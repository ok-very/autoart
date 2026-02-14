import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import * as http from 'http';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';

export class PythonManager extends EventEmitter {
  private pythonProcess: ChildProcess | null = null;
  private logStream: fs.WriteStream | null = null;
  private isReady = false;

  async start(): Promise<void> {
    if (this.pythonProcess) {
      throw new Error('Python process already running');
    }

    const pythonPath = this.resolvePythonPath();
    const logPath = path.join(app.getPath('userData'), 'python-backend.log');

    this.logStream = fs.createWriteStream(logPath, { flags: 'a' });
    this.logStream.write(`\n=== Starting Python Backend at ${new Date().toISOString()} ===\n`);

    console.log(`Starting Python backend with: ${pythonPath}`);

    this.pythonProcess = spawn(pythonPath, ['-m', 'autohelper.main'], {
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    if (this.pythonProcess.stdout) {
      this.pythonProcess.stdout.on('data', (data) => {
        const message = data.toString();
        console.log('[Python]', message);
        this.logStream?.write(`[stdout] ${message}`);
      });
    }

    if (this.pythonProcess.stderr) {
      this.pythonProcess.stderr.on('data', (data) => {
        const message = data.toString();
        console.error('[Python Error]', message);
        this.logStream?.write(`[stderr] ${message}`);
      });
    }

    this.pythonProcess.on('exit', (code, signal) => {
      console.log(`Python process exited with code ${code}, signal ${signal}`);
      this.logStream?.write(`\n=== Process exited: code=${code}, signal=${signal} ===\n`);
      this.isReady = false;
      this.emit('exit', code, signal);
      this.cleanup();
    });

    this.pythonProcess.on('error', (error) => {
      console.error('Python process error:', error);
      this.logStream?.write(`\n=== Process error: ${error.message} ===\n`);
      this.emit('error', error);
      this.cleanup();
    });
  }

  async waitForReady(timeoutMs = 15000): Promise<void> {
    const startTime = Date.now();
    const pollInterval = 500;

    while (Date.now() - startTime < timeoutMs) {
      try {
        const isHealthy = await this.checkHealth();
        if (isHealthy) {
          this.isReady = true;
          this.emit('ready');
          console.log('Python backend is ready');
          return;
        }
      } catch (error) {
        // Continue polling
      }
      await this.sleep(pollInterval);
    }

    throw new Error(`Python backend did not become ready within ${timeoutMs}ms`);
  }

  private checkHealth(): Promise<boolean> {
    return new Promise((resolve) => {
      const req = http.get('http://127.0.0.1:8100/health', (res) => {
        resolve(res.statusCode === 200);
        res.resume(); // Consume response
      });

      req.on('error', () => {
        resolve(false);
      });

      req.setTimeout(1000, () => {
        req.destroy();
        resolve(false);
      });
    });
  }

  async stop(): Promise<void> {
    if (!this.pythonProcess) {
      return;
    }

    console.log('Stopping Python backend...');
    this.logStream?.write(`\n=== Stopping backend at ${new Date().toISOString()} ===\n`);

    // Attempt graceful shutdown via HTTP endpoint first
    try {
      await this.requestShutdown();
      console.log('Shutdown request sent, waiting for process to exit...');
    } catch (error) {
      console.log('Shutdown endpoint unavailable, falling back to signal');
    }

    return new Promise((resolve) => {
      const proc = this.pythonProcess!;

      const forceKillTimeout = setTimeout(() => {
        console.log('Force killing Python process...');
        proc.kill('SIGKILL');
      }, 5000);

      proc.on('exit', () => {
        clearTimeout(forceKillTimeout);
        this.cleanup();
        resolve();
      });

      // If process hasn't started exiting yet, send signal as fallback
      if (!proc.killed) {
        if (process.platform === 'win32') {
          proc.kill('SIGKILL');
        } else {
          proc.kill('SIGTERM');
        }
      }
    });
  }

  private requestShutdown(): Promise<void> {
    return new Promise((resolve, reject) => {
      const req = http.request(
        'http://127.0.0.1:8100/shutdown',
        { method: 'POST', timeout: 2000 },
        (res) => {
          res.resume();
          resolve();
        }
      );
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Shutdown request timed out'));
      });
      req.end();
    });
  }

  async restart(maxRetries = 3): Promise<void> {
    await this.stop();

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.start();
        await this.waitForReady();
        console.log(`Python backend restarted successfully (attempt ${attempt})`);
        return;
      } catch (error) {
        console.error(`Restart attempt ${attempt} failed:`, error);
        if (attempt === maxRetries) {
          throw new Error(`Failed to restart Python backend after ${maxRetries} attempts`);
        }
        await this.sleep(2000);
      }
    }
  }

  private cleanup(): void {
    this.pythonProcess = null;
    this.isReady = false;
    if (this.logStream) {
      this.logStream.end();
      this.logStream = null;
    }
  }

  private resolvePythonPath(): string {
    const isDev = !app.isPackaged;

    if (isDev) {
      // Development: use virtual environment
      const platform = process.platform;
      const venvPath = path.join(app.getAppPath(), '..', 'autohelper', '.venv');

      if (platform === 'win32') {
        return path.join(venvPath, 'Scripts', 'python.exe');
      } else {
        return path.join(venvPath, 'bin', 'python3');
      }
    } else {
      // Production: use embedded Python
      const pythonDir = path.join(process.resourcesPath, 'python');

      if (process.platform === 'win32') {
        return path.join(pythonDir, 'python.exe');
      } else {
        return path.join(pythonDir, 'bin', 'python3');
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getReady(): boolean {
    return this.isReady;
  }
}
