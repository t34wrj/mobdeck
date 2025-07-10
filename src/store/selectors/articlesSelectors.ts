import { createSelector } from '@reduxjs/toolkit';
import { RootState } from '../index';
import { Article } from '../../types';
import {
  selectAllArticles,
  selectArticleEntities,
} from '../slices/articlesSlice';

// Base selectors for articles state
export const selectArticlesState = (state: RootState) => state.articles;

// Loading state selectors
export const selectArticlesLoading = createSelector(
  [selectArticlesState],
  articlesState => articlesState.loading
);

export const selectIsFetchingArticles = createSelector(
  [selectArticlesLoading],
  loading => loading.fetch
);

export const selectIsCreatingArticle = createSelector(
  [selectArticlesLoading],
  loading => loading.create
);

export const selectIsUpdatingArticle = createSelector(
  [selectArticlesLoading],
  loading => loading.update
);

export const selectIsDeletingArticle = createSelector(
  [selectArticlesLoading],
  loading => loading.delete
);

export const selectIsSyncingArticles = createSelector(
  [selectArticlesLoading],
  loading => loading.sync
);

export const selectAnyArticleLoading = createSelector(
  [selectArticlesLoading],
  loading => Object.values(loading).some(isLoading => isLoading)
);

// Error state selectors
export const selectArticlesErrors = createSelector(
  [selectArticlesState],
  articlesState => articlesState.error
);

export const selectArticlesFetchError = createSelector(
  [selectArticlesErrors],
  errors => errors.fetch
);

export const selectArticlesCreateError = createSelector(
  [selectArticlesErrors],
  errors => errors.create
);

export const selectArticlesUpdateError = createSelector(
  [selectArticlesErrors],
  errors => errors.update
);

export const selectArticlesDeleteError = createSelector(
  [selectArticlesErrors],
  errors => errors.delete
);

export const selectArticlesSyncError = createSelector(
  [selectArticlesErrors],
  errors => errors.sync
);

export const selectAnyArticleError = createSelector(
  [selectArticlesErrors],
  errors => Object.values(errors).find(error => error !== null) || null
);

// Pagination selectors
export const selectArticlesPagination = createSelector(
  [selectArticlesState],
  articlesState => articlesState.pagination
);

export const selectCurrentPage = createSelector(
  [selectArticlesPagination],
  pagination => pagination.page
);

export const selectPageSize = createSelector(
  [selectArticlesPagination],
  pagination => pagination.limit
);

export const selectTotalPages = createSelector(
  [selectArticlesPagination],
  pagination => pagination.totalPages
);

export const selectTotalArticles = createSelector(
  [selectArticlesPagination],
  pagination => pagination.totalItems
);

export const selectHasMoreArticles = createSelector(
  [selectArticlesPagination],
  pagination => pagination.hasMore
);

export const selectPaginationInfo = createSelector(
  [selectArticlesPagination],
  pagination => ({
    currentPage: pagination.page,
    totalPages: pagination.totalPages,
    totalItems: pagination.totalItems,
    pageSize: pagination.limit,
    hasMore: pagination.hasMore,
    hasPrevious: pagination.page > 1,
    isFirstPage: pagination.page === 1,
    isLastPage: pagination.page >= pagination.totalPages,
  })
);

// Filter selectors
export const selectArticlesFilters = createSelector(
  [selectArticlesState],
  articlesState => articlesState.filters
);

export const selectSearchQuery = createSelector(
  [selectArticlesFilters],
  filters => filters.searchQuery
);

export const selectArchivedFilter = createSelector(
  [selectArticlesFilters],
  filters => filters.isArchived
);

export const selectFavoriteFilter = createSelector(
  [selectArticlesFilters],
  filters => filters.isFavorite
);

export const selectReadFilter = createSelector(
  [selectArticlesFilters],
  filters => filters.isRead
);

export const selectTagsFilter = createSelector(
  [selectArticlesFilters],
  filters => filters.tags
);

export const selectHasActiveFilters = createSelector(
  [selectArticlesFilters],
  filters => {
    return (
      filters.searchQuery.length > 0 ||
      filters.isArchived !== undefined ||
      filters.isFavorite !== undefined ||
      filters.isRead !== undefined ||
      (filters.tags && filters.tags.length > 0)
    );
  }
);

// Sync state selectors
export const selectArticlesSync = createSelector(
  [selectArticlesState],
  articlesState => articlesState.sync
);

export const selectLastSyncTime = createSelector(
  [selectArticlesSync],
  sync => sync.lastSyncTime
);

export const selectIsSyncing = createSelector(
  [selectArticlesSync],
  sync => sync.isSyncing
);

export const selectPendingChanges = createSelector(
  [selectArticlesSync],
  sync => sync.pendingChanges
);

export const selectSyncConflicts = createSelector(
  [selectArticlesSync],
  sync => sync.conflicts
);

export const selectSyncError = createSelector(
  [selectArticlesSync],
  sync => sync.syncError
);

export const selectHasPendingChanges = createSelector(
  [selectPendingChanges],
  pendingChanges => pendingChanges.length > 0
);

export const selectHasSyncConflicts = createSelector(
  [selectSyncConflicts],
  conflicts => conflicts.length > 0
);

export const selectSyncStatus = createSelector(
  [
    selectIsSyncing,
    selectLastSyncTime,
    selectHasPendingChanges,
    selectHasSyncConflicts,
    selectSyncError,
  ],
  (
    isSyncing,
    lastSyncTime,
    hasPendingChanges,
    hasSyncConflicts,
    syncError
  ) => ({
    isSyncing,
    lastSyncTime,
    hasPendingChanges,
    hasSyncConflicts,
    hasError: syncError !== null,
    syncError,
    status: isSyncing
      ? 'syncing'
      : syncError
        ? 'error'
        : hasSyncConflicts
          ? 'conflicts'
          : hasPendingChanges
            ? 'pending'
            : 'synced',
  })
);

// Selection selectors
export const selectSelectedArticleId = createSelector(
  [selectArticlesState],
  articlesState => articlesState.selectedArticleId
);

export const selectSelectedArticle = createSelector(
  [selectSelectedArticleId, selectArticleEntities],
  (selectedId, articles) => (selectedId ? articles[selectedId] || null : null)
);

export const selectMultiSelectMode = createSelector(
  [selectArticlesState],
  articlesState => articlesState.multiSelectMode
);

export const selectSelectedArticleIds = createSelector(
  [selectArticlesState],
  articlesState => articlesState.selectedArticleIds
);

export const selectSelectedArticles = createSelector(
  [selectSelectedArticleIds, selectArticleEntities],
  (selectedIds, articles) =>
    selectedIds.map(id => articles[id]).filter(Boolean) as Article[]
);

export const selectSelectedArticlesCount = createSelector(
  [selectSelectedArticleIds],
  selectedIds => selectedIds.length
);

export const selectHasSelectedArticles = createSelector(
  [selectSelectedArticlesCount],
  count => count > 0
);

// Filtered and sorted articles selectors
export const selectFilteredArticles = createSelector(
  [selectAllArticles, selectArticlesFilters],
  (articles, filters) => {
    return articles.filter(article => {
      // Search query filter
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        const searchableText = [
          article.title,
          article.summary,
          article.content,
          ...(article.tags || []),
        ]
          .join(' ')
          .toLowerCase();

        if (!searchableText.includes(query)) {
          return false;
        }
      }

      // Archive filter
      if (
        filters.isArchived !== undefined &&
        article.isArchived !== filters.isArchived
      ) {
        return false;
      }

      // Favorite filter
      if (
        filters.isFavorite !== undefined &&
        article.isFavorite !== filters.isFavorite
      ) {
        return false;
      }

      // Read filter
      if (filters.isRead !== undefined && article.isRead !== filters.isRead) {
        return false;
      }

      // Tags filter
      if (filters.tags && filters.tags.length > 0) {
        const articleTags = article.tags || [];
        const hasMatchingTag = filters.tags.some(tag =>
          articleTags.includes(tag)
        );
        if (!hasMatchingTag) {
          return false;
        }
      }

      return true;
    });
  }
);

// Category-specific selectors
export const selectUnreadArticles = createSelector(
  [selectAllArticles],
  articles => articles.filter(article => !article.isRead && !article.isArchived)
);

export const selectFavoriteArticles = createSelector(
  [selectAllArticles],
  articles =>
    articles.filter(article => article.isFavorite && !article.isArchived)
);

export const selectArchivedArticles = createSelector(
  [selectAllArticles],
  articles => articles.filter(article => article.isArchived)
);

export const selectRecentArticles = createSelector(
  [selectAllArticles],
  articles => {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    return articles.filter(
      article => article.createdAt > oneDayAgo && !article.isArchived
    );
  }
);

// Statistics selectors
export const selectArticlesStats = createSelector(
  [selectAllArticles],
  articles => {
    const stats = {
      total: articles.length,
      unread: 0,
      favorites: 0,
      archived: 0,
      read: 0,
      recent: 0, // Last 24 hours
    };

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    articles.forEach(article => {
      if (!article.isRead && !article.isArchived) stats.unread++;
      if (article.isFavorite) stats.favorites++;
      if (article.isArchived) stats.archived++;
      if (article.isRead) stats.read++;
      if (article.createdAt > oneDayAgo && !article.isArchived) stats.recent++;
    });

    return stats;
  }
);

// Utility selectors
export const selectArticlesByIds = createSelector(
  [selectArticleEntities, (_: RootState, articleIds: string[]) => articleIds],
  (articles, articleIds) =>
    articleIds.map(id => articles[id]).filter(Boolean) as Article[]
);

export const selectArticlesByTag = createSelector(
  [selectAllArticles, (_: RootState, tag: string) => tag],
  (articles, tag) => articles.filter(article => article.tags?.includes(tag))
);

export const selectArticleConflictStatus = createSelector(
  [
    selectSyncConflicts,
    selectPendingChanges,
    (_: RootState, articleId: string) => articleId,
  ],
  (conflicts, pendingChanges, articleId) => ({
    hasConflict: conflicts.includes(articleId),
    hasPendingChanges: pendingChanges.includes(articleId),
    needsSync:
      conflicts.includes(articleId) || pendingChanges.includes(articleId),
  })
);

// Performance-optimized selectors for large lists
export const selectArticlesCount = createSelector(
  [selectAllArticles],
  articles => articles.length
);

export const selectFilteredArticlesCount = createSelector(
  [selectFilteredArticles],
  articles => articles.length
);

export const selectArticleExists = createSelector(
  [selectArticleEntities, (_: RootState, articleId: string) => articleId],
  (articles, articleId) => Boolean(articles[articleId])
);

// Complex computed selectors
export const selectArticlesWithSyncStatus = createSelector(
  [selectAllArticles, selectPendingChanges, selectSyncConflicts],
  (articles, pendingChanges, conflicts) => {
    return articles.map(article => ({
      ...article,
      syncStatus: {
        hasConflict: conflicts.includes(article.id),
        hasPendingChanges: pendingChanges.includes(article.id),
        needsSync:
          conflicts.includes(article.id) || pendingChanges.includes(article.id),
      },
    }));
  }
);

export const selectArticleNavigationInfo = createSelector(
  [selectFilteredArticles, selectSelectedArticleId],
  (articles, selectedId) => {
    if (!selectedId || articles.length === 0) {
      return null;
    }

    const currentIndex = articles.findIndex(
      article => article.id === selectedId
    );
    if (currentIndex === -1) {
      return null;
    }

    return {
      currentIndex,
      totalCount: articles.length,
      hasNext: currentIndex < articles.length - 1,
      hasPrevious: currentIndex > 0,
      nextArticleId:
        currentIndex < articles.length - 1
          ? articles[currentIndex + 1].id
          : null,
      previousArticleId:
        currentIndex > 0 ? articles[currentIndex - 1].id : null,
    };
  }
);

// Export all selectors for easy importing
export {
  selectAllArticles,
  selectArticleById,
  selectArticleEntities,
} from '../slices/articlesSlice';
