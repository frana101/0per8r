// 0per8r - Dashboard System
const state = {
  mission: '',
  goal: '',
  task: '', // Single needle-mover task
  allowSites: [],
  allowApps: [],
  googleAlwaysAllowed: true, // Toggle for google.com always allowed
  soundscape: {
    rain: 0,
    ocean: 0,
    fire: 0,
    wind: 0,
    forest: 0,
    cafe: 0,
    cityscape: 0
  },
  soundscapeEnabled: true, // Master on/off toggle
  streak: 0,
  currentSession: null,
  timer: null,
  endTime: null,
  sessionStart: null,
  isLocked: false,
  isAuthenticated: false,
  currentUser: null
};

/** Prevents double-invoke when timer hits 0 */
let sessionCompletionInProgress = false;

function formatAppDisplayName(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  return s
    .split(/[\s\-_.]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function normalizeAllowAppEntry(entry) {
  if (entry && typeof entry === 'object' && entry.process) {
    const proc = String(entry.process).toLowerCase().trim();
    const label = (entry.label && String(entry.label).trim()) || formatAppDisplayName(entry.process);
    return { process: proc, label };
  }
  const s = String(entry || '').trim();
  if (!s) return null;
  return { process: s.toLowerCase(), label: formatAppDisplayName(s) };
}

function normalizeAllowAppsArray(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(normalizeAllowAppEntry).filter(Boolean);
}

function getAllowAppProcessKey(entry) {
  if (entry && typeof entry === 'object' && entry.process) return String(entry.process).toLowerCase().trim();
  return String(entry || '').toLowerCase().trim();
}

function getAllowAppDisplay(entry) {
  if (entry && typeof entry === 'object' && entry.label) return String(entry.label);
  if (entry && typeof entry === 'object' && entry.process) return formatAppDisplayName(entry.process);
  return formatAppDisplayName(String(entry || ''));
}

// Audio system - Using HTML5 Audio instead of Web Audio API to avoid crashes
const audioElements = {}; // Store HTML5 Audio elements

// Audio file URLs - Using local files from sounds folder
// Download free ambient sounds and place them in the 'sounds' folder
// See sounds/README.md for instructions
const SOUND_URLS = {
  rain: './sounds/rain.mp3',
  ocean: './sounds/ocean.mp3',
  fire: './sounds/fire.mp3',
  wind: './sounds/wind.mp3',
  forest: './sounds/forest.mp3',
  cafe: './sounds/cafe.mp3',
  cityscape: './sounds/cityscape.mp3'
};

// Initialize - with immediate execution check
(function() {
  console.log('Script loaded');
  
  // Add keyboard shortcut for emergency exit (Cmd+Shift+E)
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'E') {
      e.preventDefault();
      console.log('Emergency exit keyboard shortcut triggered');
      handleEmergencyExit();
    }
    // Also allow Cmd+Q to quit (override if needed)
    if ((e.metaKey || e.ctrlKey) && e.key === 'q') {
      // Allow quit - don't prevent it
    }
  });
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    // DOM already loaded
    initApp();
  }
})();

async function initApp() {
  console.log('Initializing app...');
  console.log('Document ready state:', document.readyState);
  console.log('Body exists:', !!document.body);
  // Show that we're loading
  if (document.body) {
    document.body.style.backgroundColor = '#0a0a0f';
    document.body.style.color = '#ffffff';
  }
  
  try {
    const isAuth = checkAuthentication();
    console.log('Authentication check result:', isAuth, 'state.isAuthenticated:', state.isAuthenticated);
    
    if (!state.isAuthenticated) {
      // Show auth page
      showPhase('auth');
      // Initialize auth listeners immediately
      initializeAuthListeners();
      console.log('✓ Auth page shown');
      return; // Don't proceed to dashboard
    }
    
    // User is authenticated, proceed with normal initialization
    console.log('User is authenticated, loading dashboard for:', state.currentUser);
    showPhase('dashboard'); // IMPORTANT: Show dashboard when authenticated
    
    await loadState();
    console.log('✓ State loaded');
    
    initializeEventListeners();
    console.log('✓ Event listeners initialized');
    
    updateUI();
    console.log('✓ UI updated');
    
    // Audio init can fail, that's okay
    try {
      initAudioContext();
      console.log('✓ Audio initialized');
    } catch (e) {
      console.warn('Audio init failed (non-critical):', e);
    }
    
    // Initialize auto-updater listeners
    initializeUpdateListeners();
    
    console.log('✓ App initialized successfully');
  } catch (e) {
    console.error('✗ Error initializing app:', e);
    showError(e);
    throw e; // Re-throw to see in console
  }
}

function showError(e) {
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = 'padding: 20px; color: white; font-family: monospace; background: #1a1a1a; position: fixed; top: 0; left: 0; right: 0; z-index: 10000;';
  errorDiv.innerHTML = `
    <h1 style="color: #ff4444;">Error Loading App</h1>
    <p><strong>Message:</strong> ${e.message}</p>
    <pre style="background: #000; padding: 10px; overflow: auto;">${e.stack || 'No stack trace'}</pre>
  `;
  document.body.appendChild(errorDiv);
}

// Also handle window load as fallback
window.addEventListener('load', () => {
  console.log('Window loaded');
  // Force a repaint to ensure rendering is complete
  requestAnimationFrame(() => {
    document.body.style.display = 'block';
  });
});

// Initialize Audio - Using HTML5 Audio (more stable than Web Audio API)
function initAudioContext() {
  console.log('Audio system initialized (HTML5 Audio)');
  // No initialization needed - audio elements created on demand
}

// Create or get audio element for a sound type
function getAudioElement(type) {
  if (!audioElements[type]) {
    const audio = new Audio();
    audio.loop = true;
    audio.volume = 0;
    audio.preload = 'auto';
    
    // Set source
    const soundUrl = SOUND_URLS[type];
    if (soundUrl) {
      audio.src = soundUrl;
    }
    
    // Handle errors gracefully
    audio.addEventListener('error', (e) => {
      console.warn(`Error loading audio for ${type}:`, e);
    });
    
    audioElements[type] = audio;
  }
  return audioElements[type];
}

// Preload audio - using HTML5 Audio (no preloading needed, loads on demand)
async function preloadSounds() {
  console.log('Audio will load on demand (HTML5 Audio)');
  // HTML5 Audio loads automatically when needed
}

// Per-user storage key - when logged in, each account has separate preferences
function getStorageKeys() {
  const user = state.currentUser || localStorage.getItem('0per8r_currentUser') || '';
  const suffix = user ? '_' + user : '';
  return { stateKey: '0per8r_state' + suffix, longTermKey: '0per8r_longterm' + suffix };
}

// Load state - sync from localStorage (per-user when logged in), fetch from API if backend session exists
async function loadState() {
  try {
    const token = localStorage.getItem('0per8r_sessionToken');
    if (token) {
      try {
        const res = await fetch(`${API_BASE}/api/user?token=${encodeURIComponent(token)}`);
        if (res.ok) {
          const data = await res.json();
          const prefs = (data.user && data.user.preferences) || {};
          // Full overwrite - empty arrays and strings must replace old data
          state.mission = prefs.mission !== undefined ? prefs.mission : '';
          state.goal = prefs.goal !== undefined ? prefs.goal : '';
          state.task = prefs.task !== undefined ? prefs.task : '';
  state.allowSites = Array.isArray(prefs.allowSites) ? prefs.allowSites : [];
  state.allowApps = normalizeAllowAppsArray(Array.isArray(prefs.allowApps) ? prefs.allowApps : []);
  state.googleAlwaysAllowed = prefs.googleAlwaysAllowed !== undefined ? prefs.googleAlwaysAllowed : true;
  if (prefs.soundscape && typeof prefs.soundscape === 'object') {
            state.soundscape = { ...state.soundscape, ...prefs.soundscape };
          }
          state.soundscapeEnabled = prefs.soundscapeEnabled !== undefined ? prefs.soundscapeEnabled : true;
          state.streak = prefs.streak !== undefined ? prefs.streak : 0;
          applyLoadedState();
          return;
        }
      } catch (e) {
        console.warn('API load failed, using local:', e.message);
      }
    }
    loadStateFromLocal();
  } catch (e) {
    console.error('Load state error:', e);
    loadStateFromLocal();
  }
}

function loadStateFromLocal() {
  const keys = getStorageKeys();
  // When logged in, use only per-user keys (no fallback to global - avoids leaking other accounts' data)
  const longTermRaw = keys.longTermKey.includes('_') ? localStorage.getItem(keys.longTermKey) : (localStorage.getItem(keys.longTermKey) || localStorage.getItem('0per8r_longterm'));
  const longTermData = JSON.parse(longTermRaw || '{}');
  if (longTermData.mission) state.mission = longTermData.mission;
  if (longTermData.goal) state.goal = longTermData.goal;
  if (longTermData.needleMover) state.task = longTermData.needleMover;
  const savedRaw = keys.stateKey.includes('_') ? localStorage.getItem(keys.stateKey) : (localStorage.getItem(keys.stateKey) || localStorage.getItem('focusOS_state'));
  const saved = JSON.parse(savedRaw || '{}');
  if (!longTermData.mission) state.mission = saved.mission || '';
  if (!longTermData.goal) state.goal = saved.goal || '';
  if (!longTermData.needleMover) {
    if (saved.tasks && saved.tasks.length > 0) {
      const firstTask = typeof saved.tasks[0] === 'string' ? saved.tasks[0] : (saved.tasks[0].text || '');
      state.task = firstTask;
    } else {
      state.task = saved.task || '';
    }
  }
  state.allowSites = Array.isArray(saved.allowSites) ? saved.allowSites : [];
  state.allowApps = Array.isArray(saved.allowApps) ? saved.allowApps : [];
  state.googleAlwaysAllowed = saved.googleAlwaysAllowed !== undefined ? saved.googleAlwaysAllowed : true;
  const allowedSounds = ['rain', 'ocean', 'fire', 'wind', 'forest', 'cafe', 'cityscape'];
  if (saved.soundscape) {
    state.soundscape = {};
    allowedSounds.forEach(sound => { state.soundscape[sound] = saved.soundscape[sound] || 0; });
  }
  state.soundscapeEnabled = saved.soundscapeEnabled !== undefined ? saved.soundscapeEnabled : true;
  state.streak = saved.streak || 0;
  applyLoadedState();
}

function applyLoadedState() {
  state.allowApps = normalizeAllowAppsArray(state.allowApps);
  // Ensure soundscape has all keys
  const allowedSounds = ['rain', 'ocean', 'fire', 'wind', 'forest', 'cafe', 'cityscape'];
  allowedSounds.forEach(s => { if (state.soundscape[s] === undefined) state.soundscape[s] = 0; });
}

let saveToServerTimeout = null;

// Save state - local (per-user when logged in) + sync to backend when logged in
function saveState() {
  const payload = {
    mission: state.mission,
    goal: state.goal,
    task: state.task,
    allowSites: state.allowSites,
    allowApps: state.allowApps,
    googleAlwaysAllowed: state.googleAlwaysAllowed,
    soundscape: state.soundscape,
    soundscapeEnabled: state.soundscapeEnabled,
    streak: state.streak
  };
  const keys = getStorageKeys();
  localStorage.setItem(keys.stateKey, JSON.stringify(payload));
  const longTermData = { mission: state.mission, goal: state.goal, needleMover: state.task };
  localStorage.setItem(keys.longTermKey, JSON.stringify(longTermData));

  const token = localStorage.getItem('0per8r_sessionToken');
  if (token) {
    clearTimeout(saveToServerTimeout);
    saveToServerTimeout = setTimeout(() => {
      fetch(`${API_BASE}/api/user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, ...payload })
      }).catch(() => {});
    }, 500);
  }
}

// Update UI
function updateUI() {
  try {
    // Mission
    const missionInput = document.getElementById('mission-input');
    if (missionInput) {
      missionInput.value = state.mission;
    }
    
    // Goal
    const goalInput = document.getElementById('goal-input');
    if (goalInput) {
      goalInput.value = state.goal;
    }
    
    // Task (Needle-Mover)
    const taskInput = document.getElementById('task-input');
    if (taskInput) {
      taskInput.value = state.task;
    }
    
    updateMITSelect();
    
    
    // Tags
    const removeSiteTag = (site) => {
      // Remove case-insensitively
      state.allowSites = state.allowSites.filter(s => s.toLowerCase() !== site.toLowerCase());
      saveState();
      // Immediately re-render tags to update UI
      renderTags('allow-sites-tags', state.allowSites, removeSiteTag);
    };
    renderTags('allow-sites-tags', state.allowSites, removeSiteTag);
    
    const removeAppTag = (app) => {
      const key = getAllowAppProcessKey(app);
      state.allowApps = state.allowApps.filter((a) => getAllowAppProcessKey(a) !== key);
      saveState();
      renderAppTags('allow-apps-tags', state.allowApps, removeAppTag);
    };
    renderAppTags('allow-apps-tags', state.allowApps, removeAppTag);
    
    // Google always allowed toggle
    const googleToggle = document.getElementById('google-always-allowed-toggle');
    const googleNote = document.getElementById('google-note');
    if (googleToggle) {
      googleToggle.checked = state.googleAlwaysAllowed;
    }
    if (googleNote) {
      googleNote.textContent = state.googleAlwaysAllowed 
        ? 'google.com is always allowed. All other websites will be blocked.' 
        : 'All websites except those listed above will be blocked.';
    }
    
    // Streak
    const streakCount = document.getElementById('streak-count');
    if (streakCount) {
      streakCount.textContent = state.streak;
    }
    
    // Windows: show Uninstall button only on Windows
    const uninstallBtn = document.getElementById('uninstall-btn');
    if (uninstallBtn && window.electronAPI && typeof window.electronAPI.getPlatform === 'function') {
      uninstallBtn.style.display = window.electronAPI.getPlatform() === 'win32' ? '' : 'none';
    }
    
    // Soundscape sliders
    Object.keys(state.soundscape).forEach(sound => {
      const slider = document.querySelector(`.sound-item[data-sound="${sound}"] .sound-slider`);
      const value = document.querySelector(`.sound-item[data-sound="${sound}"] .sound-value`);
      if (slider && value) {
        slider.value = state.soundscape[sound];
        value.textContent = state.soundscape[sound] + '%';
      }
    });
    
    // Update soundscape toggle buttons - ensure they reflect current state
    const toggleBtn1 = document.getElementById('soundscape-toggle');
    if (toggleBtn1) {
      const isEnabled = state.soundscapeEnabled;
      toggleBtn1.textContent = isEnabled ? 'ON' : 'OFF';
      toggleBtn1.style.background = isEnabled ? '#000' : '#333';
      toggleBtn1.style.borderColor = isEnabled ? '#fff' : '#666';
      toggleBtn1.style.color = '#fff';
      console.log('Updated soundscape toggle 1:', isEnabled ? 'ON' : 'OFF');
    }
    
    const toggleBtn2 = document.getElementById('session-soundscape-toggle');
    if (toggleBtn2) {
      const isEnabled = state.soundscapeEnabled;
      toggleBtn2.textContent = isEnabled ? 'ON' : 'OFF';
      toggleBtn2.style.background = isEnabled ? '#000' : '#333';
      toggleBtn2.style.borderColor = isEnabled ? '#fff' : '#666';
      toggleBtn2.style.color = '#fff';
      console.log('Updated soundscape toggle 2:', isEnabled ? 'ON' : 'OFF');
    }

    populateAllowAppsDropdown().catch(() => {});
  } catch (e) {
    console.error('Error in updateUI:', e);
  }
}

// Render needle-movers (tasks with explanation)
function renderNeedleMovers() {
  const container = document.getElementById('tasks-list');
  if (!container) return;
  
  container.innerHTML = '';
  
  // Show/hide add button based on count
  const showAddBtn = document.getElementById('show-task-input');
  const addContainer = document.getElementById('task-add-container');
  if (showAddBtn) showAddBtn.style.display = state.tasks.length >= 2 ? 'none' : 'block';
  if (addContainer) addContainer.style.display = 'none';
  
  state.tasks.forEach((taskObj, index) => {
    const task = typeof taskObj === 'string' ? taskObj : (taskObj.text || '');
    const explanation = typeof taskObj === 'object' ? (taskObj.explanation || '') : '';
    
    const div = document.createElement('div');
    div.className = 'item';
    div.style.cssText = 'display: flex; flex-direction: column; gap: 8px; padding: 16px;';
    div.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: start; gap: 12px;">
        <div style="flex: 1;">
          <div class="item-text" contenteditable="true" data-index="${index}" data-field="text" style="font-weight: 600; margin-bottom: 8px; min-height: 24px;">${task || 'Task...'}</div>
          <div class="item-text" contenteditable="true" data-index="${index}" data-field="explanation" style="font-size: 12px; color: #888; min-height: 20px;">${explanation || 'Explanation...'}</div>
        </div>
        <button class="item-remove" data-index="${index}" style="background: none; border: none; color: #fff; font-size: 24px; cursor: pointer; padding: 0 8px;">×</button>
      </div>
    `;
    
    container.appendChild(div);
    
    // Edit functionality for text
    div.querySelectorAll('.item-text').forEach(textSpan => {
      textSpan.addEventListener('blur', (e) => {
        const field = e.target.dataset.field;
        const idx = parseInt(e.target.dataset.index);
        const newValue = e.target.textContent.trim();
        
        if (!state.tasks[idx]) {
          state.tasks[idx] = { text: '', explanation: '' };
        }
        if (typeof state.tasks[idx] === 'string') {
          state.tasks[idx] = { text: state.tasks[idx], explanation: '' };
        }
        
        state.tasks[idx][field] = newValue;
        
        if (field === 'text' && !newValue) {
          e.target.textContent = task || 'Task...';
        } else if (field === 'explanation' && !newValue) {
          e.target.textContent = 'Explanation...';
        }
        
        saveState();
        if (field === 'text') {
          updateMITSelect();
        }
      });
      
      textSpan.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          e.target.blur();
        }
      });
    });
    
    // Remove functionality
    const removeBtn = div.querySelector('.item-remove');
    removeBtn.addEventListener('click', () => {
      state.tasks.splice(index, 1);
      saveState();
      updateUI();
    });
  });
}

// Render items list with edit capability (kept for backward compatibility if needed)
function renderItems(containerId, items, onRemove) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  container.innerHTML = '';
  items.forEach((item, index) => {
    const div = document.createElement('div');
    div.className = 'item';
    div.innerHTML = `
      <span class="item-text" contenteditable="true" data-index="${index}">${item}</span>
      <button class="item-remove" data-index="${index}">×</button>
    `;
    
    const textSpan = div.querySelector('.item-text');
    const removeBtn = div.querySelector('.item-remove');
    
    // Edit functionality
    textSpan.addEventListener('blur', (e) => {
      const newValue = e.target.textContent.trim();
      if (newValue && newValue !== item) {
        items[index] = newValue;
        saveState();
        if (containerId === 'tasks-list') {
          updateMITSelect();
        }
      } else if (!newValue) {
        e.target.textContent = item; // Restore if empty
      }
    });
    
    textSpan.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.target.blur();
      }
    });
    
    textSpan.addEventListener('focus', () => {
      div.classList.add('editing');
    });
    
    textSpan.addEventListener('blur', () => {
      div.classList.remove('editing');
    });
    
    // Remove functionality
    removeBtn.onclick = () => onRemove(item, index);
    
    container.appendChild(div);
  });
}

// Render tags
function renderTags(containerId, tags, onRemove) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  container.innerHTML = '';
  tags.forEach(tag => {
    const div = document.createElement('div');
    div.className = 'tag';
    div.innerHTML = `
      <span>${tag}</span>
      <button class="tag-remove">×</button>
    `;
    div.querySelector('.tag-remove').onclick = () => onRemove(tag);
    container.appendChild(div);
  });
}

function renderAppTags(containerId, tags, onRemove) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  tags.forEach((tag) => {
    const div = document.createElement('div');
    div.className = 'tag';
    const span = document.createElement('span');
    span.textContent = getAllowAppDisplay(tag);
    const btn = document.createElement('button');
    btn.className = 'tag-remove';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Remove');
    btn.textContent = '×';
    btn.onclick = () => onRemove(tag);
    div.appendChild(span);
    div.appendChild(btn);
    container.appendChild(div);
  });
}

async function populateAllowAppsDropdown() {
  const sel = document.getElementById('allow-apps-select');
  if (!sel || !window.electronAPI || typeof window.electronAPI.listInstalledApps !== 'function') return;
  if (sel.dataset.populated === '1') return;
  try {
    const res = await window.electronAPI.listInstalledApps();
    if (!res || !res.ok || !Array.isArray(res.apps)) return;
    sel.innerHTML = '<option value="">Add an app…</option>';
    res.apps.forEach((a) => {
      const opt = document.createElement('option');
      opt.value = JSON.stringify({ process: a.process, label: a.label || a.process });
      opt.textContent = a.label || a.process;
      sel.appendChild(opt);
    });
    sel.dataset.populated = '1';
  } catch (e) {
    console.warn('populateAllowAppsDropdown:', e);
  }
}

// Update MIT select (simplified - just shows the current task)
function updateMITSelect() {
  const select = document.getElementById('mit-select');
  if (!select) return;
  
  // Only show task if it's not empty
  if (state.task && state.task.trim()) {
    select.innerHTML = '<option value="0">' + state.task.trim() + '</option>';
  } else {
    select.innerHTML = '<option value="0">Select needle-mover...</option>';
  }
}

// Play sound using HTML5 Audio
function playSound(type, volume) {
  if (volume === 0) {
    stopSound(type);
    return;
  }
  
  try {
    const audio = getAudioElement(type);
    
    // Set volume (0-1 range, normalize from 0-100)
    // Use 0.7 max to prevent clipping and ensure all sounds are equally audible
    audio.volume = (volume / 100) * 0.7;
    
    // Play if not already playing
    if (audio.paused) {
      audio.play().catch(e => {
        console.warn(`Could not play ${type} sound:`, e);
        // User interaction might be required - try again on next update
      });
    }
  } catch (e) {
    console.error(`Error playing sound ${type}:`, e);
  }
}

// Stop sound
function stopSound(type) {
  if (audioElements[type]) {
    try {
      audioElements[type].pause();
      audioElements[type].currentTime = 0; // Reset to start
    } catch (e) {
      console.warn(`Error stopping sound ${type}:`, e);
    }
  }
}

// Update soundscape - using HTML5 Audio
function updateSoundscape() {
  try {
    // If soundscape is disabled, stop all sounds
    if (!state.soundscapeEnabled) {
      const allowedSounds = ['rain', 'ocean', 'fire', 'wind', 'forest', 'cafe', 'cityscape'];
      allowedSounds.forEach(sound => {
        stopSound(sound);
      });
      return;
    }
    
    // Only process allowed sounds (filter out any invalid keys like whiteNoise)
    const allowedSounds = ['rain', 'ocean', 'fire', 'wind', 'forest', 'cafe', 'cityscape'];
    allowedSounds.forEach(sound => {
      if (!state.soundscape.hasOwnProperty(sound)) return;
      try {
        const volume = state.soundscape[sound];
        if (volume > 0) {
          // Update or start sound
          const audio = getAudioElement(sound);
          if (audio) {
            audio.volume = (volume / 100) * 0.7;
            if (audio.paused) {
              audio.play().catch(e => {
                console.warn(`Could not auto-play ${sound}:`, e);
              });
            }
          }
        } else {
          stopSound(sound);
        }
      } catch (e) {
        console.error(`Error updating sound ${sound}:`, e);
      }
    });
  } catch (e) {
    console.error('Error in updateSoundscape:', e);
  }
}

// Initialize event listeners
function initializeEventListeners() {
  // Mission fields
  const missionInput = document.getElementById('mission-input');
  if (missionInput) {
    missionInput.addEventListener('input', (e) => {
      state.mission = e.target.value;
      saveState();
    });
  }
  
  // Goal
  const goalInput = document.getElementById('goal-input');
  if (goalInput) {
    goalInput.addEventListener('input', (e) => {
      state.goal = e.target.value;
      saveState();
    });
  }
  
  // Task (Needle-Mover)
  const taskInput = document.getElementById('task-input');
  if (taskInput) {
    taskInput.addEventListener('input', (e) => {
      state.task = e.target.value;
      saveState();
      updateMITSelect();
    });
  }
  
  // Helper function to validate URL - very strict validation
  function isValidUrl(url) {
    try {
      if (!url || typeof url !== 'string') {
        return false;
      }
      
      // Clean the URL - remove protocol and www
      let cleaned = url.trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '');
      
      // Remove any trailing slashes or paths
      cleaned = cleaned.split('/')[0].split('?')[0].split('#')[0];
      
      // Must not be empty after cleaning
      if (!cleaned || cleaned.length === 0) {
        return false;
      }
      
      // Must have at least one dot
      if (!cleaned.includes('.')) {
        return false;
      }
      
      // Must not contain spaces, tabs, or newlines
      if (/\s/.test(cleaned)) {
        return false;
      }
      
      // Must not contain invalid characters (only alphanumeric, dots, hyphens allowed)
      if (!/^[a-zA-Z0-9.\-]+$/.test(cleaned)) {
        return false;
      }
      
      // Must not start or end with dot or hyphen
      if (cleaned.startsWith('.') || cleaned.endsWith('.') || 
          cleaned.startsWith('-') || cleaned.endsWith('-')) {
        return false;
      }
      
      // Must not have consecutive dots
      if (cleaned.includes('..')) {
        return false;
      }
      
      // Split into parts
      const parts = cleaned.split('.');
      if (parts.length < 2) {
        return false;
      }
      
      // TLD (last part) must be at least 2 characters and only letters
      const tld = parts[parts.length - 1];
      if (tld.length < 2 || !/^[a-zA-Z]{2,}$/.test(tld)) {
        return false;
      }
      
      // Each part must be valid
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        
        // Must not be empty
        if (!part || part.length === 0) {
          return false;
        }
        
        // Must not start or end with hyphen
        if (part.startsWith('-') || part.endsWith('-')) {
          return false;
        }
        
        // Must only contain alphanumeric and hyphens
        if (!/^[a-zA-Z0-9-]+$/.test(part)) {
          return false;
        }
        
        // First part (domain name) must have at least one letter or number
        if (i === 0 && !/[a-zA-Z0-9]/.test(part)) {
          return false;
        }
      }
      
      // Must be a reasonable length (max 253 characters for full domain)
      if (cleaned.length > 253) {
        return false;
      }
      
      // Each part must be max 63 characters (DNS limit)
      for (let part of parts) {
        if (part.length > 63) {
          return false;
        }
      }
      
      return true;
    } catch (e) {
      return false;
    }
  }
  
  // Tags - Sites
  document.getElementById('allow-sites-input').addEventListener('keypress', async (e) => {
    if (e.key === 'Enter' && e.target.value.trim()) {
      const input = e.target;
      const value = input.value.trim().replace(/^https?:\/\//, '').replace(/^www\./, '');
      
      // Validate URL
      if (!isValidUrl(value)) {
        input.value = '';
        input.placeholder = 'Invalid URL. Try again...';
        input.style.borderColor = '#f00';
        setTimeout(() => {
          input.placeholder = 'e.g., docs.google.com (Enter)';
          input.style.borderColor = '';
        }, 2000);
        return;
      }
      
      // Check if already exists (case-insensitive)
      const valueLower = value.toLowerCase();
      if (!state.allowSites.some(s => s.toLowerCase() === valueLower)) {
        state.allowSites.push(value);
        input.value = '';
        saveState();
        updateUI();
      } else {
        input.value = '';
      }
    }
  });
  
  const allowAppsSelect = document.getElementById('allow-apps-select');
  if (allowAppsSelect) {
    allowAppsSelect.addEventListener('change', () => {
      const raw = allowAppsSelect.value;
      if (!raw) return;
      try {
        const entry = JSON.parse(raw);
        const proc = String(entry.process || '').toLowerCase().trim();
        const label = String(entry.label || '').trim() || formatAppDisplayName(proc);
        if (!proc) return;
        if (!state.allowApps.some((a) => getAllowAppProcessKey(a) === proc)) {
          state.allowApps.push({ process: proc, label });
          saveState();
          updateUI();
        }
      } catch (e) {
        console.warn('allow-apps-select:', e);
      }
      allowAppsSelect.value = '';
    });
  }
  
  // Google always allowed toggle
  const googleToggle = document.getElementById('google-always-allowed-toggle');
  if (googleToggle) {
    googleToggle.addEventListener('change', (e) => {
      state.googleAlwaysAllowed = e.target.checked;
      saveState();
      updateUI();
    });
  }
  
  // Soundscape sliders
  document.querySelectorAll('.sound-slider').forEach(slider => {
    slider.addEventListener('input', (e) => {
      try {
        const sound = e.target.closest('.sound-item').dataset.sound;
        const value = parseInt(e.target.value);
        state.soundscape[sound] = value;
        e.target.nextElementSibling.textContent = value + '%';
        saveState();
        
        // Update soundscape with HTML5 Audio
        updateSoundscape();
        
        // Update visual state
        const item = e.target.closest('.sound-item');
        if (value > 0) {
          item.classList.add('active');
        } else {
          item.classList.remove('active');
        }
      } catch (err) {
        console.error('Error in sound slider:', err);
      }
    });
  });
  
  // Soundscape toggle buttons - Remove old listeners first to prevent duplicates
  const soundscapeToggle1 = document.getElementById('soundscape-toggle');
  if (soundscapeToggle1) {
    // Clone and replace to remove all event listeners
    const newToggle1 = soundscapeToggle1.cloneNode(true);
    soundscapeToggle1.parentNode.replaceChild(newToggle1, soundscapeToggle1);
    newToggle1.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('Soundscape toggle clicked, current state:', state.soundscapeEnabled);
      state.soundscapeEnabled = !state.soundscapeEnabled;
      console.log('New state:', state.soundscapeEnabled);
      saveState();
      updateUI();
      updateSoundscape();
    });
  }
  
  const soundscapeToggle2 = document.getElementById('session-soundscape-toggle');
  if (soundscapeToggle2) {
    // Clone and replace to remove all event listeners
    const newToggle2 = soundscapeToggle2.cloneNode(true);
    soundscapeToggle2.parentNode.replaceChild(newToggle2, soundscapeToggle2);
    newToggle2.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('Session soundscape toggle clicked, current state:', state.soundscapeEnabled);
      state.soundscapeEnabled = !state.soundscapeEnabled;
      console.log('New state:', state.soundscapeEnabled);
      saveState();
      updateUI();
      updateSoundscape();
    });
  }
  
  // Start session
  document.getElementById('start-session').addEventListener('click', startSession);
  
  // Emergency exit
  document.getElementById('emergency-exit').addEventListener('click', handleEmergencyExit);
  
  // Completion
  document.querySelectorAll('.option-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
      e.target.classList.add('selected');
    });
  });
  
  document.getElementById('complete-finish').addEventListener('click', handleCompletion);
  
  // Electron break attempt listener
  if (window.electronAPI) {
    // Handle quit password request
    window.electronAPI.onRequestQuitPassword((event, data) => {
      const attempts = (data && data.attempts) ? data.attempts : 1;
      showPasswordPrompt('Enter your ACCOUNT password to quit 0per8r.', attempts).then((verified) => {
        if (window.electronAPI) {
          window.electronAPI.verifyQuitPassword(verified);
        }
      });
    });
    
    // Handle hosts blocking errors
    window.electronAPI.onHostsBlockingError((event, data) => {
      const message = (data && data.message) ? data.message : 'System-wide blocking setup failed. You may need to grant admin privileges when prompted. Session will continue with app-level blocking only.';
      alert(`⚠️ System-wide blocking setup failed:\n\n${message}\n\nSession will continue with app-level blocking only.`);
    });

    // Handle hosts blocking prompt notification
    window.electronAPI.onHostsBlockingPrompt((event, data) => {
      const message = (data && data.message) ? data.message : 'A password prompt will appear. Please enter your admin password.';
      const notification = document.createElement('div');
      notification.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #1a1a1a; color: #ffff00; padding: 15px 20px; border: 2px solid #ffff00; border-radius: 4px; z-index: 10000; font-family: monospace; max-width: 400px;';
      notification.textContent = '🔐 ' + message;
      document.body.appendChild(notification);
      setTimeout(() => notification.remove(), 8000);
    });

    // Handle hosts blocking success
    window.electronAPI.onHostsBlockingSuccess((event, data) => {
      console.log('✅ System-wide blocking enabled:', data.message);
      // Show a brief notification (non-blocking)
      const notification = document.createElement('div');
      notification.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #1a1a1a; color: #00ff00; padding: 15px 20px; border: 2px solid #00ff00; border-radius: 4px; z-index: 10000; font-family: monospace; max-width: 400px;';
      notification.textContent = '✅ ' + data.message;
      document.body.appendChild(notification);
      setTimeout(() => notification.remove(), 5000);
    });

    window.electronAPI.onBreakAttempt((event, data) => {
      console.log('Break attempt:', data);
    });
  }
}

// Render soundscape in session view - show ALL sounds for customization
function renderSessionSoundscape() {
  const container = document.getElementById('session-soundscape');
  if (!container) return;
  
  container.innerHTML = '';
  
  // Show all sounds, not just active ones (exclude any unwanted sounds)
  const allowedSounds = ['rain', 'ocean', 'fire', 'wind', 'forest', 'cafe', 'cityscape'];
  Object.keys(state.soundscape)
    .filter(sound => allowedSounds.includes(sound)) // Only show allowed sounds
    .forEach(sound => {
    const volume = state.soundscape[sound] || 0;
    const item = document.createElement('div');
    item.className = `sound-item ${volume > 0 ? 'active' : ''}`;
    item.innerHTML = `
      <div class="sound-icon">${getSoundIcon(sound)}</div>
      <div class="sound-name">${capitalize(sound.replace('-', ' '))}</div>
      <input type="range" class="sound-slider" min="0" max="100" value="${volume}" />
      <span class="sound-value">${volume}%</span>
    `;
    const slider = item.querySelector('.sound-slider');
    slider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      state.soundscape[sound] = value;
      e.target.nextElementSibling.textContent = value + '%';
      saveState();
      updateSoundscape();
      
      if (value > 0) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
    container.appendChild(item);
  });
}

function getSoundIcon(sound) {
  const icons = {
    rain: '🌧️',
    ocean: '🌊',
    fire: '🔥',
    wind: '💨',
    forest: '🌲',
    cafe: '☕',
    cityscape: '🏙️'
  };
  return icons[sound] || '🔊';
}

function capitalize(str) {
  return str.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// Render allowed apps and websites in focus session
function renderSessionAllowed() {
  const appsContainer = document.getElementById('session-allowed-apps');
  const sitesContainer = document.getElementById('session-allowed-sites');
  
  if (!appsContainer || !sitesContainer) return;
  
  // Render allowed apps
  appsContainer.innerHTML = '';
  if (state.allowApps && state.allowApps.length > 0) {
    state.allowApps.forEach((app) => {
      const item = document.createElement('div');
      item.className = 'allowed-item';
      item.textContent = getAllowAppDisplay(app);
      appsContainer.appendChild(item);
    });
  } else {
    const empty = document.createElement('div');
    empty.className = 'allowed-empty';
    empty.textContent = 'No apps allowed';
    appsContainer.appendChild(empty);
  }
  
  // Render allowed websites
  sitesContainer.innerHTML = '';
  if (state.allowSites && state.allowSites.length > 0) {
    state.allowSites.forEach(site => {
      const item = document.createElement('div');
      item.className = 'allowed-item';
      // Clean up the site display (remove protocol, www)
      let displaySite = site.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '');
      item.textContent = displaySite;
      sitesContainer.appendChild(item);
    });
  } else {
    const empty = document.createElement('div');
    empty.className = 'allowed-empty';
    empty.textContent = 'No websites allowed';
    sitesContainer.appendChild(empty);
  }
}

// Start session
async function startSession() {
  try {
    console.log('Starting session...');
    
    const mitSelect = document.getElementById('mit-select');
    const durationInput = document.getElementById('duration-input');
    
    if (!mitSelect || !durationInput) {
      console.error('Missing required elements');
      alert('Error: Missing required elements. Please refresh the app.');
      return;
    }
    
    const mitIndex = mitSelect.value;
    const duration = parseInt(durationInput.value);
    
    if (!duration || isNaN(duration) || duration < 1 || duration > 999) {
      alert('Please enter a valid duration between 1 and 999 minutes.');
      durationInput.focus();
      return;
    }
    
    if (!mitIndex || mitIndex === '' || mitIndex === 'null') {
      alert('Please select your Most Important Task');
      return;
    }
    
    if (!state.task || state.task.trim() === '') {
      alert('Please set your needle-mover task first');
      return;
    }
    
    const mit = state.task;
    
    // Show confirmation dialog with disclaimer about admin privileges
    const confirmed = confirm(
      '⚠️ BEGIN FOCUS MODE\n\n' +
      'System-wide website blocking will be enabled.\n' +
      '• ALL websites except google.com and your allowed sites will be blocked\n' +
      '• Admin privileges required (password prompt will appear)'
    );
    
    if (!confirmed) {
      console.log('User cancelled focus mode start');
      return;
    }
    
    console.log('Session starting with MIT:', mit, 'Duration:', duration);
    
    state.currentSession = { mit, duration, startTime: Date.now() };
    state.isLocked = true;
    
  // Start Electron monitoring
  if (window.electronAPI) {
    try {
      console.log('Starting Electron session with:', {
        allowApps: (state.allowApps || []).map((a) => getAllowAppProcessKey(a)),
        allowSites: state.allowSites || []
      });
      
      const result = await window.electronAPI.startSession({
        allowApps: (state.allowApps || []).map((a) => getAllowAppProcessKey(a)),
        allowSites: state.allowSites || [],
        googleAlwaysAllowed: state.googleAlwaysAllowed !== false
      });
      
      console.log('Electron startSession result:', result);
      
      window.electronAPI.setLocked(true);
      window.electronAPI.requestFullscreen();
      console.log('Electron session started successfully');
    } catch (e) {
      console.error('Error starting Electron session:', e);
      console.error('Error stack:', e.stack);
      alert('Error starting session: ' + (e.message || 'Unknown error') + '. Check console for details.');
      // Don't return - continue with session anyway
    }
  } else {
    console.warn('electronAPI not available');
  }
    
    // Show focus session
    showPhase('focus-session');
    
    const sessionMitEl = document.getElementById('session-mit');
    if (sessionMitEl) {
      sessionMitEl.textContent = mit;
    }
    
    // Start timer
    state.endTime = Date.now() + (duration * 60 * 1000);
    startTimer();
    
    // Start soundscape
    updateSoundscape();
    
    // Render soundscape in session
    renderSessionSoundscape();
    
    // Render allowed apps and websites
    renderSessionAllowed();
    
    console.log('Session started successfully');
  } catch (e) {
    console.error('Error in startSession:', e);
    alert('Error starting session: ' + e.message);
  }
}

// Start timer
function startTimer() {
  function updateTimer() {
    if (!state.isLocked) return;
    
    const remaining = Math.max(0, state.endTime - Date.now());
    
    if (remaining <= 0) {
      completeSession();
      return;
    }
    
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    
    const timerEl = document.getElementById('session-timer');
    if (timerEl) {
      timerEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    
    setTimeout(updateTimer, 1000);
  }
  
  updateTimer();
}

// Show password prompt modal (with optional multiple attempts)
function showPasswordPrompt(message, attempts = 1) {
  return new Promise((resolve) => {
    (async () => {
    // Fullscreen + modal breaks keyboard focus on Windows; exit fullscreen before any prompt
    if (window.electronAPI && typeof window.electronAPI.exitFullscreenUnconditional === 'function') {
      try {
        await window.electronAPI.exitFullscreenUnconditional();
      } catch (e) {
        console.warn('exitFullscreenUnconditional:', e);
      }
      const isWin =
        typeof window.electronAPI.getPlatform === 'function' &&
        window.electronAPI.getPlatform() === 'win32';
      await new Promise((r) => setTimeout(r, isWin ? 100 : 0));
    }
    const modal = document.getElementById('password-modal');
    const messageEl = document.getElementById('password-modal-message');
    const input = document.getElementById('password-input');
    const confirmBtn = document.getElementById('password-modal-confirm');
    const cancelBtn = document.getElementById('password-modal-cancel');
    
    if (!modal || !messageEl || !input || !confirmBtn || !cancelBtn) {
      console.error('Password modal elements not found');
      resolve(false);
      return;
    }
    
    // `attempts` = how many times the user must enter the correct password in a row (e.g. 3 for emergency exit).
    let successCount = 0;
    const maxAttempts = attempts || 1;
    const initialMessage = message || 'Please enter your password to continue.';
    messageEl.textContent =
      maxAttempts > 1
        ? `${initialMessage}\n\nEnter your ACCOUNT password (Attempt 1 of ${maxAttempts}):`
        : initialMessage;
    input.value = '';
    modal.classList.add('password-modal--open');
    modal.setAttribute('aria-hidden', 'false');
    input.focus();
    setTimeout(() => {
      try {
        input.focus();
        input.select();
      } catch (_) {}
    }, 50);

    const cleanup = () => {
      modal.classList.remove('password-modal--open');
      modal.setAttribute('aria-hidden', 'true');
      input.value = '';
      confirmBtn.onclick = null;
      cancelBtn.onclick = null;
      input.onkeydown = null;
    };

    const offlineNetworkHint = () => {
      const isWin =
        typeof window.electronAPI?.getPlatform === 'function' &&
        window.electronAPI.getPlatform() === 'win32';
      return isWin
        ? 'If blocking broke your network: run RESTORE_WINDOWS_PROXY.bat from the install folder (as Administrator if needed), or in an elevated Command Prompt run: netsh winhttp reset proxy'
        : 'If blocking broke your network, run CLEAR_MACOS_NETWORK.command or fix_network_proxy_gui.js from the app folder.';
    };
    
    const handleConfirm = async () => {
      const password = input.value;
      if (!password) {
        return; // Don't resolve if password is empty
      }
      
      const currentUser = localStorage.getItem('0per8r_currentUser');
      if (!currentUser) {
        alert('No user found. Please log in again.');
        cleanup();
        resolve(false);
        return;
      }
      
      const users = JSON.parse(localStorage.getItem('0per8r_users') || '{}');
      const userData = users[currentUser];
      
      let passwordOk = false;
      if (userData && userData.passwordHash) {
        passwordOk = hashPassword(password) === userData.passwordHash;
      } else {
        // No local hash yet (e.g. API-only session): verify online and save hash for offline exit
        try {
          const res = await fetch(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ emailOrUsername: currentUser, password })
          });
          if (res.ok) {
            passwordOk = true;
            mergePasswordHashIntoUser(currentUser, (userData && userData.email) || '', password);
          } else if (res.status === 401) {
            alert('Incorrect ACCOUNT password. Please try again.');
            input.value = '';
            input.focus();
            return;
          } else {
            const data = await res.json().catch(() => ({}));
            alert(data.error || 'Could not verify password. Try again.');
            input.value = '';
            input.focus();
            return;
          }
        } catch (e) {
          const usersRetry = JSON.parse(localStorage.getItem('0per8r_users') || '{}');
          const ud2 = usersRetry[currentUser];
          if (ud2 && ud2.passwordHash && hashPassword(password) === ud2.passwordHash) {
            passwordOk = true;
          } else {
            alert(
              `Could not reach the server to verify your password. ${offlineNetworkHint()} After you log in once while online, your password is saved locally for offline exit.`
            );
            input.value = '';
            input.focus();
            return;
          }
        }
      }
      
      if (passwordOk) {
        successCount++;
        if (successCount >= maxAttempts) {
          cleanup();
          resolve(true);
        } else {
          const remaining = maxAttempts - successCount;
          messageEl.textContent = `${initialMessage}\n\nAttempt ${successCount} of ${maxAttempts} successful. Enter your ACCOUNT password ${remaining} more time${remaining > 1 ? 's' : ''} (Attempt ${successCount + 1} of ${maxAttempts}):`;
          input.value = '';
          input.focus();
        }
      } else {
        alert('Incorrect ACCOUNT password. Please try again.');
        input.value = '';
        input.focus();
      }
    };
    
    const handleCancel = () => {
      cleanup();
      resolve(false);
    };
    
    confirmBtn.onclick = handleConfirm;
    cancelBtn.onclick = handleCancel;
    
    input.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleConfirm();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      }
    };
    })().catch((err) => {
      console.error('showPasswordPrompt:', err);
      resolve(false);
    });
  });
}

// Handle emergency exit
async function handleEmergencyExit() {
  try {
    if (window.electronAPI && typeof window.electronAPI.exitFullscreenUnconditional === 'function') {
      try {
        await window.electronAPI.exitFullscreenUnconditional();
      } catch (e) {
        console.warn(e);
      }
      const isWin =
        typeof window.electronAPI.getPlatform === 'function' &&
        window.electronAPI.getPlatform() === 'win32';
      if (isWin) await new Promise((r) => setTimeout(r, 80));
    }
    // Show confirmation dialog
    const confirmed = confirm('⚠️ Emergency Exit\n\nThis session will be marked as incomplete and your streak will be reset.\n\nAre you sure you want to exit?');
    
    if (!confirmed) {
      return; // User cancelled
    }
    
    // Require 3 correct password entries in a row (same as intentional design)
    const passwordCorrect = await showPasswordPrompt('Enter your ACCOUNT password to exit The Execution Chamber.', 3);
    
    if (!passwordCorrect) {
      return; // User cancelled or password incorrect
    }
    
    console.log('Emergency exit confirmed with password');
    
    state.isLocked = false;
    
    // Stop all sounds
    Object.keys(audioElements).forEach(sound => {
      try {
        stopSound(sound);
      } catch (e) {
        console.warn('Error stopping sound:', e);
      }
    });
    
    // Stop session: await so main process starts restore (proxy / WinHTTP) before leaving session UI
    if (window.electronAPI) {
      try {
        await window.electronAPI.stopSession();
        window.electronAPI.setLocked(false);
        window.electronAPI.exitFullscreen();
      } catch (e) {
        console.error('Error calling electronAPI:', e);
      }
    }
    
    state.streak = 0;
    saveState();
    showPhase('dashboard');
    updateUI();
    
    console.log('Emergency exit completed');
  } catch (e) {
    console.error('Error in emergency exit:', e);
    // Force show dashboard even if there's an error
    try {
      showPhase('dashboard');
      state.isLocked = false;
    } catch (e2) {
      console.error('Could not show dashboard:', e2);
    }
  }
}

// Complete session (timer finished — must always reach completion UI)
async function completeSession() {
  if (sessionCompletionInProgress) return;
  sessionCompletionInProgress = true;
  try {
    state.isLocked = false;

    try {
      Object.keys(audioElements).forEach((sound) => stopSound(sound));
    } catch (e) {
      console.warn('stopSound:', e);
    }

    if (window.electronAPI) {
      try {
        await window.electronAPI.stopSession();
      } catch (e) {
        console.error('stopSession failed:', e);
      }
      try {
        window.electronAPI.setLocked(false);
        window.electronAPI.exitFullscreen();
      } catch (e) {
        console.warn('setLocked/exitFullscreen:', e);
      }
    }
    showPhase('completion');
  } finally {
    sessionCompletionInProgress = false;
  }
}

// Handle completion
function handleCompletion() {
  const selected = document.querySelector('.option-btn.selected');
  if (!selected) {
    alert('Please select if task was completed');
    return;
  }
  
  const result = selected.dataset.result;
  if (result === 'yes') {
    state.streak++;
  } else {
    state.streak = 0;
  }
  
  saveState();
  showPhase('dashboard');
  updateUI();
}

// Backend API - set to your Vercel deployment URL (see BACKEND_SETUP.md). Use https://
function getApiBase() {
  // Must match Vercel project → Deployments → Domains (production), e.g. 0per8r-complete1.vercel.app
  const url = 'https://0per8r-complete1.vercel.app';
  return url.startsWith('http') ? url : 'https://' + url;
}
const API_BASE = getApiBase();

// Authentication Functions
function checkAuthentication() {
  const currentUser = localStorage.getItem('0per8r_currentUser');
  const sessionToken = localStorage.getItem('0per8r_sessionToken');
  const sessionExpiry = localStorage.getItem('0per8r_sessionExpiry');
  
  console.log('Checking authentication:', { currentUser, hasToken: !!sessionToken, hasExpiry: !!sessionExpiry });
  
  if (currentUser && sessionToken) {
    // Check if session has expired
    if (sessionExpiry) {
      const expiryTime = parseInt(sessionExpiry, 10);
      const now = Date.now();
      console.log('Session expiry check:', { expiryTime, now, expired: now > expiryTime });
      if (now > expiryTime) {
        // Session expired, clear it
        console.log('Session expired, clearing...');
        clearSession();
        state.isAuthenticated = false;
        state.currentUser = null;
        return false;
      }
    }
    // Session is valid
    console.log('Session valid, user authenticated:', currentUser);
    state.isAuthenticated = true;
    state.currentUser = currentUser;
    return true;
  }
  
  console.log('No valid session found');
  state.isAuthenticated = false;
  state.currentUser = null;
  return false;
}

function saveUserData(username, email, passwordHash, verified = true, verificationCode = null) {
  // Store user accounts (in production, this would be on a server)
  const users = JSON.parse(localStorage.getItem('0per8r_users') || '{}');
  users[username] = {
    email: email.toLowerCase(),
    passwordHash: passwordHash,
    verified: true,
    createdAt: new Date().toISOString()
  };
  // Also store by email for lookup
  const usersByEmail = JSON.parse(localStorage.getItem('0per8r_users_by_email') || '{}');
  usersByEmail[email.toLowerCase()] = username;
  localStorage.setItem('0per8r_users', JSON.stringify(users));
  localStorage.setItem('0per8r_users_by_email', JSON.stringify(usersByEmail));
}

/**
 * Store a local password hash after API login/signup so exit/quit verification works offline
 * (e.g. broken proxy / ERR_PROXY when the server cannot be reached).
 */
function mergePasswordHashIntoUser(username, email, plainPassword) {
  if (!username || !plainPassword) return;
  const hash = hashPassword(plainPassword);
  const users = JSON.parse(localStorage.getItem('0per8r_users') || '{}');
  const usersByEmail = JSON.parse(localStorage.getItem('0per8r_users_by_email') || '{}');
  const prev = users[username] || {};
  const emailNorm =
    email && typeof email === 'string' && email.includes('@')
      ? email.trim().toLowerCase()
      : prev.email || '';
  users[username] = {
    ...prev,
    email: prev.email || emailNorm,
    passwordHash: hash,
    verified: prev.verified !== false,
    createdAt: prev.createdAt || new Date().toISOString()
  };
  if (emailNorm && emailNorm.includes('@')) {
    usersByEmail[emailNorm] = username;
  }
  localStorage.setItem('0per8r_users', JSON.stringify(users));
  localStorage.setItem('0per8r_users_by_email', JSON.stringify(usersByEmail));
}

function getUserData(usernameOrEmail) {
  if (!usernameOrEmail || typeof usernameOrEmail !== 'string') {
    return null;
  }
  
  const users = JSON.parse(localStorage.getItem('0per8r_users') || '{}');
  const usersByEmail = JSON.parse(localStorage.getItem('0per8r_users_by_email') || '{}');
  
  // Try username first
  if (users[usernameOrEmail]) {
    return users[usernameOrEmail];
  }
  
  // Try email lookup
  const username = usersByEmail[usernameOrEmail.toLowerCase()];
  if (username && users[username]) {
    return users[username];
  }
  
  return null;
}

function getUserByEmail(email) {
  if (!email || typeof email !== 'string') {
    return null;
  }
  
  const usersByEmail = JSON.parse(localStorage.getItem('0per8r_users_by_email') || '{}');
  const username = usersByEmail[email.toLowerCase()];
  if (username) {
    const users = JSON.parse(localStorage.getItem('0per8r_users') || '{}');
    return users[username] || null;
  }
  return null;
}

function getUserByUsername(username) {
  const users = JSON.parse(localStorage.getItem('0per8r_users') || '{}');
  return users[username] || null;
}

// Validate email format - strict: valid structure, recognised TLDs
function isValidEmail(email) {
  if (!email || typeof email !== 'string' || email.length > 254) return false;
  const trimmed = email.trim();
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(trimmed)) return false;
  const parts = trimmed.split('@');
  const domain = parts[1];
  const tld = domain ? domain.split('.').pop() : '';
  const commonTlds = ['com', 'org', 'net', 'edu', 'gov', 'co', 'io', 'me', 'app', 'dev', 'info', 'biz', 'uk', 'de', 'fr', 'jp', 'cn', 'in', 'au', 'br'];
  if (tld && tld.length >= 2 && tld.length <= 6 && /^[a-z]{2,6}$/i.test(tld)) return true;
  return commonTlds.includes(tld.toLowerCase());
}

// Generate verification code
function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send verification email using backend API (Resend)
async function sendVerificationEmail(email, code) {
  // Store code with expiry (24 hours)
  const verificationData = {
    email: email.toLowerCase(),
    code: code,
    expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
  };
  localStorage.setItem(`0per8r_verification_${email.toLowerCase()}`, JSON.stringify(verificationData));
  
  try {
    // Send email via backend API endpoint
    const backendUrl = 'https://0per8r-email-api-real.vercel.app/api/send-verification';
    
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: email,
        code: code,
        subject: '0per8r Email Verification'
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('Verification email sent successfully to', email);
      return { success: true };
    } else {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('Backend email service error:', errorData);
      throw new Error(errorData.error || 'Email service error');
    }
  } catch (error) {
    console.error('Error sending verification email:', error);
    // Still return success:false but don't show code in UI - user should check email
    // The code is stored in localStorage so verification can still work
    return { success: false, error: error.message };
  }
}

function hashPassword(password) {
  // Simple hash function (in production, use proper bcrypt or similar)
  // For now, just a simple hash for local storage
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString();
}

function createSession(username) {
  const sessionToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  const expiryTime = Date.now() + (30 * 24 * 60 * 60 * 1000);
  localStorage.setItem('0per8r_currentUser', username);
  localStorage.setItem('0per8r_sessionToken', sessionToken);
  localStorage.setItem('0per8r_sessionExpiry', expiryTime.toString());
  state.isAuthenticated = true;
  state.currentUser = username;
}

// Create session from API response (backend auth)
function createSessionFromApi(token, expiry, user) {
  if (!token || !user || !user.username) return;
  localStorage.setItem('0per8r_currentUser', user.username);
  localStorage.setItem('0per8r_sessionToken', token);
  localStorage.setItem('0per8r_sessionExpiry', String(expiry || Date.now() + 30 * 24 * 60 * 60 * 1000));
  state.isAuthenticated = true;
  state.currentUser = user.username;
}

// Apply preferences from API user object to state - full overwrite for clean per-account state
function applyPreferencesToState(prefs) {
  if (!prefs || typeof prefs !== 'object') return;
  state.mission = prefs.mission !== undefined ? prefs.mission : '';
  state.goal = prefs.goal !== undefined ? prefs.goal : '';
  state.task = prefs.task !== undefined ? prefs.task : '';
  state.allowSites = Array.isArray(prefs.allowSites) ? prefs.allowSites : [];
  state.allowApps = normalizeAllowAppsArray(Array.isArray(prefs.allowApps) ? prefs.allowApps : []);
  state.googleAlwaysAllowed = prefs.googleAlwaysAllowed !== undefined ? prefs.googleAlwaysAllowed : true;
  if (prefs.soundscape && typeof prefs.soundscape === 'object') {
    state.soundscape = { ...state.soundscape, ...prefs.soundscape };
  }
  state.soundscapeEnabled = prefs.soundscapeEnabled !== undefined ? prefs.soundscapeEnabled : true;
  state.streak = prefs.streak !== undefined ? prefs.streak : 0;
}

function clearSession() {
  localStorage.removeItem('0per8r_currentUser');
  localStorage.removeItem('0per8r_sessionToken');
  localStorage.removeItem('0per8r_sessionExpiry');
  state.isAuthenticated = false;
  state.currentUser = null;
}

// Logout function
window.handleLogout = function() {
  if (confirm('Are you sure you want to log out?')) {
    clearSession();
    showPhase('auth');
    // Clear any error messages
    clearAuthErrors();
    // Reset auth tabs to login
    switchAuthTab('login');
  }
};

// Windows uninstaller - opens Uninstall 0per8r.exe
window.handleUninstall = async function() {
  if (!window.electronAPI || !window.electronAPI.openUninstaller) return;
  if (!confirm('This will launch the 0per8r uninstaller. The app will need to close for uninstallation to complete.\n\nContinue?')) return;
  try {
    const result = await window.electronAPI.openUninstaller();
    if (result && result.ok) {
      alert('Uninstaller launched. Please follow the prompts to remove 0per8r.');
    } else if (result && result.error) {
      alert(result.error);
    }
  } catch (e) {
    console.error('Uninstall error:', e);
    alert('Failed to open uninstaller. Use Settings > Apps to uninstall 0per8r.');
  }
};

// Global functions for inline event handlers - must be on window object
window.switchAuthTab = function(tab) {
  console.log('Switching to tab:', tab);
  const loginTab = document.getElementById('login-tab');
  const signupTab = document.getElementById('signup-tab');
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  
  if (tab === 'login') {
    if (loginTab) loginTab.classList.add('active');
    if (signupTab) signupTab.classList.remove('active');
    if (loginForm) loginForm.classList.add('active');
    if (signupForm) signupForm.classList.remove('active');
  } else {
    if (signupTab) signupTab.classList.add('active');
    if (loginTab) loginTab.classList.remove('active');
    if (signupForm) signupForm.classList.add('active');
    if (loginForm) loginForm.classList.remove('active');
  }
  // Ensure verify form is hidden (no longer used)
  const verifyForm = document.getElementById('verify-email-form');
  if (verifyForm) verifyForm.style.display = 'none';
  clearAuthErrors();
};

function initializeAuthListeners() {
  // Event listeners are now inline in HTML, so this function just logs
  console.log('✓ Auth page ready (using inline event handlers)');
}

function clearAuthErrors() {
  const errorEl = document.getElementById('auth-error');
  const signupErrorEl = document.getElementById('signup-error');
  if (errorEl) {
    errorEl.textContent = '';
    errorEl.style.display = 'none';
  }
  if (signupErrorEl) {
    signupErrorEl.textContent = '';
    signupErrorEl.style.display = 'none';
  }
}

function showAuthError(message, isSignup = false) {
  const errorEl = isSignup ? document.getElementById('signup-error') : document.getElementById('auth-error');
  if (errorEl) {
    errorEl.innerHTML = '';
    errorEl.textContent = message;
    errorEl.style.display = 'block';
    console.log('Auth error shown:', message, isSignup ? '(signup)' : '(login)');
  } else {
    console.error('Error element not found!', isSignup ? 'signup-error' : 'auth-error');
  }
}

// Make handleLogin global so inline handlers can access it
window.handleLogin = async function() {
  const usernameEl = document.getElementById('login-username');
  const passwordEl = document.getElementById('login-password');
  if (!usernameEl || !passwordEl) { showAuthError('Form error - please refresh'); return; }
  const usernameOrEmail = usernameEl.value.trim();
  const password = passwordEl.value;
  clearAuthErrors();
  if (!usernameOrEmail || !password) {
    showAuthError('Please enter both email/username and password');
    return;
  }
  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailOrUsername: usernameOrEmail, password })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      createSessionFromApi(data.token, data.expiry, data.user);
      const u = data.user;
      if (u && u.username) {
        mergePasswordHashIntoUser(u.username, u.email || usernameOrEmail, password);
      }
      showPhase('dashboard');
      applyPreferencesToState(data.user && data.user.preferences);
      saveState(); // Persist to per-user localStorage immediately so each account stays separate
      await loadState();
      initializeEventListeners();
      updateUI();
      try { initAudioContext(); } catch (e) { console.warn('Audio init failed:', e); }
      return;
    }
    // 401 "Account not found" from API - user may exist only in local storage (signup fell back to local when API was down)
    if (res.status === 401) {
      const userData = getUserData(usernameOrEmail);
      if (userData) {
        const passwordHash = hashPassword(password);
        const usersByEmail = JSON.parse(localStorage.getItem('0per8r_users_by_email') || '{}');
        const username = usersByEmail[usernameOrEmail.toLowerCase()] || usernameOrEmail;
        if (userData.passwordHash === passwordHash) {
          createSession(username);
          showPhase('dashboard');
          await loadState();
          initializeEventListeners();
          updateUI();
          try { initAudioContext(); } catch (e) { console.warn('Audio init failed:', e); }
          return;
        }
      }
      showAuthError(data.error || 'Login failed');
      return;
    }
    const isServerConfigError = res.status === 500 || (data.error && (data.error.includes('configuration') || data.error.includes('Server configuration')));
    if (isServerConfigError) {
      const userData = getUserData(usernameOrEmail);
      if (!userData) {
        showAuthError('Account not found. Please sign up first.');
        return;
      }
      const passwordHash = hashPassword(password);
      const usersByEmail = JSON.parse(localStorage.getItem('0per8r_users_by_email') || '{}');
      const username = usersByEmail[usernameOrEmail.toLowerCase()] || usernameOrEmail;
      if (userData.passwordHash !== passwordHash) {
        showAuthError('Incorrect password');
        return;
      }
      createSession(username);
      showPhase('dashboard');
      await loadState();
      initializeEventListeners();
      updateUI();
      try { initAudioContext(); } catch (e) { console.warn('Audio init failed:', e); }
      return;
    }
    showAuthError(data.error || 'Login failed');
  } catch (e) {
    const userData = getUserData(usernameOrEmail);
    if (!userData) {
      showAuthError('Cannot reach server. Please check your connection or try again later.');
      return;
    }
    const passwordHash = hashPassword(password);
    const usersByEmail = JSON.parse(localStorage.getItem('0per8r_users_by_email') || '{}');
    const username = usersByEmail[usernameOrEmail.toLowerCase()] || usernameOrEmail;
    if (userData.passwordHash !== passwordHash) {
      showAuthError('Incorrect password');
      return;
    }
    createSession(username);
    showPhase('dashboard');
    await loadState();
    initializeEventListeners();
    updateUI();
    try { initAudioContext(); } catch (e) { console.warn('Audio init failed:', e); }
  }
};

// Make handleSignup global so inline handlers can access it
window.handleSignup = async function() {
  console.log('handleSignup called');
  const emailEl = document.getElementById('signup-email');
  const usernameEl = document.getElementById('signup-username');
  const passwordEl = document.getElementById('signup-password');
  const confirmEl = document.getElementById('signup-confirm');
  
  if (!emailEl || !usernameEl || !passwordEl || !confirmEl) {
    console.error('Signup form elements not found!');
    showAuthError('Form error - please refresh the page', true);
    return;
  }
  
  const email = emailEl.value.trim();
  const username = usernameEl.value.trim();
  const password = passwordEl.value;
  const confirm = confirmEl.value;
  
  console.log('Signup attempt:', { email, username, passwordLength: password.length });
  
  clearAuthErrors();
  
  if (!email || !username || !password || !confirm) {
    showAuthError('Please fill in all fields', true);
    return;
  }
  
  // Validate email format
  if (!isValidEmail(email)) {
    showAuthError('Please enter a valid email address', true);
    return;
  }
  
  if (username.length < 3) {
    showAuthError('Username must be at least 3 characters', true);
    return;
  }
  
  if (password.length < 6) {
    showAuthError('Password must be at least 6 characters', true);
    return;
  }
  
  if (password !== confirm) {
    showAuthError('Passwords do not match', true);
    return;
  }
  
  try {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), username: username.trim(), password })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      createSessionFromApi(data.token, data.expiry, data.user);
      const u = data.user;
      if (u && u.username) {
        mergePasswordHashIntoUser(u.username, u.email || email, password);
      }
      showPhase('dashboard');
      applyPreferencesToState(data.user && data.user.preferences);
      saveState(); // Persist to per-user localStorage immediately so each account stays separate
      await loadState();
      initializeEventListeners();
      updateUI();
      try { initAudioContext(); } catch (e) { console.warn('Audio init failed:', e); }
      return;
    }
    if (res.status === 401) {
      showAuthError('Backend returned 401. Turn off Vercel Deployment Protection (Settings → Deployment Protection) so the API can be reached.', true);
      return;
    }
    const isServerConfigError = res.status === 500 || (data.error && (data.error.includes('configuration') || data.error.includes('Server configuration')));
    if (isServerConfigError) {
      if (getUserByEmail(email)) {
        showAuthError('An account with this email already exists', true);
        return;
      }
      if (getUserByUsername(username)) {
        showAuthError('Username already taken', true);
        return;
      }
      const passwordHash = hashPassword(password);
      saveUserData(username, email, passwordHash, true);
      createSession(username);
      showPhase('dashboard');
      await loadState();
      initializeEventListeners();
      updateUI();
      try { initAudioContext(); } catch (e) { console.warn('Audio init failed:', e); }
      return;
    }
    const errMsg = (data && data.error) ? data.error : (`Sign up failed (${res.status}). Check backend and Supabase.`);
    showAuthError(errMsg, true);
  } catch (e) {
    if (getUserByEmail(email)) {
      showAuthError('An account with this email already exists', true);
      return;
    }
    if (getUserByUsername(username)) {
      showAuthError('Username already taken', true);
      return;
    }
    const passwordHash = hashPassword(password);
    saveUserData(username, email, passwordHash, true);
    createSession(username);
    showPhase('dashboard');
    await loadState();
    initializeEventListeners();
    updateUI();
    try { initAudioContext(); } catch (e) { console.warn('Audio init failed:', e); }
  }
};

// Handle email verification
window.handleVerifyEmail = function() {
  const codeEl = document.getElementById('verify-code');
  if (!codeEl) return;
  
  const code = codeEl.value.trim();
  clearAuthErrors();
  
  if (!code || code.length !== 6) {
    const verifyError = document.getElementById('verify-error');
    if (verifyError) {
      verifyError.textContent = 'Please enter the 6-digit verification code';
      verifyError.style.color = '#f00';
    }
    return;
  }
  
  // Get pending verification
  const pending = JSON.parse(localStorage.getItem('0per8r_pending_verification') || 'null');
  if (!pending) {
    showAuthError('No pending verification found. Please sign up again.', true);
    return;
  }
  
  const { username, email } = pending;
  const userData = getUserByUsername(username);
  
  if (!userData) {
    showAuthError('Account not found. Please sign up again.', true);
    return;
  }
  
  // Check verification code
  const storedCode = localStorage.getItem(`0per8r_verification_${email.toLowerCase()}`);
  if (!storedCode) {
    showAuthError('Verification code expired. Please request a new one.', true);
    return;
  }
  
  const verificationData = JSON.parse(storedCode);
  if (Date.now() > verificationData.expiresAt) {
    showAuthError('Verification code expired. Please request a new one.', true);
    localStorage.removeItem(`0per8r_verification_${email.toLowerCase()}`);
    return;
  }
  
  if (code !== verificationData.code && code !== userData.verificationCode) {
    const verifyError = document.getElementById('verify-error');
    if (verifyError) {
      verifyError.textContent = 'Invalid verification code. Please try again.';
      verifyError.style.color = '#f00';
    }
    return;
  }
  
  // Verify account
  userData.verified = true;
  const users = JSON.parse(localStorage.getItem('0per8r_users') || '{}');
  users[username] = userData;
  localStorage.setItem('0per8r_users', JSON.stringify(users));
  
  // Clean up
  localStorage.removeItem('0per8r_pending_verification');
  localStorage.removeItem(`0per8r_verification_${email.toLowerCase()}`);
  
  console.log('Email verified successfully!');
  
  // Auto-login after verification
  createSession(username);
  showPhase('dashboard');
  
  // Initialize app
  loadState();
  initializeEventListeners();
  updateUI();
  
  try {
    initAudioContext();
  } catch (e) {
    console.warn('Audio init failed (non-critical):', e);
  }
};

// Handle resend verification code
window.handleResendCode = async function() {
  const pending = JSON.parse(localStorage.getItem('0per8r_pending_verification') || 'null');
  if (!pending) {
    showAuthError('No pending verification found.', true);
    return;
  }
  
  const { email } = pending;
  const verificationCode = generateVerificationCode();
  
  try {
    const emailResult = await sendVerificationEmail(email, verificationCode);
    
    // Update code in user data
    const userData = getUserByEmail(email);
    if (userData) {
      userData.verificationCode = verificationCode;
      const users = JSON.parse(localStorage.getItem('0per8r_users') || '{}');
      const username = JSON.parse(localStorage.getItem('0per8r_users_by_email') || '{}')[email.toLowerCase()];
      if (username) {
        users[username] = userData;
        localStorage.setItem('0per8r_users', JSON.stringify(users));
      }
    }
    
    const verifyError = document.getElementById('verify-error');
    if (verifyError) {
      if (emailResult && emailResult.success) {
        verifyError.innerHTML = `
          <div style="color: #0f0; margin-bottom: 8px; font-size: 14px;">
            ✅ New verification code sent to ${email}
          </div>
          <div style="color: #aaa; font-size: 12px;">
            Please check your inbox (and spam folder) for the verification code.
          </div>
        `;
        verifyError.style.color = '#0f0';
      } else {
        // Email sending failed
        verifyError.innerHTML = `
          <div style="color: #ff0; margin-bottom: 8px; font-size: 14px;">
            ⚠️ Email sending failed: ${emailResult?.error || 'Unknown error'}
          </div>
          <div style="color: #aaa; font-size: 12px;">
            Please try again. The verification code has been generated and will work when you receive the email.
          </div>
        `;
        verifyError.style.color = '#ff0';
      }
    }
  } catch (error) {
    console.error('Error resending verification email:', error);
    const verifyError = document.getElementById('verify-error');
    if (verifyError) {
      verifyError.innerHTML = `
        <div style="color: #ff0; margin-bottom: 8px; font-size: 14px;">
          ⚠️ Error: ${error.message || 'Failed to send verification email'}
        </div>
        <div style="color: #aaa; font-size: 12px;">
          Please try again or contact support.
        </div>
      `;
      verifyError.style.color = '#ff0';
    }
  }
};

// Initialize auto-updater listeners
function initializeUpdateListeners() {
  if (!window.electronAPI) {
    console.warn('electronAPI not available for updates');
    return;
  }
  
  // Listen for update status
  window.electronAPI.onUpdateStatus((data) => {
    console.log('Update status:', data);
    showUpdateNotification(data);
  });
  
  // Listen for download progress
  window.electronAPI.onUpdateProgress((data) => {
    console.log('Update progress:', data.percent + '%');
    updateDownloadProgress(data);
  });
  
  // Check for updates on startup (after a delay)
  setTimeout(() => {
    if (window.electronAPI && window.electronAPI.checkForUpdates) {
      window.electronAPI.checkForUpdates().then(result => {
        if (result && result.success) {
          console.log('Update check completed');
        }
      }).catch(err => {
        console.warn('Update check failed:', err);
      });
    }
  }, 5000); // Wait 5 seconds after app loads
}

// Show update notification
function showUpdateNotification(data) {
  const { status, version, message } = data;
  
  // Create or get update notification element
  let updateDiv = document.getElementById('update-notification');
  if (!updateDiv) {
    updateDiv = document.createElement('div');
    updateDiv.id = 'update-notification';
    updateDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #1a1a2e;
      border: 2px solid #0f0;
      padding: 16px 20px;
      border-radius: 0;
      color: #fff;
      font-family: var(--mono);
      font-size: 12px;
      z-index: 10000;
      max-width: 300px;
      box-shadow: 0 4px 20px rgba(0, 255, 0, 0.3);
      display: none;
    `;
    document.body.appendChild(updateDiv);
  }
  
  if (status === 'available') {
    updateDiv.innerHTML = `
      <div style="margin-bottom: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;">
        Update Available
      </div>
      <div style="margin-bottom: 12px; color: #aaa;">
        Version ${version} is available
      </div>
      <div style="display: flex; gap: 8px;">
        <button onclick="installUpdate()" style="
          padding: 8px 16px;
          background: #0f0;
          border: none;
          color: #000;
          font-family: var(--mono);
          font-weight: 700;
          cursor: pointer;
          text-transform: uppercase;
          font-size: 11px;
        ">Download & Install</button>
        <button onclick="dismissUpdate()" style="
          padding: 8px 16px;
          background: transparent;
          border: 1px solid #666;
          color: #fff;
          font-family: var(--mono);
          cursor: pointer;
          text-transform: uppercase;
          font-size: 11px;
        ">Later</button>
      </div>
    `;
    updateDiv.style.display = 'block';
  } else if (status === 'downloaded') {
    updateDiv.innerHTML = `
      <div style="margin-bottom: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;">
        Update Ready
      </div>
      <div style="margin-bottom: 12px; color: #aaa;">
        Version ${version} downloaded. Restart to install.
      </div>
      <div style="display: flex; gap: 8px;">
        <button onclick="restartAndInstall()" style="
          padding: 8px 16px;
          background: #0f0;
          border: none;
          color: #000;
          font-family: var(--mono);
          font-weight: 700;
          cursor: pointer;
          text-transform: uppercase;
          font-size: 11px;
        ">Restart Now</button>
        <button onclick="dismissUpdate()" style="
          padding: 8px 16px;
          background: transparent;
          border: 1px solid #666;
          color: #fff;
          font-family: var(--mono);
          cursor: pointer;
          text-transform: uppercase;
          font-size: 11px;
        ">Later</button>
      </div>
    `;
    updateDiv.style.display = 'block';
  } else if (status === 'error') {
    updateDiv.innerHTML = `
      <div style="margin-bottom: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #f00;">
        Update Error
      </div>
      <div style="margin-bottom: 12px; color: #aaa; font-size: 11px;">
        ${message || 'Failed to check for updates'}
      </div>
      <button onclick="dismissUpdate()" style="
        padding: 8px 16px;
        background: transparent;
        border: 1px solid #666;
        color: #fff;
        font-family: var(--mono);
        cursor: pointer;
        text-transform: uppercase;
        font-size: 11px;
      ">Dismiss</button>
    `;
    updateDiv.style.borderColor = '#f00';
    updateDiv.style.display = 'block';
    setTimeout(() => {
      if (updateDiv) updateDiv.style.display = 'none';
    }, 5000);
  }
}

// Update download progress
function updateDownloadProgress(data) {
  let updateDiv = document.getElementById('update-notification');
  if (!updateDiv || updateDiv.style.display === 'none') return;
  
  const percent = Math.round(data.percent);
  const mbTransferred = (data.transferred / 1024 / 1024).toFixed(1);
  const mbTotal = (data.total / 1024 / 1024).toFixed(1);
  
  updateDiv.innerHTML = `
    <div style="margin-bottom: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;">
      Downloading Update
    </div>
    <div style="margin-bottom: 8px; color: #aaa; font-size: 11px;">
      ${percent}% - ${mbTransferred} MB / ${mbTotal} MB
    </div>
    <div style="
      width: 100%;
      height: 4px;
      background: #333;
      margin-bottom: 12px;
    ">
      <div style="
        width: ${percent}%;
        height: 100%;
        background: #0f0;
        transition: width 0.3s ease;
      "></div>
    </div>
    <div style="color: #666; font-size: 10px;">
      Please wait...
    </div>
  `;
}

// Global functions for update buttons
window.installUpdate = async function() {
  if (!window.electronAPI) return;
  try {
    if (typeof window.electronAPI.downloadUpdate === 'function') {
      const r = await window.electronAPI.downloadUpdate();
      if (r && r.success) return;
    }
  } catch (e) {
    console.warn('downloadUpdate:', e);
  }
  if (typeof window.electronAPI.checkForUpdates === 'function') {
    window.electronAPI.checkForUpdates();
  }
};

window.restartAndInstall = function() {
  if (window.electronAPI && window.electronAPI.restartAndInstall) {
    window.electronAPI.restartAndInstall();
  }
};

window.dismissUpdate = function() {
  const updateDiv = document.getElementById('update-notification');
  if (updateDiv) {
    updateDiv.style.display = 'none';
  }
};

// Show phase
function showPhase(phase) {
  document.querySelectorAll('.phase').forEach(p => p.classList.remove('active'));
  const phaseEl = document.getElementById(phase);
  if (phaseEl) {
    phaseEl.classList.add('active');
  }
}
