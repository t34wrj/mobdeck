import { RootState } from '../index';
import { Article } from '../../types';
// import {
//   selectAllArticles,
//   selectArticleById,
// } from '../slices/articlesSlice'; // Currently unused

// Base selectors for articles state
export const selectArticlesState = (state: RootState) => state.articles;

// Loading state selectors (simplified)
export const selectArticlesLoading = (state: RootState) => state.articles.loading;
export const selectIsFetchingArticles = (state: RootState) => state.articles.loading.fetch;
export const selectIsCreatingArticle = (state: RootState) => state.articles.loading.create;
export const selectIsUpdatingArticle = (state: RootState) => state.articles.loading.update;
export const selectIsDeletingArticle = (state: RootState) => state.articles.loading.delete;
export const selectIsSyncingArticles = (state: RootState) => state.articles.loading.sync;
export const selectAnyArticleLoading = (state: RootState) => 
  Object.values(state.articles.loading).some(isLoading => isLoading);

// Error state selectors (simplified)
export const selectArticlesErrors = (state: RootState) => state.articles.error;
export const selectArticlesFetchError = (state: RootState) => state.articles.error.fetch;
export const selectArticlesCreateError = (state: RootState) => state.articles.error.create;
export const selectArticlesUpdateError = (state: RootState) => state.articles.error.update;
export const selectArticlesDeleteError = (state: RootState) => state.articles.error.delete;
export const selectArticlesSyncError = (state: RootState) => state.articles.error.sync;
export const selectAnyArticleError = (state: RootState) => 
  Object.values(state.articles.error).find(error => error !== null) || null;

// Pagination selectors (simplified)
export const selectArticlesPagination = (state: RootState) => state.articles.pagination;
export const selectCurrentPage = (state: RootState) => state.articles.pagination.page;
export const selectPageSize = (state: RootState) => state.articles.pagination.limit;
export const selectTotalPages = (state: RootState) => state.articles.pagination.totalPages;
export const selectTotalArticlesCount = (state: RootState) => state.articles.pagination.totalItems;
export const selectHasMoreArticles = (state: RootState) => state.articles.pagination.hasMore;
export const selectPaginationInfo = (state: RootState) => {
  const pagination = state.articles.pagination;
  return {
    currentPage: pagination.page,
    totalPages: pagination.totalPages,
    totalItems: pagination.totalItems,
    pageSize: pagination.limit,
    hasMore: pagination.hasMore,
    hasPrevious: pagination.page > 1,
    isFirstPage: pagination.page === 1,
    isLastPage: pagination.page >= pagination.totalPages,
  };
};

// Filter selectors (simplified)
export const selectArticlesFilters = (state: RootState) => state.articles.filters;
export const selectSearchQuery = (state: RootState) => state.articles.filters.searchQuery;
export const selectHasActiveFilters = (state: RootState) => {
  const filters = state.articles.filters;
  return (
    filters.searchQuery.length > 0 ||
    filters.isArchived !== undefined ||
    filters.isFavorite !== undefined ||
    filters.isRead !== undefined ||
    (filters.tags && filters.tags.length > 0)
  );
};

// Sync state selectors (simplified)
export const selectArticlesSync = (state: RootState) => state.articles.sync;
export const selectLastSyncTime = (state: RootState) => state.articles.sync.lastSyncTime;
export const selectIsSyncing = (state: RootState) => state.articles.sync.isSyncing;
export const selectPendingChanges = (state: RootState) => state.articles.sync.pendingChanges;
export const selectSyncConflicts = (state: RootState) => state.articles.sync.conflicts;
export const selectSyncError = (state: RootState) => state.articles.sync.syncError;
export const selectHasPendingChanges = (state: RootState) => state.articles.sync.pendingChanges.length > 0;
export const selectHasSyncConflicts = (state: RootState) => state.articles.sync.conflicts.length > 0;

// Selection selectors (simplified)
export const selectSelectedArticleId = (state: RootState) => state.articles.selectedArticleId;
export const selectSelectedArticle = (state: RootState) => {
  const selectedId = state.articles.selectedArticleId;
  return selectedId ? state.articles.articles.find(article => article.id === selectedId) || null : null;
};
export const selectMultiSelectMode = (state: RootState) => state.articles.multiSelectMode;
export const selectSelectedArticleIds = (state: RootState) => state.articles.selectedArticleIds;
export const selectSelectedArticles = (state: RootState) => {
  const selectedIds = state.articles.selectedArticleIds;
  return selectedIds.map(id => state.articles.articles.find(article => article.id === id)).filter(Boolean) as Article[];
};
export const selectSelectedArticlesCount = (state: RootState) => state.articles.selectedArticleIds.length;
export const selectHasSelectedArticles = (state: RootState) => state.articles.selectedArticleIds.length > 0;

// Essential filtered articles selector
export const selectFilteredArticles = (state: RootState) => {
  const articles = state.articles.articles;
  const filters = state.articles.filters;
  
  return articles.filter(article => {
    // Search query filter
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      const searchableText = [
        article.title,
        article.summary,
        article.content,
        ...(article.tags || []),
      ].join(' ').toLowerCase();

      if (!searchableText.includes(query)) {
        return false;
      }
    }

    // Archive filter
    if (filters.isArchived !== undefined && article.isArchived !== filters.isArchived) {
      return false;
    }

    // Favorite filter
    if (filters.isFavorite !== undefined && article.isFavorite !== filters.isFavorite) {
      return false;
    }

    // Read filter
    if (filters.isRead !== undefined && article.isRead !== filters.isRead) {
      return false;
    }

    // Tags filter
    if (filters.tags && filters.tags.length > 0) {
      const articleTags = article.tags || [];
      const hasMatchingTag = filters.tags.some(tag => articleTags.includes(tag));
      if (!hasMatchingTag) {
        return false;
      }
    }

    return true;
  });
};

// Essential category selectors (simplified)
export const selectUnreadArticles = (state: RootState) => 
  state.articles.articles.filter(article => !article.isRead && !article.isArchived);

export const selectFavoriteArticles = (state: RootState) => 
  state.articles.articles.filter(article => article.isFavorite && !article.isArchived);

export const selectArchivedArticles = (state: RootState) => 
  state.articles.articles.filter(article => article.isArchived);

// Basic statistics
export const selectArticlesStats = (state: RootState) => {
  const articles = state.articles.articles;
  return {
    total: articles.length,
    unread: articles.filter(article => !article.isRead && !article.isArchived).length,
    favorites: articles.filter(article => article.isFavorite).length,
    archived: articles.filter(article => article.isArchived).length,
  };
};

// Essential utility selectors
export const selectArticlesCount = (state: RootState) => state.articles.articles.length;
export const selectFilteredArticlesCount = (state: RootState) => selectFilteredArticles(state).length;
export const selectArticleExists = (state: RootState, articleId: string) => 
  Boolean(state.articles.articles.find(article => article.id === articleId));

// Export from articlesSlice for compatibility
export { selectAllArticles, selectArticleById } from '../slices/articlesSlice';
