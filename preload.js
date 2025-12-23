const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getRunningApps: () => ipcRenderer.invoke('get-running-apps'),
  startSession: (payload) => ipcRenderer.invoke('start-session', payload),
  stopSession: () => ipcRenderer.invoke('stop-session'),
  setLocked: (locked) => ipcRenderer.send('set-locked', locked),
  requestFullscreen: () => ipcRenderer.send('request-fullscreen'),
  exitFullscreen: () => ipcRenderer.send('exit-fullscreen'),
  onBreakAttempt: (callback) => {
    ipcRenderer.on('break-attempt', (event, data) => callback(data));
  },
  onHostsBlockingError: (callback) => {
    ipcRenderer.on('hosts-blocking-error', (event, data) => callback(data));
  },
  onHostsBlockingSuccess: (callback) => {
    ipcRenderer.on('hosts-blocking-success', (event, data) => callback(data));
  },
  onHostsBlockingPrompt: (callback) => {
    ipcRenderer.on('hosts-blocking-prompt', (event, data) => callback(data));
  },
  removeBreakAttemptListener: () => {
    ipcRenderer.removeAllListeners('break-attempt');
    ipcRenderer.removeAllListeners('hosts-blocking-error');
    ipcRenderer.removeAllListeners('hosts-blocking-success');
    ipcRenderer.removeAllListeners('hosts-blocking-prompt');
  },
  // Auto-updater API
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  quitAndInstall: () => ipcRenderer.invoke('quit-and-install'),
  restartAndInstall: () => ipcRenderer.send('restart-and-install'),
  onUpdateStatus: (callback) => {
    ipcRenderer.on('update-status', (event, data) => callback(data));
  },
  onUpdateProgress: (callback) => {
    ipcRenderer.on('update-progress', (event, data) => callback(data));
  }
});
