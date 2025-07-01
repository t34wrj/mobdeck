// Mock for react-native core modules
export const mockReactNative = {
  Platform: {
    OS: 'ios' as const,
    Version: '16.0',
    select: jest.fn((obj: any) => obj.ios || obj.default),
  },
  
  Dimensions: {
    get: jest.fn(() => ({ width: 375, height: 812 })),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  },
  
  Alert: {
    alert: jest.fn(),
    prompt: jest.fn(),
  },
  
  Linking: {
    openURL: jest.fn(() => Promise.resolve()),
    canOpenURL: jest.fn(() => Promise.resolve(true)),
    getInitialURL: jest.fn(() => Promise.resolve(null)),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  },
  
  AppState: {
    currentState: 'active',
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  },
  
  StatusBar: {
    setBarStyle: jest.fn(),
    setBackgroundColor: jest.fn(),
    setHidden: jest.fn(),
  },
  
  Keyboard: {
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    removeListener: jest.fn(),
    removeAllListeners: jest.fn(),
    dismiss: jest.fn(),
  },
  
  BackHandler: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
    removeEventListener: jest.fn(),
    exitApp: jest.fn(),
  },
  
  PermissionsAndroid: {
    request: jest.fn(() => Promise.resolve('granted')),
    check: jest.fn(() => Promise.resolve(true)),
    requestMultiple: jest.fn(() => Promise.resolve({})),
  },
  
  NativeModules: {
    RNCNetInfo: {
      getCurrentState: jest.fn(() => Promise.resolve({
        type: 'wifi',
        isConnected: true,
        isInternetReachable: true,
      })),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    },
    
    RNKeychain: {
      setInternetCredentials: jest.fn(() => Promise.resolve()),
      getInternetCredentials: jest.fn(() => Promise.resolve({ 
        username: 'test', 
        password: 'test' 
      })),
      resetInternetCredentials: jest.fn(() => Promise.resolve()),
    },
  },
};