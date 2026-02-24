-- AppleScript to restore hosts file with GUI password dialog
on run
    set pythonScript to "
import sys
import os

hosts_path = '/etc/hosts'

try:
    with open(hosts_path, 'r') as f:
        lines = f.readlines()
    
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
        
        for keyword in blocked_keywords:
            if keyword in line_lower:
                should_skip = True
                removed_count += 1
                break
        
        if should_skip:
            continue
            
        if line.strip().startswith('127.0.0.1'):
            parts = line.strip().split()
            if len(parts) > 1:
                domain = parts[1].lower()
                domain_clean = domain.replace('www.', '').replace('m.', '')
                for blocked in blocked_domains:
                    if blocked in domain_clean:
                        should_skip = True
                        removed_count += 1
                        break
        
        if not should_skip:
            cleaned_lines.append(line)
    
    import tempfile
    temp_fd, temp_path = tempfile.mkstemp(text=True)
    with os.fdopen(temp_fd, 'w') as f:
        f.writelines(cleaned_lines)
    
    print(f'SUCCESS:{removed_count}:{temp_path}')
    sys.exit(0)
    
except Exception as e:
    print(f'ERROR:{str(e)}', file=sys.stderr)
    sys.exit(1)
"
    
    try
        set pythonOutput to do shell script "python3 -c " & quoted form of pythonScript
        set AppleScript's text item delimiters to ":"
        set outputParts to text items of pythonOutput
        set resultType to item 1 of outputParts
        set AppleScript's text item delimiters to ""
        
        if resultType is "SUCCESS" then
            set removedCount to item 2 of outputParts
            set tempPath to item 3 of outputParts
            
            -- Copy temp file to /etc/hosts with admin privileges
            do shell script "cp " & quoted form of tempPath & " /etc/hosts && rm " & quoted form of tempPath & " && dscacheutil -flushcache && killall -HUP mDNSResponder" with administrator privileges
            
            display dialog "✅ Success! Removed " & removedCount & " blocking entries. Amazon and all other sites should work now." buttons {"OK"} default button "OK" with icon note
        else
            display dialog "❌ Error: " & resultType buttons {"OK"} default button "OK" with icon stop
        end if
    on error errorMessage number errorNumber
        if errorNumber is -128 then
            -- User cancelled
            display dialog "❌ Cancelled. No changes made." buttons {"OK"} default button "OK" with icon caution
        else
            display dialog "❌ Error: " & errorMessage buttons {"OK"} default button "OK" with icon stop
        end if
    end try
end run



