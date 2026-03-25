#!/usr/bin/env node
/**
 * Emergency: clear macOS system proxy / auto-proxy left after force quit (fixes ERR_PROXY_CONNECTION_FAILED).
 * Run: node fix_network_proxy_gui.js
 * Or double-click CLEAR_MACOS_NETWORK.command (runs this).
 *
 * Uses osascript (not sudo-prompt) so this works on Node 18+ including Node 24 where util.isObject was removed.
 */
const { exec, spawnSync } = require('child_process');

if (process.platform !== 'darwin') {
  console.error('This script is for macOS only.');
  process.exit(1);
}

/** Escape a string for use inside an AppleScript double-quoted literal. */
function appleScriptEscape(str) {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/** Run a shell command with GUI admin prompt (same UX as sudo-prompt, compatible with modern Node). */
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

exec('networksetup -listallnetworkservices', (err, stdout) => {
  if (err) {
    console.error('Failed to list network services:', err.message);
    process.exit(1);
  }
  const unsupported = ['Thunderbolt Bridge', 'PPPoE', 'Bluetooth', 'FireWire'];
  const services = stdout
    .toString()
    .split('\n')
    .map((l) => l.trim())
    .filter(
      (line) =>
        line &&
        !line.includes('*') &&
        !line.includes('denotes') &&
        !unsupported.some((u) => line.includes(u))
    );

  const parts = services.map((service) => {
    const escaped = service.replace(/"/g, '\\"').replace(/\$/g, '\\$');
    return `networksetup -setwebproxystate "${escaped}" off || true; networksetup -setsecurewebproxystate "${escaped}" off || true; networksetup -setautoproxystate "${escaped}" off || true; networksetup -setautoproxyurl "${escaped}" "" || true`;
  });

  const script = `#!/bin/bash
set +e
${parts.join('\n')}
dscacheutil -flushcache 2>/dev/null || true
killall -HUP mDNSResponder 2>/dev/null || true
echo Done
`;

  const fs = require('fs');
  const path = require('path');
  const tmp = path.join(require('os').tmpdir(), `0per8r_restore_net_${Date.now()}.sh`);
  fs.writeFileSync(tmp, script, { mode: 0o755 });

  console.log('Opening admin password dialog to clear system proxy settings…');
  try {
    const shellLine = `bash "${tmp.replace(/"/g, '\\"')}"`;
    runShellWithAdminPrivileges(shellLine);
  } catch (e) {
    try {
      fs.unlinkSync(tmp);
    } catch (_) {}
    console.error('Failed:', e.message);
    if (String(e.message).includes('(-128)') || e.code === 1) {
      console.error('Password prompt was cancelled or permission denied.');
    }
    process.exit(1);
  }
  try {
    fs.unlinkSync(tmp);
  } catch (_) {}
  console.log('✅ System proxy cleared. Try your browser again.');
});
