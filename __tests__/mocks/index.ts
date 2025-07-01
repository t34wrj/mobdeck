// Central export for all mock modules
export * from './react-native-modules';
export * from './async-storage';
export * from './sqlite-storage';
export * from './navigation';

// Additional utility mocks
export const mockAxios = {
  get: jest.fn(() => Promise.resolve({ data: {} })),
  post: jest.fn(() => Promise.resolve({ data: {} })),
  put: jest.fn(() => Promise.resolve({ data: {} })),
  delete: jest.fn(() => Promise.resolve({ data: {} })),
  patch: jest.fn(() => Promise.resolve({ data: {} })),
  create: jest.fn(() => mockAxios),
  defaults: {
    baseURL: '',
    headers: {},
    timeout: 5000,
  },
  interceptors: {
    request: {
      use: jest.fn(),
      eject: jest.fn(),
    },
    response: {
      use: jest.fn(),
      eject: jest.fn(),
    },
  },
};

export const mockNetInfo = {
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(() => Promise.resolve({
    type: 'wifi',
    isConnected: true,
    isInternetReachable: true,
    details: {
      isConnectionExpensive: false,
      ssid: 'MockWiFi',
      bssid: '00:00:00:00:00:00',
      strength: 99,
      ipAddress: '192.168.1.100',
      subnet: '255.255.255.0',
    },
  })),
  refresh: jest.fn(() => Promise.resolve()),
  configure: jest.fn(),
};

export const mockKeychain = {
  setInternetCredentials: jest.fn(() => Promise.resolve()),
  getInternetCredentials: jest.fn(() => Promise.resolve({
    username: 'test-user',
    password: 'test-password',
    server: 'test-server',
  })),
  resetInternetCredentials: jest.fn(() => Promise.resolve()),
  hasInternetCredentials: jest.fn(() => Promise.resolve(true)),
  setGenericPassword: jest.fn(() => Promise.resolve()),
  getGenericPassword: jest.fn(() => Promise.resolve({
    username: 'test-user',
    password: 'test-password',
  })),
  resetGenericPassword: jest.fn(() => Promise.resolve()),
  canImplyAuthentication: jest.fn(() => Promise.resolve(true)),
  getSupportedBiometryType: jest.fn(() => Promise.resolve('FaceID')),
};

export const mockRNFS = {
  DocumentDirectoryPath: '/mock/documents',
  CachesDirectoryPath: '/mock/caches',
  TemporaryDirectoryPath: '/mock/temp',
  MainBundlePath: '/mock/bundle',
  ExternalDirectoryPath: '/mock/external',
  writeFile: jest.fn(() => Promise.resolve()),
  readFile: jest.fn(() => Promise.resolve('')),
  exists: jest.fn(() => Promise.resolve(true)),
  unlink: jest.fn(() => Promise.resolve()),
  mkdir: jest.fn(() => Promise.resolve()),
  readDir: jest.fn(() => Promise.resolve([])),
  stat: jest.fn(() => Promise.resolve({
    path: '/mock/path',
    ctime: new Date(),
    mtime: new Date(),
    size: 1024,
    mode: 33188,
    originalFilepath: '/mock/path',
    isFile: () => true,
    isDirectory: () => false,
  })),
  copyFile: jest.fn(() => Promise.resolve()),
  moveFile: jest.fn(() => Promise.resolve()),
  downloadFile: jest.fn(() => ({
    promise: Promise.resolve({ statusCode: 200 }),
    jobId: 1,
  })),
  uploadFiles: jest.fn(() => ({
    promise: Promise.resolve({ statusCode: 200 }),
    jobId: 1,
  })),
};

export const mockShare = {
  open: jest.fn(() => Promise.resolve()),
  isPackageInstalled: jest.fn(() => Promise.resolve(true)),
  shareSingle: jest.fn(() => Promise.resolve()),
};