---
root: false
targets:
  - claudecode
description: Main Claude Code configuration
globs:
  - '**/*'
---

# Mobdeck Mobile App - CLAUDE.md

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
- `npm test` - Run all tests with Jest (full suite)
- `npm run test:essential` - Run essential tests only (core functionality)
- `npm run test:ci` - Run CI tests (mirrors GitHub workflow)
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Generate test coverage report
- `npm run test:debug` - Run tests with debugging enabled

### Code Quality
- `npm run lint` - Run ESLint code analysis
- `npm run lint:fix` - Fix auto-fixable ESLint issues
- `npx prettier --write .` - Format code with Prettier
- `npm run type-check` - Run TypeScript type checking (when implemented)

### Version Management
- `npm run version:check` - Display current version from package.json
- `npm run version:patch` - Bump patch version (0.1.2 → 0.1.3)
- `npm run version:minor` - Bump minor version (0.1.2 → 0.2.0)
- `npm run version:major` - Bump major version (0.1.2 → 1.0.0)

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
### Streamlined Testing Philosophy (Simple Mobile App)
- **Essential Tests Only**: Focus on core business logic and critical user flows
- **CI Efficiency**: GitHub workflows run only essential tests for faster feedback
- **Practical Coverage**: 60% minimum coverage (appropriate for simple mobile app)
- **Quality over Quantity**: Test behavior that matters to users

### Test Categories
- **Essential Tests** (`npm run test:essential`): Core functionality only
  - DatabaseService, AuthStorageService, SyncService, ReadeckApiService
  - UserJourneys (authentication, article reading, sync)
  - MobileSecurity (token storage, basic validation)
- **Full Suite** (`npm test`): All tests including utilities and components

### Test Priorities (Simple App)
1. **Authentication Flow**: Login, token storage, logout
2. **Article Management**: Fetch, display, sync, offline access
3. **Core Components**: Article list, article reader, basic settings
4. **Error Handling**: Network failures, API errors, offline scenarios

### Frameworks & Tools
- **Unit Tests**: Jest with React Native Testing Library
- **Integration Tests**: Basic API and database integration
- **Component Tests**: Core UI components and user interactions

### Test Conventions
- **Test Files**: `*.test.ts` or `*.test.tsx`
- **Test Structure**: Simple Arrange-Act-Assert pattern
- **Mock Strategy**: Mock external dependencies (API calls, native modules)
- **Focus**: Test user-facing behavior, not implementation details

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
- [ ] Essential tests pass (`npm run test:essential`)
- [ ] Basic linting passes (`npm run lint`)
- [ ] App builds successfully (`npm run android`)
- [ ] Manual testing of core functionality
- [ ] Brief documentation update for significant changes

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
### Practical Mobile Security
- Store API tokens securely using react-native-keychain
- Basic input validation for user forms and API data
- Support HTTPS for API communications (HTTP fallback for local development)
- Simple authentication flows with manual token entry
- Follow standard React Native security practices
- Basic error handling without exposing sensitive information

### Security Checklist (Simple App)
- [ ] API tokens stored in secure keychain (not AsyncStorage)
- [ ] Form inputs validated before submission
- [ ] API calls use HTTPS when possible
- [ ] No sensitive data logged in production
- [ ] Error messages don't expose system internals

## Performance Guidelines
### Mobile-Focused Performance
- Optimize SQLite queries for article storage and retrieval
- Implement basic article caching for offline access
- Use simple list virtualization for article collections (50+ items)
- Background sync with reasonable intervals (preserve battery)
- Basic image optimization for article thumbnails

### Performance Targets (Simple Mobile App)
- **App startup**: < 3 seconds on mid-range Android devices
- **Article loading**: < 1 second from local SQLite storage
- **Sync performance**: Handle 100+ articles without UI blocking
- **Battery usage**: Minimal impact from background operations
- **Memory usage**: Efficient article content management

## Quality Standards (Proportionate to Simple App)
### Code Quality Approach
- **Linting**: ESLint with React Native recommended rules
- **Formatting**: Prettier with project-standard configuration
- **TypeScript**: Basic type safety for core interfaces
- **Testing**: Focus on user-critical functionality

### Quality Checklist
- [ ] Code follows consistent style guidelines
- [ ] Core user flows are tested and working
- [ ] App functions properly offline
- [ ] API integration handles common error scenarios
- [ ] UI adapts to different Android screen sizes
- [ ] No obvious performance issues on mid-range devices

## Documentation Standards
### Proportionate Documentation
- Update README.md for user installation and basic usage
- Document API integration with straightforward examples
- Comment complex business logic (especially sync algorithms)
- Maintain basic summaries for significant feature additions
- Use simple JSDoc comments for key exported functions
- Keep CLAUDE.md updated for major architectural changes

### Documentation Priorities (Simple App)
1. **User Guide**: How to install and configure the app
2. **Developer Setup**: Getting the development environment running
3. **API Integration**: Working with the Readeck API
4. **Core Features**: Main screens and functionality overview
5. **Troubleshooting**: Common issues and basic solutions

### Documentation Maintenance
- Update docs when adding major features (not minor changes)
- Focus on practical information developers and users need
- Avoid over-documenting internal implementation details
- Keep examples simple and relevant to actual usage

---
*This CLAUDE.md was last updated on 30 June 2025. Keep it current as the Mobdeck project evolves.*