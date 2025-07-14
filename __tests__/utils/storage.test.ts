import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  saveUserPreferences,
  getUserPreferences,
} from '../../src/utils/storage';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
}));

describe('Storage Utils', () => {
  const mockSetItem = AsyncStorage.setItem as jest.MockedFunction<
    typeof AsyncStorage.setItem
  >;
  const mockGetItem = AsyncStorage.getItem as jest.MockedFunction<
    typeof AsyncStorage.getItem
  >;

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock console methods to avoid noise in tests
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('saveUserPreferences', () => {
    it('should save user preferences successfully', async () => {
      const preferences = { theme: 'dark', language: 'en' };
      mockSetItem.mockResolvedValue();

      await saveUserPreferences(preferences);

      expect(mockSetItem).toHaveBeenCalledWith(
        '@user_preferences',
        JSON.stringify(preferences)
      );
    });

    it('should handle setItem errors gracefully', async () => {
      const preferences = { theme: 'light' };
      const error = new Error('Storage error');
      mockSetItem.mockRejectedValue(error);

      // Should not throw
      await expect(saveUserPreferences(preferences)).resolves.toBeUndefined();

      expect(console.error).toHaveBeenCalledWith(
        'Failed to save user preferences:',
        error
      );
    });

    it('should handle complex preference objects', async () => {
      const complexPreferences = {
        theme: 'dark',
        notifications: {
          enabled: true,
          frequency: 'daily',
          types: ['sync', 'error'],
        },
        sync: {
          interval: 300000,
          autoSync: false,
        },
        ui: {
          density: 'compact',
          showImages: true,
        },
      };
      mockSetItem.mockResolvedValue();

      await saveUserPreferences(complexPreferences);

      expect(mockSetItem).toHaveBeenCalledWith(
        '@user_preferences',
        JSON.stringify(complexPreferences)
      );
    });

    it('should handle null preferences', async () => {
      mockSetItem.mockResolvedValue();

      await saveUserPreferences(null);

      expect(mockSetItem).toHaveBeenCalledWith(
        '@user_preferences',
        JSON.stringify(null)
      );
    });

    it('should handle undefined preferences', async () => {
      mockSetItem.mockResolvedValue();

      await saveUserPreferences(undefined);

      expect(mockSetItem).toHaveBeenCalledWith(
        '@user_preferences',
        JSON.stringify(undefined)
      );
    });

    it('should handle circular reference objects safely', async () => {
      const circularObject: any = { name: 'test' };
      circularObject.self = circularObject;

      mockSetItem.mockRejectedValue(
        new TypeError('Converting circular structure to JSON')
      );

      await saveUserPreferences(circularObject);

      expect(console.error).toHaveBeenCalledWith(
        'Failed to save user preferences:',
        expect.any(TypeError)
      );
    });
  });

  describe('getUserPreferences', () => {
    it('should retrieve user preferences successfully', async () => {
      const preferences = { theme: 'dark', language: 'en' };
      mockGetItem.mockResolvedValue(JSON.stringify(preferences));

      const result = await getUserPreferences();

      expect(mockGetItem).toHaveBeenCalledWith('@user_preferences');
      expect(result).toEqual(preferences);
    });

    it('should return null when no preferences exist', async () => {
      mockGetItem.mockResolvedValue(null);

      const result = await getUserPreferences();

      expect(result).toBeNull();
    });

    it('should handle getItem errors gracefully', async () => {
      const error = new Error('Storage read error');
      mockGetItem.mockRejectedValue(error);

      const result = await getUserPreferences();

      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalledWith(
        'Failed to fetch user preferences:',
        error
      );
    });

    it('should handle malformed JSON gracefully', async () => {
      mockGetItem.mockResolvedValue('invalid json {');

      const result = await getUserPreferences();

      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalledWith(
        'Failed to fetch user preferences:',
        expect.any(SyntaxError)
      );
    });

    it('should handle empty string as no preferences', async () => {
      mockGetItem.mockResolvedValue('');

      const result = await getUserPreferences();

      expect(result).toBeNull();
    });

    it('should handle valid JSON null value', async () => {
      mockGetItem.mockResolvedValue(JSON.stringify(null));

      const result = await getUserPreferences();

      expect(result).toBeNull();
    });

    it('should handle complex preference objects on retrieval', async () => {
      const complexPreferences = {
        theme: 'dark',
        notifications: {
          enabled: true,
          frequency: 'daily',
          types: ['sync', 'error'],
        },
        sync: {
          interval: 300000,
          autoSync: false,
        },
      };
      mockGetItem.mockResolvedValue(JSON.stringify(complexPreferences));

      const result = await getUserPreferences();

      expect(result).toEqual(complexPreferences);
    });

    it('should handle boolean preferences', async () => {
      mockGetItem.mockResolvedValue(JSON.stringify(false));

      const result = await getUserPreferences();

      expect(result).toBe(false);
    });

    it('should handle number preferences', async () => {
      mockGetItem.mockResolvedValue(JSON.stringify(42));

      const result = await getUserPreferences();

      expect(result).toBe(42);
    });

    it('should handle array preferences', async () => {
      const arrayPreferences = ['theme1', 'theme2', 'theme3'];
      mockGetItem.mockResolvedValue(JSON.stringify(arrayPreferences));

      const result = await getUserPreferences();

      expect(result).toEqual(arrayPreferences);
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    it('should handle AsyncStorage being unavailable', async () => {
      mockSetItem.mockRejectedValue(new Error('AsyncStorage is not available'));

      await saveUserPreferences({ theme: 'dark' });

      expect(console.error).toHaveBeenCalledWith(
        'Failed to save user preferences:',
        expect.any(Error)
      );
    });

    it('should handle storage quota exceeded', async () => {
      mockSetItem.mockRejectedValue(new Error('Storage quota exceeded'));

      await saveUserPreferences({ largeData: 'x'.repeat(10000) });

      expect(console.error).toHaveBeenCalledWith(
        'Failed to save user preferences:',
        expect.any(Error)
      );
    });

    it('should handle storage permission denied', async () => {
      mockGetItem.mockRejectedValue(new Error('Permission denied'));

      const result = await getUserPreferences();

      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalledWith(
        'Failed to fetch user preferences:',
        expect.any(Error)
      );
    });

    it('should handle concurrent access patterns', async () => {
      const preferences1 = { theme: 'dark' };
      const preferences2 = { theme: 'light' };

      mockSetItem.mockResolvedValue();

      // Simulate concurrent saves
      const promises = [
        saveUserPreferences(preferences1),
        saveUserPreferences(preferences2),
      ];

      await Promise.all(promises);

      expect(mockSetItem).toHaveBeenCalledTimes(2);
    });
  });
});
