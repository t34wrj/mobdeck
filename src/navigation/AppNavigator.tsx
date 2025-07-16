import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import {
  selectIsUserAuthenticated,
  selectAuthLoading,
} from '../store/selectors/authSelectors';
import { initializeAuth } from '../store/slices/authSlice';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import { View, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { theme } from '../components/theme';
import { useShareIntent } from '../hooks/useShareIntent';
import { ShareService } from '../services/ShareService';
import {
  fetchArticles,
  loadLocalArticles,
} from '../store/slices/articlesSlice';
import { AppDispatch } from '../store';
import NetInfo from '@react-native-community/netinfo';
import { ConnectivityIndicator } from '../components/ConnectivityIndicator';

const AppNavigator: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const isAuthenticated = useSelector(selectIsUserAuthenticated);
  const authLoading = useSelector(selectAuthLoading);
  const { sharedData, clearSharedData } = useShareIntent();
  const [networkConnected, setNetworkConnected] = useState(true);

  useEffect(() => {
    dispatch(initializeAuth());
  }, [dispatch]);

  // Monitor network status
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      if (__DEV__) {
        console.log('AppNavigator: Network state changed:', state);
      }
      setNetworkConnected(state.isConnected ?? false);
    });

    return unsubscribe;
  }, []);

  // Handle shared data when user is authenticated
  useEffect(() => {
    if (__DEV__) {
      console.log('AppNavigator: Share effect triggered', {
        isAuthenticated,
        hasSharedData: !!sharedData,
        sharedDataText: `${sharedData?.text?.substring(0, 100)}...`, // Show first 100 chars
      });
    }

    if (isAuthenticated && sharedData) {
      if (__DEV__) {
        console.log('AppNavigator: Processing shared data...', sharedData);
      }
      const url = ShareService.extractUrl(sharedData.text);
      if (__DEV__) {
        console.log('AppNavigator: Extracted URL:', url);
      }

      if (url) {
        if (__DEV__) {
          console.log('AppNavigator: Showing share dialog for URL:', url);
        }
        // Add small delay to ensure dialog shows after app is fully loaded
        setTimeout(() => {
          Alert.alert(
            'Share Detected',
            `Would you like to add this URL to your articles?\n\n${url}`,
            [
              {
                text: 'Cancel',
                onPress: () => {
                  if (__DEV__) {
                    console.log('AppNavigator: User cancelled share');
                  }
                  clearSharedData();
                },
                style: 'cancel',
              },
              {
                text: 'Add Article',
                onPress: async () => {
                  try {
                    const articleData =
                      ShareService.formatForArticle(sharedData);
                    if (__DEV__) {
                      console.log(
                        'AppNavigator: Formatted article data:',
                        articleData
                      );
                    }

                    if (articleData) {
                      if (__DEV__) {
                        console.log(
                          'AppNavigator: Saving article locally first (offline-first approach)'
                        );
                      }

                      // Always save locally first
                      const db = DatabaseService;
                      await db.initialize();

                      // Generate a local ID for the article
                      const localId = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

                      // Create article in local database with correct SQLite field names and types
                      const createResult = await db.createArticle({
                        id: localId,
                        title: articleData.title || 'Shared Article',
                        url: articleData.url,
                        summary: '',
                        content: '',
                        image_url: '',
                        read_time: 0,
                        source_url: articleData.url,
                        is_archived: 0, // SQLite boolean as integer
                        is_favorite: 0, // SQLite boolean as integer
                        is_read: 0, // SQLite boolean as integer
                        is_modified: 1, // Mark as modified for sync (SQLite boolean as integer)
                        synced_at: null, // Not synced yet
                        deleted_at: null, // Not deleted
                      });

                      if (createResult.success) {
                        if (__DEV__) {
                          console.log(
                            'AppNavigator: Article saved locally:',
                            localId
                          );
                        }

                        // Add to sync queue for background sync
                        await db.createSyncMetadata({
                          entity_type: 'article',
                          entity_id: localId,
                          operation: 'create',
                          local_timestamp: Date.now(),
                          server_timestamp: null,
                          sync_status: 'pending',
                          conflict_resolution: null,
                          retry_count: 0,
                          error_message: JSON.stringify({
                            url: articleData.url,
                            title: articleData.title,
                          }),
                        });

                        // Refresh the articles list to show the new article
                        if (__DEV__) {
                          console.log(
                            'AppNavigator: Refreshing articles list to show new article'
                          );
                        }
                        if (networkConnected) {
                          dispatch(
                            fetchArticles({ page: 1, forceRefresh: true })
                          );

                          // If online, try to create the article on the server and fetch content
                          if (__DEV__) {
                            console.log(
                              'AppNavigator: Attempting to sync article to server and fetch content...'
                            );
                          }
                          try {
                            const { articlesApiService } = await import(
                              '../services/ArticlesApiService'
                            );
                            const serverArticle =
                              await articlesApiService.createArticle({
                                title: articleData.title || 'Shared Article',
                                url: articleData.url,
                              });

                            // Update local article with server ID and content
                            if (serverArticle) {
                              if (__DEV__) {
                                console.log(
                                  'AppNavigator: Article created on server:',
                                  serverArticle.id
                                );
                              }
                              // Note: Content fetching will be handled by sync service
                            }
                          } catch (syncError) {
                            if (__DEV__) {
                              console.log(
                                'AppNavigator: Server sync failed, will retry later:',
                                syncError
                              );
                            }
                            // This is okay - sync service will handle it later
                          }
                        } else {
                          dispatch(
                            loadLocalArticles({ page: 1, forceRefresh: true })
                          );
                        }

                        Alert.alert(
                          'Success',
                          'Article saved! Content will be downloaded when online.'
                        );

                        // Note: Sync will happen automatically in background via sync service
                        if (__DEV__) {
                          console.log(
                            'AppNavigator: Article saved locally, background sync will handle server sync when online'
                          );
                        }
                      } else {
                        console.error(
                          'AppNavigator: Failed to save article locally:',
                          createResult.error
                        );
                        Alert.alert(
                          'Error',
                          'Failed to save article. Please try again.'
                        );
                      }
                    }
                  } catch (error) {
                    console.error(
                      'AppNavigator: Error creating article from share:',
                      error
                    );

                    // Fallback to offline queue
                    const queueId =
                      await ShareService.queueSharedUrl(sharedData);
                    if (queueId) {
                      Alert.alert('Success', 'Article saved!');
                    } else {
                      Alert.alert(
                        'Error',
                        'Failed to add article. Please try again.'
                      );
                    }
                  } finally {
                    if (__DEV__) {
                      console.log('AppNavigator: Clearing shared data');
                    }
                    clearSharedData();
                  }
                },
              },
            ]
          );
        }, 500); // 500ms delay to ensure app is fully loaded
      } else {
        if (__DEV__) {
          console.log(
            'AppNavigator: No valid URL found in shared data, clearing'
          );
        }
        // Clear invalid share data
        clearSharedData();
      }
    }
  }, [
    isAuthenticated,
    sharedData,
    clearSharedData,
    dispatch,
    networkConnected,
  ]);

  if (authLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size='large' color={theme.colors.primary[500]} />
      </View>
    );
  }

  return (
    <>
      <ConnectivityIndicator />
      <NavigationContainer>
        {isAuthenticated ? <MainNavigator /> : <AuthNavigator />}
      </NavigationContainer>
    </>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.neutral[50],
  },
});

export default AppNavigator;
