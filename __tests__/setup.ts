import 'react-native-gesture-handler/jestSetup';
import { 
  mockAsyncStorage, 
  mockKeychain, 
  mockSQLite, 
  mockNetInfo, 
  mockNavigation, 
  mockRoute, 
  mockBackgroundActions,
  resetAllMocks as _resetAllMocks 
} from './mocks/strategicMocks';

// Strategic External Dependency Mocking
jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

// Mock React Native modules
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: jest.fn(dict => dict.ios || dict.default),
  },
  Alert: {
    alert: jest.fn(),
  },
  Dimensions: {
    get: jest.fn().mockReturnValue({ width: 375, height: 812 }),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  },
  Linking: {
    openURL: jest.fn(() => Promise.resolve()),
    canOpenURL: jest.fn(() => Promise.resolve(true)),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  },
  StyleSheet: {
    create: jest.fn(styles => styles),
    flatten: jest.fn(styles => styles),
  },
  View: 'View',
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  ScrollView: 'ScrollView',
  TextInput: 'TextInput',
  FlatList: 'FlatList',
  Image: 'Image',
  Modal: 'Modal',
  ActivityIndicator: 'ActivityIndicator',
  KeyboardAvoidingView: 'KeyboardAvoidingView',
  NativeModules: {
    RNCNetInfo: {
      getCurrentState: jest.fn(() =>
        Promise.resolve({
          type: 'wifi',
          isConnected: true,
          isInternetReachable: true,
        })
      ),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    },
  },
}));

// Mock Keychain (External Dependency)
jest.mock('react-native-keychain', () => ({
  ...mockKeychain,
  ACCESSIBLE: {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WhenUnlockedThisDeviceOnly',
    WHEN_UNLOCKED: 'WhenUnlocked',
    AFTER_FIRST_UNLOCK: 'AfterFirstUnlock',
    ALWAYS: 'Always',
    WHEN_PASSCODE_SET_THIS_DEVICE_ONLY: 'WhenPasscodeSetThisDeviceOnly',
    ALWAYS_THIS_DEVICE_ONLY: 'AlwaysThisDeviceOnly',
    AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'AfterFirstUnlockThisDeviceOnly',
  },
  BIOMETRY_TYPE: {
    BIOMETRICS: 'Biometrics',
    TOUCH_ID: 'TouchID',
    FACE_ID: 'FaceID',
    FINGERPRINT: 'Fingerprint',
  },
}));

// Mock NetInfo (External Dependency)
jest.mock('@react-native-community/netinfo', () => mockNetInfo);

// Mock React Navigation (UI Boundary)
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => mockRoute,
  useFocusEffect: jest.fn(),
  NavigationContainer: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock SQLite Storage (External Dependency)
jest.mock('react-native-sqlite-storage', () => ({
  ...mockSQLite,
  DEBUG: jest.fn(),
}));

// Mock Background Actions (System Boundary)
jest.mock('react-native-background-actions', () => mockBackgroundActions);

// Mock React Native Screens
jest.mock('react-native-screens', () => ({
  enableScreens: jest.fn(),
}));

// Mock Safe Area Context
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  useSafeAreaFrame: () => ({ x: 0, y: 0, width: 375, height: 812 }),
}));

// Mock ConnectivityManager
jest.mock('../src/utils/connectivityManager', () => ({
  connectivityManager: {
    isOnline: jest.fn(() => true),
    getStatus: jest.fn(() => 'online'),
    getDetails: jest.fn(() => ({
      isConnected: true,
      isInternetReachable: true,
      networkType: 'wifi',
      isConnectionExpensive: false,
    })),
    addListener: jest.fn(),
    removeListener: jest.fn(),
    refresh: jest.fn(() => Promise.resolve()),
  },
  default: {
    isOnline: jest.fn(() => true),
    getStatus: jest.fn(() => 'online'),
    getDetails: jest.fn(() => ({
      isConnected: true,
      isInternetReachable: true,
      networkType: 'wifi',
      isConnectionExpensive: false,
    })),
    addListener: jest.fn(),
    removeListener: jest.fn(),
    refresh: jest.fn(() => Promise.resolve()),
  },
}));

// Mock ReadeckApiService for all tests
jest.mock('../src/services/ReadeckApiService', () => {
  const mockMethods = {
    fetchArticles: jest.fn(() =>
      Promise.resolve({
        items: [],
        page: 1,
        totalPages: 1,
        totalItems: 0,
      })
    ),
    createArticle: jest.fn(() =>
      Promise.resolve({
        id: 'test-id',
        title: 'Test Article',
        url: 'https://example.com',
        createdAt: new Date().toISOString(),
      })
    ),
    updateArticle: jest.fn(() => Promise.resolve()),
    deleteArticle: jest.fn(() => Promise.resolve()),
  };

  // Mock class constructor that returns an object with the same methods
  const MockArticlesApiService = jest.fn().mockImplementation(() => mockMethods);

  return {
    articlesApiService: mockMethods,
    default: MockArticlesApiService,
    __esModule: true,
  };
});

// Global test utilities
global.fetch = jest.fn();
global.XMLHttpRequest = jest.fn() as any;

// Skip problematic animated mock - not essential for basic testing

// Mock console methods for cleaner test output (but not during device tests)
if (process.env.RUN_DEVICE_TESTS !== 'true') {
  global.console = {
    ...console,
    warn: jest.fn(),
    error: jest.fn(),
    log: jest.fn(),
  };
}

// Setup timeout for async tests
jest.setTimeout(10000);
