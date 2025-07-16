# GitHub Copilot Custom Instructions for Mobdeck

This file provides GitHub Copilot with essential context, guidelines, and preferences for assisting with the Mobdeck mobile application. The more detailed and accurate this document is, the better Copilot can understand your intent and provide relevant suggestions.

---

## 1. Project Overview & Goals

- **Project Title:** Mobdeck Mobile App
- **Purpose/Goal:** To develop a mobile application that allows users with a self-hosted Readeck instance to access their articles using the Readeck API. The app enables users to add articles via the OS share function, synchronize articles between mobile and server, download articles for offline reading, and manage their article collection.
- **Target Audience:** Mobile phone users who have a self-hosted Readeck instance and want mobile access to their articles.
- **Key Features (MVP):**
  - Add articles to the app using OS share function
  - Synchronize articles between mobile app and Readeck server
  - Delete articles from the mobile app
  - Manual Bearer token authentication with Readeck API
  - Background synchronization with user-configurable settings
  - Single Readeck instance and single user support

---

## 2. Technology Stack

- **Mobile Framework:** React Native 0.80.0 (latest stable) with TypeScript
- **Node.js:** 22.17.0 (enforced version)
- **State Management:** Redux Toolkit
- **Local Database:** SQLite with react-native-sqlite-storage
- **API Client:** Axios for Readeck API communication
- **Authentication:** Bearer tokens stored securely with react-native-keychain (manual entry only)
- **Background Sync:** @react-native-async-storage/async-storage + react-native-background-job
- **File Operations:** react-native-fs + react-native-share
- **Testing:** Jest and React Native Testing Library
- **Development Tools:** Android Studio, React Native CLI, Metro Bundler, Flipper
- **Code Quality:** ESLint and Prettier

---

## 3. App Structure & Screens

- **Overall App Organization:** React Native single-screen application with stack navigation for different views and screens.
- **Main Screens/Views:** Core screens and their general purpose:
  - **Home Screen (`HomeScreen`):** List of articles with search functionality
  - **Article Detail (`ArticleScreen`):** Full article content for reading
  - **Settings (`SettingsScreen`):** User preferences, sync settings, API configuration
  - **Login/Auth (`AuthScreen`):** Readeck server connection and token management
- **Navigation Flow:** After authentication, users land on Home screen. From Home, they can navigate to individual articles or Settings. Articles can be shared into the app from other applications using OS share functionality.

---

## Automated Release Process

The project uses automated version synchronization to ensure consistent versioning across all platforms:

1. **Version Management**: `package.json` serves as the single source of truth for version numbers
2. **Android Integration**: `build.gradle` dynamically reads version from `package.json` and auto-increments `versionCode` based on git commit count
3. **Automated Releases**: Use GitHub Actions workflow "Create Release" to:
   - Bump version automatically (patch/minor/major)
   - Run tests and quality checks
   - Commit version changes
   - Create git tag
   - Trigger release workflow
   - Build and publish APK with correct version

---

## Manual Release Process

1. **Bump Version**: `npm run version:patch` (or minor/major)
2. **Run Tests**: `npm test`
3. **Lint Code**: `npm run lint`
4. **Commit Changes**: Include version bump in commit
5. **Create Tag**: `git tag v$(npm run version:check)`
6. **Push**: `git push origin main --tags`
7. **GitHub Actions**: Will automatically build and release APK

---

## 4. Data Model (High-Level)

- **Key Entities:** Main data entities the application handles:
  - **Article:** `id`, `title`, `summary`, `content`, `imageUrl`, `createdAt`, `updatedAt`, `readStatus`
  - **User:** `serverUrl`, `token` (Bearer token for Readeck API - single user only)
  - **SyncSettings:** `autoSync`, `syncInterval`, `wifiOnly`, `lastSyncTime`
  - **AppState:** `articles[]`, `user`, `loading`, `error`, `syncStatus`
- **API Integration:** Uses Readeck API endpoints (see `@internal_docs/READECK_API_DOCUMENTATION.md` for complete API reference):
  - `GET /api/bookmarks` - Fetch articles
  - `POST /api/bookmarks` - Add new articles
  - `DELETE /api/bookmarks/:id` - Remove articles
  - Manual Bearer token authentication (no POST /auth endpoint used)

---

## 5. Coding Standards & Conventions

- **Code Formatting:** Use Prettier for code formatting with project configuration.
- **Naming Conventions:**
  - **Variables:** `camelCase` (TypeScript/JavaScript)
  - **Components:** `PascalCase` (React Native)
  - **Files:**
    - React Components: `PascalCase.tsx` (e.g., `ArticleCard.tsx`)
    - Utilities/Services: `camelCase.ts` (e.g., `apiService.ts`)
    - Store/Slices: `camelCase.ts` (e.g., `articlesSlice.ts`)
- **Language Specifics:**
  - _TypeScript:_
    - Use strict mode in `tsconfig.json`
    - Prefer `interface` for object types and API contracts
    - Use `type` for unions, intersections, and mapped types
    - Always define return types for functions
    - All interfaces should be defined in `src/types/index.ts`
  - _React Native:_
    - Prefer functional components with hooks
    - Extract reusable logic into custom hooks
    - Keep components focused on a single responsibility
    - Use StyleSheet.create for component styling
- **Error Handling Standards:**
  - Use proper Error objects with descriptive messages
  - Implement error boundaries for React components
  - Handle API errors gracefully with user-friendly messages
  - Log errors appropriately for debugging
- **Import Order:**
  1. React and React Native imports
  2. Third-party libraries/packages
  3. Internal modules/components
  4. Type imports
- **Mobile-Specific Conventions:**
  - Use React Native's built-in components over custom implementations
  - Implement proper loading states for async operations
  - Handle device-specific permissions (file access, sharing)
  - Ensure proper keyboard handling and screen responsiveness

---

## 6. Key Architectural Patterns & Design Principles

- **Architecture:** React Native application with Redux + Clean Architecture approach for separation of concerns.
- **State Management:** Redux Toolkit for global state management (articles, authentication, sync status). Local component state with `useState` for UI-specific state.
- **Offline-First Design:** Articles stored locally in SQLite, sync with server in background, graceful handling of network failures.
- **Design Principles:**
  - **Modularity:** Code separated into reusable modules and components
  - **Offline Capability:** App functions without internet connection
  - **Performance:** Efficient article loading and background sync
  - **Security:** Secure token storage and API communication

---

## 7. Important Files & Directories

- **Mobile App Structure:**
  - `src/components/`: Reusable UI components (ArticleCard, SearchBar, etc.)
  - `src/screens/`: Main application screens (HomeScreen, ArticleScreen, SettingsScreen)
  - `src/services/`: API interaction logic (api.ts, sync.ts, database.ts)
  - `src/store/`: Redux store configuration and slices
  - `src/store/slices/`: Individual Redux slices (articlesSlice, authSlice)
  - `src/types/index.ts`: TypeScript type definitions
  - `src/utils/`: Helper functions and utilities
  - `src/navigation/`: React Navigation configuration
- **Configuration:**
  - `tsconfig.json`: TypeScript configuration with path aliases
  - `package.json`: Dependencies and scripts
  - `android/`: Android-specific configuration
  - `ios/`: iOS-specific configuration (future)
- **Documentation:**
  - `docs/task_completion_summaries/`: Task completion documentation

---

## 8. Development Workflow & Tools

- **Version Control:** Git with conventional commits following the specification.
- **Branch Strategy:**
  - **main**: Production-ready, deployable code
  - **feature/\***: New features (e.g., `feature/offline-sync`)
  - **fix/\***: Bug fixes (e.g., `fix/article-display-issue`)
  - **chore/\***: Maintenance tasks (e.g., `chore/dependency-updates`)

### **Pre-Commit Validation Checklist**

1. **Stage Changes:** `git add .`
2. **TypeScript Check:** `npm run type-check` (when TypeScript is implemented)
3. **Lint Check:** `npm run lint` (fix with `npm run lint:fix`)
4. **Format Check:** `npx prettier --check .` (fix with `npx prettier --write .`)
5. **Test Validation:** `npm test`
6. **Pre-commit Hook Test:** Test commit to validate hooks
7. **Task Completion Summary:** Create summary in `docs/task_completion_summaries/`

---

## 8.1. Commit Failure Prevention & Debugging

### **Pre-Commit Validation Checklist**

1. **Stage Changes:** `git add .`
2. **TypeScript Check:** `npm run type-check`
3. **Lint Check:** `npm run lint` (fix with `npm run lint:fix`)
4. **Format Check:** `npx prettier --check .` (fix with `npx prettier --write .`)
5. **Test Validation:** `npm test`
6. **Pre-commit Hook Test:** Test commit to validate hooks
7. **Task Completion Summary:** Create summary in `docs/task_completion_summaries/`

### **Common Mobile-Specific Issues**

- **React Native Imports:** Incorrect imports from 'react-native' vs React
- **Platform-Specific Code:** Missing Platform.OS checks where needed
- **AsyncStorage:** Proper error handling for storage operations
- **Navigation:** Correct typing for navigation props and routes

---

## 9. Things to Avoid

- Avoid direct manipulation of native modules without proper React Native bridges
- Do not hardcode API endpoints or tokens in the codebase
- Avoid synchronous operations that block the main thread
- Do not store sensitive data in AsyncStorage (use react-native-keychain instead)
- Avoid large component files - extract when they grow beyond 300 lines
- Never commit large binary files or node_modules
- Avoid platform-specific code without proper Platform.OS checks
- Do not use deprecated React Native components or APIs

---

## 10. Preferred Libraries/APIs for Common Tasks

- **HTTP Requests:** Use `axios` for all API communications with Readeck
- **Secure Storage:** Use `react-native-keychain` for storing Bearer tokens
- **Local Database:** Use `react-native-sqlite-storage` for article storage
- **Background Tasks:** Use `react-native-background-job` for sync operations
- **File Operations:** Use `react-native-fs` for article downloads
- **Sharing:** Use `react-native-share` for OS share integration
- **State Management:** Use `@reduxjs/toolkit` for all state management
- **Navigation:** Use `@react-navigation/native` and `@react-navigation/stack`
- **Date/Time:** Use `date-fns` for date manipulation and formatting

---

## 11. Project Documentation References

This project maintains comprehensive documentation in the `/docs/` directory:

- **Project Overview (`/docs/project_overview.md`):** High-level vision and target audience
- **User Stories (`/docs/user_stories.md`):** Detailed user interactions and requirements
- **Site Structure & Pages (`/docs/site_structure_pages.md`):** App navigation and screen organization
- **Data Model (`/docs/data_model.md`):** Detailed description of entities and relationships
- **Design & UI Guidelines (`/docs/design_ui.md`):** Visual style and UI component guidelines
- **Task Completion Summaries (`/docs/task_completion_summaries/`):** Historical development documentation

---

## 12. General Guidance for Copilot

- Generate React Native components with proper TypeScript interfaces
- Include error handling for network requests and async operations
- Consider offline scenarios in all implementations
- Use Redux Toolkit patterns for state management
- Include proper loading states for async operations
- **Mobile-Specific Considerations:**
  - Handle device permissions appropriately
  - Implement proper keyboard avoidance
  - Consider different screen sizes and orientations
  - Use platform-appropriate UI patterns
- **Readeck API Integration:**
  - Always include Bearer token in Authorization headers
  - Handle API rate limiting and network failures gracefully
  - Implement proper sync conflict resolution
  - Cache data locally for offline access
  - Refer to `@internal_docs/READECK_API_DOCUMENTATION.md` for complete API specifications

---

## 13. MCP Server Capability Assessment & Integration

### 13.3. Project-Specific MCP Applications

**Mobdeck MCP Use Cases:**

- **Testing Enhancement**: React Native component testing, API integration testing, offline functionality validation
- **Documentation Automation**: App screenshots, user guide images, API integration documentation
- **Quality Assurance**: Accessibility compliance for mobile apps, performance monitoring, battery usage optimization
- **Development Validation**: Code quality checks, dependency analysis, React Native best practices validation

---

_This file should be updated as the Mobdeck project evolves and new features are added._
