# Mobdeck Mobile App

Mobdeck is a mobile application built with React Native that allows users to read and manage articles from their self-hosted Readeck instances. The app supports Android devices and provides offline-first functionality.

## Features

- **Android Compatibility**: Optimized for Android 13+ devices
- **Manual Authentication**: Secure Bearer token authentication with Readeck instances
- **OS Share Integration**: Add articles directly from other apps via Android share functionality
- **Background Sync**: Automatic synchronization of articles in the background
- **Single User/Instance**: Simplified setup for individual Readeck instance access
- **GitHub Releases**: Distributed via GitHub Releases + Obtainium

## Tech Stack

- **Framework**: React Native 0.80.0 (latest stable)
- **Node.js**: 22.17.0 (enforced version)
- **State Management**: Redux Toolkit
- **Local Database**: SQLite with react-native-sqlite-storage
- **API Client**: Axios
- **Testing**: Jest and React Native Testing Library
- **Code Quality**: ESLint and Prettier

## Getting Started

### Prerequisites

- Node.js 22.17.0 (enforced - use nvm for version management)
- npm or yarn
- React Native CLI
- Android Studio (for Android development)
- Android 13+ compatible device or emulator

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/t34wrj/mobdeck.git
   ```

2. Navigate to the project directory:
   ```
   cd mobdeck
   ```

3. Install dependencies:
   ```
   npm install
   ```

### Running the App

- For Android:
  ```
  npx react-native run-android
  ```

### Testing

Run the tests using:
```
npm test
```

## Installation

### For End Users

#### Option 1: Obtainium (Recommended)
Obtainium provides automatic updates directly from GitHub releases:

1. Install [Obtainium](https://github.com/ImranR98/Obtainium) from F-Droid or GitHub
2. Add Mobdeck using repository URL: `https://github.com/t34wrj/mobdeck`
3. Install and receive automatic update notifications

For detailed setup instructions, see [Obtainium Setup Guide](internal_docs/OBTAINIUM_SETUP.md).

#### Option 2: Direct APK Download
1. Visit [GitHub Releases](https://github.com/t34wrj/mobdeck/releases)
2. Download the latest `app-release.apk`
3. Enable "Install from unknown sources" in Android settings
4. Install the APK file

**System Requirements:**
- Android 7.0+ (API level 24+)
- ~50MB storage space
- Self-hosted Readeck instance for authentication

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any enhancements or bug fixes.

## License

This project is licensed under the MIT License. See the LICENSE file for details.