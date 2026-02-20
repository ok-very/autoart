import { execFile, spawn, ChildProcess } from "child_process";
import path from "path";
import net from "net";
import log from "electron-log/main";
import { app } from "electron";

let child: ChildProcess | null = null;

const MAX_CRASHES = 3;
const CRASH_WINDOW_MS = 60_000;
const crashTimestamps: number[] = [];

/**
 * Resolve the path to autohelper.exe.
 * Packaged: resources/autohelper/autohelper.exe (extraResource)
 * Dev: relative to this repo layout
 */
function getAutoHelperPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "autohelper", "autohelper.exe");
  }
  // Dev — PyInstaller output copied to apps/desktop/autohelper/
  return path.resolve(__dirname, "..", "..", "autohelper", "autohelper.exe");
}

/**
 * Check if a port is already in use (e.g., dev server running separately).
 */
function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    sock.setTimeout(1000);
    sock.once("connect", () => {
      sock.destroy();
      resolve(true);
    });
    sock.once("error", () => resolve(false));
    sock.once("timeout", () => {
      sock.destroy();
      resolve(false);
    });
    sock.connect(port, "127.0.0.1");
  });
}

/**
 * Spawn autohelper.exe as a hidden child process.
 * Skips if port 8100 is already in use (dev mode).
 */
export async function spawnAutoHelper(): Promise<void> {
  const portBusy = await isPortInUse(8100);
  if (portBusy) {
    log.info("Port 8100 already in use — skipping autohelper spawn (dev mode)");
    return;
  }

  const exePath = getAutoHelperPath();
  log.info(`Spawning: ${exePath}`);

  child = spawn(exePath, [], {
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout?.on("data", (data: Buffer) => {
    log.info(`[autohelper] ${data.toString().trimEnd()}`);
  });

  child.stderr?.on("data", (data: Buffer) => {
    log.warn(`[autohelper] ${data.toString().trimEnd()}`);
  });

  child.on("exit", (code, signal) => {
    log.info(`autohelper exited (code=${code}, signal=${signal})`);
    child = null;

    // Crash-restart with backoff
    const now = Date.now();
    crashTimestamps.push(now);
    // Prune old timestamps
    while (crashTimestamps.length > 0 && now - crashTimestamps[0] > CRASH_WINDOW_MS) {
      crashTimestamps.shift();
    }

    if (crashTimestamps.length <= MAX_CRASHES) {
      log.info("Restarting autohelper...");
      spawnAutoHelper().catch((err) => log.error("Restart failed:", err));
    } else {
      log.error(
        `autohelper crashed ${MAX_CRASHES} times in ${CRASH_WINDOW_MS / 1000}s — not restarting`,
      );
    }
  });
}

/**
 * Poll the health endpoint until it responds 200 or timeout.
 */
export async function waitForHealth(
  url: string,
  timeoutMs = 30_000,
  intervalMs = 500,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const ok = await fetch(url).then((r) => r.ok);
      if (ok) return;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Health check timed out after ${timeoutMs}ms`);
}

/**
 * Kill the child process.
 */
export function killAutoHelper(): void {
  if (!child) return;

  const pid = child.pid;
  log.info(`Killing autohelper (pid=${pid})`);

  try {
    child.kill();
  } catch {
    // ignore
  }

  // Fallback: taskkill on Windows
  if (pid && process.platform === "win32") {
    try {
      execFile("taskkill", ["/F", "/PID", String(pid)], (err) => {
        if (err) log.warn("taskkill fallback failed:", err.message);
      });
    } catch {
      // best effort
    }
  }

  child = null;
}
