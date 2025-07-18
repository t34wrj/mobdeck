---
root: false
targets:
  - geminicli
description: Main Gemini CLI configuration
globs:
  - '**/*'
---

# Mobdeck Mobile App - GEMINI.md

## Project Overview
Mobdeck is a React Native mobile application that provides mobile access to self-hosted Readeck instances, enabling article management, offline reading, and synchronization.
- **Project Type**: Mobile application (React Native)
- **Primary Function**: Mobile client for Readeck API with offline-first bookmark reading and management capabilities
- **Target Users**: Mobile users with self-hosted Readeck instances who need mobile access to their articles
- **Domain**: Content management and offline reading

## Tech Stack
- **Languages**: TypeScript 5.x, JavaScript ES2022
- **Framework**: React Native 0.80.0 (latest stable), React 18.x
- **Database**: SQLite with react-native-sqlite-storage for local article storage
- **State Management**: Redux Toolkit for global state, useState for local component state
- **Testing**: Jest and React Native Testing Library
- **Tools**: Metro Bundler, ESLint, Prettier, Android Studio, Flipper
- **Infrastructure**: Local development with Android Studio emulator

## Project Structure
```
mobdeck/
├── src/                    # Main application source code
│   ├── components/         # Reusable UI components (ArticleCard, SearchBar)
│   ├── screens/           # Main app screens (HomeScreen, ArticleScreen, SettingsScreen, AuthScreen)
│   ├── services/          # API and database services (api.ts, sync.ts, database.ts)
│   ├── store/             # Redux store configuration and slices
│   ├── navigation/        # React Navigation configuration
│   ├── types/             # TypeScript type definitions
│   └── utils/             # Helper functions and utilities
├── android/               # Android-specific configuration
├── ios/                   # iOS configuration (future)
├── internal_docs/         # Comprehensive project documentation
└── __tests__/             # Test files
```

## Development Environment Setup
### Prerequisites
- Node.js 22.17.0 (enforced version)
- npm package manager
- React Native CLI
- Android Studio with Android SDK
- Java Development Kit (JDK 17+)

### Environment Variables
```bash
# No environment variables required for basic setup
# API configuration handled through in-app settings
NODE_ENV=development
```

### Setup Commands
```bash
# Initial setup
npm install                     # Install dependencies
cd android && ./gradlew clean  # Clean Android build (if needed)

# Start development
npm start                       # Start Metro bundler
npm run android                 # Run on Android emulator/device
npm run ios                     # Run on iOS simulator (future)
```

## Common Commands
### Development
- `npm start` - Start Metro bundler
- `npm run android` - Launch on Android emulator/device
- `npm run ios` - Launch on iOS simulator (when iOS support added)
- `npx react-native log-android` - View Android logs
- `npx react-native log-ios` - View iOS logs

### Testing
- `npm test` - Run all tests with Jest
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Generate test coverage report
- `npm run test:debug` - Run tests with debugging enabled
- `npm run test:performance` - Run performance tests (currently disabled with .skip extension)
- `npm run performance:report` - Generate performance test report (outputs to performance-report.txt)

### Code Quality
- `npm run lint` - Run ESLint code analysis
- `npm run lint:fix` - Fix auto-fixable ESLint issues
- `npx prettier --write .` - Format code with Prettier
- `npm run type-check` - Run TypeScript type checking (when implemented)

### React Native Specific
- `npx react-native info` - Environment information
- `cd android && ./gradlew clean` - Clean Android build cache
- `npx react-native start --reset-cache` - Reset Metro bundler cache

## Code Style & Conventions
### Language Standards
- **Import Style**: Use ES modules (import/export)
- **Function Style**: Prefer arrow functions for consistency
- **Component Style**: Function components with React Hooks exclusively
- **Async Style**: async/await preferred over .then() chains

### Naming Conventions
- **Variables**: camelCase (e.g., `bookmarkList`, `syncStatus`)
- **Functions**: camelCase (e.g., `fetchBookmarks`, `handleSync`)
- **Components**: PascalCase (e.g., `BookmarkCard`, `SearchBar`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `API_ENDPOINTS`, `SYNC_INTERVALS`)
- **Files**: 
  - Components: PascalCase.tsx (e.g., `BookmarkCard.tsx`)
  - Services/Utils: camelCase.ts (e.g., `apiService.ts`)
- **Directories**: camelCase (e.g., `src/store/slices`)

### Architecture Patterns
- Redux Toolkit for global state management (bookmarks, auth, sync)
- Simple component architecture with clear separation of concerns
- Offline-first design with local SQLite storage
- Basic service layer for API and database operations
- Custom hooks for reusable stateful logic

## Testing Strategy
### Frameworks & Tools
- **Unit Tests**: Jest with React Native Testing Library
- **Integration Tests**: Basic API and database integration tests
- **Component Tests**: Core UI components and user flows only
- **Coverage Target**: 60% minimum coverage (appropriate for simple mobile app)

### Test Conventions
- **Test Files**: `*.test.ts` or `*.test.tsx`
- **Test Structure**: Arrange-Act-Assert pattern
- **Mock Strategy**: Mock external dependencies (API calls, native modules)
- **Component Testing**: Test key user interactions (article reading, sync, auth)
- **Focus**: Test core functionality - article display, sync, and offline reading

### Test Priorities (Simple App Approach)
1. **Critical Path**: Authentication, article sync, offline reading
2. **Core Components**: Article list, article reader, settings
3. **API Integration**: Readeck API communication and error handling
4. **Data Persistence**: SQLite operations and offline functionality

## Important Files & Utilities
### Configuration Files
- `package.json` - Dependencies and npm scripts
- `metro.config.js` - Metro bundler configuration
- `android/` - Android build configuration
- `tsconfig.json` - TypeScript configuration (when implemented)

### Core Modules
- `src/services/api.ts` - Readeck API client with axios
- `src/services/database.ts` - SQLite database operations
- `src/store/` - Redux store configuration and slices
- `src/types/index.ts` - TypeScript interface definitions
- `internal_docs/READECK_API_DOCUMENTATION.md` - Comprehensive Readeck API reference

### Key Components
- `src/screens/AuthScreen.tsx` - Readeck server authentication
- `src/screens/HomeScreen.tsx` - Bookmark list and search
- `src/components/BookmarkCard.tsx` - Individual bookmark display

## Security & Compliance
### Basic Mobile Security
- Store API tokens securely using react-native-keychain
- Basic input validation for user data
- Support HTTPS for API communications (HTTP fallback for local setups)
- Simple authentication flows with API tokens
- Follow standard React Native security practices

### Security Checklist (Simple App)
- [ ] API tokens stored securely
- [ ] Input validation on forms
- [ ] HTTPS preferred for API calls
- [ ] No sensitive data in logs
- [ ] Basic error handling without exposing internals

## Performance Guidelines
### Mobile-Focused Performance
- Efficient SQLite queries for article storage
- Basic article caching for offline access
- Simple list virtualization for large article collections
- Reasonable sync intervals to preserve battery life
- Basic image optimization for article thumbnails

### Performance Targets (Mobile App)
- **App startup**: < 3 seconds on mid-range devices
- **Article loading**: < 1 second from local storage
- **Sync performance**: Handle 100+ articles efficiently
- **Battery usage**: Minimal background sync impact
- **Storage**: Efficient local article storage

## Documentation Standards
### Proportionate Documentation
- Update README.md for installation and basic usage
- Document API integration patterns with simple examples
- Comment complex business logic (sync algorithms)
- Maintain basic task summaries for significant features
- Use simple JSDoc comments for exported functions
- Keep GEMINI.md updated for major architectural changes

### Documentation Priorities
1. **User Setup**: Installation and configuration
2. **Developer Setup**: Getting started with development
3. **API Integration**: How to work with Readeck API
4. **Key Components**: Core screens and functionality
5. **Troubleshooting**: Common issues and solutions

## Quality Standards (Simple App)
### Code Quality
- **Linting**: ESLint with basic React Native rules
- **Formatting**: Prettier with standard configuration
- **TypeScript**: Basic type safety (when implemented)
- **Testing**: Focus on core functionality and user flows

### Quality Checklist
- [ ] Code follows basic style guidelines
- [ ] Core functionality is tested
- [ ] App works offline as expected
- [ ] API integration handles basic errors
- [ ] UI is responsive on different screen sizes

---
*This GEMINI.md was last updated on 30 June 2025. Keep it current as the Mobdeck project evolves.*