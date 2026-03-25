#!/usr/bin/env node
/**
 * Emergency hosts file restore using GUI password dialog
 * Run with: node fix_hosts_gui.js
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

/** Escape a string for use inside an AppleScript double-quoted literal. */
function appleScriptEscape(str) {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/** Run a shell command with GUI admin prompt (Node 24–safe; avoids sudo-prompt / util.isObject). */
function runShellWithAdminPrivileges(shellOneLiner) {
  const inner = appleScriptEscape(shellOneLiner);
  const appleScript = `do shell script "bash -lc " & quoted form of "${inner}" with administrator privileges`;
  const r = spawnSync('osascript', ['-e', appleScript], { stdio: 'inherit' });
  if (r.error) throw r.error;
  if (r.status !== 0 && r.status !== null) {
    const err = new Error(`osascript exited with code ${r.status}`);
    err.code = r.status;
    throw err;
  }
}

const hostsPath = '/etc/hosts';

console.log('🔧 Restoring hosts file...');
console.log('This will show a GUI password dialog...\n');

// Read hosts file first to see what needs to be cleaned
let hostsContent;
try {
  hostsContent = fs.readFileSync(hostsPath, 'utf8');
} catch (e) {
  console.error('❌ Could not read hosts file:', e.message);
  process.exit(1);
}

// Filter out blocking lines
const lines = hostsContent.split('\n');
const cleanedLines = [];
const blockedKeywords = ['0per8r', 'blocked distracting', '# blocked', 'focus os blocking'];
const blockedDomains = ['facebook', 'twitter', 'instagram', 'youtube', 'reddit', 'tiktok', 
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
                     'hbomax.com', 'primevideo.com', 'amazonvideo.com', 'amazon.co.uk', 'amazon.de',
                     'funimation.com', 'youtu.be', 'm.facebook', 'm.youtube'];

let removedCount = 0;

for (const line of lines) {
  const lineLower = line.toLowerCase();
  let shouldSkip = false;
  
  // Skip if line contains blocking markers
  for (const keyword of blockedKeywords) {
    if (lineLower.includes(keyword)) {
      shouldSkip = true;
      removedCount++;
      break;
    }
  }
  
  if (shouldSkip) continue;
  
  // Skip 127.0.0.1 entries for blocked domains
  if (line.trim().startsWith('127.0.0.1')) {
    const parts = line.trim().split(/\s+/);
    if (parts.length > 1) {
      const domain = parts[1].toLowerCase();
      const domainClean = domain.replace('www.', '').replace('m.', '');
      for (const blocked of blockedDomains) {
        if (domainClean.includes(blocked)) {
          shouldSkip = true;
          removedCount++;
          break;
        }
      }
    }
  }
  
  if (!shouldSkip) {
    cleanedLines.push(line);
  }
}

const cleanedContent = cleanedLines.join('\n');

if (removedCount === 0) {
  console.log('✅ No blocking entries found - hosts file is already clean!');
  process.exit(0);
}

console.log(`Found ${removedCount} blocking entries to remove...`);

// Create temp file with cleaned content
const tempPath = path.join(__dirname, 'hosts_cleaned.tmp');
fs.writeFileSync(tempPath, cleanedContent);

const command = `cp "${tempPath}" "${hostsPath}" && rm "${tempPath}" && dscacheutil -flushcache && killall -HUP mDNSResponder`;

console.log('📝 Requesting admin privileges (GUI password dialog will appear)...\n');

let error;
try {
  runShellWithAdminPrivileges(command);
} catch (e) {
  error = e;
}

// Clean up temp file even if command failed
try {
  if (fs.existsSync(tempPath)) {
    fs.unlinkSync(tempPath);
  }
} catch (e) {
  // Ignore cleanup errors
}

if (error) {
  console.error('❌ Error:', error.message);
  if (
    String(error.message).includes('(-128)') ||
    error.code === 1 ||
    error.message.includes('cancelled')
  ) {
    console.error('\n⚠️  Password prompt was cancelled or permission denied.');
    console.error('Please try again and enter your admin password when prompted.');
  } else {
    console.error('\n⚠️  Could not restore hosts file. You may need admin privileges.');
  }
  process.exit(1);
}

console.log('✅ Hosts file restored successfully!');
console.log(`✅ Removed ${removedCount} blocking entries`);
console.log('✅ DNS cache flushed');
console.log('\n✅ DONE! Amazon and all other sites should work now.');
process.exit(0);



