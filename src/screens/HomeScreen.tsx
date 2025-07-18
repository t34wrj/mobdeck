import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { useSelector } from 'react-redux';
import { useAppDispatch, RootState } from '../store';
import { SimpleText as Text } from '../components';
import {
  fetchArticles,
  selectAllArticles,
  setFilters,
} from '../store/slices/articlesSlice';
import { startSyncOperation } from '../store/thunks/syncThunks';
import ArticleCard from '../components/ArticleCard';
import SearchBar from '../components/SearchBar';
import { MainScreenProps } from '../navigation/types';
// RootState and AppDispatch are imported above
import { theme } from '../components/theme';
import { Article } from '../types';
import { useAppInitialization } from '../hooks/useAppInitialization';

const HomeScreen: React.FC<MainScreenProps<'ArticlesList'>> = ({
  navigation: _navigation,
  route: _route,
}) => {
  const dispatch = useAppDispatch();
  const articles = useSelector(selectAllArticles);
  const { loading, error } = useSelector((state: RootState) => ({
    loading: state.articles.loading.fetch,
    error: state.articles.error.fetch,
  }));
  const isAuthenticated = useSelector(
    (state: RootState) => state.auth.isAuthenticated
  );
  const { isOnline } = useSelector((state: RootState) => state.sync);
  const [searchQuery, setSearchQuery] = useState('');
  const { isInitialized, isInitializing } = useAppInitialization();

  useEffect(() => {
    console.log('[HomeScreen] State check:', {
      isAuthenticated,
      isInitialized,
      isInitializing,
      articlesCount: articles.length,
      isOnline,
    });

    // Only fetch articles if authenticated and initialization is complete
    if (isAuthenticated && isInitialized) {
      // Only fetch from API if we don't have any articles cached in store after initialization
      if (articles.length === 0) {
        console.log('[HomeScreen] No articles in store after initialization, fetching from API...');
        dispatch(fetchArticles({}));
      } else {
        console.log(`[HomeScreen] Found ${articles.length} articles in store after initialization, skipping API fetch`);
      }

      // Trigger sync when main page loads after authentication (only if online)
      if (isOnline) {
        dispatch(
          startSyncOperation({
            syncOptions: {
              fullTextSync: true,
              downloadImages: true,
            },
            forceFull: false,
          })
        ).catch((syncError: any) => {
          console.error('Auto-sync failed on home screen load:', syncError);
        });
      }
    } else {
      console.log('[HomeScreen] Waiting for authentication and initialization to complete...');
    }
  }, [dispatch, isAuthenticated, isInitialized, isInitializing, isOnline, articles.length]);

  const renderItem = ({ item }: { item: Article }) => (
    <ArticleCard
      article={item}
      onPress={() => {
        // TODO: Navigate to article detail screen
        console.log('Article pressed:', item.id);
      }}
    />
  );

  if (!isAuthenticated) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>
          Please log in to view your articles
        </Text>
      </View>
    );
  }

  if (loading || isInitializing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size='large' color={theme.colors.primary[500]} />
        <Text style={styles.loadingText}>
          {isInitializing ? 'Initializing app...' : 'Loading articles...'}
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  const handleSearch = () => {
    dispatch(setFilters({ searchQuery }));
    dispatch(fetchArticles({ searchQuery })).catch((searchError: any) => {
      console.error('Search failed:', searchError);
    });
  };

  return (
    <View style={styles.container}>
      <SearchBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={handleSearch}
      />
      <FlatList
        data={articles}
        renderItem={renderItem}
        keyExtractor={(item: Article) => item.id.toString()}
        ListEmptyComponent={
          <View style={styles.centerContainer}>
            <Text style={styles.emptyText}>
              {isInitialized ? 'No articles yet' : 'Loading articles...'}
            </Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: theme.colors.neutral[50],
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    backgroundColor: theme.colors.neutral[50],
  },
  errorText: {
    fontSize: 16,
    color: theme.colors.error[500],
    textAlign: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: theme.colors.neutral[600],
    textAlign: 'center',
    marginTop: 12,
  },
  emptyText: {
    fontSize: 16,
    color: theme.colors.neutral[600],
    textAlign: 'center',
  },
});

export default HomeScreen;
