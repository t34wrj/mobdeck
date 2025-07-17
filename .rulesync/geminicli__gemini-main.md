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
- Clean Architecture separation between UI, business logic, and data
- Offline-first design with local SQLite storage
- Repository pattern for data access abstraction
- Custom hooks for reusable stateful logic

## Design System & Styling

### Color Palette
The Mobdeck app uses a vibrant, modern color palette that creates visual interest while maintaining readability and accessibility. All colors are defined in the theme system (`src/components/ui/theme.ts`).

**Primary Colors:**
- **Primary Orange (#FE5D26)**: Giants Orange - Main brand color used for primary actions, buttons, and emphasis
- **Secondary Yellow (#F9BD4D)**: Xanthous - Accent color for secondary actions and highlights
- **Primary Blue (#083D77)**: Yale Blue - Deep blue for headers, navigation, and important text
- **Accent Cyan (#7DE2D1)**: Tiffany Blue - Light accent for highlights, hover states, and interactive elements
- **Dark Green (#0B5739)**: Castleton Green - Success states, confirmations, and positive indicators

**Semantic Colors:**
- **Error**: Uses warm tones from the primary orange palette
- **Warning**: Uses the secondary yellow (Xanthous) palette
- **Info**: Uses the accent cyan (Tiffany Blue) palette
- **Success**: Uses the dark green (Castleton Green) palette
- **Neutral**: Blue-based grayscale derived from Yale Blue for text, borders, and surfaces

### Theme System
- **Location**: `src/components/ui/theme.ts` (primary), `src/hooks/useAppTheme.ts` (legacy)
- **Structure**: Material Design inspired with 50-900 shade scales
- **Usage**: Import theme and use `theme.colors.primary[500]` format
- **Components**: Button, Text, ArticleCard automatically use theme colors

### Typography System
- **Font Family**: Uses sans serif fonts across the entire application (`sans-serif`)
- **Font Weights**: Supports normal (400), medium (500), semibold (600), and bold (700)
- **Font Sizes**: Scale from xs (12px) to 5xl (48px) with corresponding line heights
- **Usage**: Access via `theme.typography.fontFamily.regular` for consistent font application

### Styling Conventions
- **Themed Components**: Use theme system for all colors (`theme.colors.primary[500]`)
- **Spacing**: Use theme spacing values (`theme.spacing[4]`)
- **Border Radius**: Use theme border radius (`theme.borderRadius.md`)
- **Typography**: Use theme typography scale (`theme.typography.fontSize.lg`)
- **Font Family**: Always use theme font family (`theme.typography.fontFamily.regular`)
- **No Hardcoded Colors**: All color values should reference the theme system

## Testing Strategy
### Frameworks & Tools
- **Unit Tests**: Jest with React Native Testing Library
- **Integration Tests**: Jest with mocked React Native modules
- **Component Tests**: React Native Testing Library for UI components
- **Coverage Target**: Industry standard 80% minimum coverage

### Test Conventions
- **Test Files**: `*.test.ts` or `*.test.tsx`
- **Test Structure**: Arrange-Act-Assert pattern
- **Mock Strategy**: Mock external dependencies (API calls, native modules)
- **Component Testing**: Test user interactions and state changes

## Git Workflow
### Branch Strategy
- **main**: Production-ready, deployable code
- **feature/***: New features (e.g., `feature/offline-sync`)
- **fix/***: Bug fixes (e.g., `fix/bookmark-display-issue`)
- **chore/***: Maintenance tasks (e.g., `chore/dependency-updates`)

### Commit Standards
```
type(scope): description

[optional body]

[optional footer]
```
**Types**: feat, fix, docs, style, refactor, test, chore, perf
**Scopes**: auth, api, ui, sync, db, nav, settings

### PR Requirements
- [ ] All tests pass (`npm test`)
- [ ] Linting passes (`npm run lint`)
- [ ] Code builds successfully (`npm run android`)
- [ ] Code review approval from team member
- [ ] Documentation updated for API changes
- [ ] Test coverage maintained at 80% minimum

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
- Store API tokens securely using react-native-keychain
- Validate all user inputs and API responses
- Support both HTTP and HTTPS for API communications with Readeck servers (HTTPS recommended for security)
- Implement proper authentication flows with API tokens
- Follow React Native security best practices for data storage
- Regular dependency updates for security patches

## Error Handling
- Structured error handling with try-catch blocks for async operations
- User-friendly error messages for network failures and API errors
- Graceful degradation when offline (use local data)
- Error boundaries for React component error containment
- Comprehensive logging for debugging (development only)

## Performance Guidelines
- Optimize SQLite queries with proper indexing
- Implement efficient bookmark caching for offline access
- Use React.memo() for expensive component re-renders
- Lazy loading for large bookmark lists
- Background sync with user-configurable intervals (WiFi/mobile data options)
- Bundle size optimization through code splitting

## Deployment
### Environments
- **Development**: Local development with Metro bundler hot reload
- **Testing**: Android emulator and physical device testing
- **Production**: Android APK builds for distribution (future: Google Play Store)

### Build Process
1. Run full test suite: `npm test`
2. Lint and format code: `npm run lint`
3. Build Android APK: `cd android && ./gradlew assembleRelease`
4. Test on physical devices before distribution
5. Create release notes and version documentation

## Troubleshooting
### Common Issues
1. **Metro bundler cache**: `npx react-native start --reset-cache`
2. **Android build failures**: `cd android && ./gradlew clean`
3. **Node modules issues**: `rm -rf node_modules && npm install`
4. **Android emulator connection**: Check adb devices and restart emulator

### Debug Commands
- `npx react-native log-android` - View Android app logs
- `adb devices` - List connected Android devices
- `adb logcat` - Full Android system logs
- `npm run android -- --verbose` - Verbose build output

## Restrictions and Boundaries
- **DO NOT** store API tokens in plain text or AsyncStorage
- **DO NOT** commit directly to main branch without PR review
- **NEVER** commit API keys, passwords, or sensitive configuration
- **NEVER** use deprecated React Native APIs or components
- **ALWAYS** test on physical devices before release
- **AVOID** large component files (extract when > 300 lines)
- **AVOID** synchronous operations that block the main thread
- **AVOID** direct native module manipulation without proper bridges

## Team Conventions
- All PRs require code review before merging
- Use conventional commit messages for clear change tracking
- Update documentation for any API or major feature changes
- Test offline functionality for all new features
- Follow React Native performance best practices
- Maintain backwards compatibility with older Readeck API versions

## Documentation Standards
- Update README.md for user-facing installation changes
- Document all API integration patterns with examples
- Comment complex business logic, especially sync algorithms
- Maintain task completion summaries in `/internal_docs/task_completion_summaries/`
- Use JSDoc comments for exported functions and components
- Keep GEMINI.md updated as architecture evolves
- Refer to `internal_docs/READECK_API_DOCUMENTATION.md` for all Readeck API specifications and implementation details

---
*This GEMINI.md was last updated on 30 June 2025. Keep it current as the Mobdeck project evolves.*