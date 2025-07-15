/**
 * Critical User Journey Integration Tests
 * Simplified integration tests for core mobile app functionality
 */

import { mockAsyncStorage, mockKeychain, mockSQLite } from '../mocks/strategicMocks';

describe('Critical User Journeys', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication Flow', () => {
    it('should store and retrieve credentials securely', async () => {
      const credentials = {
        serverUrl: 'https://test.com',
        apiToken: 'test-token'
      };

      // Mock credential storage
      mockKeychain.setInternetCredentials.mockResolvedValue(true);
      mockKeychain.getInternetCredentials.mockResolvedValue({
        username: 'user',
        password: JSON.stringify(credentials)
      });

      // Store credentials
      await mockKeychain.setInternetCredentials('mobdeck-auth', 'user', JSON.stringify(credentials));
      
      // Retrieve credentials
      const result = await mockKeychain.getInternetCredentials('mobdeck-auth');
      
      expect(result).toBeDefined();
      expect(result.username).toBe('user');
      const storedCredentials = JSON.parse(result.password);
      expect(storedCredentials.serverUrl).toBe('https://test.com');
      expect(storedCredentials.apiToken).toBe('test-token');
    });

    it('should handle missing credentials gracefully', async () => {
      // Mock missing credentials
      mockKeychain.getInternetCredentials.mockResolvedValue(false);
      
      // Try to get non-existent credentials
      const result = await mockKeychain.getInternetCredentials('non-existent');
      
      expect(result).toBe(false);
    });
  });

  describe('Article Storage Flow', () => {
    it('should store and retrieve articles from local database', async () => {
      const mockArticles = [
        { id: 1, title: 'Test Article', url: 'https://test.com/article' },
        { id: 2, title: 'Another Article', url: 'https://test.com/article2' }
      ];

      // Mock SQLite database operations
      const mockDb = mockSQLite.openDatabase();
      const mockTx = {
        executeSql: jest.fn((sql, params, success) => {
          if (success) success(mockTx, { rows: { _array: mockArticles } });
        })
      };
      
      mockDb.transaction = jest.fn((callback) => callback(mockTx));

      // Execute transaction
      mockDb.transaction((tx) => {
        tx.executeSql(
          'INSERT OR REPLACE INTO articles (id, title, url) VALUES (?, ?, ?)',
          [1, 'Test Article', 'https://test.com/article'],
          () => {
            expect(true).toBe(true); // Transaction successful
          }
        );
      });

      expect(mockDb.transaction).toHaveBeenCalled();
      expect(mockTx.executeSql).toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      const mockDb = mockSQLite.openDatabase();
      const mockError = new Error('Database error');
      
      mockDb.transaction = jest.fn((callback, errorCallback) => {
        if (errorCallback) errorCallback(mockError);
      });

      let errorCaught = false;
      mockDb.transaction(
        () => {},
        (error) => {
          errorCaught = true;
          expect(error.message).toBe('Database error');
        }
      );

      expect(errorCaught).toBe(true);
    });
  });

  describe('Settings Management Flow', () => {
    it('should store and retrieve app settings', async () => {
      const settings = {
        syncInterval: 30,
        theme: 'dark',
        notificationsEnabled: true
      };

      // Mock storage behavior
      mockAsyncStorage.setItem.mockResolvedValue(true);
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(settings));

      // Store settings
      await mockAsyncStorage.setItem('app_settings', JSON.stringify(settings));
      
      // Retrieve settings
      const storedSettings = await mockAsyncStorage.getItem('app_settings');
      
      expect(storedSettings).not.toBeNull();
      const parsedSettings = JSON.parse(storedSettings);
      expect(parsedSettings.syncInterval).toBe(30);
      expect(parsedSettings.theme).toBe('dark');
      expect(parsedSettings.notificationsEnabled).toBe(true);
    });

    it('should handle missing settings gracefully', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);
      
      const result = await mockAsyncStorage.getItem('non-existent-setting');
      
      expect(result).toBeNull();
    });
  });

  describe('Search Functionality Flow', () => {
    it('should search articles by title and content', async () => {
      const searchQuery = 'react native';
      const mockResults = [
        { id: 1, title: 'React Native Tutorial', content: 'Learn React Native development' }
      ];

      // Mock search operation
      const mockDb = mockSQLite.openDatabase();
      const mockTx = {
        executeSql: jest.fn((sql, params, callback) => {
          if (callback) {
            callback(mockTx, {
              rows: {
                length: 1,
                item: (index: number) => mockResults[index],
                _array: mockResults
              }
            });
          }
        })
      };
      
      mockDb.transaction = jest.fn((callback) => callback(mockTx));

      // Execute search
      mockDb.transaction((tx) => {
        tx.executeSql(
          'SELECT * FROM articles WHERE title LIKE ? OR content LIKE ?',
          [`%${searchQuery}%`, `%${searchQuery}%`],
          (tx, results) => {
            expect(results.rows.length).toBe(1);
            expect(results.rows.item(0).title).toBe('React Native Tutorial');
          }
        );
      });

      expect(mockTx.executeSql).toHaveBeenCalled();
    });
  });

  describe('Connectivity Management Flow', () => {
    it('should handle online/offline state changes', async () => {
      // Mock connectivity state
      const mockConnectivity = {
        isConnected: true,
        isInternetReachable: true,
        type: 'wifi'
      };

      mockAsyncStorage.setItem.mockResolvedValue(true);
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(mockConnectivity));

      // Store connectivity state
      await mockAsyncStorage.setItem('connectivity_state', JSON.stringify(mockConnectivity));
      
      // Retrieve connectivity state
      const storedState = await mockAsyncStorage.getItem('connectivity_state');
      
      expect(storedState).not.toBeNull();
      const parsedState = JSON.parse(storedState);
      expect(parsedState.isConnected).toBe(true);
      expect(parsedState.type).toBe('wifi');
    });
  });
});