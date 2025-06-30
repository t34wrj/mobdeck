import { createSlice, createAsyncThunk, PayloadAction, createEntityAdapter } from '@reduxjs/toolkit';
import { Article, PaginatedResponse, ApiResponse } from '../../types';
import { RootState } from '../index';

// Entity adapter for normalized state management
const articlesAdapter = createEntityAdapter<Article>({
  selectId: (article) => article.id,
  sortComparer: (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
});

// Enhanced state interface with sync state and pagination
export interface ArticlesState extends ReturnType<typeof articlesAdapter.getInitialState> {
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

// Mock API service - would be replaced with actual API calls
const mockApiService = {
  fetchArticles: async (params: FetchArticlesParams): Promise<PaginatedResponse<Article>> => {
    // Mock implementation - replace with actual API call
    await new Promise<void>(resolve => setTimeout(() => resolve(), 1000));
    return {
      items: [],
      page: params.page || 1,
      totalPages: 0,
      totalItems: 0,
    };
  },
  
  createArticle: async (params: CreateArticleParams): Promise<Article> => {
    await new Promise<void>(resolve => setTimeout(() => resolve(), 500));
    return {
      id: Date.now().toString(),
      title: params.title,
      summary: params.summary || '',
      content: params.content || '',
      url: params.url,
      imageUrl: undefined,
      readTime: undefined,
      isArchived: false,
      isFavorite: false,
      isRead: false,
      tags: params.tags || [],
      sourceUrl: params.url,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncedAt: new Date().toISOString(),
    };
  },
  
  updateArticle: async (_params: UpdateArticleParams): Promise<Article> => {
    await new Promise<void>(resolve => setTimeout(() => resolve(), 500));
    // Mock implementation - replace with actual API call
    throw new Error('Not implemented');
  },
  
  deleteArticle: async (_params: DeleteArticleParams): Promise<void> => {
    await new Promise<void>(resolve => setTimeout(() => resolve(), 500));
    // Mock implementation - replace with actual API call
  },
  
  syncArticles: async (_params: SyncArticlesParams): Promise<{ syncedCount: number; conflictCount: number }> => {
    await new Promise<void>(resolve => setTimeout(() => resolve(), 2000));
    return { syncedCount: 0, conflictCount: 0 };
  },
};

// Async thunk actions
export const fetchArticles = createAsyncThunk<
  PaginatedResponse<Article>,
  FetchArticlesParams,
  { rejectValue: string; state: RootState }
>('articles/fetchArticles', async (params, { rejectWithValue, getState }) => {
  try {
    const state = getState();
    const currentPage = params.page || state.articles.pagination.page;
    
    const response = await mockApiService.fetchArticles({
      ...params,
      page: currentPage,
      limit: params.limit || state.articles.pagination.limit,
    });
    
    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch articles';
    return rejectWithValue(errorMessage);
  }
});

export const createArticle = createAsyncThunk<
  Article,
  CreateArticleParams,
  { rejectValue: string }
>('articles/createArticle', async (params, { rejectWithValue }) => {
  try {
    const article = await mockApiService.createArticle(params);
    return article;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to create article';
    return rejectWithValue(errorMessage);
  }
});

export const updateArticle = createAsyncThunk<
  Article,
  UpdateArticleParams,
  { rejectValue: string }
>('articles/updateArticle', async (params, { rejectWithValue }) => {
  try {
    const article = await mockApiService.updateArticle(params);
    return article;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to update article';
    return rejectWithValue(errorMessage);
  }
});

export const deleteArticle = createAsyncThunk<
  string,
  DeleteArticleParams,
  { rejectValue: string }
>('articles/deleteArticle', async (params, { rejectWithValue }) => {
  try {
    await mockApiService.deleteArticle(params);
    return params.id;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete article';
    return rejectWithValue(errorMessage);
  }
});

export const syncArticles = createAsyncThunk<
  { syncedCount: number; conflictCount: number },
  SyncArticlesParams,
  { rejectValue: string }
>('articles/syncArticles', async (params, { rejectWithValue }) => {
  try {
    const result = await mockApiService.syncArticles(params);
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to sync articles';
    return rejectWithValue(errorMessage);
  }
});

// Slice definition
const articlesSlice = createSlice({
  name: 'articles',
  initialState,
  reducers: {
    // Clear errors
    clearError: (state, action: PayloadAction<keyof ArticlesState['error'] | 'all'>) => {
      if (action.payload === 'all') {
        state.error = initialState.error;
      } else {
        state.error[action.payload] = null;
      }
    },
    
    // Update filters
    setFilters: (state, action: PayloadAction<Partial<ArticlesState['filters']>>) => {
      state.filters = { ...state.filters, ...action.payload };
      // Reset pagination when filters change
      state.pagination.page = 1;
    },
    
    clearFilters: (state) => {
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
    
    toggleMultiSelectMode: (state) => {
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
    
    clearSelection: (state) => {
      state.selectedArticleIds = [];
      state.multiSelectMode = false;
    },
    
    // Local article updates (for optimistic updates)
    updateArticleLocal: (state, action: PayloadAction<{ id: string; updates: Partial<Article> }>) => {
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
      state.sync.conflicts = state.sync.conflicts.filter(id => id !== articleId);
      state.sync.pendingChanges = state.sync.pendingChanges.filter(id => id !== articleId);
    },
    
    clearSyncError: (state) => {
      state.sync.syncError = null;
    },
  },
  
  extraReducers: (builder) => {
    builder
      // Fetch articles
      .addCase(fetchArticles.pending, (state) => {
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
      
      // Create article
      .addCase(createArticle.pending, (state) => {
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
      .addCase(updateArticle.pending, (state) => {
        state.loading.update = true;
        state.error.update = null;
      })
      .addCase(updateArticle.fulfilled, (state, action) => {
        state.loading.update = false;
        state.error.update = null;
        articlesAdapter.updateOne(state, {
          id: action.payload.id,
          changes: action.payload,
        });
        // Remove from pending changes after successful sync
        state.sync.pendingChanges = state.sync.pendingChanges.filter(
          id => id !== action.payload.id
        );
      })
      .addCase(updateArticle.rejected, (state, action) => {
        state.loading.update = false;
        state.error.update = action.payload || 'Failed to update article';
      })
      
      // Delete article
      .addCase(deleteArticle.pending, (state) => {
        state.loading.delete = true;
        state.error.delete = null;
      })
      .addCase(deleteArticle.fulfilled, (state, action) => {
        state.loading.delete = false;
        state.error.delete = null;
        articlesAdapter.removeOne(state, action.payload);
        state.pagination.totalItems = Math.max(0, state.pagination.totalItems - 1);
        
        // Clean up selection and sync state
        state.selectedArticleIds = state.selectedArticleIds.filter(id => id !== action.payload);
        state.sync.pendingChanges = state.sync.pendingChanges.filter(id => id !== action.payload);
        state.sync.conflicts = state.sync.conflicts.filter(id => id !== action.payload);
        
        if (state.selectedArticleId === action.payload) {
          state.selectedArticleId = null;
        }
      })
      .addCase(deleteArticle.rejected, (state, action) => {
        state.loading.delete = false;
        state.error.delete = action.payload || 'Failed to delete article';
      })
      
      // Sync articles
      .addCase(syncArticles.pending, (state) => {
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
} = articlesSlice.actions;

export default articlesSlice.reducer;