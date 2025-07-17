import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Article, PaginatedResponse } from '../../types';
import { RootState } from '../index';
import { readeckApiService } from '../../services/ReadeckApiService';
import { localStorageService } from '../../services/LocalStorageService';

// Simple state interface without entity adapter
export interface ArticlesState {
  // Article data as simple array
  articles: Article[];
  // Loading states
  loading: {
    fetch: boolean;
    create: boolean;
    update: boolean;
    delete: boolean;
    sync: boolean;
    content: boolean;
  };

  // Error states
  error: {
    fetch: string | null;
    create: string | null;
    update: string | null;
    delete: string | null;
    sync: string | null;
    content: string | null;
  };

  // Pagination state
  pagination: {
    page: number;
    limit: number;
    totalPages: number;
    totalItems: number;
    hasMore: boolean;
  };

  // Search and filtering
  filters: {
    searchQuery: string;
    isArchived?: boolean;
    isFavorite?: boolean;
    isRead?: boolean;
    tags?: string[];
  };

  // Sync state management
  sync: {
    lastSyncTime: string | null;
    isSyncing: boolean;
    pendingChanges: string[]; // Article IDs with pending changes
    conflicts: string[]; // Article IDs with sync conflicts
    syncError: string | null;
  };

  // UI state
  selectedArticleId: string | null;
  multiSelectMode: boolean;
  selectedArticleIds: string[];

  // Content loading states for individual articles
  contentLoading: Record<string, boolean>;
  contentErrors: Record<string, string | null>;
}

// Initial state
const initialState: ArticlesState = {
  articles: [],
  loading: {
    fetch: false,
    create: false,
    update: false,
    delete: false,
    sync: false,
    content: false,
  },
  error: {
    fetch: null,
    create: null,
    update: null,
    delete: null,
    sync: null,
    content: null,
  },
  pagination: {
    page: 1,
    limit: 20,
    totalPages: 0,
    totalItems: 0,
    hasMore: false,
  },
  filters: {
    searchQuery: '',
    isArchived: undefined,
    isFavorite: undefined,
    isRead: undefined,
    tags: undefined,
  },
  sync: {
    lastSyncTime: null,
    isSyncing: false,
    pendingChanges: [],
    conflicts: [],
    syncError: null,
  },
  selectedArticleId: null,
  multiSelectMode: false,
  selectedArticleIds: [],
  contentLoading: {},
  contentErrors: {},
};

// Async thunk interfaces
interface FetchArticlesParams {
  page?: number;
  limit?: number;
  searchQuery?: string;
  filters?: Partial<ArticlesState['filters']>;
  forceRefresh?: boolean;
  fetchFullContent?: boolean;
}

interface CreateArticleParams {
  title: string;
  url: string;
  summary?: string;
  content?: string;
  tags?: string[];
}

interface UpdateArticleParams {
  id: string;
  updates: Partial<Omit<Article, 'id' | 'createdAt' | 'updatedAt'>>;
}

interface DeleteArticleParams {
  id: string;
  permanent?: boolean;
}

interface SyncArticlesParams {
  fullSync?: boolean;
  articlesOnly?: boolean;
}

interface FetchArticleContentParams {
  articleId: string;
  forceRefresh?: boolean;
}

// Async thunk actions
export const fetchArticles = createAsyncThunk<
  PaginatedResponse<Article>,
  FetchArticlesParams,
  { rejectValue: string; state: RootState }
>('articles/fetchArticles', async (params, { rejectWithValue, getState }) => {
  try {
    const state = getState();

    // Check if user is authenticated
    if (!state.auth.isAuthenticated || !state.auth.user) {
      return rejectWithValue(
        'Please configure your Readeck server settings first'
      );
    }

    const currentPage = params.page || state.articles.pagination.page;

    // First try to fetch from API if online
    try {
      const response = await readeckApiService.fetchArticlesWithFilters({
        ...params,
        page: currentPage,
        limit: params.limit || state.articles.pagination.limit,
        filters: params.filters || state.articles.filters,
        fetchFullContent: false, // Disable bulk full content fetching to avoid API spam
      });

      return response;
    } catch (apiError) {
      // If API fails due to offline status, fallback to local database
      const isOfflineError = apiError instanceof Error && (
        apiError.message.includes('offline') ||
        apiError.message.includes('CONNECTION_ERROR') ||
        apiError.message.includes('Network') ||
        apiError.message.includes('network')
      );

      if (isOfflineError) {
        console.log('[articlesSlice] API unavailable, loading from local database');
        
        // Convert filters to database format
        const dbFilters = {
          limit: params.limit || state.articles.pagination.limit,
          offset: ((currentPage - 1) * (params.limit || state.articles.pagination.limit)),
          searchQuery: params.searchQuery || state.articles.filters.searchQuery,
          isArchived: params.filters?.isArchived || state.articles.filters.isArchived,
          isFavorite: params.filters?.isFavorite || state.articles.filters.isFavorite,
          isRead: params.filters?.isRead || state.articles.filters.isRead,
        };

        const localResult = await localStorageService.getArticles(dbFilters);
        
        if (localResult.success && localResult.data) {
          // Convert database articles to API format
          const articles = localResult.data.items.map(dbArticle => ({
            id: dbArticle.id,
            title: dbArticle.title,
            summary: dbArticle.summary,
            content: dbArticle.content,
            contentUrl: dbArticle.content_url,
            url: dbArticle.url,
            imageUrl: dbArticle.image_url,
            readTime: dbArticle.read_time,
            isArchived: Boolean(dbArticle.is_archived),
            isFavorite: Boolean(dbArticle.is_favorite),
            isRead: Boolean(dbArticle.is_read),
            tags: [], // Tags would need to be loaded separately
            sourceUrl: dbArticle.source_url,
            createdAt: new Date(dbArticle.created_at * 1000).toISOString(),
            updatedAt: new Date(dbArticle.updated_at * 1000).toISOString(),
            syncedAt: dbArticle.synced_at ? new Date(dbArticle.synced_at * 1000).toISOString() : undefined,
          }));

          return {
            items: articles,
            page: currentPage,
            totalPages: Math.ceil(localResult.data.totalCount / (params.limit || state.articles.pagination.limit)),
            totalItems: localResult.data.totalCount,
          };
        } else {
          // If both API and database fail, return empty result
          return {
            items: [],
            page: currentPage,
            totalPages: 0,
            totalItems: 0,
          };
        }
      } else {
        // Re-throw non-offline errors
        throw apiError;
      }
    }
  } catch (error) {
    console.error('[articlesSlice] fetchArticles error:', error);

    let errorMessage = 'Failed to fetch articles';
    if (error instanceof Error) {
      if (
        error.message.includes('401') ||
        error.message.includes('unauthorized')
      ) {
        errorMessage =
          'Authentication failed. Please check your server settings.';
      } else if (
        error.message.includes('404') ||
        error.message.includes('not found')
      ) {
        errorMessage = 'Server not found. Please check your server URL.';
      } else if (
        error.message.includes('Network') ||
        error.message.includes('network')
      ) {
        errorMessage =
          'Network error. Please check your connection and server URL.';
      } else {
        errorMessage = error.message;
      }
    }

    return rejectWithValue(errorMessage);
  }
});

export const createArticle = createAsyncThunk<
  Article,
  CreateArticleParams,
  { rejectValue: string }
>('articles/createArticle', async (params, { rejectWithValue }) => {
  try {
    const article = await readeckApiService.createArticleWithMetadata(params);
    return article;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to create article';
    return rejectWithValue(errorMessage);
  }
});

export const updateArticle = createAsyncThunk<
  Article,
  UpdateArticleParams,
  { rejectValue: string }
>('articles/updateArticle', async (params, { rejectWithValue }) => {
  try {
    // Update via API first
    const article = await readeckApiService.updateArticleWithMetadata(params);

    // Also persist to local database with is_modified flag for sync
    try {
      const updatedArticleForDB = {
        ...article,
        isModified: true, // Mark as modified for sync
        syncedAt: null, // Clear synced timestamp since it's now modified
      };

      await localStorageService.updateArticleFromAppFormat(
        article.id,
        updatedArticleForDB
      );
      console.log(
        '[ArticlesSlice] Article updated in database and marked for sync:',
        article.id
      );
    } catch (dbError) {
      console.warn(
        '[ArticlesSlice] Failed to update article in database:',
        dbError
      );
      // Don't fail the whole operation if database update fails
    }

    return article;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to update article';
    return rejectWithValue(errorMessage);
  }
});

export const updateArticleLocalWithDB = createAsyncThunk<
  Article,
  { id: string; updates: Partial<Article> },
  { rejectValue: string }
>(
  'articles/updateArticleLocalWithDB',
  async (params, { rejectWithValue, getState }) => {
    try {
      const state = getState() as RootState;
      const existingArticle = state.articles.articles.find(
        article => article.id === params.id
      );

      if (!existingArticle) {
        throw new Error('Article not found');
      }

      // Merge updates with existing article
      const updatedArticle = {
        ...existingArticle,
        ...params.updates,
        isModified: true, // Mark as modified for sync
        syncedAt: null, // Clear synced timestamp
        updatedAt: new Date().toISOString(),
      };

      // Persist to database
      await localStorageService.updateArticleFromAppFormat(
        params.id,
        updatedArticle
      );
      console.log(
        '[ArticlesSlice] Article updated locally in database and marked for sync:',
        params.id
      );

      return updatedArticle;
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to update article locally';
      return rejectWithValue(errorMessage);
    }
  }
);

export const deleteArticle = createAsyncThunk<
  string,
  DeleteArticleParams,
  { rejectValue: string }
>('articles/deleteArticle', async (params, { rejectWithValue }) => {
  try {
    await readeckApiService.deleteArticle(params.id);
    return params.id;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to delete article';
    return rejectWithValue(errorMessage);
  }
});

export const loadLocalArticles = createAsyncThunk<
  PaginatedResponse<Article>,
  FetchArticlesParams,
  { rejectValue: string; state: RootState }
>('articles/loadLocalArticles', async (params, { rejectWithValue }) => {
  try {
    console.log('[articlesSlice] Loading articles from local database...');

    const page = params.page || 1;
    const limit = params.limit || 20;
    const offset = (page - 1) * limit;

    const result = await localStorageService.getArticles({
      limit,
      offset,
      searchQuery: params.searchQuery,
      isArchived: params.filters?.isArchived,
      isFavorite: params.filters?.isFavorite,
      isRead: params.filters?.isRead,
    });

    if (result.success && result.data) {
      console.log(
        `[articlesSlice] Loaded ${result.data.items.length} articles from local database`
      );

      // Convert database articles to Article format
      const articles = result.data.items.map((dbArticle: any) => ({
        id: dbArticle.id,
        title: dbArticle.title,
        url: dbArticle.url,
        summary: dbArticle.summary || '',
        content: dbArticle.content || '',
        imageUrl: dbArticle.image_url || '',
        readTime: dbArticle.read_time || 0,
        isArchived: Boolean(dbArticle.is_archived),
        isFavorite: Boolean(dbArticle.is_favorite),
        isRead: Boolean(dbArticle.is_read),
        tags: [], // Tags not implemented in local DB yet
        sourceUrl: dbArticle.source_url || dbArticle.url,
        createdAt: new Date(dbArticle.created_at * 1000).toISOString(),
        updatedAt: new Date(dbArticle.updated_at * 1000).toISOString(),
        syncedAt: dbArticle.synced_at
          ? new Date(dbArticle.synced_at * 1000).toISOString()
          : undefined,
      }));

      // Calculate pagination from database result
      const currentPage =
        Math.floor(result.data.offset / result.data.limit) + 1;
      const totalPages = Math.ceil(result.data.totalCount / result.data.limit);

      return {
        items: articles,
        page: currentPage,
        totalPages,
        totalItems: result.data.totalCount,
        pagination: {
          page: currentPage,
          limit: result.data.limit,
          total: result.data.totalCount,
          pages: totalPages,
          hasNextPage: result.data.hasMore,
          hasPreviousPage: result.data.offset > 0,
        },
      };
    } else {
      throw new Error(result.error || 'Failed to load local articles');
    }
  } catch (error) {
    console.error('[articlesSlice] loadLocalArticles error:', error);
    return rejectWithValue(
      error instanceof Error ? error.message : 'Failed to load local articles'
    );
  }
});

export const fetchArticleContent = createAsyncThunk<
  Article,
  FetchArticleContentParams,
  { rejectValue: string; state: RootState }
>('articles/fetchArticleContent', async (params, { rejectWithValue, getState }) => {
  try {
    const state = getState();
    const article = state.articles.articles.find(a => a.id === params.articleId);
    
    if (!article) {
      return rejectWithValue('Article not found');
    }

    // Check if we already have content and don't need to force refresh
    if (article.content && article.content.trim() && !params.forceRefresh) {
      return article;
    }

    console.log(`[articlesSlice] Fetching content for article ${params.articleId}`);
    
    const fullArticle = await readeckApiService.getArticleWithContent(params.articleId);
    
    return fullArticle;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch article content';
    console.error(`[articlesSlice] fetchArticleContent error for ${params.articleId}:`, errorMessage);
    return rejectWithValue(errorMessage);
  }
});

export const syncArticles = createAsyncThunk<
  { syncedCount: number; conflictCount: number; articles: Article[] },
  SyncArticlesParams,
  { rejectValue: string }
>('articles/syncArticles', async (params, { rejectWithValue, dispatch }) => {
  try {
    const syncStartTime = Date.now();
    // Use simplified sync service instead
    const { syncService } = await import('../../services/SyncService');
    const syncResult = await syncService.startFullSync(params.fullSync);

    // Convert sync result to expected format
    const result = {
      syncedCount: syncResult.syncedCount,
      conflictCount: syncResult.conflictCount,
      articles: [], // Articles will be loaded from local storage after sync
    };

    // Also update the main sync slice's lastSyncTime for the Settings screen
    const syncEndTime = Date.now();
    const syncDuration = syncEndTime - syncStartTime;

    // Import and dispatch syncSuccess action
    const { syncSuccess } = await import('./syncSlice');
    dispatch(
      syncSuccess({
        syncTime: new Date().toISOString(),
        syncDuration,
        itemsProcessed: result.syncedCount,
        itemsSynced: result.syncedCount,
        conflicts: result.conflictCount,
      })
    );

    return result;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to sync articles';
    return rejectWithValue(errorMessage);
  }
});

// Slice definition
const articlesSlice = createSlice({
  name: 'articles',
  initialState,
  reducers: {
    // Clear errors
    clearError: (
      state,
      action: PayloadAction<keyof ArticlesState['error'] | 'all'>
    ) => {
      if (action.payload === 'all') {
        state.error = initialState.error;
      } else {
        state.error[action.payload] = null;
      }
    },

    // Update filters
    setFilters: (
      state,
      action: PayloadAction<Partial<ArticlesState['filters']>>
    ) => {
      state.filters = { ...state.filters, ...action.payload };
      // Reset pagination when filters change
      state.pagination.page = 1;
    },

    clearFilters: state => {
      state.filters = initialState.filters;
      state.pagination.page = 1;
    },

    // Pagination
    setPage: (state, action: PayloadAction<number>) => {
      state.pagination.page = action.payload;
    },

    setPageSize: (state, action: PayloadAction<number>) => {
      state.pagination.limit = action.payload;
      state.pagination.page = 1; // Reset to first page
    },

    // Article selection
    setSelectedArticle: (state, action: PayloadAction<string | null>) => {
      state.selectedArticleId = action.payload;
    },

    toggleMultiSelectMode: state => {
      state.multiSelectMode = !state.multiSelectMode;
      if (!state.multiSelectMode) {
        state.selectedArticleIds = [];
      }
    },

    toggleArticleSelection: (state, action: PayloadAction<string>) => {
      const articleId = action.payload;
      const index = state.selectedArticleIds.indexOf(articleId);
      if (index > -1) {
        state.selectedArticleIds.splice(index, 1);
      } else {
        state.selectedArticleIds.push(articleId);
      }
    },

    clearSelection: state => {
      state.selectedArticleIds = [];
      state.multiSelectMode = false;
    },

    // Local article updates (for optimistic updates)
    updateArticleLocal: (
      state,
      action: PayloadAction<{ id: string; updates: Partial<Article> }>
    ) => {
      const { id, updates } = action.payload;
      const articleIndex = state.articles.findIndex(
        article => article.id === id
      );
      if (articleIndex !== -1) {
        state.articles[articleIndex] = {
          ...state.articles[articleIndex],
          ...updates,
          updatedAt: new Date().toISOString(),
        };

        // Mark as having pending changes for sync
        if (!state.sync.pendingChanges.includes(id)) {
          state.sync.pendingChanges.push(id);
        }
      }
    },

    // Sync state management
    markSyncConflict: (state, action: PayloadAction<string>) => {
      const articleId = action.payload;
      if (!state.sync.conflicts.includes(articleId)) {
        state.sync.conflicts.push(articleId);
      }
    },

    resolveSyncConflict: (state, action: PayloadAction<string>) => {
      const articleId = action.payload;
      state.sync.conflicts = state.sync.conflicts.filter(
        id => id !== articleId
      );
      state.sync.pendingChanges = state.sync.pendingChanges.filter(
        id => id !== articleId
      );
    },

    clearSyncError: state => {
      state.sync.syncError = null;
    },

    // Content loading state management
    setContentLoading: (state, action: PayloadAction<{ articleId: string; loading: boolean }>) => {
      const { articleId, loading } = action.payload;
      state.contentLoading[articleId] = loading;
      if (loading) {
        // Clear any existing error when starting to load
        delete state.contentErrors[articleId];
      }
    },

    setContentError: (state, action: PayloadAction<{ articleId: string; error: string | null }>) => {
      const { articleId, error } = action.payload;
      if (error) {
        state.contentErrors[articleId] = error;
      } else {
        delete state.contentErrors[articleId];
      }
      // Clear loading state when setting error
      state.contentLoading[articleId] = false;
    },

    clearContentError: (state, action: PayloadAction<string>) => {
      const articleId = action.payload;
      delete state.contentErrors[articleId];
    },

    // Clear all articles data (used during logout)
    clearAll: () => {
      return initialState;
    },
  },

  extraReducers: builder => {
    builder
      // Fetch articles
      .addCase(fetchArticles.pending, state => {
        state.loading.fetch = true;
        state.error.fetch = null;
      })
      .addCase(fetchArticles.fulfilled, (state, action) => {
        state.loading.fetch = false;
        state.error.fetch = null;

        const { items, page, totalPages, totalItems } = action.payload;

        // Update pagination
        state.pagination = {
          page,
          totalPages,
          totalItems,
          limit: state.pagination.limit,
          hasMore: page < totalPages,
        };

        // Handle pagination: replace for page 1, append for subsequent pages
        if (page === 1) {
          state.articles = items.sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        } else {
          const newArticles = [...state.articles, ...items];
          state.articles = newArticles.sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        }
      })
      .addCase(fetchArticles.rejected, (state, action) => {
        state.loading.fetch = false;
        state.error.fetch = action.payload || 'Failed to fetch articles';
      })

      // Load local articles
      .addCase(loadLocalArticles.pending, state => {
        state.loading.fetch = true;
        state.error.fetch = null;
      })
      .addCase(loadLocalArticles.fulfilled, (state, action) => {
        state.loading.fetch = false;
        state.error.fetch = null;

        const { items, page, totalPages, totalItems, pagination } =
          action.payload;

        // Update pagination
        state.pagination = {
          page,
          totalPages,
          totalItems,
          limit: pagination.limit,
          hasMore: pagination.hasNextPage,
        };

        // Handle pagination: replace for page 1, append for subsequent pages
        if (page === 1) {
          state.articles = items.sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        } else {
          const newArticles = [...state.articles, ...items];
          state.articles = newArticles.sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        }
      })
      .addCase(loadLocalArticles.rejected, (state, action) => {
        state.loading.fetch = false;
        state.error.fetch = action.payload || 'Failed to load local articles';
      })

      // Create article
      .addCase(createArticle.pending, state => {
        state.loading.create = true;
        state.error.create = null;
      })
      .addCase(createArticle.fulfilled, (state, action) => {
        state.loading.create = false;
        state.error.create = null;
        state.articles.unshift(action.payload); // Add to beginning for newest-first order
        state.pagination.totalItems += 1;
      })
      .addCase(createArticle.rejected, (state, action) => {
        state.loading.create = false;
        state.error.create = action.payload || 'Failed to create article';
      })

      // Update article
      .addCase(updateArticle.pending, state => {
        state.loading.update = true;
        state.error.update = null;
      })
      .addCase(updateArticle.fulfilled, (state, action) => {
        state.loading.update = false;
        state.error.update = null;

        const articleIndex = state.articles.findIndex(
          article => article.id === action.payload.id
        );

        if (articleIndex !== -1) {
          const existingArticle = state.articles[articleIndex];
          // Create a smart merge that preserves important fields like content
          const mergedChanges = { ...existingArticle };

          // Only update fields that are meaningful (not empty strings or undefined)
          Object.entries(action.payload).forEach(([key, value]) => {
            // Always update these fields regardless of value
            const alwaysUpdateFields = [
              'id',
              'isRead',
              'isArchived',
              'isFavorite',
              'tags',
              'syncedAt',
              'updatedAt',
            ];

            // For content, only update if the new value has actual content
            // AND we're not currently loading content for this article
            if (key === 'content') {
              const isLoadingContent = state.contentLoading[action.payload.id];
              if (
                value &&
                typeof value === 'string' &&
                value.trim().length > 0 &&
                !isLoadingContent
              ) {
                (mergedChanges as any)[key] = value;
              }
              // Otherwise keep existing content to prevent clearing during sync
            }
            // For other fields, update if not empty or if it's an always-update field
            else if (
              alwaysUpdateFields.includes(key) ||
              (value !== '' && value !== null && value !== undefined)
            ) {
              (mergedChanges as any)[key] = value;
            }
          });

          state.articles[articleIndex] = mergedChanges;
        } else {
          // No existing article, add it
          state.articles.unshift(action.payload);
        }

        // Remove from pending changes after successful sync
        state.sync.pendingChanges = state.sync.pendingChanges.filter(
          id => id !== action.payload.id
        );
      })
      .addCase(updateArticle.rejected, (state, action) => {
        state.loading.update = false;
        state.error.update = action.payload || 'Failed to update article';
      })

      // Update article locally with database persistence
      .addCase(updateArticleLocalWithDB.pending, state => {
        state.loading.update = true;
        state.error.update = null;
      })
      .addCase(updateArticleLocalWithDB.fulfilled, (state, action) => {
        state.loading.update = false;
        state.error.update = null;
        const articleIndex = state.articles.findIndex(
          article => article.id === action.payload.id
        );
        if (articleIndex !== -1) {
          state.articles[articleIndex] = action.payload;
        }
        // Mark as having pending changes for sync
        if (!state.sync.pendingChanges.includes(action.payload.id)) {
          state.sync.pendingChanges.push(action.payload.id);
        }
      })
      .addCase(updateArticleLocalWithDB.rejected, (state, action) => {
        state.loading.update = false;
        state.error.update =
          action.payload || 'Failed to update article locally';
      })

      // Delete article
      .addCase(deleteArticle.pending, state => {
        state.loading.delete = true;
        state.error.delete = null;
      })
      .addCase(deleteArticle.fulfilled, (state, action) => {
        state.loading.delete = false;
        state.error.delete = null;
        state.articles = state.articles.filter(
          article => article.id !== action.payload
        );
        state.pagination.totalItems = Math.max(
          0,
          state.pagination.totalItems - 1
        );

        // Clean up selection and sync state
        state.selectedArticleIds = state.selectedArticleIds.filter(
          id => id !== action.payload
        );
        state.sync.pendingChanges = state.sync.pendingChanges.filter(
          id => id !== action.payload
        );
        state.sync.conflicts = state.sync.conflicts.filter(
          id => id !== action.payload
        );

        if (state.selectedArticleId === action.payload) {
          state.selectedArticleId = null;
        }
      })
      .addCase(deleteArticle.rejected, (state, action) => {
        state.loading.delete = false;
        state.error.delete = action.payload || 'Failed to delete article';
      })

      // Sync articles
      .addCase(syncArticles.pending, state => {
        state.loading.sync = true;
        state.sync.isSyncing = true;
        state.sync.syncError = null;
      })
      .addCase(syncArticles.fulfilled, (state, action) => {
        state.loading.sync = false;
        state.sync.isSyncing = false;
        state.sync.lastSyncTime = new Date().toISOString();
        state.sync.syncError = null;

        const { conflictCount, articles } = action.payload;

        // Add or update synced articles in the store
        if (articles && articles.length > 0) {
          articles.forEach(syncedArticle => {
            const existingIndex = state.articles.findIndex(
              article => article.id === syncedArticle.id
            );
            if (existingIndex !== -1) {
              state.articles[existingIndex] = syncedArticle;
            } else {
              state.articles.push(syncedArticle);
            }
          });
          // Re-sort after sync
          state.articles.sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        }

        // Clear pending changes for successfully synced articles
        // This would be more sophisticated in a real implementation
        if (conflictCount === 0) {
          state.sync.pendingChanges = [];
        }
      })
      .addCase(syncArticles.rejected, (state, action) => {
        state.loading.sync = false;
        state.sync.isSyncing = false;
        state.sync.syncError = action.payload || 'Failed to sync articles';
      })

      // Fetch article content
      .addCase(fetchArticleContent.pending, (state, action) => {
        const articleId = action.meta.arg.articleId;
        state.contentLoading[articleId] = true;
        delete state.contentErrors[articleId];
      })
      .addCase(fetchArticleContent.fulfilled, (state, action) => {
        const articleId = action.meta.arg.articleId;
        state.contentLoading[articleId] = false;
        delete state.contentErrors[articleId];

        // Update the article with the fetched content
        const articleIndex = state.articles.findIndex(
          article => article.id === articleId
        );

        if (articleIndex !== -1) {
          const existingArticle = state.articles[articleIndex];
          // Preserve important fields while updating content
          const updatedArticle = {
            ...existingArticle,
            content: action.payload.content || existingArticle.content,
            summary: action.payload.summary || existingArticle.summary,
            imageUrl: action.payload.imageUrl || existingArticle.imageUrl,
            updatedAt: action.payload.updatedAt || new Date().toISOString(),
          };
          state.articles[articleIndex] = updatedArticle;
        }
      })
      .addCase(fetchArticleContent.rejected, (state, action) => {
        const articleId = action.meta.arg.articleId;
        state.contentLoading[articleId] = false;
        state.contentErrors[articleId] = action.payload || 'Failed to fetch content';
      });
  },
});

// Export simple selectors for articles
export const selectAllArticles = (state: RootState) => state.articles.articles;
export const selectArticleById = (state: RootState, id: string) =>
  state.articles.articles.find(article => article.id === id);
export const selectArticleIds = (state: RootState) =>
  state.articles.articles.map(article => article.id);
export const selectTotalArticles = (state: RootState) =>
  state.articles.articles.length;

// Content loading selectors
export const selectContentLoading = (state: RootState, articleId: string) =>
  state.articles.contentLoading[articleId] || false;
export const selectContentError = (state: RootState, articleId: string) =>
  state.articles.contentErrors[articleId] || null;
export const selectIsContentLoading = (state: RootState) =>
  Object.values(state.articles.contentLoading).some(loading => loading);
export const selectArticleContentState = (state: RootState, articleId: string) => ({
  isLoading: state.articles.contentLoading[articleId] || false,
  error: state.articles.contentErrors[articleId] || null,
  article: state.articles.articles.find(article => article.id === articleId),
});

// Export action creators
export const {
  clearError,
  setFilters,
  clearFilters,
  setPage,
  setPageSize,
  setSelectedArticle,
  toggleMultiSelectMode,
  toggleArticleSelection,
  clearSelection,
  updateArticleLocal,
  markSyncConflict,
  resolveSyncConflict,
  clearSyncError,
  setContentLoading,
  setContentError,
  clearContentError,
  clearAll,
} = articlesSlice.actions;

export default articlesSlice.reducer;
