# 0per8r - Focus Operating System

## Overview
0per8r is a comprehensive deep focus application designed to eliminate distractions and enforce productive work sessions. It's a desktop application (currently macOS) that combines task management, system-wide blocking, and ambient soundscapes to create an immersive focus environment.

## Core Concept
0per8r transforms your computer into a "Focus Operating System" - a controlled environment where distractions are systematically eliminated. It's not just a timer or blocker; it's a complete system that monitors your activity, blocks unauthorized apps and websites at the system level, and tracks your execution streak.

## Key Features

### 1. Task Hierarchy System
- **Long-Term Mission**: Define your overarching purpose with a clear reason and time-bound goal
- **Current Goal**: Set your immediate objective that aligns with your mission
- **Needle-Mover Task**: One high-value, specific task per day that moves the needle on your goals

### 2. System-Wide Blocking
- **Application Blocking**: Blocks all applications except those you explicitly allow
- **Website Blocking**: System-wide internet blocking that intercepts ALL network requests
- **Proxy-Based Blocking**: Uses PAC files and system proxy settings to block at the network level
- **Hosts File Modification**: Blocks websites at the DNS level
- **Automatic Tab Group Blocking**: Even cached tabs and restored tab groups are blocked immediately
- **Works Across All Browsers**: Safari, Chrome, Firefox, Edge, etc.

### 3. Focus Session Management
- **Timed Focus Sessions**: Set duration for your focus blocks
- **Execution Streak Tracking**: Build momentum with consecutive successful sessions
- **Session Persistence**: Sessions survive app restarts
- **Emergency Exit**: Keyboard shortcut (Cmd+Shift+E) for emergency situations

### 4. Environment Customization

#### Restrictions
- **Allowed Apps**: Whitelist specific applications you need for work
- **Allowed Websites**: Whitelist specific websites/domains you need access to
- **System-Level Enforcement**: Blocking happens at the OS level, not just browser level

#### Soundscapes
- **7 Ambient Sound Options**: Rain, Ocean, Fire, Wind, Forest, Cafe, Cityscape
- **Individual Volume Controls**: Mix multiple sounds with percentage sliders
- **Master Toggle**: Enable/disable all soundscapes with one switch
- **HTML5 Audio**: Reliable audio playback without crashes

### 5. User Authentication
- **Login/Signup System**: Account-based access (prepared for paid subscriptions)
- **Local Storage**: User data stored locally in browser
- **Session Management**: Persistent login sessions
- **Free Beta Access**: Currently free, designed for future paid model

### 6. Smart Monitoring
- **Active Application Detection**: Monitors which app you're using in real-time
- **Break Detection**: Logs when you switch to unauthorized apps
- **Automatic Restoration**: If app quits during focus mode, blocking is immediately restored
- **Crash Recovery**: Automatically restores blocking on next app start if needed

## Technical Architecture

### Frontend
- **Electron Framework**: Cross-platform desktop app foundation
- **HTML5/CSS3/JavaScript**: Modern web technologies
- **Local Storage**: Persistent state management
- **HTML5 Audio API**: Soundscape playback

### Backend/System Integration
- **macOS System APIs**: Active window detection, system preferences modification
- **Sudo-Prompt**: Admin privileges for system-level blocking
- **Proxy Server**: Custom HTTP proxy for network request interception
- **PAC Files**: Proxy Auto-Configuration for browser-level blocking
- **Hosts File**: DNS-level website blocking
- **Network Setup**: System network configuration modification

## User Experience Flow

1. **Login/Signup**: User authenticates to access the app
2. **Dashboard Setup**:
   - Define long-term mission
   - Set current goal
   - Enter needle-mover task
   - Configure allowed apps and websites
   - Adjust soundscape preferences
3. **Start Focus Session**: Click "Begin Execution" button
4. **System Lockdown**: 
   - App enters fullscreen mode
   - System-wide blocking activates (requires admin password)
   - Only allowed apps/websites are accessible
   - Soundscapes begin playing
5. **Active Monitoring**: App monitors your activity throughout the session
6. **Session Completion**: Timer ends, blocking is automatically removed
7. **Streak Tracking**: Successful sessions increment your execution streak

## Design Philosophy

### Zero Tolerance for Distractions
- Everything is blocked by default
- You must explicitly whitelist what you need
- System-level enforcement means you can't bypass it easily

### Focus on Execution
- Task hierarchy ensures alignment from mission to daily action
- Single needle-mover prevents task switching
- Streak system builds momentum and accountability

### Immersive Environment
- Fullscreen mode removes visual distractions
- Ambient soundscapes create focus atmosphere
- Dark, minimal UI reduces cognitive load

## Target Audience
- **Knowledge Workers**: Writers, developers, designers, researchers
- **Students**: Need deep focus for studying and assignments
- **Entrepreneurs**: Building products or businesses
- **Anyone Struggling with Distraction**: People who need external enforcement to maintain focus

## Value Proposition
"Transform your computer into a Focus Operating System. Eliminate distractions at the system level. Build execution streaks. Get deep work done."

## Future Vision
- Paid subscription model (currently free beta)
- Cloud sync for account data
- Multi-platform support (Windows, Linux)
- Advanced analytics and focus insights
- Team/workspace features
- Mobile companion app

## Technical Highlights
- System-level blocking (not just browser extensions)
- Works with all browsers and applications
- Automatic crash recovery
- Immediate restoration on app quit
- No performance impact during focus mode
- Secure local storage for user data

