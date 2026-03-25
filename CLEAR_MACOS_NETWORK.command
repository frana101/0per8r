#!/bin/bash
# Double-click in Finder: clears macOS proxy / auto-proxy from 0per8r after force quit.
cd "$(dirname "$0")"
if [ ! -f "fix_network_proxy_gui.js" ]; then
  osascript -e 'display alert "Run this from your 0per8r project folder (fix_network_proxy_gui.js missing)."'
  exit 1
fi
exec node fix_network_proxy_gui.js
