# Tinder Auto Swiper Chrome Extension

A Chrome Extension (Manifest V3) that automates swiping on Tinder by integrating with an external API service for intelligent decision-making.

## Features

- **Smart Profile Analysis**: Extracts comprehensive profile data including photos, bio, age, interests, and more
- **API-Driven Decisions**: Sends profile data to your configured API endpoint for intelligent swipe decisions
- **Real-time Statistics**: Tracks likes, passes, errors, and success rates
- **Robust Photo Extraction**: Navigates through photo carousels to capture all profile images
- **Comprehensive Profile Info**: Extracts all profile sections including "Looking for", "Essentials", "Basics", "Lifestyle", "Interests", and Spotify data

## Installation

1. Clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the project directory
5. The extension icon will appear in your Chrome toolbar

## Usage

1. **Open Tinder**: Navigate to [tinder.com](https://tinder.com) and log in
2. **Configure API**: Click the extension icon and enter your API endpoint URL
3. **Set Max Swipes**: Configure the maximum number of swipes per session
4. **Start Swiping**: Click "Start Swiping" to begin automation
5. **Monitor Progress**: View real-time statistics in the popup

## API Endpoint Specification

Your API endpoint must handle POST requests with the following structure:

### Request Format

**Endpoint**: Your configured API URL (e.g., `https://your-api.com/decide`)  
**Method**: `POST`  
**Content-Type**: `application/json`  
**User-Agent**: `TinderSwiper/1.0`

### Request Payload

```json
{
  "userId": "user_abc123def",
  "swipeCount": 42,
  "stats": {
    "total": 42,
    "likes": 15,
    "passes": 27,
    "errors": 0
  },
  "profile": {
    "name": "Emma",
    "age": 25,
    "bio": "Love hiking and good coffee. Looking for someone to explore the city with!",
    "photos": [
      "https://images-ssl.gotinder.com/u/abc123/photo1.jpg",
      "https://images-ssl.gotinder.com/u/abc123/photo2.jpg",
      "https://images-ssl.gotinder.com/u/abc123/photo3.jpg"
    ],
    "verified": true,
    "timestamp": 1703123456789,
    "url": "https://tinder.com/app/recs",
    "profileInfo": {
      "lookingFor": "Long-term partner",
      "essentials": [
        {"category": "Height", "value": "5'6\""},
        {"category": "Exercise", "value": "Often"},
        {"category": "Drinking", "value": "Socially"}
      ],
      "basics": [
        {"category": "Zodiac", "value": "Gemini"},
        {"category": "Education", "value": "University"},
        {"category": "Job Title", "value": "Software Engineer"},
        {"category": "Company", "value": "Tech Corp"}
      ],
      "lifestyle": [
        {"category": "Pets", "value": "Dog"},
        {"category": "Smoking", "value": "Never"},
        {"category": "Workout", "value": "Regularly"}
      ],
      "interests": [
        "Photography",
        "Travel",
        "Cooking",
        "Hiking",
        "Coffee"
      ],
      "anthem": ["Song Title - Artist Name"],
      "topArtists": ["Artist 1", "Artist 2", "Artist 3"]
    }
  }
}
```

### Response Format

Your API must return a JSON response with the following structure:

```json
{
  "action": "like",
  "reason": "Shared interests in hiking and photography",
  "confidence": 0.85,
  "nextDelay": 3000
}
```

### Response Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `action` | string | ✅ | Decision action: `"like"`, `"pass"`, or `"stop"` |
| `reason` | string | ✅ | Human-readable explanation for the decision |
| `confidence` | number | ❌ | Confidence score (0.0 - 1.0) |
| `nextDelay` | number | ❌ | Milliseconds to wait before next profile (default: 4000) |

### Valid Actions

- **`"like"` or `"right"`**: Swipe right (like the profile)
- **`"pass"` or `"left"`**: Swipe left (pass on the profile)  
- **`"stop"`**: Stop the automation immediately
- **Unknown actions**: Will stop the swiper and log an error

### Error Handling

- If your API returns non-200 status codes, the swiper will stop
- If your API is unreachable, the swiper will stop with an error
- Unknown actions will stop the swiper and increment the error count

## Profile Data Structure

The extension extracts comprehensive profile information:

### Basic Info
- **name**: Profile name (cleaned of extra text)
- **age**: Age as integer
- **bio**: Bio text (cleaned, "About me" prefix removed)
- **verified**: Boolean verification status
- **photos**: Array of full-resolution image URLs

### Profile Sections
- **lookingFor**: Relationship type preference
- **essentials**: Height, exercise, drinking habits
- **basics**: Zodiac, education, job, company
- **lifestyle**: Pets, smoking, workout habits
- **interests**: Array of interest tags
- **anthem**: Spotify track information
- **topArtists**: Favorite artists from Spotify

## Development

This is a vanilla JavaScript Chrome extension with no build process required.

### File Structure
- `manifest.json` - Chrome extension configuration
- `content.js` - Main automation logic injected into Tinder
- `popup.html/popup.js` - Extension popup interface
- `examples/` - Sample HTML for testing extraction logic

### Testing
1. Load the extension in Chrome
2. Open Chrome DevTools on tinder.com to view console logs
3. Right-click extension icon → "Inspect popup" to debug popup

### Key Classes
- `SimpleTinderSwiper` - Main automation controller
- `PopupController` - Extension popup interface manager

## Security & Privacy

- No data is stored locally except user settings
- All profile data is sent to your configured API endpoint
- No telemetry or tracking beyond your own API
- Extension only runs on tinder.com

## License

MIT License - See LICENSE file for details