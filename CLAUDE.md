# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Chrome Extension (Manifest V3) that automates swiping on Tinder by integrating with an external API service for decision-making.

## Development Commands

This is a vanilla JavaScript Chrome extension with no build process or package management. To develop:

1. **Load the extension in Chrome:**
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the project directory

2. **Reload the extension after changes:**
   - Click the refresh icon on the extension card in `chrome://extensions/`

3. **Debug the extension:**
   - Content script: Open Chrome DevTools on tinder.com
   - Popup: Right-click the extension icon and select "Inspect popup"

## Architecture

### Core Components

1. **content.js** - Main content script injected into tinder.com
   - `SimpleTinderSwiper` class: Core automation logic
   - Profile data extraction from DOM
   - API communication for swipe decisions
   - Swipe action execution (keyboard/click simulation)
   - Statistics tracking and session management

2. **popup.html/popup.js** - Extension popup interface
   - Configuration UI (API endpoint, max swipes)
   - Real-time statistics display
   - Start/stop controls
   - Settings persistence via Chrome storage API

3. **manifest.json** - Chrome extension configuration
   - Permissions: activeTab, storage
   - Host permissions for API communication
   - Content script injection rules

### Key Implementation Details

- **Profile Data Extraction**: The extension scrapes Tinder's DOM to extract profile information including photos, bio, age, and other details
- **API Integration**: Sends profile data to a configurable external API endpoint that returns swipe decisions
- **Swipe Execution**: Implements multiple fallback methods for executing swipes (keyboard events, click events)
- **Session Management**: Tracks statistics per session with unique session IDs
- **Error Handling**: Includes retry logic and graceful error handling for API failures

### Data Flow

1. Content script extracts profile data from Tinder DOM
2. Profile data sent to external API endpoint
3. API returns decision (like/pass)
4. Extension executes swipe action
5. Statistics updated and displayed in popup

## Important Notes

- No build process required - pure JavaScript
- No test framework currently implemented
- External API endpoint must be configured before use
- Extension requires active Tinder.com tab to function