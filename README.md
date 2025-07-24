# Legal Billables AI Platform

AI-powered billables assistant that automatically tracks email time and generates professional summaries for law firms using PracticePanther, Clio, and MyCase.

## 🎯 Features

### MVP (Phase 1) - Chrome Extension
- **Gmail Time Tracking**: Automatically tracks typing time for each email
- **Smart Warning System**: 30s and 45s inactivity warnings before auto-pause
- **Auto-Pause & Resume**: Automatically pauses after 60s, click to resume
- **Auto-Clear**: Automatically clears entry after successful email send
- **AI-Powered Summaries**: Uses GPT-4 to generate professional billable entries
- **Client/Case Mapping**: Intelligently associates emails with clients
- **One-Click Logging**: Pushes entries directly to practice management systems
- **Real-time Feedback**: In-Gmail confirmation and time display

### Supported Platforms
- **PracticePanther**: Full OAuth integration
- **Clio**: Complete API support
- **MyCase**: Seamless time entry logging

## 🚀 Quick Start

### Backend Setup

1. **Install Dependencies**
```bash
cd backend
npm install
```

2. **Environment Configuration**
```bash
cp .env.example .env
```

3. **Configure API Keys**
Edit `.env` file with your credentials:
```env
OPENAI_API_KEY=your_openai_api_key
PRACTICEPANTHER_CLIENT_ID=your_client_id
PRACTICEPANTHER_CLIENT_SECRET=your_client_secret
# ... other platform credentials
```

4. **Start the Server**
```bash
npm run dev
```

### Chrome Extension Setup

1. **Load Extension in Chrome**
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `chrome-extension` folder

2. **Authenticate Practice Management System**
   - Click the extension icon
   - Select your platform (PracticePanther, Clio, or MyCase)
   - Complete OAuth authentication

3. **Start Using in Gmail**
   - Open Gmail
   - Compose an email
   - See real-time billable tracking
   - Send email to auto-log the entry

## 📋 API Endpoints

### Core Billable Processing
```
POST /api/process-billable
```
Processes email data and creates billable entries.

### Authentication
```
POST /api/auth/practice-manager
GET /api/auth/url?platform={platform}
```

### Client Management
```
GET /api/clients
```

### Health Check
```
GET /api/health
```

## 🏗️ Architecture

```
Legal Billables AI Platform/
├── chrome-extension/          # Chrome Extension
│   ├── manifest.json         # Extension configuration
│   ├── content/              # Gmail integration
│   │   ├── gmail-tracker.js  # Time tracking & email detection
│   │   └── styles.css        # UI styling
│   ├── popup/                # Extension popup
│   │   ├── popup.html        # Configuration interface
│   │   ├── popup.css         # Popup styling
│   │   └── popup.js          # Authentication & stats
│   └── background/           # Service worker
│       └── service-worker.js # Message handling & stats
└── backend/                  # Node.js API
    ├── server.js            # Express server
    ├── services/            # Business logic
    │   ├── ai-service.js    # OpenAI integration
    │   └── practice-manager-service.js  # Platform APIs
    └── package.json         # Dependencies
```

## 🎨 User Experience

### Enhanced Gmail Workflow
1. **Start Composing**: Extension automatically detects and starts tracking
2. **Real-time Display**: See billable time counting in floating tracker
3. **Inactivity Warnings**: 
   - 30s warning: Yellow pulse notification
   - 45s warning: "Pausing soon" urgent notification
   - 60s: Automatic pause with option to resume
4. **Send & Clear**: After successful email send, entry auto-clears in 3 seconds
5. **Professional Output**: AI generates clean, legal-appropriate summaries

### Gmail Integration
1. **Seamless Tracking**: Automatically detects email composition
2. **Visual Feedback**: Real-time billable time display
3. **Smart Warning System**: 30s and 45s inactivity warnings
4. **Auto-Pause**: Automatically pauses after 60s of inactivity
5. **Auto-Clear**: Clears entry after successful email send
6. **Professional Summaries**: AI generates appropriate legal descriptions

### Practice Management Integration
1. **OAuth Security**: Secure authentication with all platforms
2. **Client Matching**: Intelligent email-to-client association
3. **Automatic Logging**: One-click entry creation
4. **Error Handling**: Robust retry mechanisms

## 🔧 Development

### Prerequisites
- Node.js 18+
- Chrome Browser
- OpenAI API Key
- Practice Management Platform API Credentials

### Development Workflow
1. **Backend Development**
   ```bash
   cd backend
   npm run dev
   ```

2. **Extension Development**
   - Make changes to extension files
   - Reload extension in Chrome
   - Test in Gmail

### Code Structure

#### Gmail Content Script
- Detects compose windows
- Tracks typing activity
- Handles send events
- Manages UI components

#### AI Service
- OpenAI GPT-4 integration
- Professional summary generation
- Fallback summary logic

#### Practice Manager Service
- Multi-platform OAuth
- API normalization
- Client/case mapping
- Time entry creation

## 📊 Analytics & Tracking

### Daily Statistics
- Emails logged count
- Total billable time
- Platform usage
- Error rates

### Chrome Extension Badge
- Shows daily email count
- Visual success indicator
- Quick access to stats

## 🔒 Security & Privacy

### Data Protection
- OAuth 2.0 authentication
- Encrypted API communications
- Local storage for temporary data
- No email content stored permanently

### Permissions
- Gmail access for composition detection
- Storage for authentication tokens
- Network access for API communication

## 🚀 Future Roadmap

### Phase 2: Web Dashboard
- Central billable management
- Weekly/monthly reports
- Team collaboration features

### Phase 3: Mobile App
- Phone call detection
- Voice memo processing
- Push notifications

### Phase 4: Desktop Agent
- Document work tracking
- Meeting transcription
- Calendar integration

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Implement clean, tested code
4. Submit pull request

## 📄 License

MIT License - see LICENSE file for details

## 📞 Support

For setup assistance or feature requests, please create an issue in the repository.

---

**Legal Billables AI Platform** - Revolutionizing legal time tracking with AI-powered automation. 

## 📊 Data Flow

### Gmail Compose Flow
```mermaid
   flowchart TD
      A["আইনজীবী Gmail খুলে ইমেইল লিখতে শুরু করে"] --> B["Chrome Extension Detect করে"]
      B --> C["Time Tracking শুরু"]
      C --> D["Typing Activity Monitor"]
      D --> E{Active Typing?}
      E -->|Yes| F["Timer Continue"]
      E -->|No 30s| G["⚠️ 30s Warning"]
      E -->|No 45s| H["⚠️ 45s Warning - Pausing Soon"]
      E -->|No 60s| I["Auto Pause"]
      F --> D
      G --> J{Resume Activity?}
      H --> J
      J -->|Yes| F
      J -->|No| I
      I --> K["Click to Resume"]
      K --> C
      F --> L["Send Button Clicked"]
      L --> M["Extract Email Data<br/>(To, Subject, Content)"]
      M --> N["Send to Backend API"]
      N --> O["GPT-4 Generate<br/>Professional Summary"]
      O --> P["Identify Client/Case<br/>from Recipient"]
      P --> Q["Create Billable Entry"]
      Q --> R{Platform Connected?}
      R -->|Yes| S["Push to PracticePanther/<br/>Clio/MyCase + Local Save"]
      R -->|No| T["Save Locally<br/>(Connect Platform for Sync)"]
      S --> U["Success Notification<br/>in Gmail"]
      T --> U
      U --> V["Auto-Clear Entry<br/>After 3 Seconds"]
      V --> W["Update Daily Stats<br/>Badge Counter"]
      
      style A fill:#e1f5fe
      style C fill:#c8e6c9
      style G fill:#fff3e0
      style H fill:#ffcc02
      style O fill:#fff3e0
      style S fill:#f3e5f5
      style U fill:#e8f5e8
      style V fill:#c8e6c9
```# Google_Chrome_Legal_Billables_AI_Assistant
