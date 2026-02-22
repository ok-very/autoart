import { Tray, Menu, BrowserWindow, nativeImage, app } from 'electron';
import * as http from 'http';
import * as path from 'path';
import { showWindow, hideWindow } from './window.js';

let tray: Tray | null = null;
let statusCheckInterval: NodeJS.Timeout | null = null;

export function createTray(window: BrowserWindow): Tray {
  if (tray) {
    return tray;
  }

  // Create tray icon
  const iconPath = path.join(app.getAppPath(), 'assets', 'tray-icon.png');
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon.resize({ width: 16, height: 16 }));

  tray.setToolTip('AutoHelper');

  // Build initial menu
  updateTrayMenu('Checking...');

  // Handle tray click
  tray.on('click', () => {
    if (window.isVisible()) {
      hideWindow();
    } else {
      showWindow();
    }
  });

  // Start status polling
  startStatusPolling();

  return tray;
}

function updateTrayMenu(status: string): void {
  if (!tray) return;

  const menu = Menu.buildFromTemplate([
    {
      label: 'AutoHelper',
      enabled: false
    },
    {
      label: `Status: ${status}`,
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'Open Dashboard',
      click: () => showWindow()
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(menu);
}

function startStatusPolling(): void {
  // Initial check
  checkBackendStatus();

  // Poll every 10 seconds
  statusCheckInterval = setInterval(() => {
    checkBackendStatus();
  }, 10000);
}

function checkBackendStatus(): void {
  const req = http.get('http://127.0.0.1:8100/health', (res) => {
    if (res.statusCode === 200) {
      updateTrayMenu('Running');
    } else {
      updateTrayMenu('Error');
    }
    res.resume();
  });

  req.on('error', () => {
    updateTrayMenu('Offline');
  });

  req.setTimeout(2000, () => {
    req.destroy();
    updateTrayMenu('Timeout');
  });
}

export function destroyTray(): void {
  if (statusCheckInterval) {
    clearInterval(statusCheckInterval);
    statusCheckInterval = null;
  }

  if (tray) {
    tray.destroy();
    tray = null;
  }
}
