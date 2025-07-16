import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SimpleText, SimpleButton } from "../../components";
import { ArticleCard } from '../../components/ArticleCard';
import MobdeckLogo from '../../components/MobdeckLogo';
import { theme } from "../../components/theme";
import { MainScreenProps } from '../../navigation/types';
import { RootState } from '../../store';
import {
  loadLocalArticles,
  setFilters,
  setPage,
  syncArticles,
  fetchArticles,
} from '../../store/slices/articlesSlice';
import { selectFilteredArticles } from '../../store/selectors/articlesSelectors';
import { selectIsUserAuthenticated } from '../../store/selectors/authSelectors';
import { Article } from '../../types';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';

const DEBOUNCE_DELAY = 300;

type ArticlesListScreenProps = MainScreenProps<'ArticlesList'>;

export const ArticlesListScreen: React.FC<ArticlesListScreenProps> = ({
  navigation,
}) => {
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();

  const { loading, error, pagination, filters, sync } = useSelector(
    (state: RootState) => state.articles
  );

  const articles = useSelector(selectFilteredArticles);
  const isAuthenticated = useSelector(selectIsUserAuthenticated);
  const { isOnline } = useNetworkStatus();

  const [searchQuery, setSearchQuery] = useState(filters.searchQuery);
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(
    null
  );

  // Debounced search function
  const debouncedSearch = useCallback(
    (query: string) => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      const timer = setTimeout(() => {
        dispatch(setFilters({ searchQuery: query }));
        // Always search local articles first to include offline-saved articles
        dispatch(
          loadLocalArticles({ page: 1, searchQuery: query, forceRefresh: true })
        );
      }, DEBOUNCE_DELAY);

      setDebounceTimer(timer);
    },
    [dispatch, debounceTimer]
  );

  // Handle search input change
  const handleSearchChange = useCallback(
    (text: string) => {
      setSearchQuery(text);
      debouncedSearch(text);
    },
    [debouncedSearch]
  );

  // Clear search
  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    dispatch(setFilters({ searchQuery: '' }));
    // Always load local articles to include offline-saved articles
    dispatch(loadLocalArticles({ page: 1, forceRefresh: true }));
  }, [dispatch]);

  // Initial load - wait for authentication to complete
  useEffect(() => {
    console.log('[ArticlesListScreen] useEffect triggered:', {
      isAuthenticated,
      articlesLength: articles.length,
      willFetch: isAuthenticated && articles.length === 0,
    });

    if (isAuthenticated && articles.length === 0) {
      // Add a small delay to ensure API service is configured
      console.log('[ArticlesListScreen] Scheduling article fetch after delay');
      const timer = setTimeout(() => {
        console.log('[ArticlesListScreen] Loading articles...', { isOnline });
        // Always load local articles first to show offline-saved articles immediately
        dispatch(loadLocalArticles({ page: 1 }));
      }, 100);

      return () => clearTimeout(timer);
    }
    return undefined;
  }, [dispatch, articles.length, isAuthenticated, isOnline]);

  // Pull to refresh
  const handleRefresh = useCallback(async () => {
    console.log('[ArticlesListScreen] Pull to refresh triggered');

    // Always reload local articles first for immediate feedback
    dispatch(loadLocalArticles({ page: 1, forceRefresh: true }));

    // Try to sync with server if online and authenticated
    if (isOnline && isAuthenticated) {
      try {
        console.log('[ArticlesListScreen] Syncing with server...');
        const syncResult = await dispatch(syncArticles({ fullSync: false }));
        console.log('[ArticlesListScreen] Sync result:', syncResult);

        // Try to fetch fresh articles from server
        try {
          console.log(
            '[ArticlesListScreen] Fetching fresh articles from server'
          );
          const fetchResult = await dispatch(
            fetchArticles({
              page: 1,
              forceRefresh: true,
              fetchFullContent: false,
            })
          );
          console.log('[ArticlesListScreen] Fetch result:', fetchResult);
        } catch (fetchError) {
          console.warn(
            '[ArticlesListScreen] Fetch failed, continuing with sync:',
            fetchError
          );
        }

        // Reload local articles after sync to show changes
        dispatch(loadLocalArticles({ page: 1, forceRefresh: true }));
      } catch (syncError) {
        console.warn(
          '[ArticlesListScreen] Sync failed, showing local articles only:',
          syncError
        );
      }
    } else {
      console.log(
        '[ArticlesListScreen] Offline or not authenticated, showing local articles only'
      );
    }
  }, [dispatch, isOnline, isAuthenticated]);

  // Load more articles (pagination)
  const handleLoadMore = useCallback(() => {
    if (pagination.hasMore && !loading.fetch) {
      dispatch(setPage(pagination.page + 1));
      const loadParams = {
        page: pagination.page + 1,
        searchQuery: filters.searchQuery,
        filters: {
          searchQuery: filters.searchQuery,
          isArchived: filters.isArchived,
          isFavorite: filters.isFavorite,
          isRead: filters.isRead,
          tags: filters.tags,
        },
      };

      // Always load from local to include offline-saved articles
      dispatch(loadLocalArticles(loadParams));
    }
  }, [dispatch, pagination.hasMore, pagination.page, loading.fetch, filters]);

  // Handle article press
  const handleArticlePress = useCallback(
    (article: Article) => {
      navigation.navigate('ArticleDetail', {
        articleId: article.id,
        title: article.title,
      });
    },
    [navigation]
  );

  // Filter options
  const filterOptions = useMemo(
    () => [
      {
        key: 'all',
        label: 'All',
        active:
          filters.isRead === undefined &&
          filters.isArchived === undefined &&
          filters.isFavorite === undefined,
      },
      { key: 'unread', label: 'Unread', active: filters.isRead === false },
      { key: 'read', label: 'Read', active: filters.isRead === true },
      {
        key: 'favorites',
        label: 'Favorites',
        active: filters.isFavorite === true,
      },
      {
        key: 'archived',
        label: 'Archived',
        active: filters.isArchived === true,
      },
    ],
    [filters]
  );

  // Handle filter selection
  const handleFilterPress = useCallback(
    (filterKey: string) => {
      let newFilters = {};

      switch (filterKey) {
        case 'all':
          newFilters = {
            isRead: undefined,
            isArchived: undefined,
            isFavorite: undefined,
          };
          break;
        case 'unread':
          newFilters = {
            isRead: false,
            isArchived: undefined,
            isFavorite: undefined,
          };
          break;
        case 'read':
          newFilters = {
            isRead: true,
            isArchived: undefined,
            isFavorite: undefined,
          };
          break;
        case 'favorites':
          newFilters = {
            isFavorite: true,
            isRead: undefined,
            isArchived: undefined,
          };
          break;
        case 'archived':
          newFilters = {
            isArchived: true,
            isRead: undefined,
            isFavorite: undefined,
          };
          break;
      }

      dispatch(setFilters(newFilters));
      const loadParams = {
        page: 1,
        filters: {
          ...filters,
          ...newFilters,
        },
        forceRefresh: true,
      };

      // Always load from local to include offline-saved articles
      dispatch(loadLocalArticles(loadParams));
    },
    [dispatch, filters]
  );

  // Render article item
  const renderArticleItem = useCallback(
    ({ item }: { item: Article }) => (
      <ArticleCard article={item} onPress={() => handleArticlePress(item)} />
    ),
    [handleArticlePress]
  );

  // Render empty state
  const renderEmptyState = useCallback(() => {
    const getEmptyStateContent = () => {
      if (searchQuery) {
        return {
          title: 'No articles found',
          message: `No articles match "${searchQuery}"`,
          showClearButton: true,
        };
      }

      // Check which filter is active
      const { isRead, isFavorite, isArchived } = filters;

      if (isRead === false) {
        return {
          title: 'No unread articles',
          message: 'All your articles have been read',
          showClearButton: false,
        };
      }

      if (isRead === true) {
        return {
          title: 'No read articles',
          message: "You haven't read any articles yet",
          showClearButton: false,
        };
      }

      if (isFavorite === true) {
        return {
          title: 'No favorite articles',
          message: "You haven't marked any articles as favorites yet",
          showClearButton: false,
        };
      }

      if (isArchived === true) {
        return {
          title: 'No archived articles',
          message: "You haven't archived any articles yet",
          showClearButton: false,
        };
      }

      // Default state (All filter)
      return {
        title: 'No articles yet',
        message: 'Pull down to sync your articles from Readeck',
        showClearButton: false,
      };
    };

    const { title, message, showClearButton } = getEmptyStateContent();

    return (
      <View style={styles.emptyContainer}>
        <SimpleText variant='h4' style={styles.emptyTitle}>
          {title}
        </SimpleText>
        <SimpleText variant='body1' style={styles.emptyMessage}>
          {message}
        </SimpleText>
        {showClearButton && (
          <SimpleButton
            variant='outline'
            onPress={handleClearSearch}
            style={styles.clearButton}
          >
            Clear Search
          </SimpleButton>
        )}
      </View>
    );
  }, [searchQuery, filters, handleClearSearch]);

  // Render footer with loading indicator for pagination
  const renderFooter = useCallback(() => {
    if (!loading.fetch || pagination.page === 1) return null;

    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size='small' color={theme.colors.primary[500]} />
        <SimpleText variant='caption' style={styles.loadingText}>
          Loading more articles...
        </SimpleText>
      </View>
    );
  }, [loading.fetch, pagination.page]);

  // Render filter chips
  const renderFilters = useCallback(
    () => (
      <View style={styles.filtersContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={filterOptions}
          keyExtractor={item => item.key}
          contentContainerStyle={styles.filtersContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.filterChip,
                item.active && styles.filterChipActive,
              ]}
              onPress={() => handleFilterPress(item.key)}
            >
              <SimpleText
                variant='body2'
                style={[
                  styles.filterChipText,
                  item.active && styles.filterChipTextActive,
                ]}
              >
                {item.label}
              </SimpleText>
            </TouchableOpacity>
          )}
        />
      </View>
    ),
    [filterOptions, handleFilterPress]
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <MobdeckLogo
            size={24}
            color={theme.colors.accent[500]} // Tiffany Blue for contrast on green
          />
          <SimpleText variant='h3' style={styles.headerTitle}>
            Mobdeck
          </SimpleText>
        </View>
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => navigation.navigate('Settings')}
        >
          <SimpleText style={styles.settingsIcon}>⚙️</SimpleText>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder='Search articles...'
          value={searchQuery}
          onChangeText={handleSearchChange}
          placeholderTextColor={theme.colors.neutral[500]}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            style={styles.clearSearchButton}
            onPress={handleClearSearch}
          >
            <SimpleText style={styles.clearSearchIcon}>✕</SimpleText>
          </TouchableOpacity>
        )}
      </View>

      {/* Filters */}
      {renderFilters()}

      {/* Error State */}
      {error.fetch && (
        <View style={styles.errorContainer}>
          <SimpleText variant='body1' style={styles.errorText}>
            {error.fetch}
          </SimpleText>
          <View style={styles.errorButtonsContainer}>
            {error.fetch.includes('server settings') ||
            error.fetch.includes('Authentication') ||
            error.fetch.includes('Server not found') ? (
              <SimpleButton
                variant='primary'
                size='sm'
                onPress={() => navigation.navigate('Settings')}
                style={styles.settingsButton}
              >
                Settings
              </SimpleButton>
            ) : null}
            <SimpleButton
              variant='outline'
              size='sm'
              onPress={() => {
                // Always load from local to include offline-saved articles
                dispatch(loadLocalArticles({ page: 1, forceRefresh: true }));
              }}
              style={styles.retryButton}
            >
              Retry
            </SimpleButton>
          </View>
        </View>
      )}

      {/* Articles List */}
      <FlatList
        data={articles}
        renderItem={renderArticleItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={sync.isSyncing}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary[500]]}
            tintColor={theme.colors.primary[500]}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.1}
        ListEmptyComponent={!loading.fetch ? renderEmptyState : null}
        ListFooterComponent={renderFooter}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={10}
        initialNumToRender={10}
      />

      {/* Loading overlay for initial load */}
      {loading.fetch && articles.length === 0 && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size='large' color={theme.colors.primary[500]} />
          <SimpleText variant='body1' style={styles.loadingText}>
            Loading articles...
          </SimpleText>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.neutral[100],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[3],
    backgroundColor: theme.colors.success[700], // Castleton Green
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.success[800],
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    color: theme.colors.neutral[50], // White text for contrast on green background
    marginLeft: theme.spacing[2],
  },
  settingsButton: {
    padding: theme.spacing[2],
  },
  settingsIcon: {
    fontSize: 20,
    color: theme.colors.neutral[50], // White color for contrast on green background
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: theme.spacing[4],
    marginVertical: theme.spacing[3],
    backgroundColor: theme.colors.neutral[50],
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing[3],
    ...theme.shadows.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: theme.spacing[3],
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.neutral[900],
  },
  clearSearchButton: {
    padding: theme.spacing[1],
  },
  clearSearchIcon: {
    fontSize: 16,
    color: theme.colors.neutral[500],
  },
  filtersContainer: {
    backgroundColor: theme.colors.neutral[50],
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.neutral[200],
  },
  filtersContent: {
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[2],
  },
  filterChip: {
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[2],
    marginRight: theme.spacing[2],
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.neutral[200],
  },
  filterChipActive: {
    backgroundColor: theme.colors.primary[500],
  },
  filterChipText: {
    color: theme.colors.neutral[700],
  },
  filterChipTextActive: {
    color: theme.colors.neutral[50],
  },
  errorContainer: {
    alignItems: 'center',
    padding: theme.spacing[4],
    backgroundColor: theme.colors.error[50],
    marginHorizontal: theme.spacing[4],
    marginVertical: theme.spacing[2],
    borderRadius: theme.borderRadius.md,
  },
  errorText: {
    color: theme.colors.error[700],
    marginBottom: theme.spacing[2],
    textAlign: 'center',
  },
  errorButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: theme.spacing[2],
  },
  retryButton: {
    minWidth: 80,
  },
  listContainer: {
    flexGrow: 1,
    paddingBottom: theme.spacing[4],
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing[6],
  },
  emptyTitle: {
    marginBottom: theme.spacing[2],
    textAlign: 'center',
  },
  emptyMessage: {
    textAlign: 'center',
    color: theme.colors.neutral[600],
    marginBottom: theme.spacing[4],
  },
  clearButton: {
    marginTop: theme.spacing[2],
  },
  footerLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing[4],
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  loadingText: {
    marginTop: theme.spacing[2],
    marginLeft: theme.spacing[2],
    color: theme.colors.neutral[600],
  },
});

export default ArticlesListScreen;
