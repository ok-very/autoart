import { app, BrowserWindow } from 'electron';
import * as path from 'path';

let mainWindow: BrowserWindow | null = null;

export function createWindow(): BrowserWindow {
  if (mainWindow && !mainWindow.isDestroyed()) {
    return mainWindow;
  }

  mainWindow = new BrowserWindow({
    width: 900,
    height: 680,
    minWidth: 600,
    minHeight: 400,
    title: 'AutoHelper',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  if (app.isPackaged) {
    // Production: load bundled React dashboard
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  } else {
    // Development: load Vite dev server
    mainWindow.loadURL('http://localhost:5174');
  }

  // Close to tray unless app is actually quitting
  mainWindow.on('close', (event) => {
    if (!(app as any).isQuitting && mainWindow && !mainWindow.isDestroyed()) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

export function showWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
  } else {
    mainWindow.show();
    mainWindow.focus();
  }
}

export function hideWindow(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.hide();
  }
}

export function getWindow(): BrowserWindow | null {
  return mainWindow;
}
