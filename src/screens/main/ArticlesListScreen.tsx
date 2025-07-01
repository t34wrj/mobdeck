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
import { Text } from '../../components/ui/Text';
import { Button } from '../../components/ui/Button';
import { ArticleCard } from '../../components/ArticleCard';
import { theme } from '../../components/ui/theme';
import { MainScreenProps } from '../../navigation/types';
import { RootState } from '../../store';
import {
  fetchArticles,
  setFilters,
  clearFilters,
  setPage,
  syncArticles,
  selectAllArticles,
} from '../../store/slices/articlesSlice';
import { Article } from '../../types';

const DEBOUNCE_DELAY = 300;

type ArticlesListScreenProps = MainScreenProps<'ArticlesList'>;

export const ArticlesListScreen: React.FC<ArticlesListScreenProps> = ({
  navigation,
}) => {
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  
  const {
    loading,
    error,
    pagination,
    filters,
    sync,
  } = useSelector((state: RootState) => state.articles);
  
  const articles = useSelector(selectAllArticles);
  
  const [searchQuery, setSearchQuery] = useState(filters.searchQuery);
  const [showFilters, setShowFilters] = useState(false);
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  // Debounced search function
  const debouncedSearch = useCallback((query: string) => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    
    const timer = setTimeout(() => {
      dispatch(setFilters({ searchQuery: query }));
      dispatch(fetchArticles({ page: 1, searchQuery: query, forceRefresh: true }));
    }, DEBOUNCE_DELAY);
    
    setDebounceTimer(timer);
  }, [dispatch, debounceTimer]);

  // Handle search input change
  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
    debouncedSearch(text);
  }, [debouncedSearch]);

  // Clear search
  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    dispatch(setFilters({ searchQuery: '' }));
    dispatch(fetchArticles({ page: 1, forceRefresh: true }));
  }, [dispatch]);

  // Initial load
  useEffect(() => {
    if (articles.length === 0) {
      dispatch(fetchArticles({ page: 1 }));
    }
  }, [dispatch, articles.length]);

  // Pull to refresh
  const handleRefresh = useCallback(() => {
    dispatch(syncArticles({ fullSync: false }));
  }, [dispatch]);

  // Load more articles (pagination)
  const handleLoadMore = useCallback(() => {
    if (pagination.hasMore && !loading.fetch) {
      dispatch(setPage(pagination.page + 1));
      dispatch(fetchArticles({ 
        page: pagination.page + 1,
        searchQuery: filters.searchQuery,
        filters,
      }));
    }
  }, [dispatch, pagination.hasMore, pagination.page, loading.fetch, filters]);

  // Handle article press
  const handleArticlePress = useCallback((article: Article) => {
    navigation.navigate('ArticleDetail', {
      articleId: article.id,
      title: article.title,
    });
  }, [navigation]);

  // Filter options
  const filterOptions = useMemo(() => [
    { key: 'all', label: 'All Articles', active: !filters.isRead && !filters.isArchived && !filters.isFavorite },
    { key: 'unread', label: 'Unread', active: filters.isRead === false },
    { key: 'read', label: 'Read', active: filters.isRead === true },
    { key: 'favorites', label: 'Favorites', active: filters.isFavorite === true },
    { key: 'archived', label: 'Archived', active: filters.isArchived === true },
  ], [filters]);

  // Handle filter selection
  const handleFilterPress = useCallback((filterKey: string) => {
    let newFilters = {};
    
    switch (filterKey) {
      case 'all':
        newFilters = { isRead: undefined, isArchived: undefined, isFavorite: undefined };
        break;
      case 'unread':
        newFilters = { isRead: false, isArchived: undefined, isFavorite: undefined };
        break;
      case 'read':
        newFilters = { isRead: true, isArchived: undefined, isFavorite: undefined };
        break;
      case 'favorites':
        newFilters = { isFavorite: true, isRead: undefined, isArchived: undefined };
        break;
      case 'archived':
        newFilters = { isArchived: true, isRead: undefined, isFavorite: undefined };
        break;
    }
    
    dispatch(setFilters(newFilters));
    dispatch(fetchArticles({ page: 1, filters: newFilters, forceRefresh: true }));
  }, [dispatch]);

  // Render article item
  const renderArticleItem = useCallback(({ item }: { item: Article }) => (
    <ArticleCard
      article={item}
      onPress={() => handleArticlePress(item)}
    />
  ), [handleArticlePress]);

  // Render empty state
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text variant="h4" style={styles.emptyTitle}>
        {searchQuery ? 'No articles found' : 'No articles yet'}
      </Text>
      <Text variant="body1" style={styles.emptyMessage}>
        {searchQuery 
          ? `No articles match "${searchQuery}"`
          : 'Pull down to sync your articles from Readeck'
        }
      </Text>
      {searchQuery && (
        <Button
          variant="outline"
          onPress={handleClearSearch}
          style={styles.clearButton}
        >
          Clear Search
        </Button>
      )}
    </View>
  );

  // Render footer with loading indicator for pagination
  const renderFooter = () => {
    if (!loading.fetch || pagination.page === 1) return null;
    
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={theme.colors.primary[500]} />
        <Text variant="caption" style={styles.loadingText}>
          Loading more articles...
        </Text>
      </View>
    );
  };

  // Render filter chips
  const renderFilters = () => (
    <View style={styles.filtersContainer}>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={filterOptions}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.filtersContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.filterChip,
              item.active && styles.filterChipActive,
            ]}
            onPress={() => handleFilterPress(item.key)}
          >
            <Text
              variant="body2"
              style={[
                styles.filterChipText,
                item.active && styles.filterChipTextActive,
              ]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text variant="h3" style={styles.headerTitle}>
          Articles
        </Text>
        <TouchableOpacity
          style={styles.filterToggle}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Text style={styles.filterIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search articles..."
          value={searchQuery}
          onChangeText={handleSearchChange}
          placeholderTextColor={theme.colors.neutral[500]}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            style={styles.clearSearchButton}
            onPress={handleClearSearch}
          >
            <Text style={styles.clearSearchIcon}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filters */}
      {showFilters && renderFilters()}

      {/* Error State */}
      {error.fetch && (
        <View style={styles.errorContainer}>
          <Text variant="body1" style={styles.errorText}>
            {error.fetch}
          </Text>
          <Button
            variant="outline"
            size="sm"
            onPress={() => dispatch(fetchArticles({ page: 1, forceRefresh: true }))}
            style={styles.retryButton}
          >
            Retry
          </Button>
        </View>
      )}

      {/* Articles List */}
      <FlatList
        data={articles}
        renderItem={renderArticleItem}
        keyExtractor={(item) => item.id}
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
          <ActivityIndicator size="large" color={theme.colors.primary[500]} />
          <Text variant="body1" style={styles.loadingText}>
            Loading articles...
          </Text>
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
    backgroundColor: theme.colors.neutral[50],
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.neutral[200],
  },
  headerTitle: {
    color: theme.colors.neutral[900],
  },
  filterToggle: {
    padding: theme.spacing[2],
  },
  filterIcon: {
    fontSize: 20,
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
  },
  retryButton: {
    marginTop: theme.spacing[2],
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