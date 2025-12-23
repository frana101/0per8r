// 0per8r - Dashboard System
const state = {
  mission: '',
  goal: '',
  task: '', // Single needle-mover task
  allowSites: [],
  allowApps: [],
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

function initApp() {
  console.log('Initializing app...');
  console.log('Document ready state:', document.readyState);
  console.log('Body exists:', !!document.body);
  
  // Show that we're loading
  if (document.body) {
    document.body.style.backgroundColor = '#0a0a0f';
    document.body.style.color = '#ffffff';
  }
  
  try {
    // Check authentication first
    checkAuthentication();
    
    if (!state.isAuthenticated) {
      // Show auth page
      showPhase('auth');
      // Initialize auth listeners immediately
      initializeAuthListeners();
      console.log('✓ Auth page shown');
      return; // Don't proceed to dashboard
    }
    
    // User is authenticated, proceed with normal initialization
    loadState();
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

// Load state
function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem('focusOS_state') || '{}');
    state.mission = saved.mission || '';
    state.goal = saved.goal || '';
    // Migrate old format
    if (saved.tasks && saved.tasks.length > 0) {
      const firstTask = typeof saved.tasks[0] === 'string' ? saved.tasks[0] : (saved.tasks[0].text || '');
      state.task = firstTask;
    } else {
      state.task = saved.task || '';
    }
    state.allowSites = saved.allowSites || [];
    state.allowApps = saved.allowApps || [];
    // Load soundscape but filter out any invalid keys (like whiteNoise from old versions)
  const allowedSounds = ['rain', 'ocean', 'fire', 'wind', 'forest', 'cafe', 'cityscape'];
  if (saved.soundscape) {
    state.soundscape = {};
    allowedSounds.forEach(sound => {
      state.soundscape[sound] = saved.soundscape[sound] || 0;
    });
  }
  state.soundscapeEnabled = saved.soundscapeEnabled !== undefined ? saved.soundscapeEnabled : true;
    state.streak = saved.streak || 0;
  } catch (e) {
    console.error('Load state error:', e);
  }
}

// Save state
function saveState() {
  localStorage.setItem('focusOS_state', JSON.stringify({
    mission: state.mission,
    goal: state.goal,
    task: state.task,
    allowSites: state.allowSites,
    allowApps: state.allowApps,
    soundscape: state.soundscape,
    soundscapeEnabled: state.soundscapeEnabled,
    streak: state.streak
  }));
}

// Update UI
function updateUI() {
  try {
    // Mission
    const missionInput = document.getElementById('mission-input');
    if (missionInput) {
      missionInput.value = state.mission;
    }
    
    updateMITSelect();
    
    
    // Tags
    const removeSiteTag = (site) => {
      state.allowSites = state.allowSites.filter(s => s !== site);
      saveState();
      // Immediately re-render tags to update UI
      renderTags('allow-sites-tags', state.allowSites, removeSiteTag);
    };
    renderTags('allow-sites-tags', state.allowSites, removeSiteTag);
    
    const removeAppTag = (app) => {
      state.allowApps = state.allowApps.filter(a => a !== app);
      saveState();
      // Immediately re-render tags to update UI
      renderTags('allow-apps-tags', state.allowApps, removeAppTag);
    };
    renderTags('allow-apps-tags', state.allowApps, removeAppTag);
    
    // Streak
    const streakCount = document.getElementById('streak-count');
    if (streakCount) {
      streakCount.textContent = state.streak;
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
    
    // Update soundscape toggle buttons
    const toggleBtn1 = document.getElementById('soundscape-toggle');
    if (toggleBtn1) {
      toggleBtn1.textContent = state.soundscapeEnabled ? 'ON' : 'OFF';
      toggleBtn1.style.background = state.soundscapeEnabled ? '#000' : '#333';
      toggleBtn1.style.borderColor = state.soundscapeEnabled ? '#fff' : '#666';
    }
    
    const toggleBtn2 = document.getElementById('session-soundscape-toggle');
    if (toggleBtn2) {
      toggleBtn2.textContent = state.soundscapeEnabled ? 'ON' : 'OFF';
      toggleBtn2.style.background = state.soundscapeEnabled ? '#000' : '#333';
      toggleBtn2.style.borderColor = state.soundscapeEnabled ? '#fff' : '#666';
    }
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

// Update MIT select (simplified - just shows the current task)
function updateMITSelect() {
  const select = document.getElementById('mit-select');
  if (!select) return;
  
  select.innerHTML = '<option value="0">' + (state.task || 'No needle-mover set') + '</option>';
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
  
  // Tags - Sites
  document.getElementById('allow-sites-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && e.target.value.trim()) {
      const value = e.target.value.trim().replace(/^https?:\/\//, '').replace(/^www\./, '');
      if (!state.allowSites.includes(value)) {
        state.allowSites.push(value);
        e.target.value = '';
        saveState();
        updateUI();
      }
    }
  });
  
  // Tags - Apps
  document.getElementById('allow-apps-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && e.target.value.trim()) {
      const value = e.target.value.trim();
      if (!state.allowApps.includes(value)) {
        state.allowApps.push(value);
        e.target.value = '';
        saveState();
        updateUI();
      }
    }
  });
  
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
  
  // Soundscape toggle buttons
  const soundscapeToggle1 = document.getElementById('soundscape-toggle');
  if (soundscapeToggle1) {
    soundscapeToggle1.addEventListener('click', () => {
      state.soundscapeEnabled = !state.soundscapeEnabled;
      saveState();
      updateUI();
      updateSoundscape();
    });
  }
  
  const soundscapeToggle2 = document.getElementById('session-soundscape-toggle');
  if (soundscapeToggle2) {
    soundscapeToggle2.addEventListener('click', () => {
      state.soundscapeEnabled = !state.soundscapeEnabled;
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
    state.allowApps.forEach(app => {
      const item = document.createElement('div');
      item.className = 'allowed-item';
      item.textContent = app;
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
    const durationSelect = document.getElementById('duration-select');
    
    if (!mitSelect || !durationSelect) {
      console.error('Missing required elements');
      alert('Error: Missing required elements. Please refresh the app.');
      return;
    }
    
    const mitIndex = mitSelect.value;
    const duration = parseInt(durationSelect.value);
    
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
        allowApps: state.allowApps || [],
        allowSites: state.allowSites || []
      });
      
      const result = await window.electronAPI.startSession({
        allowApps: state.allowApps || [],
        allowSites: state.allowSites || []
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

// Handle emergency exit
async function handleEmergencyExit() {
  try {
    // Show confirmation dialog
    const confirmed = confirm('⚠️ Emergency Exit\n\nThis session will be marked as incomplete and your streak will be reset.\n\nAre you sure you want to exit?');
    
    if (!confirmed) {
      return; // User cancelled
    }
    
    console.log('Emergency exit confirmed');
    
    state.isLocked = false;
    
    // Stop all sounds
    Object.keys(audioElements).forEach(sound => {
      try {
        stopSound(sound);
      } catch (e) {
        console.warn('Error stopping sound:', e);
      }
    });
    
    // Stop session - don't await, do it in parallel
    if (window.electronAPI) {
      try {
        window.electronAPI.stopSession().catch(e => console.error('Stop session error:', e));
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

// Complete session
async function completeSession() {
  state.isLocked = false;
  
  // Stop all sounds
  Object.keys(audioSources).forEach(sound => stopSound(sound));
  
  if (window.electronAPI) {
    await window.electronAPI.stopSession();
    window.electronAPI.setLocked(false);
    window.electronAPI.exitFullscreen();
  }
  showPhase('completion');
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

// Authentication Functions
function checkAuthentication() {
  const currentUser = localStorage.getItem('0per8r_currentUser');
  const sessionToken = localStorage.getItem('0per8r_sessionToken');
  
  if (currentUser && sessionToken) {
    // Verify session is still valid (for now, just check if it exists)
    // In future, this could check with a server
    state.isAuthenticated = true;
    state.currentUser = currentUser;
    return true;
  }
  
  state.isAuthenticated = false;
  state.currentUser = null;
  return false;
}

function saveUserData(username, email, passwordHash, verified = false, verificationCode = null) {
  // Store user accounts (in production, this would be on a server)
  const users = JSON.parse(localStorage.getItem('0per8r_users') || '{}');
  users[username] = {
    email: email.toLowerCase(),
    passwordHash: passwordHash,
    verified: verified,
    verificationCode: verificationCode,
    createdAt: new Date().toISOString()
  };
  // Also store by email for lookup
  const usersByEmail = JSON.parse(localStorage.getItem('0per8r_users_by_email') || '{}');
  usersByEmail[email.toLowerCase()] = username;
  localStorage.setItem('0per8r_users', JSON.stringify(users));
  localStorage.setItem('0per8r_users_by_email', JSON.stringify(usersByEmail));
}

function getUserData(usernameOrEmail) {
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

// Validate email format
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Generate verification code
function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send verification email using Resend API
async function sendVerificationEmail(email, code) {
  // Store code with expiry (24 hours)
  const verificationData = {
    email: email.toLowerCase(),
    code: code,
    expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
  };
  localStorage.setItem(`0per8r_verification_${email.toLowerCase()}`, JSON.stringify(verificationData));
  
  // Get API key from localStorage (user needs to set this)
  const apiKey = localStorage.getItem('0per8r_resend_api_key');
  
  if (!apiKey) {
    console.error('Resend API key not set. Email not sent.');
    console.log(`[EMAIL VERIFICATION] Code for ${email}: ${code}`);
    console.log('To enable real emails, set your Resend API key in the app settings.');
    return Promise.resolve({ success: false, error: 'API key not configured' });
  }
  
  try {
    // Send email via Resend API
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        from: '0per8r <onboarding@resend.dev>', // Change this to your verified domain
        to: email,
        subject: '0per8r Email Verification',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #0f0;">0per8r Email Verification</h1>
            <p>Your verification code is:</p>
            <div style="background: #1a1a2e; padding: 20px; text-align: center; margin: 20px 0;">
              <h2 style="color: #0f0; font-size: 32px; letter-spacing: 8px; margin: 0;">${code}</h2>
            </div>
            <p style="color: #666; font-size: 12px;">This code expires in 24 hours.</p>
            <p style="color: #666; font-size: 12px;">If you didn't request this, please ignore this email.</p>
          </div>
        `,
        text: `Your 0per8r verification code is: ${code}\n\nThis code expires in 24 hours.`
      })
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('Verification email sent successfully to', email);
      return { success: true };
    } else {
      console.error('Failed to send email:', result);
      // Fallback: show in console
      console.log(`[EMAIL VERIFICATION] Code for ${email}: ${code}`);
      return { success: false, error: result.message || 'Failed to send email' };
    }
  } catch (error) {
    console.error('Error sending verification email:', error);
    // Fallback: show in console
    console.log(`[EMAIL VERIFICATION] Code for ${email}: ${code}`);
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
  localStorage.setItem('0per8r_currentUser', username);
  localStorage.setItem('0per8r_sessionToken', sessionToken);
  localStorage.setItem('0per8r_sessionExpiry', (Date.now() + (30 * 24 * 60 * 60 * 1000)).toString()); // 30 days
  state.isAuthenticated = true;
  state.currentUser = username;
}

function clearSession() {
  localStorage.removeItem('0per8r_currentUser');
  localStorage.removeItem('0per8r_sessionToken');
  localStorage.removeItem('0per8r_sessionExpiry');
  state.isAuthenticated = false;
  state.currentUser = null;
}

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
    errorEl.textContent = message;
    errorEl.style.display = 'block';
    console.log('Auth error shown:', message, isSignup ? '(signup)' : '(login)');
  } else {
    console.error('Error element not found!', isSignup ? 'signup-error' : 'auth-error');
  }
}

// Make handleLogin global so inline handlers can access it
window.handleLogin = function() {
  console.log('handleLogin called');
  const usernameEl = document.getElementById('login-username');
  const passwordEl = document.getElementById('login-password');
  
  if (!usernameEl || !passwordEl) {
    console.error('Login form elements not found!');
    showAuthError('Form error - please refresh the page');
    return;
  }
  
  const usernameOrEmail = usernameEl.value.trim();
  const password = passwordEl.value;
  
  console.log('Login attempt:', { usernameOrEmail, passwordLength: password.length });
  
  clearAuthErrors();
  
  if (!usernameOrEmail || !password) {
    showAuthError('Please enter both email/username and password');
    return;
  }
  
  const userData = getUserData(usernameOrEmail);
  console.log('User data retrieved:', userData ? 'found' : 'not found');
  
  if (!userData) {
    showAuthError('Account not found. Please sign up first.');
    return;
  }
  
  // Check if email is verified
  if (!userData.verified) {
    showAuthError('Please verify your email first. Check your inbox for the verification code.');
    // Show verification form
    const pending = JSON.parse(localStorage.getItem('0per8r_pending_verification') || 'null');
    if (!pending) {
      // Create pending verification if it doesn't exist
      const usersByEmail = JSON.parse(localStorage.getItem('0per8r_users_by_email') || '{}');
      const username = usersByEmail[userData.email.toLowerCase()] || usernameOrEmail;
      localStorage.setItem('0per8r_pending_verification', JSON.stringify({
        username: username,
        email: userData.email
      }));
    }
    document.getElementById('login-form').classList.remove('active');
    document.getElementById('signup-form').style.display = 'none';
    document.getElementById('verify-email-form').style.display = 'block';
    return;
  }
  
  const passwordHash = hashPassword(password);
  
  // Get username for session
  const usersByEmail = JSON.parse(localStorage.getItem('0per8r_users_by_email') || '{}');
  const username = usersByEmail[usernameOrEmail.toLowerCase()] || usernameOrEmail;
  console.log('Password hash comparison:', { stored: userData.passwordHash, computed: passwordHash });
  
  if (userData.passwordHash !== passwordHash) {
    showAuthError('Incorrect password');
    return;
  }
  
  // Login successful
  console.log('Login successful!');
  createSession(username);
  showPhase('dashboard');
  
  // Initialize app after login
  loadState();
  initializeEventListeners();
  updateUI();
  
  try {
    initAudioContext();
  } catch (e) {
    console.warn('Audio init failed (non-critical):', e);
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
  
  // Check if email already exists
  if (getUserByEmail(email)) {
    showAuthError('An account with this email already exists', true);
    return;
  }
  
  // Check if username already exists
  if (getUserByUsername(username)) {
    showAuthError('Username already taken', true);
    return;
  }
  
  // Generate verification code
  const verificationCode = generateVerificationCode();
  
  // Send verification email
  try {
    const emailResult = await sendVerificationEmail(email, verificationCode);
    
    // Create account (unverified)
    console.log('Creating account for:', username, email);
    const passwordHash = hashPassword(password);
    saveUserData(username, email, passwordHash, false, verificationCode);
    
    // Store pending verification
    localStorage.setItem('0per8r_pending_verification', JSON.stringify({
      username: username,
      email: email
    }));
    
    // Show verification form
    document.getElementById('signup-form').style.display = 'none';
    document.getElementById('verify-email-form').style.display = 'block';
    
    // Show success message
    const verifyError = document.getElementById('verify-error');
    if (verifyError) {
      if (emailResult && emailResult.success) {
        verifyError.textContent = `Verification code sent to ${email}. Check your email.`;
        verifyError.style.color = '#0f0';
      } else {
        // API key not set or email failed - show code in message
        verifyError.innerHTML = `
          <div style="color: #ff0; margin-bottom: 8px;">
            ⚠️ Email not configured. Your verification code is: <strong style="font-size: 16px;">${verificationCode}</strong>
          </div>
          <div style="color: #aaa; font-size: 11px;">
            To enable email sending, add your Resend API key. Check EMAIL_SETUP_SIMPLE.md for instructions.
          </div>
        `;
        verifyError.style.color = '#ff0';
      }
    }
    
  } catch (error) {
    console.error('Error sending verification email:', error);
    // Still show verification form with code
    const verifyError = document.getElementById('verify-error');
    if (verifyError) {
      verifyError.innerHTML = `
        <div style="color: #ff0; margin-bottom: 8px;">
          ⚠️ Email failed. Your verification code is: <strong style="font-size: 16px;">${verificationCode}</strong>
        </div>
      `;
      verifyError.style.color = '#ff0';
    }
    document.getElementById('signup-form').style.display = 'none';
    document.getElementById('verify-email-form').style.display = 'block';
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
        verifyError.textContent = `New verification code sent to ${email}`;
        verifyError.style.color = '#0f0';
      } else {
        verifyError.innerHTML = `
          <div style="color: #ff0; margin-bottom: 8px;">
            ⚠️ Email not configured. Your code is: <strong style="font-size: 16px;">${verificationCode}</strong>
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
        <div style="color: #ff0; margin-bottom: 8px;">
          ⚠️ Email failed. Your code is: <strong style="font-size: 16px;">${verificationCode}</strong>
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
window.installUpdate = function() {
  if (window.electronAPI && window.electronAPI.checkForUpdates) {
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
