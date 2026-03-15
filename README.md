# GeoTap

A daily geography guessing game inspired by MapTap.gg. Built with React Native (Expo) for web and mobile, with Azure Functions backend.

## Features

- **Daily Puzzles**: 5 rounds per day with curated world locations
- **Cross-Platform**: Works on iOS, Android, and Web
- **Scoring System**: Distance-based scoring with difficulty multipliers
- **Social Sharing**: Share your results like Wordle
- **Leaderboards**: Compete with other players
- **Streak Tracking**: Keep your daily streak going

## Tech Stack

- **Frontend**: React Native with Expo
- **Navigation**: Expo Router
- **State Management**: Zustand
- **Maps**: react-native-maps (mobile) / @react-google-maps/api (web)
- **Backend**: Azure Functions
- **Database**: Azure Cosmos DB

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
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
   ```

3. **Update app.json:**
   Replace the Google Maps API keys in `app.json` for iOS and Android.

4. **Run the app:**
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

3. **Set up Cosmos DB:**
   - Option A: Use the [Azure Cosmos DB Emulator](https://learn.microsoft.com/en-us/azure/cosmos-db/local-emulator) for local development
   - Option B: Create an Azure Cosmos DB account in the Azure Portal

4. **Configure local settings:**
   Update `api/local.settings.json` with your Cosmos DB connection string:
   ```json
   {
     "Values": {
       "COSMOS_CONNECTION_STRING": "your_connection_string",
       "COSMOS_DATABASE_NAME": "geotap"
     }
   }
   ```

5. **Run the API:**
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
        └── functions/     # API endpoints
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/puzzle/{date}` | Get daily puzzle |
| POST | `/api/scores` | Submit score |
| GET | `/api/leaderboard/{date}` | Get leaderboard |

## Deployment

### Frontend (Expo)

```bash
# Build for web
npx expo export --platform web

# Build for mobile
eas build --platform all
```

### Backend (Azure Functions)

```bash
cd api
func azure functionapp publish <your-function-app-name>
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Submit a pull request

## License

MIT
