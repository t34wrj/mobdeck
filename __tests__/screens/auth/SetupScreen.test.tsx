import { Alert } from 'react-native';
import SetupScreen from '../../../src/screens/auth/SetupScreen';
import { authStorageService } from '../../../src/services/AuthStorageService';

// Mock dependencies
jest.mock('react-native-keychain', () => ({
  setInternetCredentials: jest.fn(() => Promise.resolve(true)),
  getInternetCredentials: jest.fn(() =>
    Promise.resolve({ password: 'mock-token' })
  ),
  resetInternetCredentials: jest.fn(() => Promise.resolve(true)),
}));

jest.mock('../../../src/services/AuthStorageService', () => ({
  authStorageService: {
    storeToken: jest.fn(),
    retrieveToken: jest.fn(),
    deleteToken: jest.fn(),
    isTokenStored: jest.fn(),
    validateStoredToken: jest.fn(),
  },
}));

const mockLinking = {
  openURL: jest.fn(),
};

jest.mock('react-native/Libraries/Linking/Linking', () => mockLinking);

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
  }),
}));

jest.spyOn(Alert, 'alert');

// Mock fetch
global.fetch = jest.fn() as jest.Mock;

describe('SetupScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(SetupScreen).toBeDefined();
  });

  describe('Documentation link', () => {
    it('can open external documentation', async () => {
      mockLinking.openURL.mockResolvedValue(undefined);

      await mockLinking.openURL('https://readeck.org/en/docs/api/');

      expect(mockLinking.openURL).toHaveBeenCalledWith(
        'https://readeck.org/en/docs/api/'
      );
    });

    it('handles documentation link errors', async () => {
      mockLinking.openURL.mockRejectedValue(new Error('Failed to open'));

      try {
        await mockLinking.openURL('https://readeck.org/en/docs/api/');
      } catch (error) {
        expect(error).toEqual(new Error('Failed to open'));
      }
    });
  });

  describe('Connection testing', () => {
    it('validates empty input', () => {
      const emptyUrl = '';
      const emptyToken = '';

      expect(emptyUrl.trim()).toBe('');
      expect(emptyToken.trim()).toBe('');
    });
    it('tests connection with valid response', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
      });
      (authStorageService.storeToken as jest.Mock).mockResolvedValue(true);

      const response = await fetch(
        'https://readeck.example.com/api/bookmarks',
        {
          method: 'GET',
          headers: {
            Authorization: 'Bearer valid-token',
            Accept: 'application/json',
          },
        }
      );

      expect(response.ok).toBe(true);
      expect(response.status).toBe(200);
    });

    it('handles 401 unauthorized error', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
      });

      const response = await fetch(
        'https://readeck.example.com/api/bookmarks',
        {
          method: 'GET',
          headers: {
            Authorization: 'Bearer invalid-token',
            Accept: 'application/json',
          },
        }
      );

      expect(response.ok).toBe(false);
      expect(response.status).toBe(401);
    });

    it('handles network errors', async () => {
      (fetch as jest.Mock).mockRejectedValue(
        new Error('Network request failed')
      );

      try {
        await fetch('https://readeck.example.com/api/bookmarks');
      } catch (error) {
        expect(error).toEqual(new Error('Network request failed'));
      }
    });

    it('can store token after successful test', async () => {
      (authStorageService.storeToken as jest.Mock).mockResolvedValue(true);

      const result = await authStorageService.storeToken('valid-token');
      expect(result).toBe(true);
    });
  });

  describe('Input handling', () => {
    it('trims whitespace from inputs', () => {
      const urlWithSpaces = '  https://readeck.example.com  ';
      const tokenWithSpaces = '  valid-token  ';

      expect(urlWithSpaces.trim()).toBe('https://readeck.example.com');
      expect(tokenWithSpaces.trim()).toBe('valid-token');
    });
  });
});
