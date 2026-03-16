# GeoTap

A daily geography guessing game inspired by MapTap.gg. Built with React Native (Expo) for web and mobile, with Azure Functions backend.

## Features

- **Daily Puzzles**: 5 rounds per day with curated world locations
- **Two Categories**: Places (landmarks) and Trivia Questions
- **Cross-Platform**: Works on iOS, Android, and Web
- **Scoring System**: Distance-based scoring with difficulty multipliers
- **Social Sharing**: Share your results like Wordle
- **Leaderboards**: Compete with other players
- **Streak Tracking**: Keep your daily streak going

## Tech Stack

- **Frontend**: React Native with Expo
- **Navigation**: Expo Router
- **State Management**: Zustand
- **Maps**: react-native-maps (mobile) / Google Maps (web)
- **Backend**: Azure Functions
- **Database**: Azure Table Storage

## Live Demo

- **Frontend**: https://thankful-moss-0a124ba0f.2.azurestaticapps.net
- **API**: https://geotap-api.azurewebsites.net/api

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Google Maps API Key (for maps)
- Azure account (for backend)

### Frontend Setup

1. **Clone and install dependencies:**
   ```bash
   git clone <repo-url>
   cd geotap
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and add your Google Maps API key:
   ```
   EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_key_here
   EXPO_PUBLIC_API_URL=https://geotap-api.azurewebsites.net/api
   ```

3. **Run the app:**
   ```bash
   # Web
   npm run web

   # iOS (requires macOS)
   npm run ios

   # Android
   npm run android
   ```

### Backend Setup (Azure Functions)

1. **Navigate to API folder:**
   ```bash
   cd api
   npm install
   ```

2. **Install Azure Functions Core Tools:**
   ```bash
   npm install -g azure-functions-core-tools@4
   ```

3. **Configure local settings:**
   Update `api/local.settings.json` with your Azure Storage connection string:
   ```json
   {
     "Values": {
       "AZURE_STORAGE_CONNECTION_STRING": "your_storage_connection_string"
     }
   }
   ```

4. **Run the API:**
   ```bash
   npm start
   ```

## Project Structure

```
geotap/
├── app/                    # Expo Router screens
│   ├── (tabs)/            # Tab navigation
│   │   ├── index.tsx      # Home/Play screen
│   │   ├── leaderboard.tsx
│   │   └── profile.tsx
│   └── game/              # Game screens
│       ├── [puzzleId].tsx # Game play screen
│       └── results.tsx    # Results screen
├── components/
│   ├── game/              # Game components
│   └── map/               # Map components
├── hooks/                 # Custom hooks
├── services/              # API and storage services
├── data/                  # Curated location data
├── types/                 # TypeScript types
└── api/                   # Azure Functions backend
    └── src/
        ├── storage.ts     # Table Storage client
        └── functions/     # API endpoints
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/puzzle/{date}` | Get daily puzzle |
| POST | `/api/scores` | Submit score |
| GET | `/api/leaderboard/{date}` | Get leaderboard |

## Deployment

### Frontend (Azure Static Web Apps)

```bash
npx expo export --platform web
npx @azure/static-web-apps-cli deploy ./dist --deployment-token <token>
```

### Backend (Azure Functions)

```bash
cd api
npm run build
func azure functionapp publish geotap-api
```

## License

MIT
