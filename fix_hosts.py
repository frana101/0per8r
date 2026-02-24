#!/usr/bin/env python3
"""
Emergency hosts file restore - removes all blocking entries
Run with: sudo python3 fix_hosts.py
"""

import sys
import os

hosts_path = "/etc/hosts"

if os.geteuid() != 0:
    print("❌ This script must be run with sudo")
    print("Run: sudo python3 fix_hosts.py")
    sys.exit(1)

print("🔧 Restoring hosts file...")

try:
    # Read hosts file
    with open(hosts_path, 'r') as f:
        lines = f.readlines()
    
    # Filter out blocking lines
    cleaned_lines = []
    blocked_keywords = ['0per8r', 'blocked distracting', '# blocked', 'focus os blocking']
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
                     'hbomax.com', 'primevideo.com', 'amazonvideo.com', 'amazon.co.uk', 'amazon.de',
                     'funimation.com', 'youtu.be', 'm.facebook', 'm.youtube']
    
    original_count = len(lines)
    removed_count = 0
    
    for line in lines:
        line_lower = line.lower()
        should_skip = False
        
        # Skip if line contains blocking markers
        for keyword in blocked_keywords:
            if keyword in line_lower:
                should_skip = True
                removed_count += 1
                break
        
        if should_skip:
            continue
            
        # Skip 127.0.0.1 entries for blocked domains
        if line.strip().startswith('127.0.0.1'):
            parts = line.strip().split()
            if len(parts) > 1:
                domain = parts[1].lower()
                # Remove www. and m. prefixes for matching
                domain_clean = domain.replace('www.', '').replace('m.', '')
                # Check if this domain should be unblocked
                for blocked in blocked_domains:
                    if blocked in domain_clean:
                        should_skip = True
                        removed_count += 1
                        break
        
        if not should_skip:
            cleaned_lines.append(line)
    
    # Write cleaned hosts file
    with open(hosts_path, 'w') as f:
        f.writelines(cleaned_lines)
    
    print(f"✅ Removed {removed_count} blocking entries")
    print(f"✅ Hosts file restored successfully!")
    
    # Flush DNS cache
    print("🔄 Flushing DNS cache...")
    os.system('dscacheutil -flushcache 2>/dev/null')
    os.system('killall -HUP mDNSResponder 2>/dev/null')
    print("✅ DNS cache flushed")
    print("")
    print("✅ DONE! Amazon and all other sites should work now.")
    
except PermissionError:
    print("❌ Permission denied. Make sure you're running with sudo.")
    sys.exit(1)
except Exception as e:
    print(f"❌ Error: {e}")
    sys.exit(1)



