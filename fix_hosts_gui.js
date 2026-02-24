#!/usr/bin/env node
/**
 * Emergency hosts file restore using GUI password dialog
 * Run with: node fix_hosts_gui.js
 */

const sudo = require('sudo-prompt');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

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

// Use sudo-prompt to copy temp file to /etc/hosts
const options = {
  name: '0per8r Hosts Restore',
  icns: '/System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/AlertStopIcon.icns',
};

const command = `cp "${tempPath}" "${hostsPath}" && rm "${tempPath}" && dscacheutil -flushcache && killall -HUP mDNSResponder`;

console.log('📝 Requesting admin privileges (GUI password dialog will appear)...\n');

sudo.exec(command, options, (error, stdout, stderr) => {
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
    if (error.message.includes('did not grant permission') || error.message.includes('cancelled')) {
      console.error('\n⚠️  Password prompt was cancelled or permission denied.');
      console.error('Please try again and enter your admin password when prompted.');
    } else {
      console.error('\n⚠️  Could not restore hosts file. You may need admin privileges.');
    }
    process.exit(1);
  } else {
    console.log('✅ Hosts file restored successfully!');
    console.log(`✅ Removed ${removedCount} blocking entries`);
    console.log('✅ DNS cache flushed');
    console.log('\n✅ DONE! Amazon and all other sites should work now.');
    process.exit(0);
  }
});



