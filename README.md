# Focus OS v1 - Desktop Application

A desktop execution lock system that enforces focus by monitoring which applications you're using.

## Installation

1. Install dependencies:
```bash
npm install
```

2. Run the application:
```bash
npm start
```

## Building

To build a distributable app:
```bash
npm run build
```

## Features

- **Application Monitoring**: Tracks which application you're actively using
- **Break Detection**: Detects when you switch away from your designated work app
- **Focus Score**: Real-time focus score based on break attempts and active time
- **Restrictive Mode**: Window becomes non-closable and always-on-top during execution
- **Session Persistence**: Sessions survive app restarts

## How It Works

1. Select your work application (e.g., "Visual Studio Code", "Safari", etc.)
2. Enter your task with specific details
3. Set duration
4. Type "EXECUTE" to begin
5. The app monitors your active application and logs break attempts when you switch away
6. Focus score decreases with each break attempt
7. Window restrictions activate during execution

## Requirements

- Node.js 16+
- macOS (Windows/Linux support coming soon)

## Notes

- The app uses native macOS APIs to detect active applications
- During execution, the window cannot be closed or minimized
- Break attempts are logged and affect your focus score






