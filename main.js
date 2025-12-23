const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const activeWin = require('active-win');
const sudo = require('sudo-prompt');
const fs = require('fs');
const http = require('http');
const https = require('https');
const { exec } = require('child_process');
const httpProxy = require('http-proxy');
const net = require('net');
const { autoUpdater } = require('electron-updater');

let mainWindow = null;
let isLocked = false;
let allowedApps = [];
let allowedSites = [];
let appMonitorInterval = null;
let webRequestListener = null;
let isQuitting = false;
let monitoringPaused = false; // Flag to temporarily pause monitoring
let hostsBackupPath = path.join(__dirname, 'hosts.backup');
let hostsOriginalPath = '/etc/hosts';
let hostsModified = false;
let dohBackups = {}; // Store DoH settings backups
let safariDNSBackups = {}; // Store Safari DNS settings
let pacServer = null; // HTTP server for serving PAC file
let blockingProxyServer = null; // Actual proxy server that blocks connections
let proxyPort = 3128; // Port for the blocking proxy server
let currentAllowedDomains = []; // Domains allowed through the proxy

// Safe console logging that won't crash during shutdown
function safeLog(...args) {
  if (isQuitting) return;
  try {
    console.log(...args);
  } catch (e) {
    // Ignore write errors during shutdown
  }
}

function safeError(...args) {
  if (isQuitting) return;
  try {
    console.error(...args);
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
    
    // Allow google.com and all subdomains (including fonts.googleapis.com)
    if (domain === 'google.com' || domain.endsWith('.google.com')) {
      return; // Allow
    }
    
    // Allow fonts.gstatic.com for Google Fonts
    if (domain === 'fonts.gstatic.com' || domain.endsWith('.gstatic.com')) {
      return; // Allow
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
    
    // Allow google.com
    if (domain === 'google.com' || domain.endsWith('.google.com')) {
      return { action: 'allow' };
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

  mainWindow.on('close', (event) => {
    // Always allow closing - just clean up
    isQuitting = true;
    stopMonitoring();
    // Don't prevent close - user should always be able to exit
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

function quitApp(appName) {
  if (process.platform === 'darwin') {
    const { exec } = require('child_process');
    const safeName = appName.replace(/"/g, '\\"');
    exec(`osascript -e 'tell application "${safeName}" to quit'`);
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

async function monitorActiveApp() {
  if (!isLocked || allowedApps.length === 0 || isQuitting || monitoringPaused) return;
  try {
    const active = await activeWin();
    if (!active || !active.owner) return;
    const activeNameRaw = active.owner.name || active.owner.path?.split(path.sep).pop() || '';
    const activeName = activeNameRaw.replace('.app', '').trim();
    const normalizedActive = activeName.toLowerCase();

    // System processes that should always be allowed (password prompts, system dialogs, etc.)
    const systemProcesses = [
      'securityagent', // macOS password prompt
      'osascript', // AppleScript
      'sudo', // sudo prompt
      'system events', // System Events
      'system preferences', // System Preferences
      'system settings', // System Settings
      'loginwindow', // Login window
      'windowserver', // Window Server
      'dock', // Dock
      'finder', // Finder (if allowed)
      '0per8r', // This app
      'electron' // Electron
    ];
    
    const allowed = [...allowedApps, ...systemProcesses]
      .map((a) => a.toLowerCase().trim())
      .filter(Boolean);

    const isAllowed = allowed.some((a) => normalizedActive.includes(a) || a.includes(normalizedActive));

    if (!isAllowed && !isQuitting) {
      if (mainWindow && !mainWindow.isDestroyed()) {
        try {
          mainWindow.webContents.send('break-attempt', { type: 'app_switch', app: activeName });
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.focus();
        } catch (e) {
          // Window might be destroyed
        }
      }
      quitApp(activeName);
    }
  } catch (err) {
    safeError('monitorActiveApp error', err);
  }
}

function startMonitoring(apps, sites) {
  allowedApps = apps || [];
  allowedSites = sites || [];
  isLocked = true;

  if (appMonitorInterval) clearInterval(appMonitorInterval);
  appMonitorInterval = setInterval(monitorActiveApp, 2000);
  monitorActiveApp();
  
  // Apply website blocking using session API (for Electron app)
  setupWebRequestBlocking(allowedSites);
  
  // Don't quit browsers - user wants tab groups to remain
  // Just set up proxy blocking - it will intercept ALL requests from any tab (including restored tabs)
  safeLog('Setting up proxy blocking - all requests will be intercepted...');
  // Apply system-wide blocking (PAC + hosts + DNS) - all in ONE password prompt
  setupHostsFileBlocking(allowedSites);
}

function stopMonitoring() {
  isLocked = false;
  allowedApps = [];
  allowedSites = [];
  if (appMonitorInterval) {
    clearInterval(appMonitorInterval);
    appMonitorInterval = null;
  }
  removeWebRequestBlocking();
  // Restore everything in ONE script (PAC + hosts + DNS)
  restoreCombinedBlocking();
  // Re-enable DNS over HTTPS in browsers
  restoreDoH();
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
    
    // Always allow google.com and ALL its subdomains (including fonts.googleapis.com)
    if (domain === 'google.com' || domain.endsWith('.google.com')) {
      callback({ cancel: false });
      return;
    }
    
    // Always allow fonts.gstatic.com for Google Fonts
    if (domain === 'fonts.gstatic.com' || domain.endsWith('.gstatic.com')) {
      callback({ cancel: false });
      return;
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

// Comprehensive list of distracting domains to block
// This blocks these system-wide via hosts file across ALL browsers
// Note: Since hosts file can't use wildcards, we block specific domains
// This covers the vast majority of distracting sites
const DISTRACTING_DOMAINS = [
  // Social Media
  'facebook.com', 'www.facebook.com', 'm.facebook.com', 'fb.com', 'facebook.net',
  'twitter.com', 'www.twitter.com', 'x.com', 'www.x.com', 't.co',
  'instagram.com', 'www.instagram.com', 'instagram.net',
  'tiktok.com', 'www.tiktok.com', 'tiktokcdn.com',
  'reddit.com', 'www.reddit.com', 'old.reddit.com', 'redd.it',
  'linkedin.com', 'www.linkedin.com', 'linkedin.com',
  'pinterest.com', 'www.pinterest.com', 'pinimg.com',
  'snapchat.com', 'www.snapchat.com',
  'discord.com', 'www.discord.com', 'discord.gg', 'discordapp.com',
  'twitch.tv', 'www.twitch.tv', 'ttvnw.net',
  'whatsapp.com', 'www.whatsapp.com',
  'telegram.org', 'web.telegram.org',
  'wechat.com', 'www.wechat.com',
  
  // Video/Entertainment
  'youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'youtube-nocookie.com',
  'netflix.com', 'www.netflix.com', 'nflxext.com', 'nflximg.net',
  'hulu.com', 'www.hulu.com',
  'disney.com', 'www.disney.com', 'disneyplus.com', 'disney-plus.net',
  'hbo.com', 'www.hbo.com', 'hbomax.com',
  'amazon.com', 'www.amazon.com', 'primevideo.com', 'amazonvideo.com',
  'vimeo.com', 'www.vimeo.com',
  'dailymotion.com', 'www.dailymotion.com',
  'crunchyroll.com', 'www.crunchyroll.com',
  'funimation.com', 'www.funimation.com',
  
  // Gaming
  'steamcommunity.com', 'steam-chat.com', 'steampowered.com', 'steamstatic.com',
  'epicgames.com', 'www.epicgames.com',
  'roblox.com', 'www.roblox.com',
  'minecraft.net', 'www.minecraft.net',
  'battle.net', 'www.battle.net',
  'playstation.com', 'www.playstation.com',
  'xbox.com', 'www.xbox.com',
  
  // News/Media (distracting)
  'cnn.com', 'www.cnn.com',
  'bbc.com', 'www.bbc.com', 'bbc.co.uk',
  'nytimes.com', 'www.nytimes.com',
  'buzzfeed.com', 'www.buzzfeed.com',
  'vice.com', 'www.vice.com',
  'tmz.com', 'www.tmz.com',
  'people.com', 'www.people.com',
  'eonline.com', 'www.eonline.com',
  
  // Shopping (distracting)
  'amazon.com', 'www.amazon.com', 'amazon.co.uk', 'amazon.de',
  'ebay.com', 'www.ebay.com',
  'etsy.com', 'www.etsy.com',
  'aliexpress.com', 'www.aliexpress.com',
  
  // Other distracting sites
  '9gag.com', 'www.9gag.com',
  'imgur.com', 'www.imgur.com',
  'giphy.com', 'www.giphy.com',
  'gfycat.com', 'www.gfycat.com',
  'vine.co', 'www.vine.co',
  'tumblr.com', 'www.tumblr.com',
  'flickr.com', 'www.flickr.com',
  'deviantart.com', 'www.deviantart.com',
  
  // Test site (for verification)
  'apple.com', 'www.apple.com'
];

// Setup system-wide blocking using pfctl (macOS Packet Filter) - more effective than hosts file
function setupHostsFileBlocking(allowList = []) {
  if (process.platform !== 'darwin') {
    safeLog('System-wide blocking only supported on macOS');
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

  // Always allow google.com and Google Fonts
  const alwaysAllowed = ['google.com', 'fonts.googleapis.com', 'fonts.gstatic.com', ...normalizedAllow];
  
  // Filter out allowed domains from blocking list
  const domainsToBlock = DISTRACTING_DOMAINS.filter(domain => {
    const cleanDomain = domain.replace(/^www\./, '').toLowerCase();
    return !alwaysAllowed.some(allowed => {
      const cleanAllowed = allowed.replace(/^www\./, '').toLowerCase();
      return cleanDomain === cleanAllowed || 
             cleanDomain.endsWith('.' + cleanAllowed) ||
             cleanAllowed.endsWith('.' + cleanDomain);
    });
  });

  safeLog(`Setting up system-wide blocking - blocking ALL sites except allowed ones...`);
  
  // Use a single combined script to minimize password prompts (ONE prompt total)
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
  startBlockingProxy(alwaysAllowed);
  
  // Note: Browsers will be quit AFTER proxy is fully configured (in success callback)
  // This ensures when browsers reopen, proxy is active and all requests are intercepted
  
  // Create PAC file first (no sudo needed)
  const pacFilePath = path.join(__dirname, 'focusos_proxy.pac');
  
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
    const scriptPath = path.join(__dirname, 'setup_blocking.sh');
    
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
      
      // Create a single script that does everything (ONE password prompt)
      const scriptPath = path.join(__dirname, 'setup_blocking.sh');
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
      
      // Run the script - ONE password prompt
      sudo.exec(`bash "${scriptPath}"`, options, (error, stdout, stderr) => {
        // Clean up script
        try {
          if (fs.existsSync(scriptPath)) {
            fs.unlinkSync(scriptPath);
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
        
        if (stdout) safeLog('Script stdout:', stdout.toString().trim());
        if (stderr) safeError('Script stderr:', stderr.toString().trim());
        
        if (error) {
          safeError('Failed to set up blocking:', error);
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
    const tempPath = path.join(__dirname, 'hosts.temp');
    
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
  const pacFilePath = path.join(__dirname, 'focusos_proxy.pac');
  
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
    const scriptPath = path.join(__dirname, 'restore_blocking.sh');
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
    safeLog('Running restore script to unblock all websites...');
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
      const pacFilePath = path.join(__dirname, 'focusos_proxy.pac');
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
  const pacFilePath = path.join(__dirname, 'focusos_proxy.pac');
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

// Restore original hosts file
function restoreHostsFile() {
  if (process.platform !== 'darwin') return;
  
  // Always try to restore if backup exists (don't check isQuitting/hostsModified)

  // Check if backup exists
  if (!fs.existsSync(hostsBackupPath)) {
    safeLog('No hosts backup file found, skipping restore');
    hostsModified = false;
    return;
  }

  safeLog('Restoring original hosts file...');

  const options = {
    name: '0per8r',
    icns: '/System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/AlertStopIcon.icns',
  };

  // Properly escape paths with spaces
  const command = `cp "${hostsBackupPath}" "${hostsOriginalPath}" && rm "${hostsBackupPath}"`;
  
  sudo.exec(command, options, (error, stdout, stderr) => {
    if (error) {
      safeError('Restore error:', error);
      // Try to restore on next app start
    } else {
      safeLog('✅ Hosts file restored successfully');
      // Flush DNS cache after restore (without sudo prefix)
      const { exec } = require('child_process');
      exec('dscacheutil -flushcache; killall -HUP mDNSResponder', (e) => {
        if (e) {
          safeError('Could not flush DNS after restore:', e);
        } else {
          safeLog('DNS cache flushed after restore');
        }
      });
      hostsModified = false;
    }
  });
}

// IPC Handlers
ipcMain.handle('get-running-apps', async () => getRunningApps());

ipcMain.handle('start-session', async (_event, payload) => {
  try {
    safeLog('start-session called with payload:', payload);
    const { allowApps, allowSites } = payload || {};
    startMonitoring(allowApps || [], allowSites || []);
    safeLog('start-session completed successfully');
    return { ok: true };
  } catch (error) {
    safeError('Error in start-session handler:', error);
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('stop-session', async () => {
  try {
    isLocked = false;
    stopMonitoring();
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

// Disable hardware acceleration to prevent graphics crashes
app.disableHardwareAcceleration();

// Disable hardware acceleration BEFORE app is ready
app.disableHardwareAcceleration();

app.whenReady().then(() => {
  createWindow();
  
  // Initialize auto-updater
  initializeAutoUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
  
  // Check if hosts file needs to be restored (in case of previous crash)
  // Do this AFTER window is created to avoid blocking startup
  // Use a longer delay to ensure window is fully loaded
  setTimeout(() => {
    try {
      checkAndRestoreHostsFile();
    } catch (e) {
      safeError('Error in hosts file check:', e);
    }
  }, 2000);
});

// Auto-updater configuration
function initializeAutoUpdater() {
  // Configure auto-updater
  autoUpdater.checkForUpdatesAndNotify();
  
  // Check for updates every 4 hours
  setInterval(() => {
    if (!isQuitting && mainWindow && !mainWindow.isDestroyed()) {
      autoUpdater.checkForUpdatesAndNotify();
    }
  }, 4 * 60 * 60 * 1000); // 4 hours
  
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

// IPC handlers for update control
ipcMain.handle('check-for-updates', async () => {
  try {
    const result = await autoUpdater.checkForUpdates();
    return { success: true, updateInfo: result?.updateInfo };
  } catch (error) {
    safeError('Error checking for updates:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('quit-and-install', () => {
  if (isLocked) {
    // If in focus mode, restore blocking first
    stopMonitoring();
  }
  autoUpdater.quitAndInstall(false);
});

ipcMain.on('restart-and-install', () => {
  if (isLocked) {
    stopMonitoring();
  }
  autoUpdater.quitAndInstall(true);
});

// Check and restore blocking on startup (in case app crashed during focus mode)
function checkAndRestoreHostsFile() {
  if (process.platform !== 'darwin') return;
  if (isQuitting) return;
  
  try {
    // Check if PAC file exists - if it does, we need to restore blocking
    const pacFilePath = path.join(__dirname, 'focusos_proxy.pac');
    if (fs.existsSync(pacFilePath)) {
      safeLog('⚠️ Found blocking configuration from previous session - restoring...');
      // Restore blocking properly (requires password prompt)
      restoreCombinedBlocking();
    }
  } catch (e) {
    safeError('Error checking blocking configuration:', e);
  }
}

app.on('window-all-closed', () => {
  // Always quit when all windows are closed - don't keep app running
  app.quit();
});

app.on('before-quit', (event) => {
  // If focus mode is active, restore blocking IMMEDIATELY before quitting
  if (isLocked) {
    // On Windows, don't prevent quit - just restore in background
    if (process.platform === 'win32') {
      // Windows: Don't prevent quit, just restore immediately
      isLocked = false;
      if (appMonitorInterval) {
        clearInterval(appMonitorInterval);
        appMonitorInterval = null;
      }
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
      
      // Restore in background (don't wait)
      restoreCombinedBlocking();
      restoreHostsFile();
      restoreDoH();
      
      isQuitting = true;
      // Allow quit immediately on Windows
      return;
    }
    
    // macOS: Can prevent quit and wait
    event.preventDefault();
    safeLog('⚠️ App quitting during focus mode - restoring blocking IMMEDIATELY...');
    
    // Stop monitoring first
    isLocked = false;
    if (appMonitorInterval) {
      clearInterval(appMonitorInterval);
      appMonitorInterval = null;
    }
    removeWebRequestBlocking();
    
    // Stop servers immediately
    if (blockingProxyServer) {
      blockingProxyServer.close();
      blockingProxyServer = null;
    }
    if (pacServer) {
      pacServer.close();
      pacServer = null;
    }
    
    // Restore blocking immediately - this will show password prompt
    restoreCombinedBlocking();
    
    // Also restore hosts file immediately (synchronous where possible)
    restoreHostsFile();
    restoreDoH();
    
    // After a short delay to let restore start, allow quit
    // The restore will continue in background even after app quits
    setTimeout(() => {
      isQuitting = true;
      
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
      
      // Now allow quit
      app.exit(0);
    }, 1000);
  } else {
    // Clean up properly before quitting
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
  }
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
