const { app, BrowserWindow, ipcMain, session, dialog, shell } = require('electron');
const path = require('path');
// REMOVED: activeWin - using AppleScript instead (works in built apps)
const sudo = require('sudo-prompt');
const fs = require('fs');
const http = require('http');
const https = require('https');
const { exec } = require('child_process');
const httpProxy = require('http-proxy');
const net = require('net');
let autoUpdater = null; // Lazy-loaded after app ready

let mainWindow = null;
let isLocked = false;
let allowedApps = [];
let allowedSites = [];
let googleAlwaysAllowed = true; // Whether google.com is always allowed
let appMonitorInterval = null;
let webRequestListener = null;
let isQuitting = false;
let monitoringPaused = false; // Flag to temporarily pause monitoring
let accessibilityPermissionChecked = false;
let hasAccessibilityPermission = false;
let logHistory = []; // Store logs for UI display
const MAX_LOG_HISTORY = 100;

// Get writable directory (works in both dev and built app)
// In built app, __dirname is inside .asar (read-only), so use userData
// Initialize after app is ready
let appDataPath = null;
let hostsBackupPath = null;
let hostsOriginalPath = process.platform === 'win32' 
  ? 'C:\\Windows\\System32\\drivers\\etc\\hosts'
  : '/etc/hosts';
let hostsModified = false;

// Initialize app data path (call this after app is ready)
function initializeAppDataPath() {
  if (!appDataPath) {
    try {
      appDataPath = app.getPath('userData');
      // Ensure directory exists
      if (!fs.existsSync(appDataPath)) {
        fs.mkdirSync(appDataPath, { recursive: true });
      }
      safeLog('App data path:', appDataPath);
    } catch (e) {
      safeError('Failed to get userData path, using fallback:', e);
      // Fallback for edge cases
      appDataPath = path.join(require('os').homedir(), '.0per8r');
      try {
        if (!fs.existsSync(appDataPath)) {
          fs.mkdirSync(appDataPath, { recursive: true });
        }
      } catch (e2) {
        // Last resort - use temp directory
        appDataPath = require('os').tmpdir();
        safeError('Using temp directory as last resort:', appDataPath);
      }
    }
    hostsBackupPath = path.join(appDataPath, 'hosts.backup');
  }
  return appDataPath;
}
let dohBackups = {}; // Store DoH settings backups
let safariDNSBackups = {}; // Store Safari DNS settings
let pacServer = null; // HTTP server for serving PAC file
let blockingProxyServer = null; // Actual proxy server that blocks connections
let proxyPort = 3128; // Port for the blocking proxy server
let currentAllowedDomains = []; // Domains allowed through the proxy

// Write log to file
function writeLogToFile(message) {
  try {
    const logPath = path.join(initializeAppDataPath(), 'app.log');
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logPath, `[${timestamp}] ${message}\n`);
  } catch (e) {
    // Ignore file write errors
  }
}

// Safe console logging that won't crash during shutdown
function safeLog(...args) {
  if (isQuitting) return;
  try {
    const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    console.log(...args);
    
    // Write to file
    writeLogToFile(message);
    
    // Add to log history
    const timestamp = new Date().toLocaleTimeString();
    logHistory.push(`[${timestamp}] ${message}`);
    if (logHistory.length > MAX_LOG_HISTORY) {
      logHistory.shift(); // Remove oldest
    }
    
    // Send to renderer if window exists
    if (mainWindow && !mainWindow.isDestroyed()) {
      try {
        mainWindow.webContents.send('log-message', message);
      } catch (e) {
        // Ignore if window is closing
      }
    }
  } catch (e) {
    // Ignore write errors during shutdown
  }
}

function safeError(...args) {
  if (isQuitting) return;
  try {
    const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    console.error(...args);
    
    // Write to file
    writeLogToFile(`ERROR: ${message}`);
    
    // Add to log history
    const timestamp = new Date().toLocaleTimeString();
    logHistory.push(`[${timestamp}] ERROR: ${message}`);
    if (logHistory.length > MAX_LOG_HISTORY) {
      logHistory.shift();
    }
    
    // Send to renderer if window exists
    if (mainWindow && !mainWindow.isDestroyed()) {
      try {
        mainWindow.webContents.send('log-message', `ERROR: ${message}`);
      } catch (e) {
        // Ignore
      }
    }
  } catch (e) {
    // Ignore write errors during shutdown
  }
}

// Website blocking now uses Electron's session API to block ALL requests
// except google.com (and subdomains) and explicitly allowed sites
// No need for a list - everything is blocked by default

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1200,
    minHeight: 800,
    backgroundColor: '#0a0a0f',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true,
      sandbox: false,
      offscreen: false // Disable offscreen rendering
    },
    show: false
  });

  // Don't auto-open DevTools - it can cause issues
  // mainWindow.webContents.openDevTools();

  // Enable console logging
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer ${level}] ${message}`);
  });

  mainWindow.loadFile('index.html').catch(err => {
    safeError('Failed to load index.html:', err);
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    safeError('Failed to load page:', errorCode, errorDescription, validatedURL);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.executeJavaScript(`
        document.body.innerHTML = '<div style="padding: 20px; color: white; font-family: monospace;"><h1>Failed to Load</h1><p>Error: ${errorDescription}</p><p>Code: ${errorCode}</p></div>';
      `);
    }
  });

  mainWindow.webContents.on('render-process-gone', (event, details) => {
    safeError('Renderer process gone! Reason:', details.reason, 'Exit code:', details.exitCode);
    // Don't try to execute JavaScript on a crashed process
  });
  
  mainWindow.webContents.on('unresponsive', () => {
    safeError('Renderer process unresponsive!');
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Block navigation to unauthorized sites
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    if (!isLocked) return;
    
    const domain = getDomainFromUrl(navigationUrl);
    if (!domain) {
      event.preventDefault();
      safeLog(`🚫 Blocked navigation (invalid): ${navigationUrl}`);
      return;
    }
    
    // Allow google.com and all subdomains (if toggle is enabled)
    if (googleAlwaysAllowed) {
      if (domain === 'google.com' || domain.endsWith('.google.com')) {
        return; // Allow
      }
      
      // Allow fonts.gstatic.com for Google Fonts
      if (domain === 'fonts.gstatic.com' || domain.endsWith('.gstatic.com')) {
        return; // Allow
      }
    }
    
    // Check allowed sites
    const normalizedAllow = allowedSites.map(d => {
      let cleaned = d.toLowerCase().trim();
      cleaned = cleaned.replace(/^https?:\/\//, '');
      cleaned = cleaned.replace(/^www\./, '');
      cleaned = cleaned.replace(/\/.*$/, '');
      return cleaned;
    }).filter(Boolean);
    
    const isAllowed = normalizedAllow.some(allowed => {
      if (domain === allowed) return true;
      if (domain.endsWith('.' + allowed)) return true;
      if (allowed.endsWith('.' + domain)) return true;
      return false;
    });
    
    if (!isAllowed) {
      event.preventDefault();
      safeLog(`🚫 Blocked navigation: ${navigationUrl} (domain: ${domain})`);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('break-attempt', { type: 'navigation_blocked', url: navigationUrl });
      }
    }
  });

  // Prevent new windows from opening
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!isLocked) {
      return { action: 'allow' };
    }
    
    const domain = getDomainFromUrl(url);
    if (!domain) {
      safeLog(`🚫 Blocked new window (invalid): ${url}`);
      return { action: 'deny' };
    }
    
    // Allow google.com (if toggle is enabled)
    if (googleAlwaysAllowed) {
      if (domain === 'google.com' || domain.endsWith('.google.com')) {
        return { action: 'allow' };
      }
      if (domain === 'fonts.gstatic.com' || domain.endsWith('.gstatic.com')) {
        return { action: 'allow' };
      }
    }
    
    // Check allowed sites
    const normalizedAllow = allowedSites.map(d => {
      let cleaned = d.toLowerCase().trim();
      cleaned = cleaned.replace(/^https?:\/\//, '');
      cleaned = cleaned.replace(/^www\./, '');
      cleaned = cleaned.replace(/\/.*$/, '');
      return cleaned;
    }).filter(Boolean);
    
    const isAllowed = normalizedAllow.some(allowed => {
      if (domain === allowed) return true;
      if (domain.endsWith('.' + allowed)) return true;
      if (allowed.endsWith('.' + domain)) return true;
      return false;
    });
    
    if (!isAllowed) {
      safeLog(`🚫 Blocked new window: ${url} (domain: ${domain})`);
      return { action: 'deny' };
    }
    
    return { action: 'allow' };
  });

  mainWindow.on('close', async (event) => {
    // If focus mode is active, require account password (3 times) before closing
    if (isLocked) {
      event.preventDefault(); // Prevent immediate close
      
      try {
        // Show confirmation dialog first
        const { response } = await dialog.showMessageBox(mainWindow, {
          type: 'question',
          buttons: ['Cancel', 'Quit'],
          defaultId: 1,
          cancelId: 0,
          title: 'Quit 0per8r?',
          message: 'Are you certain you want to quit?',
          detail: 'You will need to enter your ACCOUNT password 3 times to confirm.'
        });
        
        if (response === 0) {
          // User cancelled
          return;
        }
        
        // Request password verification from renderer (3 attempts)
        const passwordVerified = await new Promise((resolve) => {
          if (!mainWindow || mainWindow.isDestroyed()) {
            resolve(false);
            return;
          }
          
          // Send message to renderer to show password prompt (3 attempts)
          mainWindow.webContents.send('request-quit-password', { attempts: 3 });
          
          // Set up listener for password response
          const passwordListener = (event, verified) => {
            ipcMain.removeListener('quit-password-verified', passwordListener);
            resolve(verified === true);
          };
          
          ipcMain.once('quit-password-verified', passwordListener);
          
          // Timeout after 60 seconds (longer for 3 attempts)
          setTimeout(() => {
            ipcMain.removeListener('quit-password-verified', passwordListener);
            resolve(false);
          }, 60000);
        });
        
        if (!passwordVerified) {
          // Password incorrect or cancelled
          return;
        }
        
        // Password verified - now restore blocking (system password prompts are OK - blocking MUST work)
        // Stop monitoring first
        isQuitting = true;
        stopMonitoring();
        
        // Restore blocking - system password prompts are acceptable to ensure blocking is properly restored
        safeLog('Restoring system-wide blocking after password verification...');
        safeLog('System password prompt will appear to restore proxy settings and hosts file.');
        
        // Wait for restore to complete before closing
        try {
          // Restore system-wide blocking (proxy + hosts file in ONE password prompt, then DoH)
          // restoreCombinedBlockingPromise includes both proxy and hosts file restoration
          await new Promise((resolve) => {
            restoreCombinedBlockingPromise().then(() => resolve()).catch(() => resolve());
          });
          
          // DoH restoration doesn't need sudo, so do it separately
          await new Promise((resolve) => {
            restoreDoHPromise().then(() => resolve()).catch(() => resolve());
          });
          
          safeLog('✅ All blocking restore operations completed');
        } catch (e) {
          safeError('Error during restore:', e);
        }
        
        // Also clean up app-level blocking
        removeWebRequestBlocking();
        
        // Stop servers
        if (blockingProxyServer) {
          blockingProxyServer.close();
          blockingProxyServer = null;
        }
        if (pacServer) {
          pacServer.close();
          pacServer = null;
        }
        
        // Allow close
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.destroy();
        }
      } catch (e) {
        safeError('Error in close handler:', e);
        return;
      }
    } else {
      // Not in focus mode, just clean up
      isQuitting = true;
      stopMonitoring();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Helper function to extract domain from URL (used by navigation blocking)
function getDomainFromUrl(url) {
  try {
    const urlObj = new URL(url);
    let hostname = urlObj.hostname.toLowerCase();
    if (hostname.startsWith('www.')) {
      hostname = hostname.substring(4);
    }
    return hostname;
  } catch (e) {
    return null;
  }
}

async function getRunningApps() {
  if (process.platform === 'darwin') {
    const { exec } = require('child_process');
    return new Promise((resolve) => {
      exec(
        'osascript -e \'tell application "System Events" to get name of every process whose background only is false\'',
        (error, stdout) => {
          if (error) return resolve([]);
          const apps = stdout
            .split(',')
            .map((a) => a.trim())
            .filter((a) => a && !a.toLowerCase().includes('osascript') && !a.toLowerCase().includes('0per8r'));
          resolve(apps);
        }
      );
    });
  }
  return [];
}

// Simple kill function - not used anymore (killing happens directly in monitorActiveApp)
function quitApp(appName) {
  if (process.platform === 'darwin') {
    const { exec } = require('child_process');
    exec(`killall "${appName}"`, () => {});
  }
}

// Force reload all browser tabs to ensure cached content is blocked
function reloadAllBrowserTabs() {
  if (process.platform !== 'darwin') return;
  
  const { exec } = require('child_process');
  
  // Reload Safari tabs
  const safariScript = `
    tell application "Safari"
      if it is running then
        repeat with w in windows
          repeat with t in tabs of w
            try
              set URL of t to URL of t
            end try
          end repeat
        end repeat
      end if
    end tell
  `;
  
  exec(`osascript -e '${safariScript}'`, (error) => {
    if (!error) {
      safeLog('✅ Safari tabs reloaded');
    }
  });
  
  // Reload Chrome tabs (using Chrome's AppleScript support)
  const chromeScript = `
    tell application "Google Chrome"
      if it is running then
        repeat with w in windows
          repeat with t in tabs of w
            try
              reload t
            end try
          end repeat
        end repeat
      end if
    end tell
  `;
  
  exec(`osascript -e '${chromeScript}'`, (error) => {
    if (!error) {
      safeLog('✅ Chrome tabs reloaded');
    }
  });
  
  // Reload Firefox tabs (Firefox doesn't have great AppleScript support, but we can try)
  // Firefox requires different approach - we'll use keyboard shortcuts
  // For now, just log that we attempted it
  safeLog('Browser tabs reload initiated - all open tabs will make new requests through proxy');
}

// Quit all browsers to ensure proxy blocking takes effect on all connections
function quitAllBrowsers(callback) {
  if (process.platform !== 'darwin') {
    if (callback) callback();
    return;
  }
  
  const browsers = ['Safari', 'Google Chrome', 'Chrome', 'Firefox', 'Microsoft Edge', 'Opera', 'Brave Browser'];
  const { exec } = require('child_process');
  let quitCount = 0;
  let checkCount = 0;
  const totalBrowsers = browsers.length;
  
  browsers.forEach(browser => {
    // Try to quit browser directly (will fail silently if not running)
    safeLog(`Quitting ${browser} to apply proxy blocking...`);
    exec(`osascript -e 'tell application "${browser}" to quit'`, (error) => {
      checkCount++;
      if (!error) {
        quitCount++;
        safeLog(`✅ ${browser} quit successfully`);
      }
      
      // When all browsers checked, call callback
      if (checkCount === totalBrowsers) {
        safeLog(`Quit ${quitCount} browser(s). Waiting for connections to close...`);
        // Small delay to ensure connections are fully closed
        setTimeout(() => {
          if (callback) callback();
        }, 1000);
      }
    });
  });
  
  // If no browsers to check, call callback immediately
  if (totalBrowsers === 0 && callback) {
    callback();
  }
}

// Get active app - WORKS WITH JUST ACCESSIBILITY PERMISSION (no Automation needed)
// macOS: Uses lsappinfo which only requires Accessibility permission
// Windows: Uses PowerShell to get foreground window
async function getActiveAppAppleScript() {
  return new Promise((resolve, reject) => {
    const { exec } = require('child_process');
    
    if (process.platform === 'win32') {
      // Windows: Use PowerShell to get foreground window process
      const psScript = `Add-Type @\"using System;using System.Runtime.InteropServices;public class Win32{[DllImport(\"user32.dll\")]public static extern IntPtr GetForegroundWindow();[DllImport(\"user32.dll\")]public static extern int GetWindowThreadProcessId(IntPtr hWnd,out uint ProcessId);}\"@;$hwnd=[Win32]::GetForegroundWindow();$pid=0;[Win32]::GetWindowThreadProcessId($hwnd,[ref]$pid);$proc=Get-Process -Id $pid -ErrorAction SilentlyContinue;if($proc){Write-Output $proc.ProcessName}`;
      
      exec(`powershell -Command "${psScript}"`, (error, stdout, stderr) => {
        if (!error && stdout && stdout.trim()) {
          resolve(stdout.trim());
        } else {
          reject(new Error('Could not get active app on Windows'));
        }
      });
      return;
    }
    
    // macOS: Try AppleScript first (works in local dev, requires Automation in built apps)
    exec(`osascript -e 'tell application "System Events" to get name of first application process whose frontmost is true' 2>&1`, (error, stdout, stderr) => {
      const output = stdout ? stdout.trim() : '';
      
      // If AppleScript works, use it
      if (!error && output && !output.includes('Not authorised') && !output.includes('execution error') && output.length > 0) {
        resolve(output);
        return;
      }
      
      // Method 2: Use lsappinfo (ONLY needs Accessibility permission - works in built apps!)
      safeLog('Using lsappinfo method (only needs Accessibility permission)...');
      // Get ASN of frontmost app
      exec(`lsappinfo front | grep -o 'ASN:[^"]*' | head -1`, (err2, stdout2) => {
        if (!err2 && stdout2 && stdout2.trim()) {
          const asn = stdout2.trim();
          safeLog(`Got ASN: ${asn}`);
          // Get app name from ASN
          exec(`lsappinfo info -only name "${asn}" 2>&1`, (err3, stdout3) => {
            if (!err3 && stdout3) {
              // Extract app name from output like: "LSDisplayName"="Cursor"
              const match = stdout3.match(/"LSDisplayName"="([^"]+)"/);
              if (match && match[1]) {
                safeLog(`Got app name from lsappinfo: "${match[1]}"`);
                resolve(match[1]);
                return;
              } else {
                safeLog('Could not parse LSDisplayName, trying bundle ID...');
              }
            }
            
            // Fallback: Try to get from bundle ID
            exec(`lsappinfo info -only bundleid "${asn}" 2>&1`, (err4, stdout4) => {
              if (!err4 && stdout4) {
                const bundleMatch = stdout4.match(/"LSBundleIdentifier"="([^"]+)"/);
                if (bundleMatch && bundleMatch[1]) {
                  // Extract app name from bundle ID (e.g., com.todesktop.230313mzl4w4u92 -> Cursor)
                  const bundleId = bundleMatch[1];
                  const appName = bundleId.split('.').pop();
                  safeLog(`Got app name from bundle ID: "${appName}"`);
                  resolve(appName);
                } else {
                  safeError('Could not get app name from bundle ID');
                  reject(new Error('Could not get app name from bundle ID'));
                }
              } else {
                safeError('lsappinfo bundleid failed:', err4 ? err4.message : 'unknown error');
                reject(new Error('Could not get active app - please grant Accessibility permission'));
              }
            });
          });
        } else {
          safeError('Could not get frontmost app ASN:', err2 ? err2.message : 'no output');
          reject(new Error('Could not get frontmost app ASN - please grant Accessibility permission'));
        }
      });
    });
  });
}

// Check accessibility permission - WORKS WITH JUST ACCESSIBILITY PERMISSION
async function checkAccessibilityPermission() {
  if (accessibilityPermissionChecked) {
    return hasAccessibilityPermission;
  }
  
  safeLog('🔐 Checking accessibility permission...');
  
  if (process.platform === 'win32') {
    safeLog('   Platform: Windows (no permission needed, using PowerShell)');
    // Windows doesn't need special permissions for PowerShell
    try {
      const appName = await getActiveAppAppleScript();
      if (appName && appName.trim()) {
        hasAccessibilityPermission = true;
        accessibilityPermissionChecked = true;
        safeLog('✅ App blocking ENABLED on Windows');
        safeLog(`   Active app detected: "${appName}"`);
        return true;
      }
    } catch (err) {
      safeLog('⚠️ Could not detect active app on Windows:', err.message);
    }
    hasAccessibilityPermission = false;
    accessibilityPermissionChecked = true;
    return false;
  }
  
  safeLog('   Platform: macOS - Method: lsappinfo/ps (only needs Accessibility permission, NOT Automation)');
  
  try {
    const appName = await getActiveAppAppleScript();
    if (appName && appName.trim() && !appName.includes('Could not')) {
      hasAccessibilityPermission = true;
      accessibilityPermissionChecked = true;
      safeLog('✅ Permission GRANTED - app blocking ENABLED');
      safeLog(`   Active app detected: "${appName}"`);
      return true;
    } else {
      safeLog('⚠️ Could not detect active app');
    }
  } catch (err) {
    safeLog('⚠️ Permission check failed:', err.message);
  }
  
  hasAccessibilityPermission = false;
  accessibilityPermissionChecked = true;
  safeLog('⚠️ Permission NOT granted - app blocking DISABLED');
  safeLog('   To enable app blocking:');
  safeLog('   1. Open System Settings → Privacy & Security → Accessibility');
  safeLog('   2. Add 0per8r to the list');
  safeLog('   3. Restart the app');
  return false;
}

let blockCount = 0;

// Monitor active app - EXACT SAME LOGIC AS LOCAL
async function monitorActiveApp() {
  if (!isLocked) return;
  if (isQuitting) return;
  if (monitoringPaused) return;
  
  try {
    // Get active app using AppleScript
    const activeName = await getActiveAppAppleScript();
    
    if (!activeName || !activeName.trim()) {
      return;
    }
    
    // Clean app name (remove .app extension)
    let cleanName = activeName.trim();
    cleanName = cleanName.replace(/\.app$/, '').replace(/\.exe$/, '');
    if (!cleanName) return;
    
    const normalizedActive = cleanName.toLowerCase();
    
    // Log every 20th check
    blockCount++;
    if (blockCount % 20 === 0) {
      safeLog(`📊 Monitoring: "${cleanName}" (check #${blockCount})`);
    }

    // System processes that are always allowed
    const systemProcesses = process.platform === 'win32' ? [
      'explorer',      // Windows Explorer
      'winlogon',      // Windows login
      'dwm',           // Desktop Window Manager
      'csrss',         // Client/Server Runtime Subsystem
      'lsass',         // Local Security Authority
      'services',      // Services
      'smss',          // Session Manager
      'taskhostw',     // Task host
      'svchost',       // Service host
      'task manager',  // Escape hatch to end stuck processes
      'taskmgr',
      '0per8r',        // This app
      'electron',      // Electron
      '0per8r.exe',    // This app (exe)
      'electron.exe'   // Electron (exe)
    ] : [
      'securityagent', // macOS password prompt
      'osascript',     // AppleScript
      'sudo',          // sudo prompt
      'system events', // System Events
      'system preferences', // System Preferences
      'system settings',    // System Settings
      'loginwindow',   // Login window
      'windowserver',  // Window Server
      'dock',          // Dock
      'finder',        // Finder
      'activity monitor', // Always allow — escape hatch if you need to force quit
      'terminal',      // Allow kill commands if needed
      '0per8r',        // This app
      'electron',      // Electron
      'electron helper', // Electron helper
      'electron helper (renderer)', // Electron renderer
      'electron helper (gpu)',      // Electron GPU
      'electron helper (plugin)'    // Electron plugin
    ];
    
    // Normalize allowed apps
    const normalizedAllowed = allowedApps.map(a => a.toLowerCase().trim()).filter(Boolean);
    const normalizedSystem = systemProcesses.map(s => s.toLowerCase().trim());
    const allAllowed = [...normalizedAllowed, ...normalizedSystem];

    // Check if app is allowed - exact match only (simpler, more reliable)
    const isAllowed = allAllowed.some((allowed) => {
      return normalizedActive === allowed || normalizedActive.includes(allowed) || allowed.includes(normalizedActive);
    });

    // If not allowed, KILL IT IMMEDIATELY
    if (!isAllowed) {
      safeLog(`🚫 BLOCKING: "${cleanName}"`);
      
      // Kill the app - Windows or macOS
      const { exec } = require('child_process');
      if (process.platform === 'win32') {
        // Windows: Use taskkill (try with .exe and without)
        exec(`taskkill /F /IM "${cleanName}.exe" /T 2>nul`, (error) => {
          if (error) {
            // Try without .exe extension
            exec(`taskkill /F /IM "${cleanName}" /T 2>nul`, (error2) => {
              if (error2 && !error2.message.includes('not found')) {
                safeLog(`Kill result for "${cleanName}":`, error2.message);
              }
            });
          }
        });
      } else {
        // macOS/Linux: Use killall
        exec(`killall -9 "${cleanName}" 2>/dev/null || killall "${cleanName}" 2>/dev/null`, (error) => {
          if (error && !error.message.includes('No matching processes')) {
            safeLog(`Kill result for "${cleanName}":`, error.message);
          }
        });
      }
      
      // Focus our window
      if (mainWindow && !mainWindow.isDestroyed()) {
        try {
          mainWindow.webContents.send('break-attempt', { 
            type: 'app_switch', 
            app: cleanName,
            message: `Blocked: ${cleanName}`
          });
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.focus();
        } catch (e) {}
      }
    }
  } catch (err) {
    // Only log non-permission errors
    const errMsg = err.message || String(err);
    if (!errMsg.includes('permission') && !errMsg.includes('accessibility') && !errMsg.includes('denied')) {
      safeError('monitorActiveApp error:', errMsg);
    }
  }
}

async function startMonitoring(apps, sites, allowGoogle = true) {
  allowedApps = apps || [];
  allowedSites = sites || [];
  googleAlwaysAllowed = allowGoogle !== false; // Default to true
  isLocked = true;
  monitoringPaused = false;

  safeLog('🔒 Starting focus session...');
  safeLog('Allowed apps:', allowedApps);
  safeLog('Allowed sites:', allowedSites);
  
  // Check permission (simple check - same as local)
  await checkAccessibilityPermission();
  
  // ALWAYS start monitoring - EXACT SAME AS LOCAL
  // Monitoring will work even if permission check failed initially
  // (it will just fail to get app name, but won't crash)
  safeLog('✅ Starting app monitoring...');
  
  if (appMonitorInterval) {
    clearInterval(appMonitorInterval);
    appMonitorInterval = null;
  }
  
  // Start monitoring interval - check every 0.5 seconds (SAME AS LOCAL)
  appMonitorInterval = setInterval(() => {
    monitorActiveApp().catch((err) => {
      // Log errors for debugging
      const errMsg = err.message || String(err);
      if (!errMsg.includes('permission') && !errMsg.includes('accessibility')) {
        safeError('Monitor interval error:', errMsg);
      }
    });
  }, 500);
  
  safeLog('✅ Monitoring interval started - checking every 0.5 seconds');
  safeLog(`   Interval ID: ${appMonitorInterval}`);
  safeLog('   Monitoring will start immediately...');
  
  // Immediate check with logging
  setTimeout(() => {
    safeLog('Running initial app check...');
    monitorActiveApp().catch((err) => {
      safeError('Initial check error:', err.message);
    });
  }, 100);
  
  // Apply website blocking
  setupWebRequestBlocking(allowedSites);
  
  // Apply system-wide blocking
  if (process.platform === 'darwin') {
    safeLog('Setting up system-wide blocking (macOS)...');
    setupHostsFileBlocking(allowedSites);
  } else if (process.platform === 'win32') {
    safeLog('Setting up system-wide blocking (Windows)...');
    setupWindowsBlocking(allowedSites);
  } else {
    safeLog('System-wide blocking not yet implemented for this platform - using app-level blocking only');
  }
}

function stopMonitoring() {
  safeLog('🛑 Stopping monitoring...');
  isLocked = false;
  allowedApps = [];
  allowedSites = [];
  if (appMonitorInterval) {
    clearInterval(appMonitorInterval);
    appMonitorInterval = null;
    safeLog('App monitoring interval cleared');
  }
  removeWebRequestBlocking();
  // Note: restoreCombinedBlocking() is called separately when needed (e.g., on app close)
  // This allows the close handler to show password prompt
}

// Setup web request blocking using Electron's session API
// This is more effective than hosts file - blocks at the browser level
// Blocks ALL requests except google.com and explicitly allowed sites
function setupWebRequestBlocking(allowList = []) {
  // Remove any existing listener first
  removeWebRequestBlocking();
  
  // Normalize allowed sites: remove protocol, www, trailing slashes
  const normalizedAllow = allowList.map(d => {
    let cleaned = d.toLowerCase().trim();
    cleaned = cleaned.replace(/^https?:\/\//, '');
    cleaned = cleaned.replace(/^www\./, '');
    cleaned = cleaned.replace(/\/.*$/, ''); // Remove path
    return cleaned;
  }).filter(Boolean);
  
  safeLog('Setting up blocking with allowed sites:', normalizedAllow);
  
  // Create web request listener with proper closure - ALL functions inside
  const listener = (details, callback) => {
    // CRITICAL: Callback MUST be called synchronously
    // Don't process if we're quitting
    if (isQuitting) {
      callback({ cancel: false });
      return;
    }
    
    // IMPORTANT: Only block if session is locked
    if (!isLocked) {
      callback({ cancel: false });
      return;
    }
    
    const url = details.url;
    
    // Always allow local files and app resources
    if (url.startsWith('file://') || 
        url.startsWith('data:') || 
        url.startsWith('blob:') ||
        url.startsWith('about:') ||
        url.startsWith('chrome-extension:') ||
        url.startsWith('chrome:') ||
        (!url.startsWith('http://') && !url.startsWith('https://'))) {
      callback({ cancel: false });
      return;
    }
    
    const domain = getDomainFromUrl(url);
    if (!domain) {
      safeLog(`🚫 Blocked request (invalid domain): ${url}`);
      callback({ cancel: true });
      return;
    }
    
    // Always allow google.com and ALL its subdomains (if toggle is enabled)
    if (googleAlwaysAllowed) {
      if (domain === 'google.com' || domain.endsWith('.google.com')) {
        callback({ cancel: false });
        return;
      }
      
      // Always allow fonts.gstatic.com for Google Fonts
      if (domain === 'fonts.gstatic.com' || domain.endsWith('.gstatic.com')) {
        callback({ cancel: false });
        return;
      }
    }
    
    // Check if it matches any explicitly allowed domain
    const isAllowed = normalizedAllow.some(allowed => {
      // Exact match
      if (domain === allowed) return true;
      // Subdomain match (e.g., www.example.com matches example.com)
      if (domain.endsWith('.' + allowed)) return true;
      // Parent domain match (e.g., example.com matches www.example.com)
      if (allowed.endsWith('.' + domain)) return true;
      return false;
    });
    
    if (isAllowed) {
      callback({ cancel: false });
      return;
    }
    
    // Block everything else
    safeLog(`🚫 Blocked request: ${url} (domain: ${domain})`);
    callback({ cancel: true });
  };
  
  webRequestListener = listener;
  
  // Apply to default session (affects all windows and all request types)
  const defaultSession = session.defaultSession;
  
  // Remove any existing listeners first
  try {
    defaultSession.webRequest.onBeforeRequest(null);
  } catch (e) {
    // Ignore
  }
  
  // Set up the blocking listener - catch ALL http and https requests
  // Use all valid resource types (removed 'other' and 'websocket' as they're not valid types)
  try {
    defaultSession.webRequest.onBeforeRequest(
      { 
        urls: ['http://*/*', 'https://*/*'],
        types: ['mainFrame', 'subFrame', 'stylesheet', 'script', 'image', 'font', 'object', 'ping', 'cspReport', 'media']
      },
      listener
    );
    
    safeLog('Web request blocking listener registered with all resource types');
    safeLog(`✅ Web request blocking enabled. Allowed: google.com, fonts.googleapis.com, fonts.gstatic.com${normalizedAllow.length > 0 ? ', ' + normalizedAllow.join(', ') : ''}`);
  } catch (e) {
    safeError('Error setting up web request blocking:', e);
    // Try with just http/https
    try {
      defaultSession.webRequest.onBeforeRequest(
        { 
          urls: ['http://*/*', 'https://*/*'],
          types: ['mainFrame', 'subFrame']
        },
        listener
      );
      safeLog('Web request blocking registered with basic types only');
    } catch (e2) {
      safeError('Failed to set up web request blocking:', e2);
    }
  }
}

// Remove web request blocking
function removeWebRequestBlocking() {
  const defaultSession = session.defaultSession;
  
  // Remove all listeners by removing and re-adding with empty handler
  try {
    defaultSession.webRequest.onBeforeRequest(null);
  } catch (e) {
    // Ignore if no listener exists
  }
  
  webRequestListener = null;
  safeLog('Web request blocking disabled');
}

// DISABLED: Hardcoded distracting domains list - completely removed
// Users now control blocking entirely through their allowed sites list
// No websites are blocked by default - only user-specified sites are allowed
const DISTRACTING_DOMAINS = []; // Empty array - no hardcoded blocking

// DISABLED: System-wide hosts file blocking - completely disabled
// Users now control blocking entirely through Electron's webRequest API
// No system-wide blocking via hosts file - only app-level blocking
function setupHostsFileBlocking(allowList = []) {
  if (process.platform !== 'darwin') {
    safeLog('System-wide blocking not yet implemented for this platform');
    return;
  }
  
  // Normalize allowed sites
  const normalizedAllow = allowList.map(d => {
    let cleaned = d.toLowerCase().trim();
    cleaned = cleaned.replace(/^https?:\/\//, '');
    cleaned = cleaned.replace(/^www\./, '');
    cleaned = cleaned.replace(/\/.*$/, '');
    return cleaned;
  }).filter(Boolean);
  
  // Build always allowed domains (google.com and fonts if enabled)
  const alwaysAllowed = [];
  if (googleAlwaysAllowed) {
    alwaysAllowed.push('google.com');
    alwaysAllowed.push('fonts.googleapis.com');
    alwaysAllowed.push('fonts.gstatic.com');
  }
  
  // For logging purposes - we block everything except allowed
  // In practice, the proxy blocks all domains with dots except those in alwaysAllowed + allowList
  const domainsToBlock = []; // Not used for actual blocking, just for logging
  
  safeLog('🔒 Setting up system-wide blocking via proxy...');
  safeLog(`   Always allowed: ${alwaysAllowed.join(', ')}`);
  safeLog(`   User allowed sites: ${normalizedAllow.join(', ') || '(none)'}`);
  
  // Use combined blocking (proxy-based) for system-wide blocking
  setupCombinedBlocking(domainsToBlock, alwaysAllowed, allowList, normalizedAllow);
}

// Start blocking proxy server that actually intercepts and blocks connections
function startBlockingProxy(allowedDomainsList) {
  if (blockingProxyServer) {
    safeLog('Blocking proxy server already running');
    return;
  }
  
  // Store allowed domains
  currentAllowedDomains = allowedDomainsList.map(d => {
    let domain = d.toLowerCase().replace(/^www\./, '');
    return domain;
  });
  
  // Helper to check if domain is allowed
  const isDomainAllowed = (hostname) => {
    if (!hostname) return false;
    const host = hostname.toLowerCase();
    
    // Allow localhost and local network
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1' ||
        host.startsWith('192.168.') || host.startsWith('10.') ||
        host.startsWith('172.16.') || host.startsWith('172.17.') ||
        host.startsWith('172.18.') || host.startsWith('172.19.') ||
        host.startsWith('172.20.') || host.startsWith('172.21.') ||
        host.startsWith('172.22.') || host.startsWith('172.23.') ||
        host.startsWith('172.24.') || host.startsWith('172.25.') ||
        host.startsWith('172.26.') || host.startsWith('172.27.') ||
        host.startsWith('172.28.') || host.startsWith('172.29.') ||
        host.startsWith('172.30.') || host.startsWith('172.31.')) {
      return true;
    }
    
    // Check against allowed domains
    for (const allowed of currentAllowedDomains) {
      if (host === allowed || host.endsWith('.' + allowed)) {
        return true;
      }
    }
    
    // Block everything else (any domain with a dot)
    return false;
  };
  
  // Create HTTP proxy server
  blockingProxyServer = http.createServer((req, res) => {
    let hostname = null;
    
    try {
      // For proxy requests, the URL in req.url is the full URL (e.g., "http://example.com/path")
      const url = req.url;
      
      // Try to parse as full URL first
      if (url.startsWith('http://') || url.startsWith('https://')) {
        const urlObj = new URL(url);
        hostname = urlObj.hostname;
      } else {
        // Fall back to Host header (for absolute URI requests)
        hostname = req.headers.host ? req.headers.host.split(':')[0] : null;
      }
      
      // Check if domain is allowed
      if (!isDomainAllowed(hostname)) {
        safeLog(`🚫 BLOCKED: ${hostname || url}`);
        res.writeHead(403, { 'Content-Type': 'text/html' });
        res.end('<html><body><h1>Blocked by 0per8r</h1><p>This website is not in your allowed list.</p></body></html>');
        return;
      }
      
      // Allow the request - use http-proxy to forward it
      const proxy = httpProxy.createProxyServer({});
      
      // Determine target URL
      let targetUrl;
      if (url.startsWith('http://') || url.startsWith('https://')) {
        targetUrl = url;
      } else {
        targetUrl = `http://${hostname}${url}`;
      }
      
      proxy.web(req, res, {
        target: targetUrl,
        changeOrigin: true,
        followRedirects: true
      }, (err) => {
        safeError('Proxy error:', err);
        if (!res.headersSent) {
          res.writeHead(502);
          res.end('Proxy error');
        }
      });
    } catch (e) {
      safeError('Request parsing error:', e);
      if (!res.headersSent) {
        res.writeHead(400);
        res.end('Bad request');
      }
    }
  });
  
  // Handle HTTPS CONNECT method (for HTTPS connections)
  blockingProxyServer.on('connect', (req, socket, head) => {
    const parts = req.url.split(':');
    const hostname = parts[0];
    const port = parseInt(parts[1]) || 443;
    
    if (!isDomainAllowed(hostname)) {
      safeLog(`🚫 BLOCKED HTTPS: ${hostname}`);
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.end();
      return;
    }
    
    // Allow HTTPS connection - establish tunnel
    const targetSocket = net.connect(port, hostname, () => {
      socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      targetSocket.pipe(socket);
      socket.pipe(targetSocket);
    });
    
    targetSocket.on('error', (err) => {
      safeError('HTTPS proxy error:', err);
      if (!socket.destroyed) {
        socket.end();
      }
    });
    
    socket.on('error', (err) => {
      safeError('Client socket error:', err);
      if (!targetSocket.destroyed) {
        targetSocket.end();
      }
    });
  });
  
  blockingProxyServer.listen(proxyPort, '127.0.0.1', () => {
    safeLog(`✅ Blocking proxy server started on port ${proxyPort}`);
  });
  
  blockingProxyServer.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      safeError(`Port ${proxyPort} already in use`);
    } else {
      safeError('Proxy server error:', e);
    }
  });
}

// Combined blocking setup - does EVERYTHING in ONE password prompt
function setupCombinedBlocking(domainsToBlock, alwaysAllowed, allowList, normalizedAllow) {
  // Start the blocking proxy server FIRST (before anything else)
  // This ensures proxy is ready to intercept connections
  safeLog('🚀 Starting blocking proxy server...');
  startBlockingProxy(alwaysAllowed);
  
  // Verify proxy server is running
  if (!blockingProxyServer) {
    safeError('❌ CRITICAL: Blocking proxy server failed to start!');
    return;
  }
  
  safeLog('✅ Blocking proxy server is running on port', proxyPort);
  
  // Note: Browsers will be quit AFTER proxy is fully configured (in success callback)
  // This ensures when browsers reopen, proxy is active and all requests are intercepted
  
  // Create PAC file first (no sudo needed) - use writable directory
  const pacFilePath = path.join(initializeAppDataPath(), 'focusos_proxy.pac');
  
  // Build PAC file content - point to our blocking proxy
  const allowedDomains = alwaysAllowed.map(d => {
    let domain = d.toLowerCase().replace(/^www\./, '');
    return `"${domain}"`;
  }).join(', ');
  
  // PAC file that blocks ALL websites except explicitly allowed ones
  // Simple and effective: blocks ANY domain with a dot (all websites have dots)
  const pacFileContent = `function FindProxyForURL(url, host) {
  // Convert to lowercase for comparison
  host = host.toLowerCase();
  
  // Always allow localhost and local network (needed for system functionality)
  if (host === "localhost" || host === "127.0.0.1" || host === "::1" || 
      host.startsWith("192.168.") || host.startsWith("10.") || 
      host.startsWith("172.16.") || host.startsWith("172.17.") || 
      host.startsWith("172.18.") || host.startsWith("172.19.") ||
      host.startsWith("172.20.") || host.startsWith("172.21.") || 
      host.startsWith("172.22.") || host.startsWith("172.23.") ||
      host.startsWith("172.24.") || host.startsWith("172.25.") ||
      host.startsWith("172.26.") || host.startsWith("172.27.") ||
      host.startsWith("172.28.") || host.startsWith("172.29.") ||
      host.startsWith("172.30.") || host.startsWith("172.31.")) {
    return "DIRECT";
  }
  
  // List of explicitly allowed domains (google.com, Google Fonts, user-specified)
  const allowedDomains = [${allowedDomains}];
  
  // Check if host matches any allowed domain
  for (let i = 0; i < allowedDomains.length; i++) {
    const allowed = allowedDomains[i].toLowerCase().replace(/"/g, '');
    // Exact match (e.g., google.com)
    if (host === allowed) {
      return "DIRECT";
    }
    // Subdomain match (e.g., www.google.com, fonts.googleapis.com)
    if (host.endsWith('.' + allowed)) {
      return "DIRECT";
    }
  }
  
  // COMPREHENSIVE BLOCKING: Block ANY domain with a dot (catches ALL websites)
  // This is simpler and more effective - any domain name has a dot, so block it
  if (host.indexOf('.') !== -1) {
    // Has a dot = it's a website domain = BLOCK IT (unless it was in allowed list above)
    // Use our blocking proxy server
    return "PROXY 127.0.0.1:3128";
  }
  
  // Allow anything without a dot (likely system/internal)
  return "DIRECT";
}`;
  
  try {
    fs.writeFileSync(pacFilePath, pacFileContent);
    safeLog('PAC file created successfully');
  } catch (e) {
    safeError('Failed to create PAC file:', e);
    return;
  }
  
  // Start HTTP server to serve PAC file (browsers respect HTTP PAC files better than file://)
  const pacPort = 8888;
  if (pacServer) {
    // Server already running, just update content
    safeLog('PAC HTTP server already running');
  } else {
    pacServer = http.createServer((req, res) => {
      if (req.url === '/proxy.pac' || req.url === '/') {
        res.writeHead(200, {
          'Content-Type': 'application/x-ns-proxy-autoconfig',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        });
        res.end(pacFileContent);
        safeLog('PAC file served via HTTP');
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });
    
    pacServer.listen(pacPort, '127.0.0.1', () => {
      safeLog(`✅ PAC file HTTP server started on port ${pacPort}`);
    });
    
    pacServer.on('error', (e) => {
      if (e.code === 'EADDRINUSE') {
        safeLog('PAC server port already in use, reusing existing server');
      } else {
        safeError('PAC server error:', e);
      }
    });
  }
  
  // Use HTTP URL instead of file:// (browsers respect this better and reload it)
  const fileUrl = `http://127.0.0.1:${pacPort}/proxy.pac`;
  safeLog(`Using HTTP PAC URL: ${fileUrl}`);
  
  // Show disclaimer and get ready for password prompt
  let wasFullscreen = false;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('hosts-blocking-prompt', { 
      message: '⚠️ IMPORTANT: System-wide website blocking requires admin privileges. ALL websites except google.com and your allowed sites will be blocked. A password prompt will appear - please enter your admin password.' 
    });
    
    monitoringPaused = true;
    safeLog('Pausing app monitoring to allow password prompt...');
    
    wasFullscreen = mainWindow.isFullScreen();
    if (wasFullscreen) {
      mainWindow.setFullScreen(false);
    }
    
    mainWindow.focus();
    mainWindow.show();
  }
  
  setTimeout(() => {
    // Create a single script that does everything
    const scriptPath = path.join(initializeAppDataPath(), 'setup_blocking.sh');
    
    // Get network services first (async, but we'll handle it in the script)
    const { exec } = require('child_process');
    exec('networksetup -listallnetworkservices', (err, stdout) => {
      if (err) {
        safeError('Failed to list network services:', err);
        handleProxyError(err, wasFullscreen);
        return;
      }
      
      const unsupportedServices = ['Thunderbolt Bridge', 'PPPoE', 'Bluetooth', 'FireWire'];
      const services = stdout.toString().split('\n')
        .filter(line => {
          const trimmed = line.trim();
          return trimmed && 
                 !trimmed.includes('*') && 
                 !trimmed.includes('denotes') &&
                 !unsupportedServices.some(unsupported => trimmed.includes(unsupported));
        })
        .map(line => line.trim());
      
      // Create a single script that does everything (ONE password prompt) - use writable directory
      const scriptPath = path.join(initializeAppDataPath(), 'setup_blocking.sh');
      const escapedBackupPath = hostsBackupPath.replace(/"/g, '\\"');
      
      const scriptContent = `#!/bin/bash
set -e

# Setup system proxy to use our blocking proxy server
${services.map(service => {
  const escaped = service.replace(/"/g, '\\"').replace(/\$/g, '\\$');
  return `networksetup -setwebproxy "${escaped}" 127.0.0.1 ${proxyPort} && networksetup -setsecurewebproxy "${escaped}" 127.0.0.1 ${proxyPort} && networksetup -setwebproxystate "${escaped}" on && networksetup -setsecurewebproxystate "${escaped}" on`;
}).join(' && ')}

# Also setup PAC file
${services.map(service => {
  const escaped = service.replace(/"/g, '\\"').replace(/\$/g, '\\$');
  const escapedUrl = fileUrl.replace(/"/g, '\\"').replace(/\$/g, '\\$');
  return `networksetup -setautoproxyurl "${escaped}" "${escapedUrl}" && networksetup -setautoproxystate "${escaped}" on`;
}).join(' && ')}

# Flush DNS cache
dscacheutil -flushcache || true
killall -HUP mDNSResponder || true

echo "Blocking setup complete"
`;
      
      try {
        fs.writeFileSync(scriptPath, scriptContent);
        fs.chmodSync(scriptPath, '755');
        safeLog('Setup script created');
      } catch (e) {
        safeError('Failed to create setup script:', e);
        handleProxyError(e, wasFullscreen);
        return;
      }
      
      const options = {
        name: '0per8r',
        icns: '/System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/AlertNoteIcon.icns',
      };
      
      safeLog('🔐 Requesting admin privileges - password prompt should appear now...');
      safeLog('Script path:', scriptPath);
      safeLog('Script exists:', fs.existsSync(scriptPath));
      
      // Run the script - ONE password prompt
      safeLog('📝 Executing setup script with sudo...');
      sudo.exec(`bash "${scriptPath}"`, options, (error, stdout, stderr) => {
        // Clean up script
        try {
          if (fs.existsSync(scriptPath)) {
            fs.unlinkSync(scriptPath);
            safeLog('✅ Setup script cleaned up');
          }
        } catch (e) {
          safeError('Failed to remove script:', e);
        }
        
        setTimeout(() => {
          monitoringPaused = false;
          safeLog('Resuming app monitoring...');
        }, 2000);
        
        if (mainWindow && !mainWindow.isDestroyed() && wasFullscreen) {
          setTimeout(() => {
            if (mainWindow && !mainWindow.isDestroyed() && isLocked) {
              mainWindow.setFullScreen(true);
            }
          }, 1500);
        }
        
        if (stdout) {
          const output = stdout.toString().trim();
          safeLog('✅ Script stdout:', output);
        }
        if (stderr) {
          const errOutput = stderr.toString().trim();
          safeError('⚠️ Script stderr:', errOutput);
        }
        
        if (error) {
          safeError('❌ Failed to set up blocking:', error);
          safeError('Error code:', error.code);
          safeError('Error message:', error.message);
          
          // Check if user cancelled password prompt
          if (error.message && (error.message.includes('cancel') || error.message.includes('denied'))) {
            safeError('⚠️ Password prompt was cancelled or denied');
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('break-attempt', {
                type: 'blocking_error',
                message: 'Blocking setup cancelled. Please try again and enter your password when prompted.'
              });
            }
          }
          
          handleProxyError(error, wasFullscreen);
        } else {
          hostsModified = true;
          safeLog('✅ System-wide blocking enabled - ALL websites blocked except allowed ones');
          
          // Force reload ALL browser tabs to clear cached content (ensures all tabs go through proxy)
          // This makes all open tabs make new requests, which will be intercepted by the proxy
          // Do this multiple times to catch any tabs that were opened during the delay
          setTimeout(() => {
            reloadAllBrowserTabs();
            // Reload again after a delay to catch any tabs opened in the meantime
            setTimeout(() => {
              reloadAllBrowserTabs();
            }, 2000);
          }, 3000); // Wait a moment for proxy to be fully active and PAC file to be applied
          
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('hosts-blocking-success', { 
              message: `✅ System-wide blocking enabled! EVERY website is now blocked except google.com and your allowed sites. ALL network requests (including from already-open tabs) are intercepted and blocked immediately. All browser tabs will be reloaded to ensure blocking takes effect.`
            });
          }
        }
      });
    });
  }, 1000);
  
  // Helper function
  function handleProxyError(error, wasFullscreen) {
    setTimeout(() => {
      monitoringPaused = false;
    }, 2000);
    
    if (mainWindow && !mainWindow.isDestroyed() && wasFullscreen) {
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed() && isLocked) {
          mainWindow.setFullScreen(true);
        }
      }, 1500);
    }
    
    if (error && error.message && error.message.includes('did not grant permission')) {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('hosts-blocking-error', { 
          message: 'Password prompt was cancelled. System-wide blocking requires admin privileges.' 
        });
      }
    } else {
      const errorMsg = error ? (error.message || error.toString()) : 'Unknown error';
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('hosts-blocking-error', { 
          message: `Failed to set up blocking: ${errorMsg}. Session will continue with app-level blocking only.` 
        });
      }
    }
  }
}

// Internal hosts file blocking (original method)
function setupHostsFileBlockingInternal(allowList, domainsToBlock, normalizedAllow, alwaysAllowed) {
  safeLog(`Setting up hosts file blocking for ${domainsToBlock.length} domains...`);

  // Backup original hosts file first - but don't block session start if it fails
  backupHostsFile()
    .then(() => {
      // Read current hosts file
      return readHostsFile()
        .then(originalContent => {
          // Create modified hosts file content
          // Get unique domains (remove www. prefix for deduplication)
          const uniqueDomains = [...new Set(domainsToBlock.map(d => d.replace(/^www\./, '').toLowerCase()))];
          
          // Create blocking entries - block both with and without www
          const blockingEntries = uniqueDomains.map(domain => {
            const base = domain.replace(/^www\./, '');
            return `127.0.0.1 ${base}\n127.0.0.1 www.${base}`;
          }).join('\n');
          
          // Also block common subdomains for major sites
          const subdomainBlocks = uniqueDomains
            .filter(d => ['facebook.com', 'twitter.com', 'instagram.com', 'youtube.com', 'reddit.com'].includes(d))
            .map(domain => {
              const base = domain.replace(/^www\./, '');
              return `127.0.0.1 m.${base}\n127.0.0.1 mobile.${base}\n127.0.0.1 api.${base}`;
            }).join('\n');
          
          const modifiedContent = originalContent + 
            '\n\n# 0per8r Blocking - Added automatically\n' +
            '# Blocked distracting sites\n' +
            blockingEntries + 
            (subdomainBlocks ? '\n' + subdomainBlocks : '') + '\n';

          // Write modified hosts file with sudo
          return writeHostsFile(modifiedContent)
            .then(() => {
              hostsModified = true;
              safeLog(`✅ System-wide blocking enabled. Blocked ${uniqueDomains.length} distracting domains.`);
              safeLog(`Allowed sites: google.com, fonts.googleapis.com, fonts.gstatic.com${normalizedAllow.length > 0 ? ', ' + normalizedAllow.join(', ') : ''}`);
              
              // Flush DNS cache to make blocking take effect immediately
              return flushDNSCache()
                .then(() => {
                  safeLog('✅ DNS cache flushed - blocking is now active');
                  // Flush again after a delay to ensure it takes effect
                  setTimeout(() => {
                    flushDNSCache().catch(() => {}); // Flush again silently
                  }, 2000);
                  
                  // Wait a moment for DNS to propagate
                  setTimeout(() => {
                    if (mainWindow && !mainWindow.isDestroyed()) {
                      mainWindow.webContents.send('hosts-blocking-success', { 
                        message: `✅ System-wide blocking enabled! ${uniqueDomains.length} sites blocked in hosts file. IMPORTANT: Restart Chrome/Safari for changes to take effect. If using DNS over HTTPS, disable it in browser settings.` 
                      });
                    }
                  }, 1000);
                })
                .catch(e => {
                  safeError('Could not flush DNS cache:', e);
                  // Still show success - blocking will work after manual DNS flush or browser restart
                  if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('hosts-blocking-success', { 
                      message: `✅ System-wide blocking enabled! ${uniqueDomains.length} sites blocked. IMPORTANT: Please restart your browser (Chrome/Safari) for changes to take effect. If sites still load, disable DNS over HTTPS in browser settings.` 
                    });
                  }
                });
            })
            .catch(err => {
              safeError('Failed to write hosts file:', err);
              // Show error to user
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('hosts-blocking-error', { 
                  message: 'Failed to set up system-wide blocking. You may need to grant admin privileges when prompted. Session will continue with app-level blocking only.' 
                });
              }
            });
        })
        .catch(err => {
          safeError('Failed to read hosts file:', err);
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('hosts-blocking-error', { 
              message: 'Could not read hosts file. Session will continue with app-level blocking only.' 
            });
          }
        });
    })
    .catch(err => {
      safeError('Failed to backup hosts file:', err);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('hosts-blocking-error', { 
          message: 'Could not backup hosts file. Session will continue with app-level blocking only. System-wide blocking requires admin privileges.' 
        });
      }
    });
}

// Windows system-wide blocking (proxy + hosts file)
function setupWindowsBlocking(allowList = []) {
  safeLog('Setting up Windows system-wide blocking...');
  
  // Normalize allowed sites
  const normalizedAllow = allowList.map(site => {
    let domain = site.toLowerCase().trim();
    domain = domain.replace(/^https?:\/\//, '');
    domain = domain.replace(/^www\./, '');
    domain = domain.split('/')[0];
    return domain;
  });
  
  // Always allow google.com
  const alwaysAllowed = ['google.com', 'www.google.com', ...normalizedAllow];
  
  // Setup Windows proxy and hosts file
  setupWindowsProxy(alwaysAllowed)
    .then(() => {
      return setupWindowsHostsFile(alwaysAllowed);
    })
    .then(() => {
      safeLog('✅ Windows system-wide blocking enabled');
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('hosts-blocking-success', {
          message: '✅ System-wide blocking enabled on Windows! All websites are now blocked except google.com and your allowed sites.'
        });
      }
    })
    .catch(err => {
      safeError('Failed to set up Windows blocking:', err);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('hosts-blocking-error', {
          message: 'Failed to set up system-wide blocking. Session will continue with app-level blocking only.'
        });
      }
    });
}

// Setup Windows proxy using netsh
function setupWindowsProxy(alwaysAllowed) {
  return new Promise((resolve, reject) => {
    // Create PAC file
    const pacFilePath = path.join(initializeAppDataPath(), 'focusos_proxy.pac');
    const allowedDomains = alwaysAllowed.map(d => {
      let domain = d.toLowerCase().replace(/^www\./, '');
      return `"${domain}"`;
    }).join(', ');
    
    const pacFileContent = `function FindProxyForURL(url, host) {
  host = host.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1" || host.startsWith("192.168.") || host.startsWith("10.") || host.startsWith("172.")) {
    return "DIRECT";
  }
  const allowedDomains = [${allowedDomains}];
  for (let i = 0; i < allowedDomains.length; i++) {
    const allowed = allowedDomains[i].toLowerCase().replace(/"/g, '');
    if (host === allowed || host.endsWith('.' + allowed)) {
      return "DIRECT";
    }
  }
  return "PROXY 127.0.0.1:3128";
}`;
    
    try {
      fs.writeFileSync(pacFilePath, pacFileContent);
      safeLog('Windows PAC file created');
    } catch (e) {
      safeError('Failed to create PAC file:', e);
      reject(e);
      return;
    }
    
    // Convert path to Windows format and escape for command
    const absolutePacPath = path.resolve(pacFilePath).replace(/\\/g, '\\\\');
    const fileUrl = `file:///${absolutePacPath.replace(/\\/g, '/')}`;
    
    const options = {
      name: '0per8r',
    };
    
    // Show notification
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('hosts-blocking-prompt', {
        message: 'A password prompt will appear. Please enter your admin password to enable system-wide website blocking.'
      });
      monitoringPaused = true;
      const wasFullscreen = mainWindow.isFullScreen();
      if (wasFullscreen) {
        mainWindow.setFullScreen(false);
      }
      mainWindow.focus();
      mainWindow.show();
    }
    
    setTimeout(() => {
      // Set proxy using netsh (Windows)
      // netsh winhttp set proxy proxy-server="127.0.0.1:3128" bypass-list="localhost;127.0.0.1;*.google.com"
      // Or use PAC file: netsh winhttp set proxy proxy-server="http=127.0.0.1:3128" script-source="file:///C:/path/to/file.pac"
      const command = `netsh winhttp set proxy proxy-server="http=127.0.0.1:3128" script-source="${fileUrl}"`;
      
      safeLog('Setting Windows proxy...');
      sudo.exec(command, options, (error, stdout, stderr) => {
        setTimeout(() => {
          monitoringPaused = false;
        }, 2000);
        
        if (mainWindow && !mainWindow.isDestroyed()) {
          const wasFullscreen = mainWindow.isFullScreen();
          if (wasFullscreen) {
            setTimeout(() => {
              if (mainWindow && !mainWindow.isDestroyed() && isLocked) {
                mainWindow.setFullScreen(true);
              }
            }, 1500);
          }
        }
        
        if (error) {
          safeError('Failed to set Windows proxy:', error);
          reject(error);
        } else {
          safeLog('✅ Windows proxy configured');
          resolve();
        }
      });
    }, 1000);
  });
}

// Setup Windows hosts file
function setupWindowsHostsFile(alwaysAllowed) {
  return new Promise((resolve, reject) => {
    // Backup hosts file first
    backupWindowsHostsFile()
      .then(() => {
        return readWindowsHostsFile();
      })
      .then(originalContent => {
        // Build blocking entries - block common distracting sites
        const blockedDomains = [
          'facebook.com', 'www.facebook.com', 'fb.com',
          'instagram.com', 'www.instagram.com',
          'twitter.com', 'www.twitter.com', 'x.com', 'www.x.com',
          'youtube.com', 'www.youtube.com', 'youtu.be',
          'reddit.com', 'www.reddit.com',
          'tiktok.com', 'www.tiktok.com',
          'netflix.com', 'www.netflix.com',
          'discord.com', 'www.discord.com', 'discord.gg',
          'telegram.org', 'www.telegram.org', 'web.telegram.org'
        ];
        
        // Remove domains that are in allow list
        const domainsToBlock = blockedDomains.filter(domain => {
          const cleanDomain = domain.replace(/^www\./, '').toLowerCase();
          return !alwaysAllowed.some(allowed => {
            const cleanAllowed = allowed.replace(/^www\./, '').toLowerCase();
            return cleanDomain === cleanAllowed || cleanDomain.endsWith('.' + cleanAllowed);
          });
        });
        
        // Build new hosts file content
        let newContent = originalContent.trim();
        if (!newContent.endsWith('\n')) {
          newContent += '\n';
        }
        newContent += '\n# 0per8r Blocking - Added automatically\n';
        domainsToBlock.forEach(domain => {
          newContent += `127.0.0.1\t${domain}\n`;
        });
        
        return writeWindowsHostsFile(newContent);
      })
      .then(() => {
        // Flush DNS cache on Windows
        exec('ipconfig /flushdns', (err) => {
          if (err) {
            safeError('Failed to flush DNS cache:', err);
          } else {
            safeLog('DNS cache flushed');
          }
        });
        resolve();
      })
      .catch(err => {
        safeError('Failed to setup Windows hosts file:', err);
        reject(err);
      });
  });
}

// Backup Windows hosts file
function backupWindowsHostsFile() {
  return new Promise((resolve, reject) => {
    try {
      if (fs.existsSync(hostsOriginalPath)) {
        const content = fs.readFileSync(hostsOriginalPath, 'utf8');
        fs.writeFileSync(hostsBackupPath, content);
        safeLog('Windows hosts file backed up');
        resolve();
        return;
      }
    } catch (e) {
      // Need admin, continue below
    }
    
    const options = {
      name: '0per8r',
    };
    
    const command = `copy "${hostsOriginalPath}" "${hostsBackupPath}"`;
    
    sudo.exec(command, options, (error) => {
      if (error) {
        safeError('Backup error:', error);
        resolve(); // Continue anyway
      } else {
        safeLog('Windows hosts file backed up');
        resolve();
      }
    });
  });
}

// Read Windows hosts file
function readWindowsHostsFile() {
  return new Promise((resolve, reject) => {
    try {
      if (fs.existsSync(hostsOriginalPath)) {
        const content = fs.readFileSync(hostsOriginalPath, 'utf8');
        const cleaned = content.split('# 0per8r Blocking')[0].trim();
        resolve(cleaned);
        return;
      }
    } catch (e) {
      // Need admin, continue below
    }
    
    const options = {
      name: '0per8r',
    };
    
    const command = `type "${hostsOriginalPath}"`;
    
    sudo.exec(command, options, (error, stdout) => {
      if (error) {
        safeError('Read error:', error);
        reject(error);
      } else {
        const content = stdout.toString();
        const cleaned = content.split('# 0per8r Blocking')[0].trim();
        resolve(cleaned);
      }
    });
  });
}

// Write Windows hosts file
function writeWindowsHostsFile(content) {
  return new Promise((resolve, reject) => {
    const tempPath = path.join(initializeAppDataPath(), 'hosts.temp');
    
    try {
      fs.writeFileSync(tempPath, content);
    } catch (e) {
      safeError('Failed to write temp file:', e);
      reject(e);
      return;
    }
    
    const options = {
      name: '0per8r',
    };
    
    if (mainWindow && !mainWindow.isDestroyed()) {
      monitoringPaused = true;
      const wasFullscreen = mainWindow.isFullScreen();
      if (wasFullscreen) {
        mainWindow.setFullScreen(false);
      }
      mainWindow.focus();
      mainWindow.show();
    }
    
    setTimeout(() => {
      // Windows: copy temp file to hosts file location (requires admin)
      const command = `copy "${tempPath}" "${hostsOriginalPath}" && del "${tempPath}"`;
      
      safeLog('Requesting admin access to modify Windows hosts file...');
      sudo.exec(command, options, (error) => {
        try {
          if (fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath);
          }
        } catch (e) {}
        
        setTimeout(() => {
          monitoringPaused = false;
        }, 3000);
        
        if (mainWindow && !mainWindow.isDestroyed()) {
          const wasFullscreen = mainWindow.isFullScreen();
          if (wasFullscreen) {
            setTimeout(() => {
              if (mainWindow && !mainWindow.isDestroyed() && isLocked) {
                mainWindow.setFullScreen(true);
              }
            }, 2000);
          }
        }
        
        if (error) {
          safeError('Write error:', error);
          if (error.message && error.message.includes('did not grant permission')) {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('hosts-blocking-error', {
                message: 'Password prompt was cancelled. System-wide blocking requires admin privileges.'
              });
            }
          }
          resolve(); // Continue anyway
        } else {
          safeLog('Windows hosts file modified successfully');
          hostsModified = true;
          resolve();
        }
      });
    }, 1000);
  });
}

// Backup original hosts file
function backupHostsFile() {
  return new Promise((resolve, reject) => {
    // First try to read without sudo (if we have read permissions)
    try {
      if (fs.existsSync(hostsOriginalPath)) {
        const content = fs.readFileSync(hostsOriginalPath, 'utf8');
        fs.writeFileSync(hostsBackupPath, content);
        safeLog('Hosts file backed up successfully (no sudo needed)');
        resolve();
        return;
      }
    } catch (e) {
      // Need sudo, continue below
    }
    
    const options = {
      name: '0per8r',
      icns: '/System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/AlertNoteIcon.icns',
    };

    const command = `cp ${hostsOriginalPath} ${hostsBackupPath}`;
    
    sudo.exec(command, options, (error, stdout, stderr) => {
      if (error) {
        safeError('Backup error:', error);
        // Don't reject - allow session to continue without system-wide blocking
        // Just log and resolve anyway
        safeLog('Could not backup hosts file, will continue with app-level blocking only');
        resolve(); // Resolve instead of reject to allow session to continue
      } else {
        safeLog('Hosts file backed up successfully');
        resolve();
      }
    });
  });
}

// Read hosts file
function readHostsFile() {
  return new Promise((resolve, reject) => {
    // First try to read without sudo
    try {
      if (fs.existsSync(hostsOriginalPath)) {
        const content = fs.readFileSync(hostsOriginalPath, 'utf8');
        // Remove any existing 0per8r blocking entries
        const cleaned = content.split('# 0per8r Blocking')[0].trim();
        resolve(cleaned);
        return;
      }
    } catch (e) {
      // Need sudo, continue below
    }
    
    const options = {
      name: '0per8r',
      icns: '/System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/AlertNoteIcon.icns',
    };

    const command = `cat ${hostsOriginalPath}`;
    
    sudo.exec(command, options, (error, stdout, stderr) => {
      if (error) {
        safeError('Read error:', error);
        reject(error);
      } else {
        // Remove any existing 0per8r blocking entries
        const content = stdout.toString();
        const cleaned = content.split('# 0per8r Blocking')[0].trim();
        resolve(cleaned);
      }
    });
  });
}

// Write hosts file
function writeHostsFile(content) {
  return new Promise((resolve, reject) => {
    // Write to temp file first, then move (safer)
    const tempPath = path.join(initializeAppDataPath(), 'hosts.temp');
    
    try {
      fs.writeFileSync(tempPath, content);
    } catch (e) {
      safeError('Failed to write temp file:', e);
      reject(e);
      return;
    }
    
    const options = {
      name: '0per8r',
      icns: '/System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/AlertNoteIcon.icns',
    };

    // Show notification to user that password prompt is coming
    let wasFullscreen = false;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('hosts-blocking-prompt', { 
        message: 'A password prompt will appear. Please enter your admin password to enable system-wide website blocking.' 
      });
      
      // Temporarily pause app monitoring to prevent blocking the password prompt
      monitoringPaused = true;
      safeLog('Pausing app monitoring to allow password prompt...');
      
      // Temporarily exit fullscreen to allow system password prompt to appear
      wasFullscreen = mainWindow.isFullScreen();
      if (wasFullscreen) {
        safeLog('Temporarily exiting fullscreen to show password prompt...');
        mainWindow.setFullScreen(false);
      }
      
      // Focus the window to make sure the prompt is visible
      mainWindow.focus();
      mainWindow.show();
    }
    
    // Small delay to ensure notification is seen and fullscreen is exited
    setTimeout(() => {
      const command = `cp "${tempPath}" "${hostsOriginalPath}" && rm "${tempPath}"`;
      
      safeLog('Requesting sudo access to modify hosts file...');
      sudo.exec(command, options, (error, stdout, stderr) => {
      // Clean up temp file if it still exists
      try { 
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
      } catch (e) {}
      
        // Re-enable app monitoring after prompt is handled
        setTimeout(() => {
          monitoringPaused = false;
          safeLog('Resuming app monitoring...');
        }, 3000); // Wait 3 seconds for prompt to complete
      
        // Restore fullscreen if it was enabled (after a delay to let prompt finish)
        if (mainWindow && !mainWindow.isDestroyed() && wasFullscreen) {
          setTimeout(() => {
            if (mainWindow && !mainWindow.isDestroyed() && isLocked) {
              mainWindow.setFullScreen(true);
              safeLog('Restored fullscreen mode');
            }
          }, 2000); // Wait 2 seconds for prompt to complete
        }
        
        if (error) {
          safeError('Write error:', error);
          safeError('Error details:', error.message || error);
          // Check if it's a permission error
          if (error.message && error.message.includes('did not grant permission')) {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('hosts-blocking-error', { 
                message: 'Password prompt was cancelled or denied. System-wide blocking requires admin privileges. Session will continue with app-level blocking only. Please try again and enter your password when prompted.' 
              });
            }
          }
          // Don't reject - allow session to continue
          safeLog('Could not write hosts file, will continue with app-level blocking only');
          resolve(); // Resolve instead of reject to allow session to continue
        } else {
          safeLog('Hosts file modified successfully');
          resolve();
        }
      });
    }, 1000); // Wait 1 second for fullscreen to exit and notification to appear
  });
}

// Setup PAC file-based blocking (like Freedom/Cold Turkey) - blocks at network level
function setupProxyBlocking(domainsToBlock, alwaysAllowed) {
  safeLog(`Setting up PAC file blocking for system-wide website blocking...`);
  
  // Create PAC file that blocks all sites except allowed ones
  const pacFilePath = path.join(initializeAppDataPath(), 'focusos_proxy.pac');
  
  // Build list of allowed domains (google.com and user-specified)
  const allowedDomains = alwaysAllowed.map(d => {
    let domain = d.toLowerCase().replace(/^www\./, '');
    return `"${domain}"`;
  }).join(', ');
  
  // PAC file JavaScript - blocks everything except allowed domains
  const pacFileContent = `function FindProxyForURL(url, host) {
  // Convert host to lowercase for comparison
  host = host.toLowerCase();
  
  // Always allow localhost and local network
  if (host === "localhost" || host === "127.0.0.1" || host.startsWith("192.168.") || host.startsWith("10.") || host.startsWith("172.")) {
    return "DIRECT";
  }
  
  // List of allowed domains
  const allowedDomains = [${allowedDomains}];
  
  // Check if host matches any allowed domain
  for (let i = 0; i < allowedDomains.length; i++) {
    const allowed = allowedDomains[i].toLowerCase().replace(/"/g, '');
    // Match exact domain or subdomains
    if (host === allowed || host.endsWith('.' + allowed)) {
      return "DIRECT";
    }
  }
  
  // Block everything else by routing through our blocking proxy
  // The proxy will check and block unauthorized domains
  return "PROXY 127.0.0.1:3128";
}`;
  
  // Write PAC file
  try {
    fs.writeFileSync(pacFilePath, pacFileContent);
    safeLog('PAC file created successfully');
  } catch (e) {
    safeError('Failed to create PAC file:', e);
    return;
  }
  
  // Get absolute path for PAC file (required by macOS)
  const absolutePacPath = path.resolve(pacFilePath);
  // macOS networksetup requires file:/// (three slashes)
  // Convert path separators to forward slashes
  const normalizedPath = absolutePacPath.replace(/\\/g, '/');
  // Ensure we have exactly 3 slashes: file:///path (not 4!)
  // normalizedPath already starts with /, so file:// + /path = file:///path
  const fileUrl = `file://${normalizedPath}`;
  
  // Set system to use PAC file
  const options = {
    name: '0per8r',
    icns: '/System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/AlertStopIcon.icns',
  };
  
  // Show notification to user that password prompt is coming
  let wasFullscreen = false;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('hosts-blocking-prompt', { 
      message: 'A password prompt will appear. Please enter your admin password to enable system-wide website blocking.' 
    });
    
    // Temporarily pause app monitoring to prevent blocking the password prompt
    monitoringPaused = true;
    safeLog('Pausing app monitoring to allow password prompt...');
    
    // Temporarily exit fullscreen to allow system password prompt to appear
    wasFullscreen = mainWindow.isFullScreen();
    if (wasFullscreen) {
      safeLog('Temporarily exiting fullscreen to show password prompt...');
      mainWindow.setFullScreen(false);
    }
    
    // Focus the window to make sure the prompt is visible
    mainWindow.focus();
    mainWindow.show();
  }
  
  // Small delay to ensure notification is seen and fullscreen is exited
  setTimeout(() => {
    // Get list of available network services
    const { exec } = require('child_process');
    exec('networksetup -listallnetworkservices', (err, stdout) => {
      if (err) {
        safeError('Failed to list network services:', err);
        handleProxyError(err, wasFullscreen);
        return;
      }
      
      // Parse network services (skip first line which is a header)
      // Filter out services that don't support auto proxy (Thunderbolt Bridge, PPPoE, etc.)
      const unsupportedServices = ['Thunderbolt Bridge', 'PPPoE', 'Bluetooth', 'FireWire'];
      const services = stdout.toString().split('\n')
        .filter(line => {
          const trimmed = line.trim();
          return trimmed && 
                 !trimmed.includes('*') && 
                 !trimmed.includes('denotes') &&
                 !unsupportedServices.some(unsupported => trimmed.includes(unsupported));
        })
        .map(line => line.trim());
      
      safeLog(`Found network services: ${services.join(', ')}`);
      
      // Build commands for each available service
      const commands = [];
      services.forEach(service => {
        if (service) {
          // Escape service name and file URL for shell
          const escapedService = service.replace(/"/g, '\\"');
          const escapedFileUrl = fileUrl.replace(/"/g, '\\"');
          commands.push(`networksetup -setautoproxyurl "${escapedService}" "${escapedFileUrl}"`);
          commands.push(`networksetup -setautoproxystate "${escapedService}" on`);
        }
      });
      
      if (commands.length === 0) {
        safeError('No network services found');
        handleProxyError(new Error('No network services found'), wasFullscreen);
        return;
      }
      
      // Combine all commands
      const combinedCommand = commands.join(' && ');
      
      safeLog(`Executing PAC setup command...`);
      safeLog(`File URL: ${fileUrl}`);
      safeLog(`Command: ${combinedCommand.substring(0, 200)}...`);
      
      sudo.exec(combinedCommand, options, (error, stdout, stderr) => {
        // Re-enable app monitoring after prompt is handled
        setTimeout(() => {
          monitoringPaused = false;
          safeLog('Resuming app monitoring...');
        }, 2000);
        
        // Restore fullscreen if it was enabled
        if (mainWindow && !mainWindow.isDestroyed() && wasFullscreen) {
          setTimeout(() => {
            if (mainWindow && !mainWindow.isDestroyed() && isLocked) {
              mainWindow.setFullScreen(true);
              safeLog('Restored fullscreen mode');
            }
          }, 1500);
        }
        
        if (stdout) safeLog('Command stdout:', stdout.toString().trim());
        if (stderr) safeError('Command stderr:', stderr.toString().trim());
        
        if (error) {
          safeError('Failed to set PAC file:', error);
          safeError('Error code:', error.code);
          safeError('Error message:', error.message || error.toString());
          handleProxyError(error, wasFullscreen);
        } else {
          safeLog('✅ PAC file configured - system-wide blocking active');
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('hosts-blocking-success', { 
              message: `✅ System-wide blocking enabled! All websites are now blocked except google.com and your allowed sites. All browsers were closed - you can reopen them now and blocking will work immediately.` 
            });
          }
        }
      });
    });
  }, 1000);
  
  // Helper function to handle proxy errors
  function handleProxyError(error, wasFullscreen) {
    // Re-enable app monitoring
    setTimeout(() => {
      monitoringPaused = false;
      safeLog('Resuming app monitoring...');
    }, 2000);
    
    // Restore fullscreen if it was enabled
    if (mainWindow && !mainWindow.isDestroyed() && wasFullscreen) {
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed() && isLocked) {
          mainWindow.setFullScreen(true);
          safeLog('Restored fullscreen mode');
        }
      }, 1500);
    }
    
    if (error && error.message && error.message.includes('did not grant permission')) {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('hosts-blocking-error', { 
          message: 'Password prompt was cancelled or denied. System-wide blocking requires admin privileges. Session will continue with app-level blocking only.' 
        });
      }
    } else {
      const errorMsg = error ? (error.message || error.toString()) : 'Unknown error';
      safeError('Failed to set PAC file:', error);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('hosts-blocking-error', { 
          message: `Failed to set system proxy: ${errorMsg}. Session will continue with app-level blocking only.` 
        });
      }
    }
  }
}

// Set system proxy settings (macOS)
function setSystemProxy() {
  return new Promise((resolve, reject) => {
    // Get current proxy settings first
    exec('networksetup -getwebproxy Wi-Fi', (error, stdout) => {
      if (!error && stdout.includes('Enabled: Yes')) {
        // Save current settings
        exec('networksetup -getwebproxy Wi-Fi', (err, out) => {
          originalProxySettings = out;
        });
      }
      
      const options = {
        name: '0per8r',
        icns: '/System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/AlertNoteIcon.icns',
      };
      
      // Set proxy for all network interfaces
      const commands = [
        `networksetup -setwebproxy Wi-Fi 127.0.0.1 ${proxyPort}`,
        `networksetup -setsecurewebproxy Wi-Fi 127.0.0.1 ${proxyPort}`,
        `networksetup -setwebproxystate Wi-Fi on`,
        `networksetup -setsecurewebproxystate Wi-Fi on`
      ];
      
      // Try Ethernet if Wi-Fi fails
      const ethernetCommands = [
        `networksetup -setwebproxy Ethernet 127.0.0.1 ${proxyPort}`,
        `networksetup -setsecurewebproxy Ethernet 127.0.0.1 ${proxyPort}`,
        `networksetup -setwebproxystate Ethernet on`,
        `networksetup -setsecurewebproxystate Ethernet on`
      ];
      
      let completed = 0;
      const totalCommands = commands.length + ethernetCommands.length;
      
      commands.forEach(cmd => {
        sudo.exec(cmd, options, (err) => {
          completed++;
          if (completed === totalCommands) {
            if (err) {
              // Try Ethernet
              ethernetCommands.forEach(ecmd => {
                sudo.exec(ecmd, options, () => {});
              });
            }
            resolve();
          }
        });
      });
      
      ethernetCommands.forEach(cmd => {
        sudo.exec(cmd, options, () => {
          completed++;
          if (completed === totalCommands) resolve();
        });
      });
    });
  });
}

// Combined restore - restores everything in ONE password prompt
function restoreCombinedBlocking() {
  if (process.platform !== 'darwin') return;
  
  const options = {
    name: '0per8r',
    icns: '/System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/AlertStopIcon.icns',
  };
  
  const { exec } = require('child_process');
  
  // Get network services
  exec('networksetup -listallnetworkservices', (err, stdout) => {
    if (err) {
      safeError('Failed to list network services for restore:', err);
      // Still try to restore hosts file
      restoreHostsFile();
      return;
    }
    
    const unsupportedServices = ['Thunderbolt Bridge', 'PPPoE', 'Bluetooth', 'FireWire'];
    const services = stdout.toString().split('\n')
      .filter(line => {
        const trimmed = line.trim();
        return trimmed && 
               !trimmed.includes('*') && 
               !trimmed.includes('denotes') &&
               !unsupportedServices.some(unsupported => trimmed.includes(unsupported));
      })
      .map(line => line.trim());
    
    // Stop blocking proxy server FIRST
    if (blockingProxyServer) {
      blockingProxyServer.close(() => {
        safeLog('Blocking proxy server stopped');
      });
      blockingProxyServer = null;
    }
    
    // Stop PAC HTTP server
    if (pacServer) {
      pacServer.close(() => {
        safeLog('PAC HTTP server stopped');
      });
      pacServer = null;
    }
    
    // Create restore script (ONE password prompt)
    const scriptPath = path.join(initializeAppDataPath(), 'restore_blocking.sh');
    const escapedBackupPath = hostsBackupPath.replace(/"/g, '\\"');
    
    const scriptContent = `#!/bin/bash
# Don't use set -e, we want to continue even if one command fails

# Remove system proxy settings (CRITICAL - must disable all proxy types)
${services.map(service => {
  const escaped = service.replace(/"/g, '\\"').replace(/\$/g, '\\$');
  return `networksetup -setwebproxystate "${escaped}" off || true && networksetup -setsecurewebproxystate "${escaped}" off || true && networksetup -setautoproxystate "${escaped}" off || true && networksetup -setautoproxyurl "${escaped}" "" || true`;
}).join(' && ')}

# Flush DNS cache multiple times to ensure changes take effect
dscacheutil -flushcache || true
killall -HUP mDNSResponder || true
dscacheutil -flushcache || true
killall -HUP mDNSResponder || true

echo "Restore complete - all websites unblocked"
`;
    
    try {
      fs.writeFileSync(scriptPath, scriptContent);
      fs.chmodSync(scriptPath, '755');
      safeLog('Restore script created');
    } catch (e) {
      safeError('Failed to create restore script:', e);
      return;
    }
    
    const options = {
      name: '0per8r',
      icns: '/System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/AlertNoteIcon.icns',
    };
    
    // Run restore script - ONE password prompt
    safeLog('🔐 Requesting admin privileges to restore blocking - password prompt should appear now...');
    safeLog('Script path:', scriptPath);
    safeLog('Script exists:', fs.existsSync(scriptPath));
    sudo.exec(`bash "${scriptPath}"`, options, (error, stdout, stderr) => {
      // Clean up script
      try {
        if (fs.existsSync(scriptPath)) {
          fs.unlinkSync(scriptPath);
        }
      } catch (e) {
        safeError('Failed to remove restore script:', e);
      }
      
      // Remove PAC file
      const pacFilePath = path.join(initializeAppDataPath(), 'focusos_proxy.pac');
      try {
        if (fs.existsSync(pacFilePath)) {
          fs.unlinkSync(pacFilePath);
          safeLog('PAC file removed');
        }
      } catch (e) {
        safeError('Failed to remove PAC file:', e);
      }
      
      if (stdout) safeLog('Restore stdout:', stdout.toString().trim());
      if (stderr) safeError('Restore stderr:', stderr.toString().trim());
      
      if (error) {
        safeError('Failed to restore blocking:', error);
      } else {
        hostsModified = false;
        safeLog('✅ All blocking restored - websites unblocked');
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('hosts-blocking-success', { 
            message: '✅ All websites have been unblocked. You can now browse normally.' 
          });
        }
      }
    });
  });
}

// Promise-based version of restoreCombinedBlocking
function restoreCombinedBlockingPromise() {
  return new Promise((resolve, reject) => {
    if (process.platform === 'win32') {
      // Windows restore
      restoreWindowsBlockingPromise().then(() => resolve()).catch(() => resolve());
      return;
    }
    if (process.platform !== 'darwin') {
      resolve();
      return;
    }
    
    const { exec } = require('child_process');
    
    // Get network services
    exec('networksetup -listallnetworkservices', (err, stdout) => {
      if (err) {
        safeError('Failed to list network services for restore:', err);
        // Still try to restore hosts file
        resolve(); // Don't reject, just continue
        return;
      }
      
      const unsupportedServices = ['Thunderbolt Bridge', 'PPPoE', 'Bluetooth', 'FireWire'];
      const services = stdout.toString().split('\n')
        .filter(line => {
          const trimmed = line.trim();
          return trimmed && 
                 !trimmed.includes('*') && 
                 !trimmed.includes('denotes') &&
                 !unsupportedServices.some(unsupported => trimmed.includes(unsupported));
        })
        .map(line => line.trim());
      
      // Stop blocking proxy server FIRST
      if (blockingProxyServer) {
        blockingProxyServer.close(() => {
          safeLog('Blocking proxy server stopped');
        });
        blockingProxyServer = null;
      }
      
      // Stop PAC HTTP server
      if (pacServer) {
        pacServer.close(() => {
          safeLog('PAC HTTP server stopped');
        });
        pacServer = null;
      }
      
      // Create restore script (ONE password prompt) - includes both proxy and hosts file restoration
      const scriptPath = path.join(initializeAppDataPath(), 'restore_blocking.sh');
      const escapedBackupPath = hostsBackupPath.replace(/"/g, '\\"');
      const pythonScriptPath = path.join(initializeAppDataPath(), 'restore_hosts.py');
      const escapedPythonPath = pythonScriptPath.replace(/"/g, '\\"');
      
      // Create Python script for hosts file restoration
      const pythonScript = `
import sys
import os

hosts_path = "${hostsOriginalPath}"
backup_path = "${hostsBackupPath}"

# Try to restore from backup first (if exists)
if os.path.exists(backup_path):
    try:
        with open(backup_path, 'r') as f:
            backup_content = f.read()
        with open(hosts_path, 'w') as f:
            f.write(backup_content)
        os.remove(backup_path)
        print("Restored from backup")
        sys.exit(0)
    except Exception as e:
        print(f"Error restoring from backup: {e}", file=sys.stderr)

# No backup - remove blocking entries directly from hosts file
if not os.path.exists(hosts_path):
    print("Hosts file not found", file=sys.stderr)
    sys.exit(1)

try:
    with open(hosts_path, 'r') as f:
        lines = f.readlines()
    
    # Filter out blocking lines
    cleaned_lines = []
    blocked_domains = ['instagram', 'telegram', 'youtube', 'facebook', 'twitter', 'reddit', 'tiktok', 'snapchat', 'discord', 'netflix', 'spotify']
    
    original_count = len(lines)
    
    for line in lines:
        line_lower = line.lower()
        # Skip if line contains blocking markers
        if '0per8r' in line_lower or 'blocked distracting' in line_lower or '# blocked' in line_lower:
            continue
        # Skip 127.0.0.1 entries for blocked domains (remove ALL of them)
        if line.strip().startswith('127.0.0.1'):
            parts = line.strip().split()
            if len(parts) > 1:
                domain = parts[1].lower()
                # Remove www. prefix for matching
                domain_clean = domain.replace('www.', '').replace('m.', '')
                # Check if this domain should be unblocked
                if any(blocked in domain_clean for blocked in blocked_domains):
                    continue
        cleaned_lines.append(line)
    
    removed_count = original_count - len(cleaned_lines)
    
    # Write cleaned hosts file
    with open(hosts_path, 'w') as f:
        f.writelines(cleaned_lines)
    
    print(f"Removed {removed_count} blocking entries")
    
except Exception as e:
    print(f"Error: {e}", file=sys.stderr)
    sys.exit(1)
`;
      
      // Write Python script first (before creating bash script)
      try {
        fs.writeFileSync(pythonScriptPath, pythonScript);
      } catch (e) {
        safeError('Could not write Python restore script:', e);
        resolve();
        return;
      }
      
      const scriptContent = `#!/bin/bash
# Don't use set -e, we want to continue even if one command fails

# Remove system proxy settings (CRITICAL - must disable all proxy types)
${services.map(service => {
  const escaped = service.replace(/"/g, '\\"').replace(/\$/g, '\\$');
  return `networksetup -setwebproxystate "${escaped}" off || true && networksetup -setsecurewebproxystate "${escaped}" off || true && networksetup -setautoproxystate "${escaped}" off || true && networksetup -setautoproxyurl "${escaped}" "" || true`;
}).join(' && ')}

# Restore hosts file (remove blocking entries)
python3 "${escapedPythonPath}" && rm "${escapedPythonPath}" || rm "${escapedPythonPath}" || true

# Flush DNS cache multiple times to ensure changes take effect
dscacheutil -flushcache || true
killall -HUP mDNSResponder || true
dscacheutil -flushcache || true
killall -HUP mDNSResponder || true

echo "Restore complete - all websites unblocked"
`;
      
      try {
        fs.writeFileSync(scriptPath, scriptContent);
        fs.chmodSync(scriptPath, '755');
        safeLog('Restore script created');
      } catch (e) {
        safeError('Failed to create restore script:', e);
        resolve(); // Don't reject, just continue
        return;
      }
      
      const options = {
        name: '0per8r',
        icns: '/System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/AlertNoteIcon.icns',
      };
      
      // Run restore script - ONE password prompt
      safeLog('🔐 Requesting admin privileges to restore blocking - password prompt should appear now...');
      sudo.exec(`bash "${scriptPath}"`, options, (error, stdout, stderr) => {
        // Clean up script
        try {
          if (fs.existsSync(scriptPath)) {
            fs.unlinkSync(scriptPath);
          }
        } catch (e) {
          safeError('Failed to remove restore script:', e);
        }
        
        // Remove PAC file
        const pacFilePath = path.join(initializeAppDataPath(), 'focusos_proxy.pac');
        try {
          if (fs.existsSync(pacFilePath)) {
            fs.unlinkSync(pacFilePath);
            safeLog('PAC file removed');
          }
        } catch (e) {
          safeError('Failed to remove PAC file:', e);
        }
        
        if (stdout) safeLog('Restore stdout:', stdout.toString().trim());
        if (stderr) safeError('Restore stderr:', stderr.toString().trim());
        
        if (error) {
          safeError('Failed to restore blocking:', error);
          resolve(); // Resolve anyway to continue
        } else {
          hostsModified = false;
          safeLog('✅ All blocking restored - websites unblocked');
          resolve();
        }
      });
    });
  });
}

// Promise-based version of restoreHostsFile
function restoreHostsFilePromise() {
  return new Promise((resolve, reject) => {
    if (process.platform !== 'darwin') {
      resolve();
      return;
    }
    
    safeLog('🧹 Restoring hosts file - removing ALL blocking entries...');
    
    const options = {
      name: '0per8r',
      icns: '/System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/AlertStopIcon.icns',
    };
    
    // Read current hosts file and remove blocking entries, then restore
    const pythonScriptPath = path.join(initializeAppDataPath(), 'restore_hosts.py');
    const pythonScript = `
import sys
import os

hosts_path = "${hostsOriginalPath}"
backup_path = "${hostsBackupPath}"

# Try to restore from backup first (if exists)
if os.path.exists(backup_path):
    try:
        with open(backup_path, 'r') as f:
            backup_content = f.read()
        with open(hosts_path, 'w') as f:
            f.write(backup_content)
        os.remove(backup_path)
        print("Restored from backup")
        sys.exit(0)
    except Exception as e:
        print(f"Error restoring from backup: {e}", file=sys.stderr)

# No backup - remove blocking entries directly from hosts file
if not os.path.exists(hosts_path):
    print("Hosts file not found", file=sys.stderr)
    sys.exit(1)

try:
    with open(hosts_path, 'r') as f:
        lines = f.readlines()
    
    # Filter out blocking lines
    cleaned_lines = []
    blocked_domains = ['instagram', 'telegram', 'youtube', 'facebook', 'twitter', 'reddit', 'tiktok', 'snapchat', 'discord', 'netflix', 'spotify']
    
    original_count = len(lines)
    
    for line in lines:
        line_lower = line.lower()
        # Skip if line contains blocking markers
        if '0per8r' in line_lower or 'blocked distracting' in line_lower or '# blocked' in line_lower:
            continue
        # Skip 127.0.0.1 entries for blocked domains (remove ALL of them)
        if line.strip().startswith('127.0.0.1'):
            parts = line.strip().split()
            if len(parts) > 1:
                domain = parts[1].lower()
                # Remove www. prefix for matching
                domain_clean = domain.replace('www.', '').replace('m.', '')
                # Check if this domain should be unblocked
                if any(blocked in domain_clean for blocked in blocked_domains):
                    continue
        cleaned_lines.append(line)
    
    removed_count = original_count - len(cleaned_lines)
    
    # Write cleaned hosts file
    with open(hosts_path, 'w') as f:
        f.writelines(cleaned_lines)
    
    print(f"Removed {removed_count} blocking entries")
    
except Exception as e:
    print(f"Error: {e}", file=sys.stderr)
    sys.exit(1)
  `;
    
    // Write Python script to temp file
    try {
      fs.writeFileSync(pythonScriptPath, pythonScript);
    } catch (e) {
      safeError('Could not write restore script:', e);
      resolve(); // Don't reject, just continue
      return;
    }
    
    const restoreScript = `
      python3 "${pythonScriptPath}" && rm "${pythonScriptPath}" || rm "${pythonScriptPath}"
      # Flush DNS cache
      dscacheutil -flushcache 2>/dev/null || true
      killall -HUP mDNSResponder 2>/dev/null || true
    `;
    
    safeLog('🔐 Requesting admin privileges to restore hosts file - password prompt should appear now...');
    sudo.exec(restoreScript, options, (error, stdout, stderr) => {
      if (error) {
        safeError('Restore error:', error);
        safeLog('⚠️ Could not restore hosts file automatically. You may need to manually edit /etc/hosts to remove blocking entries.');
        resolve(); // Resolve anyway to continue
      } else {
        safeLog('✅ Hosts file restored successfully - ALL blocking entries removed');
        hostsModified = false;
        resolve();
      }
    });
  });
}

// Promise-based version of restoreDoH
function restoreDoHPromise() {
  return new Promise((resolve) => {
    if (process.platform !== 'darwin') {
      resolve();
      return;
    }
    
    // Call the original restoreDoH (restores browser DoH settings - synchronous, no sudo needed)
    try {
      restoreDoH();
    } catch (e) {
      safeError('Error in restoreDoH:', e);
    }
    
    // Also restore system DNS settings if needed (this requires sudo)
    const { exec } = require('child_process');
    
    // Get network services
    exec('networksetup -listallnetworkservices', (err, stdout) => {
      if (err) {
        safeError('Failed to list network services for DoH restore:', err);
        resolve(); // Don't reject, just continue
        return;
      }
      
      const unsupportedServices = ['Thunderbolt Bridge', 'PPPoE', 'Bluetooth', 'FireWire'];
      const services = stdout.toString().split('\n')
        .filter(line => {
          const trimmed = line.trim();
          return trimmed && 
                 !trimmed.includes('*') && 
                 !trimmed.includes('denotes') &&
                 !unsupportedServices.some(unsupported => trimmed.includes(unsupported));
        })
        .map(line => line.trim());
      
      if (services.length === 0) {
        resolve();
        return;
      }
      
      const options = {
        name: '0per8r',
        icns: '/System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/AlertNoteIcon.icns',
      };
      
      // Restore DNS settings (remove custom DNS)
      const commands = services.map(service => {
        const escaped = service.replace(/"/g, '\\"').replace(/\$/g, '\\$');
        return `networksetup -setdnsservers "${escaped}" "Empty" || true`;
      }).join(' && ');
      
      sudo.exec(commands, options, (error, stdout, stderr) => {
        if (error) {
          safeError('Failed to restore DNS settings:', error);
          resolve(); // Resolve anyway to continue
        } else {
          safeLog('✅ DNS settings restored');
          resolve();
        }
      });
    });
  });
}

// Remove proxy blocking
function removeProxyBlocking() {
  // Remove PAC file configuration
  const options = {
    name: '0per8r',
    icns: '/System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/AlertStopIcon.icns',
  };
  
  // Get list of available network services
  const { exec } = require('child_process');
  exec('networksetup -listallnetworkservices', (err, stdout) => {
    if (err) {
      safeError('Failed to list network services for removal:', err);
      return;
    }
    
      // Parse network services (skip first line which is a header)
      // Filter out services that don't support auto proxy (Thunderbolt Bridge, PPPoE, etc.)
      const unsupportedServices = ['Thunderbolt Bridge', 'PPPoE', 'Bluetooth', 'FireWire'];
      const services = stdout.toString().split('\n')
        .filter(line => {
          const trimmed = line.trim();
          return trimmed && 
                 !trimmed.includes('*') && 
                 !trimmed.includes('denotes') &&
                 !unsupportedServices.some(unsupported => trimmed.includes(unsupported));
        })
        .map(line => line.trim());
    
    safeLog(`Removing proxy from services: ${services.join(', ')}`);
    
    // Build commands for each available service
    const commands = [];
    services.forEach(service => {
      if (service) {
        // Escape service name for shell
        const escapedService = service.replace(/"/g, '\\"');
        commands.push(`networksetup -setautoproxystate "${escapedService}" off`);
        commands.push(`networksetup -setautoproxyurl "${escapedService}" ""`);
      }
    });
    
    if (commands.length === 0) {
      safeError('No network services found for removal');
      return;
    }
    
    // Combine all commands
    const combinedCommand = commands.join(' && ');
    
    safeLog('Executing PAC removal command...');
    
    sudo.exec(combinedCommand, options, (error, stdout, stderr) => {
      if (stdout) safeLog('Command stdout:', stdout.toString().trim());
      if (stderr) safeError('Command stderr:', stderr.toString().trim());
      
      if (error) {
        safeError('Failed to remove PAC file settings:', error);
        safeError('Error code:', error.code);
        safeError('Error message:', error.message || error.toString());
      } else {
        safeLog('✅ System proxy/PAC file disabled - all websites unblocked');
      }
    });
  });
  
  // Remove PAC file (no sudo needed)
  const pacFilePath = path.join(initializeAppDataPath(), 'focusos_proxy.pac');
  try {
    if (fs.existsSync(pacFilePath)) {
      fs.unlinkSync(pacFilePath);
      safeLog('PAC file removed');
    }
  } catch (e) {
    safeError('Failed to remove PAC file:', e);
  }
}

// Disable DNS over HTTPS in browsers (temporary, only during focus mode)
// This ensures website blocking works even with DoH enabled
function disableDoH() {
  if (process.platform !== 'darwin') return;
  
  safeLog('Disabling DNS over HTTPS in browsers...');
  
  const os = require('os');
  const homeDir = os.homedir();
  
  // Chrome/Chromium
  const chromePrefsPath = path.join(homeDir, 'Library/Application Support/Google/Chrome/Default/Preferences');
  try {
    if (fs.existsSync(chromePrefsPath)) {
      const prefs = JSON.parse(fs.readFileSync(chromePrefsPath, 'utf8'));
      // Backup current setting
      dohBackups.chrome = prefs.dns_over_https?.mode || null;
      // Disable DoH
      if (!prefs.dns_over_https) prefs.dns_over_https = {};
      prefs.dns_over_https.mode = 'off';
      fs.writeFileSync(chromePrefsPath, JSON.stringify(prefs, null, 2));
      safeLog('✅ Chrome DoH disabled');
    }
  } catch (e) {
    safeError('Could not disable Chrome DoH:', e);
  }
  
  // Firefox
  const firefoxProfilesPath = path.join(homeDir, 'Library/Application Support/Firefox/Profiles');
  try {
    if (fs.existsSync(firefoxProfilesPath)) {
      const profiles = fs.readdirSync(firefoxProfilesPath).filter(p => p.endsWith('.default-release') || p.endsWith('.default'));
      profiles.forEach(profile => {
        const prefsPath = path.join(firefoxProfilesPath, profile, 'prefs.js');
        if (fs.existsSync(prefsPath)) {
          let prefsContent = fs.readFileSync(prefsPath, 'utf8');
          // Backup current setting
          const dohMatch = prefsContent.match(/user_pref\("network\.trr\.mode",\s*(\d+)\)/);
          if (dohMatch) {
            dohBackups.firefox = dohMatch[1];
          }
          // Disable DoH (mode 5 = off)
          prefsContent = prefsContent.replace(/user_pref\("network\.trr\.mode".*\)/g, '');
          prefsContent += '\nuser_pref("network.trr.mode", 5);\n';
          fs.writeFileSync(prefsPath, prefsContent);
          safeLog(`✅ Firefox DoH disabled (profile: ${profile})`);
        }
      });
    }
  } catch (e) {
    safeError('Could not disable Firefox DoH:', e);
  }
  
  // Safari - disable DoH by modifying DNS settings
  // Safari uses system DNS, so we'll set DNS servers that don't use DoH
  disableSafariDoH();
}

// Disable Safari DoH by modifying system DNS settings
function disableSafariDoH() {
  if (process.platform !== 'darwin') return;
  
  safeLog('Disabling Safari DoH by modifying DNS settings...');
  
  const { exec } = require('child_process');
  
  // Get list of network services
  exec('networksetup -listallnetworkservices', (err, stdout) => {
    if (err) {
      safeError('Failed to list network services for Safari DoH:', err);
      return;
    }
    
    // Parse network services (skip unsupported ones)
    const unsupportedServices = ['Thunderbolt Bridge', 'PPPoE', 'Bluetooth', 'FireWire'];
    const services = stdout.toString().split('\n')
      .filter(line => {
        const trimmed = line.trim();
        return trimmed && 
               !trimmed.includes('*') && 
               !trimmed.includes('denotes') &&
               !unsupportedServices.some(unsupported => trimmed.includes(unsupported));
      })
      .map(line => line.trim());
    
    // For each service, backup current DNS and set to non-DoH DNS servers
    // Use Cloudflare's regular DNS (1.1.1.1) instead of DoH
    const regularDNSServers = ['1.1.1.1', '1.0.0.1']; // Cloudflare regular DNS (not DoH)
    
    services.forEach(service => {
      if (!service) return;
      
      const escapedService = service.replace(/"/g, '\\"');
      
      // Get current DNS servers
      exec(`networksetup -getdnsservers "${escapedService}"`, (err, stdout) => {
        if (err) {
          safeError(`Failed to get DNS for ${service}:`, err);
          return;
        }
        
        const currentDNS = stdout.toString().trim();
        // Backup current DNS
        safariDNSBackups[service] = currentDNS;
        
        // Set regular DNS servers (non-DoH)
        const options = {
          name: '0per8r',
          icns: '/System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/AlertNoteIcon.icns',
        };
        
        const setDNSCommand = `networksetup -setdnsservers "${escapedService}" ${regularDNSServers.join(' ')}`;
        
        sudo.exec(setDNSCommand, options, (error) => {
          if (error) {
            safeError(`Failed to set DNS for ${service}:`, error);
          } else {
            safeLog(`✅ Safari DoH disabled for ${service} (DNS set to regular servers)`);
          }
        });
      });
    });
  });
}

// Restore Safari DNS settings
function restoreSafariDoH() {
  if (process.platform !== 'darwin') return;
  
  safeLog('Restoring Safari DNS settings...');
  
  const options = {
    name: '0per8r',
    icns: '/System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/AlertStopIcon.icns',
  };
  
  // Restore DNS for each service
  Object.keys(safariDNSBackups).forEach(service => {
    const escapedService = service.replace(/"/g, '\\"');
    const originalDNS = safariDNSBackups[service];
    
    let restoreCommand;
    if (originalDNS.includes('There aren\'t any DNS Servers') || originalDNS === '') {
      // No DNS was set, clear it
      restoreCommand = `networksetup -setdnsservers "${escapedService}" Empty`;
    } else {
      // Restore original DNS servers
      const dnsServers = originalDNS.split('\n').filter(s => s.trim()).join(' ');
      restoreCommand = `networksetup -setdnsservers "${escapedService}" ${dnsServers}`;
    }
    
    sudo.exec(restoreCommand, options, (error) => {
      if (error) {
        safeError(`Failed to restore DNS for ${service}:`, error);
      } else {
        safeLog(`✅ Safari DNS restored for ${service}`);
      }
    });
  });
  
  // Clear backups
  safariDNSBackups = {};
}

// Restore DNS over HTTPS settings
function restoreDoH() {
  if (process.platform !== 'darwin') return;
  
  safeLog('Restoring DNS over HTTPS settings...');
  
  const os = require('os');
  const homeDir = os.homedir();
  
  // Chrome/Chromium
  const chromePrefsPath = path.join(homeDir, 'Library/Application Support/Google/Chrome/Default/Preferences');
  try {
    if (fs.existsSync(chromePrefsPath) && dohBackups.chrome !== undefined) {
      const prefs = JSON.parse(fs.readFileSync(chromePrefsPath, 'utf8'));
      if (dohBackups.chrome !== null) {
        if (!prefs.dns_over_https) prefs.dns_over_https = {};
        prefs.dns_over_https.mode = dohBackups.chrome;
      } else {
        delete prefs.dns_over_https;
      }
      fs.writeFileSync(chromePrefsPath, JSON.stringify(prefs, null, 2));
      safeLog('✅ Chrome DoH restored');
    }
  } catch (e) {
    safeError('Could not restore Chrome DoH:', e);
  }
  
  // Firefox
  const firefoxProfilesPath = path.join(homeDir, 'Library/Application Support/Firefox/Profiles');
  try {
    if (fs.existsSync(firefoxProfilesPath) && dohBackups.firefox !== undefined) {
      const profiles = fs.readdirSync(firefoxProfilesPath).filter(p => p.endsWith('.default-release') || p.endsWith('.default'));
      profiles.forEach(profile => {
        const prefsPath = path.join(firefoxProfilesPath, profile, 'prefs.js');
        if (fs.existsSync(prefsPath)) {
          let prefsContent = fs.readFileSync(prefsPath, 'utf8');
          // Restore original setting
          prefsContent = prefsContent.replace(/user_pref\("network\.trr\.mode".*\)/g, '');
          if (dohBackups.firefox !== undefined) {
            prefsContent += `\nuser_pref("network.trr.mode", ${dohBackups.firefox});\n`;
          }
          fs.writeFileSync(prefsPath, prefsContent);
          safeLog(`✅ Firefox DoH restored (profile: ${profile})`);
        }
      });
    }
  } catch (e) {
    safeError('Could not restore Firefox DoH:', e);
  }
  
  // Clear backups
  dohBackups = {};
  
  // Also restore Safari DNS
  restoreSafariDoH();
}

// Flush DNS cache to make hosts file changes take effect immediately
function flushDNSCache() {
  return new Promise((resolve, reject) => {
    if (process.platform !== 'darwin') {
      resolve(); // Not needed on other platforms
      return;
    }

    const options = {
      name: '0per8r',
      icns: '/System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/AlertNoteIcon.icns',
    };

    // Flush DNS cache on macOS - more aggressive approach
    // Note: sudo-prompt handles sudo, so don't include "sudo" in the command
    const command = 'dscacheutil -flushcache; killall -HUP mDNSResponder; dscacheutil -flushcache; killall -HUP mDNSResponder';
    
    sudo.exec(command, options, (error, stdout, stderr) => {
      if (error) {
        safeError('DNS flush error:', error);
        // Try without sudo as fallback
        const { exec } = require('child_process');
        exec('dscacheutil -flushcache; killall -HUP mDNSResponder', (e) => {
          if (e) {
            safeError('Non-sudo DNS flush also failed:', e);
          } else {
            safeLog('DNS cache flushed (non-sudo)');
          }
        });
        reject(error);
      } else {
        safeLog('DNS cache flushed successfully (multiple times)');
        // Also try to flush browser-specific DNS caches
        const { exec } = require('child_process');
        exec('killall -HUP mDNSResponder', () => {}); // Don't wait for this
        resolve();
      }
    });
  });
}

// Restore original hosts file - ALWAYS removes blocking entries
function restoreHostsFile() {
  if (process.platform !== 'darwin') return;
  
  safeLog('🧹 Restoring hosts file - removing ALL blocking entries...');

  const options = {
    name: '0per8r',
    icns: '/System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/AlertStopIcon.icns',
  };

  // Read current hosts file and remove blocking entries, then restore
  // This works even if backup doesn't exist
  // Use a temp Python script file for more reliable execution
  const pythonScriptPath = path.join(initializeAppDataPath(), 'restore_hosts.py');
  const pythonScript = `
import sys
import os

hosts_path = "${hostsOriginalPath}"
backup_path = "${hostsBackupPath}"

# Try to restore from backup first (if exists)
if os.path.exists(backup_path):
    try:
        with open(backup_path, 'r') as f:
            backup_content = f.read()
        with open(hosts_path, 'w') as f:
            f.write(backup_content)
        os.remove(backup_path)
        print("Restored from backup")
        sys.exit(0)
    except Exception as e:
        print(f"Error restoring from backup: {e}", file=sys.stderr)

# No backup - remove blocking entries directly from hosts file
if not os.path.exists(hosts_path):
    print("Hosts file not found", file=sys.stderr)
    sys.exit(1)

try:
    with open(hosts_path, 'r') as f:
        lines = f.readlines()
    
    # Filter out blocking lines
    cleaned_lines = []
    blocked_domains = ['facebook', 'twitter', 'instagram', 'youtube', 'reddit', 'tiktok', 
                     'amazon', 'netflix', 'steam', 'discord', 'x.com', 't.co', 'linkedin',
                     'pinterest', 'snapchat', 'twitch', 'whatsapp', 'telegram', 'wechat',
                     'hulu', 'disney', 'hbo', 'vimeo', 'dailymotion', 'crunchyroll',
                     'epicgames', 'roblox', 'minecraft', 'battle.net', 'playstation', 'xbox',
                     'cnn', 'bbc', 'nytimes', 'buzzfeed', 'vice', 'tmz', 'people', 'eonline',
                     'ebay', 'etsy', 'aliexpress', '9gag', 'imgur', 'giphy', 'gfycat',
                     'vine', 'tumblr', 'flickr', 'deviantart', 'apple.com', 'fb.com',
                     'instagram.net', 'tiktokcdn.com', 'redd.it', 'old.reddit.com',
                     'pinimg.com', 'discord.gg', 'discordapp.com', 'ttvnw.net',
                     'nflxext.com', 'nflximg.net', 'disneyplus.com', 'disney-plus.net',
                     'hbomax.com', 'primevideo.com', 'amazonvideo.com', 'amazon.co.uk', 'amazon.de']
    
    original_count = len(lines)
    
    for line in lines:
        line_lower = line.lower()
        # Skip if line contains blocking markers
        if '0per8r' in line_lower or 'blocked distracting' in line_lower or '# blocked' in line_lower:
            continue
        # Skip 127.0.0.1 entries for blocked domains (remove ALL of them)
        if line.strip().startswith('127.0.0.1'):
            parts = line.strip().split()
            if len(parts) > 1:
                domain = parts[1].lower()
                # Remove www. prefix for matching
                domain_clean = domain.replace('www.', '').replace('m.', '')
                # Check if this domain should be unblocked
                if any(blocked in domain_clean for blocked in blocked_domains):
                    continue
        cleaned_lines.append(line)
    
    removed_count = original_count - len(cleaned_lines)
    
    # Write cleaned hosts file
    with open(hosts_path, 'w') as f:
        f.writelines(cleaned_lines)
    
    print(f"Removed {removed_count} blocking entries")
    
except Exception as e:
    print(f"Error: {e}", file=sys.stderr)
    sys.exit(1)
  `;
  
  // Write Python script to temp file
  try {
    fs.writeFileSync(pythonScriptPath, pythonScript);
  } catch (e) {
    safeError('Could not write restore script:', e);
    return;
  }
  
  const restoreScript = `
    python3 "${pythonScriptPath}" && rm "${pythonScriptPath}" || rm "${pythonScriptPath}"
    # Flush DNS cache
    dscacheutil -flushcache 2>/dev/null || true
    killall -HUP mDNSResponder 2>/dev/null || true
  `;

  sudo.exec(restoreScript, options, (error, stdout, stderr) => {
    if (error) {
      safeError('Restore error:', error);
      safeLog('⚠️ Could not restore hosts file automatically. You may need to manually edit /etc/hosts to remove blocking entries.');
    } else {
      safeLog('✅ Hosts file restored successfully - ALL blocking entries removed');
      hostsModified = false;
    }
  });
}

// IPC handlers are registered in registerIpcHandlers() - called after app.whenReady()

// REMOVED: Top-level ipcMain handlers - moved to registerIpcHandlers() to fix load order
// (ipcMain may not be available when module loads in some Electron contexts)
function _removedIpcPlaceholder() {
  // Placeholder - real handlers in registerIpcHandlers()
  void ipcMain; // Reference to ensure ipcMain is in scope when registerIpcHandlers runs
}

// Disable hardware acceleration - MUST be before app.whenReady
app.disableHardwareAcceleration();

// (Duplicate ipcMain handlers removed - see registerIpcHandlers)
/*
  try {
    safeLog('🛑 Stop session called - restoring blocking...');
    isLocked = false;
    stopMonitoring();
    
    // Restore blocking with password prompt
    // Note: restoreCombinedBlocking() already calls restoreHostsFile() internally
    // so we don't call it separately to avoid double password prompts
    safeLog('Restoring system-wide blocking (password prompt will appear)...');
    restoreCombinedBlocking();
    restoreDoH();
    
    // Always make window closable and exit fullscreen
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setClosable(true);
      mainWindow.setMinimizable(true);
      try {
        mainWindow.setFullScreen(false);
      } catch (e) {
        safeError('Error exiting fullscreen:', e);
      }
    }
    return { ok: true };
  } catch (e) {
    safeError('Error in stop-session:', e);
    return { ok: false, error: e.message };
  }
});

ipcMain.on('set-locked', (event, locked) => {
  isLocked = locked;
  if (mainWindow && !mainWindow.isDestroyed()) {
    // ALWAYS allow closing - never lock the window completely
    mainWindow.setClosable(true);
    mainWindow.setMinimizable(true); // Always allow minimizing too
    if (locked) {
      try {
        mainWindow.setFullScreen(true);
      } catch (e) {
        safeError('Error setting fullscreen:', e);
      }
    } else {
      try {
        mainWindow.setFullScreen(false);
      } catch (e) {
        safeError('Error exiting fullscreen:', e);
      }
    }
  }
});

ipcMain.on('request-fullscreen', () => {
  if (mainWindow) {
    mainWindow.setFullScreen(true);
  }
});

ipcMain.on('exit-fullscreen', () => {
  if (mainWindow && !isLocked) {
    mainWindow.setFullScreen(false);
  }
});

*/
function registerIpcHandlers() {
  ipcMain.handle('get-running-apps', async () => getRunningApps());
  ipcMain.handle('open-uninstaller', async () => {
    if (process.platform !== 'win32') return { ok: false, error: 'Uninstaller only available on Windows' };
    try {
      const installDir = path.dirname(process.execPath);
      const uninstallerPath = path.join(installDir, 'Uninstall 0per8r.exe');
      if (fs.existsSync(uninstallerPath)) {
        shell.openPath(uninstallerPath);
        return { ok: true };
      }
      shell.openExternal('ms-settings:appsfeatures');
      return { ok: false, error: 'Uninstaller not found. Use Settings > Apps to uninstall.' };
    } catch (e) {
      safeError('Failed to open uninstaller:', e);
      return { ok: false, error: e.message };
    }
  });
  ipcMain.handle('get-logs', async () => logHistory);
  ipcMain.handle('get-log-path', async () => path.join(initializeAppDataPath(), 'app.log'));
  ipcMain.handle('start-session', async (_event, payload) => {
    try {
      safeLog('start-session called with payload:', payload);
      const { allowApps, allowSites, googleAlwaysAllowed: allowGoogle } = payload || {};
      await startMonitoring(allowApps || [], allowSites || [], allowGoogle !== false);
      safeLog('start-session completed successfully');
      return { ok: true };
    } catch (error) {
      safeError('Error in start-session handler:', error);
      return { ok: false, error: error.message };
    }
  });
  ipcMain.handle('stop-session', async () => {
    try {
      safeLog('🛑 Stop session called - restoring blocking...');
      isLocked = false;
      stopMonitoring();
      safeLog('Restoring system-wide blocking (password prompt will appear)...');
      restoreCombinedBlocking();
      restoreDoH();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setClosable(true);
        mainWindow.setMinimizable(true);
        try { mainWindow.setFullScreen(false); } catch (e) { safeError('Error exiting fullscreen:', e); }
      }
      return { ok: true };
    } catch (error) {
      safeError('Error in stop-session handler:', error);
      return { ok: false, error: error.message };
    }
  });
  ipcMain.on('set-locked', (event, locked) => {
    isLocked = locked;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setClosable(!locked);
      mainWindow.setMinimizable(!locked);
    }
  });
  ipcMain.on('request-fullscreen', () => { if (mainWindow) mainWindow.setFullScreen(true); });
  ipcMain.on('exit-fullscreen', () => { if (mainWindow && !isLocked) mainWindow.setFullScreen(false); });
  ipcMain.handle('check-for-updates', async () => {
    if (!autoUpdater) return { success: false, error: 'Auto-updater not loaded' };
    try {
      const result = await autoUpdater.checkForUpdates();
      return { success: true, updateInfo: result?.updateInfo };
    } catch (error) {
      safeError('Error checking for updates:', error);
      return { success: false, error: error.message };
    }
  });
  ipcMain.handle('quit-and-install', () => {
    if (isLocked) stopMonitoring();
    if (autoUpdater) autoUpdater.quitAndInstall(false);
  });
  ipcMain.on('restart-and-install', () => {
    if (isLocked) stopMonitoring();
    if (autoUpdater) autoUpdater.quitAndInstall(true);
  });
}

app.whenReady().then(() => {
  registerIpcHandlers();
  initializeAppDataPath();
  const logPath = path.join(appDataPath, 'app.log');
  safeLog('═══════════════════════════════════════════════════════════');
  safeLog('0per8r Starting...');
  safeLog('Log file location:', logPath);
  safeLog('App environment:', app.isPackaged ? 'BUILT APP' : 'LOCAL DEV');
  safeLog('═══════════════════════════════════════════════════════════');
  createWindow();
  initializeAutoUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
  
  // DISABLED: No longer restoring hosts file on startup to prevent password prompts
  // Users can manually restore using provided scripts if needed
  safeLog('🔍 Startup hosts file restore disabled to prevent password prompts');
});

// Auto-updater configuration
function initializeAutoUpdater() {
  try {
    const { autoUpdater: updater } = require('electron-updater');
    autoUpdater = updater;
  } catch (e) {
    safeError('Failed to load auto-updater:', e);
    return;
  }
  // Re-enabled for v1.2.8 - ensure latest-mac.yml / latest.yml are uploaded to GitHub releases
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  
  // Update events
  autoUpdater.on('checking-for-update', () => {
    safeLog('Checking for updates...');
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-status', { status: 'checking' });
    }
  });
  
  autoUpdater.on('update-available', (info) => {
    safeLog('Update available:', info.version);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-status', {
        status: 'available',
        version: info.version,
        releaseDate: info.releaseDate
      });
    }
  });
  
  autoUpdater.on('update-not-available', (info) => {
    safeLog('Update not available. Current version is latest.');
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-status', { status: 'not-available' });
    }
  });
  
  autoUpdater.on('error', (err) => {
    safeError('Error in auto-updater:', err);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-status', {
        status: 'error',
        message: err.message
      });
    }
  });
  
  autoUpdater.on('download-progress', (progressObj) => {
    const message = `Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent}% (${progressObj.transferred}/${progressObj.total})`;
    safeLog(message);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-progress', {
        percent: progressObj.percent,
        bytesPerSecond: progressObj.bytesPerSecond,
        transferred: progressObj.transferred,
        total: progressObj.total
      });
    }
  });
  
  autoUpdater.on('update-downloaded', (info) => {
    safeLog('Update downloaded:', info.version);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-status', {
        status: 'downloaded',
        version: info.version
      });
    }
  });
}

// Check and restore blocking on startup (in case app crashed during focus mode)
// DISABLED: No longer restoring on startup to avoid password prompts
// The blocking will be restored when user explicitly quits or exits focus mode
function checkAndRestoreHostsFile() {
  // Disabled to prevent password prompt on startup
  // Users can manually restore using the provided scripts if needed
  safeLog('🔍 Startup hosts file check disabled to prevent password prompts');
  return;
}

app.on('window-all-closed', () => {
  // Always quit when all windows are closed - don't keep app running
  app.quit();
});

app.on('before-quit', async (event) => {
  // Only show quit confirmation with password prompt if in focus mode
  if (isLocked && mainWindow && !mainWindow.isDestroyed()) {
    event.preventDefault();
    
    try {
      // Show confirmation dialog first
      const { response } = await dialog.showMessageBox(mainWindow, {
        type: 'question',
        buttons: ['Cancel', 'Quit'],
        defaultId: 1,
        cancelId: 0,
        title: 'Quit 0per8r?',
        message: 'Are you certain you want to quit?',
        detail: 'You will need to enter your ACCOUNT password 3 times to confirm.'
      });
      
      if (response === 0) {
        // User cancelled
        return;
      }
      
      // Request password verification from renderer
      const passwordVerified = await new Promise((resolve) => {
        if (!mainWindow || mainWindow.isDestroyed()) {
          resolve(false);
          return;
        }
        
        // Send message to renderer to show password prompt (3 attempts)
        mainWindow.webContents.send('request-quit-password', { attempts: 3 });
        
        // Set up listener for password response
        const passwordListener = (event, verified) => {
          ipcMain.removeListener('quit-password-verified', passwordListener);
          resolve(verified === true);
        };
        
        ipcMain.once('quit-password-verified', passwordListener);
        
        // Timeout after 60 seconds (longer for 3 attempts)
        setTimeout(() => {
          ipcMain.removeListener('quit-password-verified', passwordListener);
          resolve(false);
        }, 60000);
      });
      
      if (!passwordVerified) {
        // Password incorrect or cancelled
        return;
      }
      
      // Password verified - now restore blocking (system password prompts are OK - blocking MUST work)
      // Stop monitoring first
      isQuitting = true;
      stopMonitoring();
      
      // Restore blocking - system password prompts are acceptable to ensure blocking is properly restored
      safeLog('Restoring system-wide blocking after password verification...');
      safeLog('System password prompt will appear to restore proxy settings and hosts file.');
      
      // Wait for restore to complete before quitting
      try {
        // Restore system-wide blocking (proxy + hosts file in ONE password prompt, then DoH)
        // restoreCombinedBlockingPromise includes both proxy and hosts file restoration
        await new Promise((resolve) => {
          restoreCombinedBlockingPromise().then(() => resolve()).catch(() => resolve());
        });
        
        // DoH restoration doesn't need sudo, so do it separately
        await new Promise((resolve) => {
          restoreDoHPromise().then(() => resolve()).catch(() => resolve());
        });
        
        safeLog('✅ All blocking restore operations completed');
      } catch (e) {
        safeError('Error during restore:', e);
      }
      
      // Also clean up app-level blocking
      removeWebRequestBlocking();
      
      // Stop servers
      if (blockingProxyServer) {
        blockingProxyServer.close();
        blockingProxyServer = null;
      }
      if (pacServer) {
        pacServer.close();
        pacServer = null;
      }
      
      safeLog('Blocking restored after password verification - app will quit');
      
      // Force close all windows
      BrowserWindow.getAllWindows().forEach(window => {
        if (!window.isDestroyed()) {
          try {
            window.destroy();
          } catch (e) {
            safeError('Error destroying window:', e);
          }
        }
      });
      
      app.quit();
      return;
    } catch (e) {
      safeError('Error in quit confirmation:', e);
      return;
    }
  }
  
  // Not in focus mode or no window - just clean up
  isQuitting = true;
  stopMonitoring();
  
  // Force close all windows to prevent stuck windows
  BrowserWindow.getAllWindows().forEach(window => {
    if (!window.isDestroyed()) {
      try {
        window.destroy();
      } catch (e) {
        safeError('Error destroying window:', e);
      }
    }
  });
});

// Handle actual quit
app.on('will-quit', (event) => {
  isQuitting = true;
  if (isLocked) {
    // Last chance to restore if still locked
    stopMonitoring();
  }
});

// Handle uncaught exceptions gracefully
process.on('uncaughtException', (error) => {
  if (!isQuitting) {
    safeError('Uncaught Exception:', error);
  }
  // Don't crash the app, just log it
});

process.on('unhandledRejection', (reason, promise) => {
  if (!isQuitting) {
    safeError('Unhandled Rejection at:', promise, 'reason:', reason);
  }
});
