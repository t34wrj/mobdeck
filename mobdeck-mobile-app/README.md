# Mobdeck Mobile App

Mobdeck is a mobile application built with React Native that allows users to read and manage articles efficiently. The app supports both Android and iOS platforms, providing a seamless experience across devices.

## Features

- **Cross-Platform Compatibility**: Single codebase for both Android and iOS.
- **Offline Access**: Articles can be stored locally for offline reading.
- **Background Sync**: Automatic synchronization of articles in the background.
- **Search Functionality**: Easily search for articles using the integrated search bar.
- **User Authentication**: Secure login and token management.

## Tech Stack

- **Framework**: React Native
- **State Management**: Redux Toolkit
- **Local Database**: SQLite with react-native-sqlite-storage
- **API Client**: Axios
- **Testing**: Jest and React Native Testing Library
- **Code Quality**: ESLint and Prettier

## Getting Started

### Prerequisites

- Node.js (version 14 or higher)
- npm or yarn
- React Native CLI
- Android Studio (for Android development)
- Xcode (for iOS development)

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/t34wrj/mobdeck.git
   ```

2. Navigate to the project directory:
   ```
   cd mobdeck-mobile-app
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

- For iOS:
  ```
  npx react-native run-ios
  ```

### Testing

Run the tests using:
```
npm test
```

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any enhancements or bug fixes.

## License

This project is licensed under the MIT License. See the LICENSE file for details.