# Tinder Auto Swiper Chrome Extension

A Chrome Extension (Manifest V3) that automates swiping on Tinder by integrating with an external API service for intelligent decision-making.

## Features

- **Multi-Step Decision Process**: Two-stage analysis with text-based decisions first, then batch image analysis
- **Smart Profile Analysis**: Extracts comprehensive profile data including photos, bio, age, interests, and more
- **Dual API Integration**: Separate endpoints for text-based and image-based decision making
- **Real-time Statistics**: Tracks likes, passes, errors, and success rates
- **Efficient Photo Processing**: Processes all images at once after positive text feedback
- **Comprehensive Profile Info**: Extracts all profile sections including "Looking for", "Essentials", "Basics", "Lifestyle", "Interests", and Spotify data

## Installation

1. Clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the project directory
5. The extension icon will appear in your Chrome toolbar

## Usage

1. **Open Tinder**: Navigate to [tinder.com](https://tinder.com) and log in
2. **Configure APIs**: Click the extension icon and enter your API endpoint URLs:
   - **Text API Endpoint**: For text-based profile analysis
   - **Image API Endpoint**: For individual image analysis
3. **Set Max Swipes**: Configure the maximum number of swipes per session
4. **Start Swiping**: Click "Start Swiping" to begin automation
5. **Monitor Progress**: View real-time statistics in the popup

## How It Works

The extension follows a two-stage decision process:

1. **Text Analysis**: Profile data (name, age, bio, interests) is sent to the text API endpoint
2. **Image Analysis**: If text analysis is positive, all photos are sent at once to the image API endpoint
3. **Final Decision**: The extension executes the swipe based on the combined analysis results

## API Endpoint Specification

The extension uses two separate API endpoints for the two-stage decision process:

### Text API Endpoint

**Purpose**: Analyzes profile text data (name, age, bio, interests) to make initial filtering decisions.

**Endpoint**: Your configured text API URL (e.g., `https://your-api.com/text-decide`)  
**Method**: `POST`  
**Content-Type**: `application/json`  
**User-Agent**: `TinderSwiper/1.0`

#### Text API Request Payload

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
    "verified": true,
    "photoCount": 4,
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

#### Text API Response Format

```json
{
  "action": "like",
  "reason": "Shared interests in hiking and photography, good bio",
  "confidence": 0.85,
  "nextDelay": 3000
}
```

**Text API Actions**:
- **`"like"` or `"right"`**: Continue to image analysis
- **`"pass"`, `"left"`, or `"skip"`**: Skip profile immediately (no image analysis)
- **`"stop"`**: Stop the automation immediately

### Image API Endpoint

**Purpose**: Analyzes all photos at once after positive text feedback. Called once per profile.

**Endpoint**: Your configured image API URL (e.g., `https://your-api.com/image-decide`)  
**Method**: `POST`  
**Content-Type**: `application/json`  
**User-Agent**: `TinderSwiper/1.0`

#### Image API Request Payload

```json
{
  "userId": "user_abc123def",
  "imageUrls": [
    "https://images-ssl.gotinder.com/u/abc123/photo1.jpg",
    "https://images-ssl.gotinder.com/u/abc123/photo2.jpg",
    "https://images-ssl.gotinder.com/u/abc123/photo3.jpg",
    "https://images-ssl.gotinder.com/u/abc123/photo4.jpg"
  ],
  "totalImages": 4,
  "profileName": "Emma",
  "skipThreshold": 6,
  "swipeCount": 42,
  "stats": {
    "total": 42,
    "likes": 15,
    "passes": 27,
    "errors": 0
  }
}
```

#### Image API Response Format

```json
{
  "action": "like",
  "reason": "Nice smile, good photo quality",
  "confidence": 0.75,
  "nextDelay": 2000
}
```

**Image API Actions**:
- **`"like"` or `"right"`**: Swipe right on the profile
- **`"pass"`, `"left"`, or `"skip"`**: Skip profile immediately

### Common Response Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `action` | string | ✅ | Decision action: `"like"`, `"pass"`, `"skip"`, or `"stop"` |
| `reason` | string | ✅ | Human-readable explanation for the decision |
| `confidence` | number | ❌ | Confidence score (0.0 - 1.0) |
| `nextDelay` | number | ❌ | Milliseconds to wait before next profile (default: 4000) |

### Error Handling

- If your API returns non-200 status codes, the swiper will stop
- If your API is unreachable, the swiper will stop with an error
- Unknown actions will stop the swiper and increment the error count
- If image extraction fails, the extension will skip to the next image

## Decision Flow Details

### Stage 1: Text Analysis
1. Profile opens and text data is extracted (name, age, bio, interests, etc.)
2. Only the first photo is extracted (no sliding through carousel)
3. Text data is sent to the **text API endpoint**
4. Based on the text decision:
   - **"like"/"right"**: Continue to image analysis
   - **"pass"/"left"/"skip"**: Skip profile immediately
   - **"stop"**: Stop automation

### Stage 2: Image Analysis (Only if text decision was positive)
1. Extension extracts all image URLs from the profile carousel
2. All images are sent together to the **image API endpoint**
3. Process the response:
   - **"like"/"right"**: Swipe right on the profile
   - **"pass"/"left"/"skip"**: Skip entire profile immediately

## Profile Data Structure

The extension extracts comprehensive profile information:

### Basic Info (Sent to Text API)
- **name**: Profile name (cleaned of extra text)
- **age**: Age as integer
- **bio**: Bio text (cleaned, "About me" prefix removed)
- **verified**: Boolean verification status
- **photoCount**: Total number of photos available

### Profile Sections (Sent to Text API)
- **lookingFor**: Relationship type preference
- **essentials**: Height, exercise, drinking habits
- **basics**: Zodiac, education, job, company
- **lifestyle**: Pets, smoking, workout habits
- **interests**: Array of interest tags
- **anthem**: Spotify track information
- **topArtists**: Favorite artists from Spotify

### Image Data (Sent to Image API)
- **imageUrls**: Array of full-resolution image URLs from Tinder CDN
- **totalImages**: Total number of images in the profile
- **profileName**: Name of the profile being analyzed
- **skipThreshold**: Maximum number of skip decisions before skipping profile

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