/**
 * macOS-only replacement for sudo-prompt that uses osascript + administrator privileges.
 * sudo-prompt relies on util.isObject (removed in Node 24), which breaks admin prompts.
 * Same callback shape as sudo-prompt: exec(command, options, callback(error, stdout, stderr)).
 */
const { spawn } = require('child_process');

function appleScriptEscape(str) {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function exec(command, options, callback) {
  if (typeof options === 'function') {
    callback = options;
  }
  if (typeof callback !== 'function') {
    callback = () => {};
  }
  const inner = appleScriptEscape(command);
  const appleScript = `do shell script "bash -lc " & quoted form of "${inner}" with administrator privileges`;
  const proc = spawn('osascript', ['-e', appleScript]);
  let stdout = '';
  let stderr = '';
  proc.stdout.on('data', (d) => {
    stdout += d.toString();
  });
  proc.stderr.on('data', (d) => {
    stderr += d.toString();
  });
  proc.on('error', (err) => callback(err, stdout, stderr));
  proc.on('close', (code) => {
    if (code === 0) {
      callback(null, stdout, stderr);
    } else {
      const err = new Error(stderr.trim() || `Command failed with exit code ${code}`);
      err.code = code;
      callback(err, stdout, stderr);
    }
  });
}

module.exports = { exec };
