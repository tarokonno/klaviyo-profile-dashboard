# Klaviyo Profile Dashboard

A modern Next.js dashboard for viewing and managing Klaviyo profiles with secure API key management and comprehensive activity tracking.

## 🚀 Features

- **Profile Management**: View, search, and paginate through Klaviyo profiles
- **Activity Log**: Detailed event tracking for each profile
- **Secure API Key Management**: Server-side storage of API keys
- **Metric Mapping**: Customizable mapping for summary statistics
- **Real-time Data**: Live data from Klaviyo API
- **Responsive Design**: Modern UI with Tailwind CSS

## 🛠️ Tech Stack

- **Frontend**: Next.js 14, React 18, Tailwind CSS
- **Backend**: Next.js API Routes
- **HTTP Client**: Axios
- **Storage**: File-based server storage
- **Styling**: Tailwind CSS

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd profile-dashboard
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env.local` file in the root directory:
   ```env
   KLAVIYO_API_KEY=your_klaviyo_private_api_key
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🔧 Configuration

### API Keys Setup

1. **Get your Klaviyo API keys**:
   - Go to your Klaviyo account settings
   - Navigate to API Keys section
   - Copy your Private API Key and Public API Key

2. **Configure in the app**:
   - Click the "Settings" button in the top right
   - Enter your Private and Public API keys
   - Click "Save Account Settings"

### Metric Mapping

Configure which metrics to display in the summary cards:

1. **Go to Settings** → **Metric Mapping**
2. **Select metrics** for:
   - Emails Received
   - Emails Opened
   - Emails Clicked
   - Orders Placed
3. **Save the mapping**

## 🔒 Security Features

### Server-side Storage
- API keys are stored securely on the server
- No sensitive data in browser localStorage
- File-based storage in `data/` directory

### Environment Variables
- Fallback to environment variables if no saved settings
- Secure configuration management

### Data Protection
- Private API keys are never exposed to the client
- Secure API key validation before saving

## 📁 Project Structure

```
profile-dashboard/
├── components/          # React components
│   ├── Header.js       # Navigation header
│   ├── Settings.js     # Settings page
│   └── ActivityLog.js  # Activity log component
├── pages/              # Next.js pages and API routes
│   ├── index.js        # Main dashboard page
│   ├── _app.js         # App wrapper
│   └── api/            # API routes
│       ├── account.js              # Account validation
│       ├── account-settings.js     # Account settings CRUD
│       ├── profiles.js             # Profile data
│       ├── events.js               # Event data
│       ├── events/metrics.js       # Metrics data
│       └── settings/metric-mapping.js # Metric mapping CRUD
├── lib/                # Utility functions
│   └── utils.js        # API key management
├── data/               # Server-side data storage
│   ├── account-settings.json
│   └── metric-mapping.json
├── styles/             # Global styles
└── public/             # Static assets
```

## 🚀 Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

### Development Workflow

1. **Start the development server**:
   ```bash
   npm run dev
   ```

2. **Configure your API keys** in the Settings page

3. **Test the functionality**:
   - Browse profiles
   - View activity logs
   - Test search and pagination

## 🔧 API Endpoints

### Authentication & Settings
- `GET /api/account` - Validate API keys
- `GET /api/account-settings` - Get account settings
- `POST /api/account-settings` - Save account settings

### Data
- `GET /api/profiles` - Get profile list with pagination
- `GET /api/events` - Get events for profiles
- `GET /api/events/metrics` - Get available metrics

### Configuration
- `GET /api/settings/metric-mapping` - Get metric mapping
- `POST /api/settings/metric-mapping` - Save metric mapping

## 🔒 Security Notes

- **API Keys**: Stored securely on server, never in browser
- **Data Files**: Protected by `.gitignore`
- **Environment Variables**: Used as fallback only
- **Validation**: All API keys validated before saving

## 📝 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `KLAVIYO_API_KEY` | Fallback Klaviyo private API key | No (can be set in UI) |

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License. 