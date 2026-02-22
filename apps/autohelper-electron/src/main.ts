import { app, BrowserWindow } from 'electron';
import { autoUpdater } from 'electron-updater';
import { PythonManager } from './python-manager.js';
import { createWindow, getWindow } from './window.js';
import { createTray, destroyTray } from './tray.js';

const pythonManager = new PythonManager();
let isQuitting = false;

// Single instance lock
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const mainWindow = getWindow();
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// App ready handler
app.on('ready', async () => {
  try {
    console.log('Starting AutoHelper...');

    // Start Python backend
    await pythonManager.start();
    console.log('Python backend started, waiting for ready...');

    await pythonManager.waitForReady();
    console.log('Python backend is ready');

    // Create main window
    const mainWindow = createWindow();

    // Create system tray
    createTray(mainWindow);

    // Setup auto-updater
    setupAutoUpdater();

    console.log('AutoHelper startup complete');
  } catch (error) {
    console.error('Failed to start AutoHelper:', error);
    app.quit();
  }
});

// Prevent quit on window close (stay in tray)
app.on('window-all-closed', () => {
  // Do nothing — tray keeps the app alive
});

// Handle app quit
app.on('before-quit', async () => {
  isQuitting = true;
  (app as any).isQuitting = true;
  destroyTray();

  try {
    console.log('Stopping Python backend...');
    await pythonManager.stop();
    console.log('Python backend stopped');
  } catch (error) {
    console.error('Error stopping Python backend:', error);
  }
});

// Auto-updater setup
function setupAutoUpdater(): void {
  if (!app.isPackaged) {
    console.log('Running in dev mode, skipping auto-updater');
    return;
  }

  autoUpdater.checkForUpdatesAndNotify();

  autoUpdater.on('update-available', (info) => {
    console.log('Update available:', info);
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('Update downloaded:', info);
    // TODO: Show notification to user
  });

  autoUpdater.on('error', (error) => {
    console.error('Auto-updater error:', error);
  });

  // Check for updates every hour
  setInterval(() => {
    autoUpdater.checkForUpdatesAndNotify();
  }, 3600000);
}

// Python manager event handlers
pythonManager.on('error', (error) => {
  console.error('Python backend error:', error);
  // TODO: Show error notification to user
});

pythonManager.on('exit', (code, signal) => {
  console.log(`Python backend exited: code=${code}, signal=${signal}`);
  if (!isQuitting) {
    // Attempt restart
    console.log('Attempting to restart Python backend...');
    pythonManager.restart().catch((error) => {
      console.error('Failed to restart Python backend:', error);
      // TODO: Show critical error to user
    });
  }
});
