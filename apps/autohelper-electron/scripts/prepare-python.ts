#!/usr/bin/env tsx

/**
 * Prepare embedded Python for Electron distribution.
 *
 * 1. Downloads python-build-standalone (install_only_stripped) for the target platform
 * 2. Extracts to python-embed/
 * 3. Installs the autohelper package via pip
 * 4. Strips __pycache__, tests, docs to reduce size
 *
 * Environment variables:
 *   TARGET_PLATFORM  — override platform (win32, darwin, linux). Defaults to process.platform.
 *   TARGET_ARCH      — override arch (x64, arm64). Defaults to process.arch.
 *   PYTHON_VERSION   — override Python version. Defaults to 3.12.
 *   PBS_RELEASE      — override python-build-standalone release tag. Defaults to 20260211.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import { execSync } from 'child_process';

const ROOT = path.resolve(__dirname, '..');
const PYTHON_EMBED_DIR = path.join(ROOT, 'python-embed');
const AUTOHELPER_DIR = path.resolve(ROOT, '..', 'autohelper');

// Configurable via env
const PLATFORM = (process.env.TARGET_PLATFORM || process.platform) as NodeJS.Platform;
const ARCH = process.env.TARGET_ARCH || process.arch;
const PYTHON_MINOR = process.env.PYTHON_VERSION || '3.12';
const PBS_RELEASE = process.env.PBS_RELEASE || '20260211';

interface PlatformConfig {
  triple: string;
  pythonBin: string;
  pipBin: string;
}

function getPlatformConfig(): PlatformConfig {
  const configs: Record<string, Record<string, PlatformConfig>> = {
    win32: {
      x64: {
        triple: 'x86_64-pc-windows-msvc',
        pythonBin: 'python.exe',
        pipBin: 'python.exe',
      },
    },
    darwin: {
      x64: {
        triple: 'x86_64-apple-darwin',
        pythonBin: 'bin/python3',
        pipBin: 'bin/python3',
      },
      arm64: {
        triple: 'aarch64-apple-darwin',
        pythonBin: 'bin/python3',
        pipBin: 'bin/python3',
      },
    },
    linux: {
      x64: {
        triple: 'x86_64-unknown-linux-gnu',
        pythonBin: 'bin/python3',
        pipBin: 'bin/python3',
      },
      arm64: {
        triple: 'aarch64-unknown-linux-gnu',
        pythonBin: 'bin/python3',
        pipBin: 'bin/python3',
      },
    },
  };

  const platformConfigs = configs[PLATFORM];
  if (!platformConfigs) {
    throw new Error(`Unsupported platform: ${PLATFORM}`);
  }

  const config = platformConfigs[ARCH];
  if (!config) {
    throw new Error(`Unsupported arch ${ARCH} for platform ${PLATFORM}`);
  }

  return config;
}

function resolveDownloadUrl(triple: string): Promise<string> {
  // Asset names use full patch versions (e.g. 3.12.12), not just minor (3.12).
  // Query the GitHub API to find the matching asset for our triple + minor version.
  const apiUrl = `https://api.github.com/repos/indygreg/python-build-standalone/releases/tags/${PBS_RELEASE}`;
  const suffix = `${triple}-install_only_stripped.tar.gz`;
  const prefix = `cpython-${PYTHON_MINOR}.`;

  return new Promise((resolve, reject) => {
    https.get(apiUrl, { headers: { 'User-Agent': 'autohelper-electron' } }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`GitHub API returned ${res.statusCode} for release ${PBS_RELEASE}`));
        return;
      }

      let data = '';
      res.on('data', (chunk: string) => { data += chunk; });
      res.on('end', () => {
        try {
          const release = JSON.parse(data);
          const assets: Array<{ name: string; browser_download_url: string }> = release.assets;
          const match = assets.find(
            (a) => a.name.startsWith(prefix) && a.name.endsWith(suffix)
          );
          if (!match) {
            reject(new Error(
              `No asset matching ${prefix}*-${suffix} in release ${PBS_RELEASE}.\n` +
              `Available assets with "${triple}": ${assets.filter(a => a.name.includes(triple)).map(a => a.name).join(', ')}`
            ));
            return;
          }
          resolve(match.browser_download_url);
        } catch (e) {
          reject(new Error(`Failed to parse GitHub API response: ${e}`));
        }
      });
    }).on('error', reject);
  });
}

function download(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const get = url.startsWith('https') ? https.get : http.get;

    const request = (reqUrl: string) => {
      get(reqUrl, (res) => {
        // Follow redirects
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          request(res.headers.location);
          return;
        }

        if (res.statusCode !== 200) {
          res.resume();
          file.close();
          fs.unlinkSync(dest);
          reject(new Error(`Download failed: HTTP ${res.statusCode} for ${reqUrl}`));
          return;
        }

        const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
        let downloaded = 0;

        res.on('data', (chunk: Buffer) => {
          downloaded += chunk.length;
          if (totalBytes > 0) {
            const pct = ((downloaded / totalBytes) * 100).toFixed(1);
            process.stdout.write(`\rDownloading... ${pct}% (${(downloaded / 1024 / 1024).toFixed(1)} MB)`);
          }
        });

        res.pipe(file);
        file.on('finish', () => {
          file.close();
          console.log('\nDownload complete.');
          resolve();
        });
      }).on('error', (err) => {
        file.close();
        fs.unlinkSync(dest);
        reject(err);
      });
    };

    request(url);
  });
}

function extractTarGz(archive: string, dest: string): void {
  console.log(`Extracting to ${dest}...`);
  fs.mkdirSync(dest, { recursive: true });

  // python-build-standalone tarballs have a top-level "python/" directory
  // We extract and then move contents up if needed
  execSync(`tar -xzf "${archive}" -C "${dest}"`, { stdio: 'inherit' });

  // Check if there's a nested python/ directory and flatten
  const nested = path.join(dest, 'python');
  if (fs.existsSync(nested) && fs.statSync(nested).isDirectory()) {
    const entries = fs.readdirSync(nested);
    for (const entry of entries) {
      fs.renameSync(path.join(nested, entry), path.join(dest, entry));
    }
    fs.rmdirSync(nested);
  }
}

function installAutohelper(pythonBin: string): void {
  const python = path.join(PYTHON_EMBED_DIR, pythonBin);

  console.log('Upgrading pip...');
  execSync(`"${python}" -m pip install --upgrade pip`, {
    stdio: 'inherit',
    env: { ...process.env, PIP_DISABLE_PIP_VERSION_CHECK: '1' },
  });

  console.log(`Installing autohelper from ${AUTOHELPER_DIR}...`);
  execSync(`"${python}" -m pip install "${AUTOHELPER_DIR}"`, {
    stdio: 'inherit',
  });
}

function stripUnnecessaryFiles(): void {
  console.log('Stripping unnecessary files...');

  const patterns = [
    '**/__pycache__',
    '**/test',
    '**/tests',
    '**/testing',
    '**/*.pyc',
    '**/*.pyo',
    '**/docs',
    '**/doc',
    '**/*.md',
    '**/*.rst',
    '**/*.txt',
    '**/LICENSE*',
    '**/CHANGELOG*',
    '**/CHANGES*',
  ];

  let removed = 0;

  function walkAndRemove(dir: string): void {
    if (!fs.existsSync(dir)) return;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        const name = entry.name;
        if (
          name === '__pycache__' ||
          name === 'test' ||
          name === 'tests' ||
          name === 'testing' ||
          name === 'docs' ||
          name === 'doc'
        ) {
          fs.rmSync(fullPath, { recursive: true, force: true });
          removed++;
          continue;
        }
        walkAndRemove(fullPath);
      } else {
        const ext = path.extname(entry.name);
        if (ext === '.pyc' || ext === '.pyo') {
          fs.unlinkSync(fullPath);
          removed++;
        }
      }
    }
  }

  // Only strip inside Lib/site-packages (not the stdlib itself)
  const sitePackages =
    PLATFORM === 'win32'
      ? path.join(PYTHON_EMBED_DIR, 'Lib', 'site-packages')
      : path.join(PYTHON_EMBED_DIR, 'lib', `python${PYTHON_MINOR}`, 'site-packages');

  walkAndRemove(sitePackages);

  // Also strip __pycache__ from stdlib
  const stdlib =
    PLATFORM === 'win32'
      ? path.join(PYTHON_EMBED_DIR, 'Lib')
      : path.join(PYTHON_EMBED_DIR, 'lib', `python${PYTHON_MINOR}`);

  function removeOnlyPycache(dir: string): void {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '__pycache__') {
          fs.rmSync(fullPath, { recursive: true, force: true });
          removed++;
        } else {
          removeOnlyPycache(fullPath);
        }
      }
    }
  }

  removeOnlyPycache(stdlib);
  console.log(`Stripped ${removed} unnecessary entries.`);
}

async function main(): Promise<void> {
  // Check if already prepared
  if (fs.existsSync(PYTHON_EMBED_DIR)) {
    console.log('python-embed/ already exists. Skipping preparation.');
    console.log('To rebuild, delete python-embed/ and run again.');
    process.exit(0);
  }

  // Verify autohelper package exists
  if (!fs.existsSync(path.join(AUTOHELPER_DIR, 'pyproject.toml'))) {
    throw new Error(`autohelper package not found at ${AUTOHELPER_DIR}`);
  }

  const config = getPlatformConfig();
  const archivePath = path.join(ROOT, 'python-standalone.tar.gz');

  console.log(`Platform: ${PLATFORM} / ${ARCH}`);
  console.log(`Python: ${PYTHON_MINOR}`);
  console.log(`Resolving download URL from release ${PBS_RELEASE}...`);

  const url = await resolveDownloadUrl(config.triple);
  console.log(`Download URL: ${url}`);

  try {
    // Download
    await download(url, archivePath);

    // Extract
    extractTarGz(archivePath, PYTHON_EMBED_DIR);

    // Install autohelper
    installAutohelper(config.pythonBin);

    // Strip unnecessary files
    stripUnnecessaryFiles();

    // Report size
    const size = execSync(`du -sh "${PYTHON_EMBED_DIR}"`, { encoding: 'utf-8' }).trim();
    console.log(`\nPython embed size: ${size}`);
    console.log('Done!');
  } finally {
    // Cleanup archive
    if (fs.existsSync(archivePath)) {
      fs.unlinkSync(archivePath);
    }
  }
}

main().catch((error) => {
  console.error('Error preparing Python:', error);
  // Cleanup on failure
  if (fs.existsSync(PYTHON_EMBED_DIR)) {
    fs.rmSync(PYTHON_EMBED_DIR, { recursive: true, force: true });
  }
  process.exit(1);
});
