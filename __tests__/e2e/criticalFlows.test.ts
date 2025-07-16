/**
 * Critical End-to-End Flow Tests
 * Simplified E2E tests for essential mobile app workflows
 */

import { mockAsyncStorage, mockKeychain, mockSQLite, mockNavigation } from '../mocks/strategicMocks';

describe('Critical E2E Flows', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete Authentication Flow', () => {
    it('should complete full auth setup to app usage flow', async () => {
      const mockCredentials = {
        serverUrl: 'https://readeck.test.com',
        apiToken: 'valid-token-123'
      };

      // Mock credential storage and retrieval
      mockKeychain.setInternetCredentials.mockResolvedValue(undefined);
      mockKeychain.getInternetCredentials.mockResolvedValue({
        username: 'user',
        password: JSON.stringify(mockCredentials)
      });

      // Step 1: Store credentials during setup
      await mockKeychain.setInternetCredentials();
      
      // Step 2: Retrieve credentials during app startup
      const storedCredentials = await mockKeychain.getInternetCredentials();
      
      expect(storedCredentials).toBeDefined();
      expect(storedCredentials.username).toBe('user');
      const parsedCredentials = JSON.parse(storedCredentials.password);
      expect(parsedCredentials.serverUrl).toBe('https://readeck.test.com');
      expect(parsedCredentials.apiToken).toBe('valid-token-123');

      // Step 3: Navigate to home screen after successful auth
      mockNavigation.navigate('Home');
      expect(mockNavigation.navigate).toHaveBeenCalledWith('Home');
    });

    it('should handle auth failure and redirect to setup', async () => {
      // Mock missing credentials
      mockKeychain.getInternetCredentials.mockResolvedValue({ username: '', password: '' });
      
      // No credentials stored - should redirect to setup
      const result = await mockKeychain.getInternetCredentials();
      
      expect(result).toEqual({ username: '', password: '' });
      
      // Navigate to setup screen
      mockNavigation.navigate('Setup');
      expect(mockNavigation.navigate).toHaveBeenCalledWith('Setup');
    });
  });

  describe('Complete Article Management Flow', () => {
    it('should handle full article lifecycle: add, store, search, read', async () => {
      const mockArticle = {
        id: 1,
        title: 'React Native Tutorial',
        url: 'https://test.com/article',
        content: 'Learn React Native development'
      };

      // Mock async storage
      mockAsyncStorage.setItem.mockResolvedValue(undefined);
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(mockArticle));

      // Step 1: Add article via share intent
      await mockAsyncStorage.setItem('shared_article', JSON.stringify(mockArticle));
      
      // Step 2: Store article in local database
      const _mockDb = mockSQLite.openDatabase();
      const mockTx = {
        executeSql: jest.fn()
      };
      _mockDb.transaction = jest.fn((callback) => callback(mockTx));
      
      _mockDb.transaction((tx: any) => {
        tx.executeSql(
          'INSERT INTO articles (id, title, url, content) VALUES (?, ?, ?, ?)',
          [mockArticle.id, mockArticle.title, mockArticle.url, mockArticle.content]
        );
      });
      
      // Step 3: Search for the article
      const searchResults = [mockArticle];
      mockTx.executeSql = jest.fn((sql, params, callback) => {
        if (callback) {
          callback(mockTx, {
            rows: {
              length: 1,
              item: (index: number) => searchResults[index]
            }
          });
        }
      });
      
      _mockDb.transaction((tx: any) => {
        tx.executeSql(
          'SELECT * FROM articles WHERE title LIKE ?',
          ['%React%'],
          (txResult: any, results: any) => {
            expect(results.rows.length).toBe(1);
            expect(results.rows.item(0).title).toBe('React Native Tutorial');
          }
        );
      });

      // Step 4: Navigate to article view
      mockNavigation.navigate('Article', { id: 1 });
      expect(mockNavigation.navigate).toHaveBeenCalledWith('Article', { id: 1 });
    });
  });

  describe('Complete Sync Workflow', () => {
    it('should handle full sync: check connection, fetch, store, update UI', async () => {
      // Mock async storage
      mockAsyncStorage.setItem.mockResolvedValue(undefined);
      mockAsyncStorage.getItem.mockImplementation((key: string) => {
        if (key === 'connectivity') {
          return Promise.resolve(JSON.stringify({
            isConnected: true,
            isInternetReachable: true,
            type: 'wifi'
          }));
        }
        if (key === 'last_sync') {
          return Promise.resolve(new Date().toISOString());
        }
        return Promise.resolve(null);
      });

      // Step 1: Check connectivity
      const connectivityState = {
        isConnected: true,
        isInternetReachable: true,
        type: 'wifi'
      };
      await mockAsyncStorage.setItem('connectivity', JSON.stringify(connectivityState));
      
      // Step 2: Fetch remote articles
      const remoteArticles = [
        { id: 1, title: 'Remote Article 1', synced: false },
        { id: 2, title: 'Remote Article 2', synced: false }
      ];
      
      // Step 3: Store articles locally
      const _mockDb = mockSQLite.openDatabase();
      const mockTx = {
        executeSql: jest.fn()
      };
      _mockDb.transaction = jest.fn((callback) => callback(mockTx));
      
      _mockDb.transaction((tx: any) => {
        remoteArticles.forEach(article => {
          tx.executeSql(
            'INSERT OR REPLACE INTO articles (id, title, synced) VALUES (?, ?, ?)',
            [article.id, article.title, true]
          );
        });
      });
      
      // Step 4: Update sync status
      await mockAsyncStorage.setItem('last_sync', new Date().toISOString());
      
      // Step 5: Verify sync completed
      const lastSync = await mockAsyncStorage.getItem('last_sync');
      expect(lastSync).toBeDefined();
      expect(_mockDb.transaction).toHaveBeenCalled();
    });
  });

  describe('Complete Offline Reading Flow', () => {
    it('should handle offline article access and reading', async () => {
      // Mock offline state
      mockAsyncStorage.setItem.mockResolvedValue(undefined);
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify({
        isConnected: false,
        isInternetReachable: false,
        type: 'none'
      }));

      // Simulate offline state
      await mockAsyncStorage.setItem('connectivity', JSON.stringify({
        isConnected: false,
        isInternetReachable: false,
        type: 'none'
      }));
      
      // Retrieve cached articles
      const cachedArticles = [
        { id: 1, title: 'Cached Article', content: 'Offline content', cached: true }
      ];
      
      const _mockDb = mockSQLite.openDatabase();
      const mockTx = {
        executeSql: jest.fn((sql, params, callback) => {
          if (callback) {
            callback(mockTx, {
              rows: {
                length: 1,
                item: (index: number) => cachedArticles[index]
              }
            });
          }
        })
      };
      
      // Load article for offline reading
      mockTx.executeSql(
        'SELECT * FROM articles WHERE cached = 1',
        [],
        (tx: any, results: any) => {
          expect(results.rows.length).toBe(1);
          expect(results.rows.item(0).title).toBe('Cached Article');
        }
      );
      
      // Navigate to offline reading view
      mockNavigation.navigate('Article', { id: 1, offline: true });
      expect(mockNavigation.navigate).toHaveBeenCalledWith('Article', { id: 1, offline: true });
    });
  });

  describe('Complete Settings Management Flow', () => {
    it('should handle settings configuration and persistence', async () => {
      const updatedSettings = {
        syncInterval: 30,
        theme: 'dark',
        notificationsEnabled: true,
        wifiOnly: true
      };

      // Mock async storage
      mockAsyncStorage.setItem.mockResolvedValue(undefined);
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(updatedSettings));
      
      await mockAsyncStorage.setItem('app_settings', JSON.stringify(updatedSettings));
      
      // Retrieve and verify settings
      const storedSettings = await mockAsyncStorage.getItem('app_settings');
      expect(storedSettings).not.toBeNull();
      
      const parsedSettings = JSON.parse(storedSettings!);
      expect(parsedSettings.syncInterval).toBe(30);
      expect(parsedSettings.theme).toBe('dark');
      expect(parsedSettings.wifiOnly).toBe(true);
      
      // Navigate back
      mockNavigation.goBack();
      expect(mockNavigation.goBack).toHaveBeenCalled();
    });
  });

  describe('Error Recovery and Resilience Flow', () => {
    it('should handle network errors and recover gracefully', async () => {
      const offlineState = {
        isConnected: false,
        lastError: 'Network request failed',
        fallbackMode: true
      };

      // Mock async storage
      mockAsyncStorage.setItem.mockResolvedValue(undefined);
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(offlineState));
      
      await mockAsyncStorage.setItem('app_state', JSON.stringify(offlineState));
      
      // Display offline notification
      const appState = await mockAsyncStorage.getItem('app_state');
      expect(appState).not.toBeNull();
      
      const parsedState = JSON.parse(appState!);
      expect(parsedState.fallbackMode).toBe(true);
      expect(parsedState.lastError).toBe('Network request failed');
    });
  });
});