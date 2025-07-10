import {
  createSlice,
  createAsyncThunk,
  PayloadAction,
  createEntityAdapter,
} from '@reduxjs/toolkit';
import { Article, PaginatedResponse } from '../../types';
import { RootState } from '../index';
import { articlesApiService } from '../../services/ArticlesApiService';
import DatabaseService from '../../services/DatabaseService';

// Entity adapter for normalized state management
const articlesAdapter = createEntityAdapter<Article>({
  selectId: article => article.id,
  sortComparer: (a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
});

// Enhanced state interface with sync state and pagination
export interface ArticlesState
  extends ReturnType<typeof articlesAdapter.getInitialState> {
  // Loading states
  loading: {
    fetch: boolean;
    create: boolean;
    update: boolean;
    delete: boolean;
    sync: boolean;
  };

  // Error states
  error: {
    fetch: string | null;
    create: string | null;
    update: string | null;
    delete: string | null;
    sync: string | null;
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
}

// Initial state
const initialState: ArticlesState = {
  ...articlesAdapter.getInitialState(),
  loading: {
    fetch: false,
    create: false,
    update: false,
    delete: false,
    sync: false,
  },
  error: {
    fetch: null,
    create: null,
    update: null,
    delete: null,
    sync: null,
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
      return rejectWithValue('Please configure your Readeck server settings first');
    }

    const currentPage = params.page || state.articles.pagination.page;

    const response = await articlesApiService.fetchArticles({
      ...params,
      page: currentPage,
      limit: params.limit || state.articles.pagination.limit,
      filters: params.filters || state.articles.filters,
      fetchFullContent: false, // Disable bulk full content fetching to avoid API spam
    });

    return response;
  } catch (error) {
    console.error('[articlesSlice] fetchArticles error:', error);
    
    let errorMessage = 'Failed to fetch articles';
    if (error instanceof Error) {
      if (error.message.includes('401') || error.message.includes('unauthorized')) {
        errorMessage = 'Authentication failed. Please check your server settings.';
      } else if (error.message.includes('404') || error.message.includes('not found')) {
        errorMessage = 'Server not found. Please check your server URL.';
      } else if (error.message.includes('Network') || error.message.includes('network')) {
        errorMessage = 'Network error. Please check your connection and server URL.';
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
    const article = await articlesApiService.createArticle(params);
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
    const article = await articlesApiService.updateArticle(params);
    
    // Also persist to local database with is_modified flag for sync
    try {
      const updatedArticleForDB = {
        ...article,
        isModified: true, // Mark as modified for sync
        syncedAt: null, // Clear synced timestamp since it's now modified
      };
      
      await DatabaseService.updateArticle(article.id, updatedArticleForDB);
      console.log('[ArticlesSlice] Article updated in database and marked for sync:', article.id);
    } catch (dbError) {
      console.warn('[ArticlesSlice] Failed to update article in database:', dbError);
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
>('articles/updateArticleLocalWithDB', async (params, { rejectWithValue, getState }) => {
  try {
    const state = getState() as RootState;
    const existingArticle = state.articles.entities[params.id];
    
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
    await DatabaseService.updateArticle(params.id, updatedArticle);
    console.log('[ArticlesSlice] Article updated locally in database and marked for sync:', params.id);
    
    return updatedArticle;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to update article locally';
    return rejectWithValue(errorMessage);
  }
});

export const deleteArticle = createAsyncThunk<
  string,
  DeleteArticleParams,
  { rejectValue: string }
>('articles/deleteArticle', async (params, { rejectWithValue }) => {
  try {
    await articlesApiService.deleteArticle(params);
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
    
    const result = await DatabaseService.getArticles({
      limit,
      offset,
      searchQuery: params.searchQuery,
      isArchived: params.filters?.isArchived,
      isFavorite: params.filters?.isFavorite,
      isRead: params.filters?.isRead,
    });

    if (result.success && result.data) {
      console.log(`[articlesSlice] Loaded ${result.data.items.length} articles from local database`);
      
      // Convert database articles to Article format
      const articles = result.data.items.map(dbArticle => ({
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
        syncedAt: dbArticle.synced_at ? new Date(dbArticle.synced_at * 1000).toISOString() : undefined,
      }));

      // Calculate pagination from database result
      const currentPage = Math.floor(result.data.offset / result.data.limit) + 1;
      const totalPages = Math.ceil(result.data.totalCount / result.data.limit);
      
      return {
        items: articles,
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
    return rejectWithValue(error instanceof Error ? error.message : 'Failed to load local articles');
  }
});

export const syncArticles = createAsyncThunk<
  { syncedCount: number; conflictCount: number },
  SyncArticlesParams,
  { rejectValue: string }
>('articles/syncArticles', async (params, { rejectWithValue }) => {
  try {
    const result = await articlesApiService.syncArticles(params);
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
      const existingArticle = state.entities[id];
      if (existingArticle) {
        articlesAdapter.updateOne(state, {
          id,
          changes: {
            ...updates,
            updatedAt: new Date().toISOString(),
          },
        });

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

    // Clear all articles data (used during logout)
    clearAll: state => {
      articlesAdapter.removeAll(state);
      return {
        ...initialState,
        ids: state.ids,
        entities: state.entities,
      };
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
          articlesAdapter.setAll(state, items);
        } else {
          articlesAdapter.addMany(state, items);
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

        const { items, pagination } = action.payload;

        // Update pagination
        state.pagination = {
          page: pagination.page,
          totalPages: pagination.pages,
          totalItems: pagination.total,
          limit: pagination.limit,
          hasMore: pagination.hasNextPage,
        };

        // Handle pagination: replace for page 1, append for subsequent pages
        if (pagination.page === 1) {
          articlesAdapter.setAll(state, items);
        } else {
          articlesAdapter.addMany(state, items);
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
        articlesAdapter.addOne(state, action.payload);
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
        
        // Get existing article to preserve fields that might not be in API response
        const existingArticle = state.entities[action.payload.id];
        
        if (existingArticle) {
          // Create a smart merge that preserves important fields like content
          const mergedChanges = { ...existingArticle };
          
          // Only update fields that are meaningful (not empty strings or undefined)
          Object.entries(action.payload).forEach(([key, value]) => {
            // Always update these fields regardless of value
            const alwaysUpdateFields = ['id', 'isRead', 'isArchived', 'isFavorite', 'tags', 'syncedAt', 'updatedAt'];
            
            // For content, only update if the new value has actual content
            if (key === 'content') {
              if (value && typeof value === 'string' && value.trim().length > 0) {
                mergedChanges[key] = value;
              }
              // Otherwise keep existing content
            }
            // For other fields, update if not empty or if it's an always-update field
            else if (alwaysUpdateFields.includes(key) || (value !== '' && value !== null && value !== undefined)) {
              mergedChanges[key] = value;
            }
          });
          
          articlesAdapter.updateOne(state, {
            id: action.payload.id,
            changes: mergedChanges,
          });
        } else {
          // No existing article, use the payload as-is
          articlesAdapter.updateOne(state, {
            id: action.payload.id,
            changes: action.payload,
          });
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
        articlesAdapter.updateOne(state, {
          id: action.payload.id,
          changes: action.payload,
        });
        // Mark as having pending changes for sync
        if (!state.sync.pendingChanges.includes(action.payload.id)) {
          state.sync.pendingChanges.push(action.payload.id);
        }
      })
      .addCase(updateArticleLocalWithDB.rejected, (state, action) => {
        state.loading.update = false;
        state.error.update = action.payload || 'Failed to update article locally';
      })

      // Delete article
      .addCase(deleteArticle.pending, state => {
        state.loading.delete = true;
        state.error.delete = null;
      })
      .addCase(deleteArticle.fulfilled, (state, action) => {
        state.loading.delete = false;
        state.error.delete = null;
        articlesAdapter.removeOne(state, action.payload);
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

        const { conflictCount } = action.payload;

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
      });
  },
});

// Export selectors created by entity adapter
export const {
  selectAll: selectAllArticles,
  selectById: selectArticleById,
  selectIds: selectArticleIds,
  selectEntities: selectArticleEntities,
  selectTotal: selectTotalArticles,
} = articlesAdapter.getSelectors((state: RootState) => state.articles);

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
  clearAll,
} = articlesSlice.actions;

export default articlesSlice.reducer;
