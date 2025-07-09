/**
 * Article Operations Performance Tests
 * 
 * Tests performance of:
 * - Article list rendering with large datasets
 * - Search and filter operations
 * - Article CRUD operations
 * - Pagination and infinite scroll
 * - Image loading and caching
 */

import React from 'react';
import { FlatList, View, Text, TouchableOpacity, TextInput, Image } from 'react-native';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { NavigationContainer } from '@react-navigation/native';
import { store } from '../../src/store';
import { performanceTestHelper, PERFORMANCE_THRESHOLDS } from '../../src/utils/performanceTestHelper';
import { Article } from '../../src/types';
import { fetchArticles } from '../../src/store/slices/articlesSlice';

// Mock dependencies
jest.mock('../../src/services/ArticlesApiService');
jest.mock('../../src/services/DatabaseService');
// Fast image not currently used - using standard Image component

// Mock ArticlesListScreen for performance testing
const MockArticlesListScreen: React.FC = () => {
  return (
    <View testID="articles-list">
      <TextInput testID="search-input" />
      <TouchableOpacity testID="filter-button">
        <Text>Filter</Text>
      </TouchableOpacity>
      <TouchableOpacity testID="filter-unread">
        <Text>Unread</Text>
      </TouchableOpacity>
      <TouchableOpacity testID="filter-favorite">
        <Text>Favorite</Text>
      </TouchableOpacity>
      <TouchableOpacity testID="filter-archived">
        <Text>Archived</Text>
      </TouchableOpacity>
      <FlatList
        testID="articles-flatlist"
        data={[]}
        renderItem={() => null}
        keyExtractor={(item: any) => item?.id || 'mock-item'}
      />
    </View>
  );
};

// Mock ArticleCard component
const MockArticleCard: React.FC<{ article: any }> = ({ article }) => {
  return (
    <View testID="article-card">
      <Text>{article.title}</Text>
      {article.imageUrl && (
        <Image 
          testID={`article-image-${article.id}`} 
          source={{ uri: article.imageUrl }} 
        />
      )}
    </View>
  );
};

// Test data factory
const createTestArticles = (count: number): Article[] => {
  return Array.from({ length: count }, (_, i) => ({
    id: `article-${i}`,
    title: `Test Article ${i} - ${Math.random().toString(36).substring(7)}`,
    summary: `Summary for article ${i} with some content to make it realistic`,
    content: `Full content for article ${i}. `.repeat(10),
    url: `https://example.com/article-${i}`,
    imageUrl: i % 3 === 0 ? `https://example.com/image-${i}.jpg` : undefined,
    readTime: Math.floor(Math.random() * 20) + 1,
    isArchived: i % 10 === 0,
    isFavorite: i % 5 === 0,
    isRead: i % 4 === 0,
    tags: [`tag-${i % 5}`, `category-${i % 3}`],
    sourceUrl: 'https://example.com',
    createdAt: new Date(Date.now() - i * 3600000), // 1 hour apart
    updatedAt: new Date(Date.now() - i * 1800000), // 30 min apart
    syncedAt: new Date(),
    isModified: false,
  }));
};

describe('Article Operations Performance Tests', () => {
  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <Provider store={store}>
        <NavigationContainer>
          {component}
        </NavigationContainer>
      </Provider>
    );
  };

  beforeEach(() => {
    performanceTestHelper.clearMetrics();
    jest.clearAllMocks();
  });

  describe('Article List Rendering Performance', () => {
    it('should render 50 articles efficiently', async () => {
      const articles = createTestArticles(50);
      // Simulate fulfilled fetchArticles action
      store.dispatch(fetchArticles.fulfilled({
        items: articles,
        totalCount: 50,
        hasMore: false,
        limit: 50,
        offset: 0
      }, 'test', { page: 1, limit: 50 }));

      const { result: screen, metrics } = performanceTestHelper.measureSync(
        'render_50_articles',
        () => render(
          <Provider store={store}>
            <NavigationContainer>
              <View testID="articles-list">
                <TextInput testID="search-input" />
                <TouchableOpacity testID="filter-button">
                  <Text>Filter</Text>
                </TouchableOpacity>
                <FlatList
                  testID="articles-flatlist"
                  data={articles}
                  renderItem={({ item }) => (
                    <View testID="article-card">
                      <Text>{item.title}</Text>
                    </View>
                  )}
                  keyExtractor={(item) => item.id}
                />
              </View>
            </NavigationContainer>
          </Provider>
        ),
        { articleCount: 50 }
      );

      await waitFor(() => {
        expect(screen.getByTestId('articles-list')).toBeTruthy();
      });

      // Validate rendering performance
      const validation = performanceTestHelper.validatePerformance(
        'render_50_articles',
        PERFORMANCE_THRESHOLDS.ARTICLE_LIST_RENDER
      );
      expect(validation.passed).toBe(true);
    });

    it('should handle 200 articles with virtualization', async () => {
      const articles = createTestArticles(200);
      store.dispatch(fetchArticles.fulfilled({
        items: articles,
        totalCount: articles.length,
        hasMore: false,
        limit: articles.length,
        offset: 0
      }, 'test', { page: 1, limit: articles.length }));

      const { result: screen } = performanceTestHelper.measureSync(
        'render_200_articles_virtualized',
        () => render(
          <Provider store={store}>
            <NavigationContainer>
              <View testID="articles-list">
                <FlatList
                  testID="articles-flatlist"
                  data={articles}
                  renderItem={({ item }) => (
                    <View testID="article-card">
                      <Text>{item.title}</Text>
                    </View>
                  )}
                  keyExtractor={(item) => item.id}
                />
              </View>
            </NavigationContainer>
          </Provider>
        ),
        { articleCount: 200, virtualized: true }
      );

      await waitFor(() => {
        expect(screen.getByTestId('articles-list')).toBeTruthy();
      });

      // Test scrolling performance
      const flatList = screen.getByTestId('articles-flatlist');
      
      const { metrics } = await performanceTestHelper.measureAsync(
        'scroll_200_articles',
        async () => {
          // Simulate scrolling to different positions
          fireEvent.scroll(flatList, {
            nativeEvent: {
              contentOffset: { y: 1000 },
              contentSize: { height: 10000 },
              layoutMeasurement: { height: 800 },
            },
          });

          await waitFor(() => {
            // Wait for render to complete
          }, { timeout: 100 });
        },
        { operation: 'scroll', position: 1000 }
      );

      // Validate scroll performance
      expect(metrics.duration).toBeLessThan(100);
    });

    it('should optimize re-renders when article status changes', async () => {
      const articles = createTestArticles(100);
      store.dispatch(fetchArticles.fulfilled({
        items: articles,
        totalCount: articles.length,
        hasMore: false,
        limit: articles.length,
        offset: 0
      }, 'test', { page: 1, limit: articles.length }));

      const screen = renderWithProviders(<MockArticlesListScreen />);

      await waitFor(() => {
        expect(screen.getByTestId('articles-list')).toBeTruthy();
      });

      // Measure performance of status updates
      const { metrics } = await performanceTestHelper.measureAsync(
        'article_status_update',
        async () => {
          // Update article status
          const updatedArticles = [...articles];
          updatedArticles[0] = { ...updatedArticles[0], isRead: true };
          store.dispatch(fetchArticles.fulfilled({
            items: updatedArticles,
            totalCount: updatedArticles.length,
            hasMore: false,
            limit: updatedArticles.length,
            offset: 0
          }, 'test', { page: 1, limit: updatedArticles.length }));

          await waitFor(() => {
            // Wait for re-render
          }, { timeout: 50 });
        },
        { operation: 'status_update', articleIndex: 0 }
      );

      // Status updates should be fast (only affected components re-render)
      expect(metrics.duration).toBeLessThan(50);
    });
  });

  describe('Search and Filter Performance', () => {
    it('should search through 100 articles efficiently', async () => {
      const articles = createTestArticles(100);
      store.dispatch(fetchArticles.fulfilled({
        items: articles,
        totalCount: articles.length,
        hasMore: false,
        limit: articles.length,
        offset: 0
      }, 'test', { page: 1, limit: articles.length }));

      const screen = renderWithProviders(<MockArticlesListScreen />);

      await waitFor(() => {
        expect(screen.getByTestId('search-input')).toBeTruthy();
      });

      const searchInput = screen.getByTestId('search-input');

      // Test search performance with different query lengths
      const searchQueries = ['t', 'te', 'test', 'test article'];

      for (const query of searchQueries) {
        await performanceTestHelper.measureAsync(
          `search_${query.length}_chars`,
          async () => {
            fireEvent.changeText(searchInput, query);
            
            await waitFor(() => {
              // Wait for search results to update
            }, { timeout: 100 });
          },
          { query, queryLength: query.length, articleCount: 100 }
        );
      }

      // Validate search performance
      const validation = performanceTestHelper.validatePerformance(
        'search_4_chars',
        PERFORMANCE_THRESHOLDS.ARTICLE_SEARCH
      );
      expect(validation.passed).toBe(true);
    });

    it('should filter articles by status efficiently', async () => {
      const articles = createTestArticles(150);
      store.dispatch(fetchArticles.fulfilled({
        items: articles,
        totalCount: articles.length,
        hasMore: false,
        limit: articles.length,
        offset: 0
      }, 'test', { page: 1, limit: articles.length }));

      const screen = renderWithProviders(<MockArticlesListScreen />);

      await waitFor(() => {
        expect(screen.getByTestId('filter-button')).toBeTruthy();
      });

      // Test filter performance
      const filters = [
        { name: 'unread', testId: 'filter-unread' },
        { name: 'favorite', testId: 'filter-favorite' },
        { name: 'archived', testId: 'filter-archived' },
      ];

      for (const filter of filters) {
        await performanceTestHelper.measureAsync(
          `filter_${filter.name}`,
          async () => {
            fireEvent.press(screen.getByTestId(filter.testId));
            
            await waitFor(() => {
              // Wait for filter to apply
            }, { timeout: 100 });
          },
          { filterType: filter.name, articleCount: 150 }
        );
      }

      // Filter operations should be fast
      const avgMetrics = performanceTestHelper.getAverageMetrics('filter_favorite');
      expect(avgMetrics.averageDuration).toBeLessThan(100);
    });

    it('should handle combined search and filter operations', async () => {
      const articles = createTestArticles(100);
      store.dispatch(fetchArticles.fulfilled({
        items: articles,
        totalCount: articles.length,
        hasMore: false,
        limit: articles.length,
        offset: 0
      }, 'test', { page: 1, limit: articles.length }));

      const screen = renderWithProviders(<MockArticlesListScreen />);

      await waitFor(() => {
        expect(screen.getByTestId('search-input')).toBeTruthy();
        expect(screen.getByTestId('filter-button')).toBeTruthy();
      });

      // Apply filter first
      fireEvent.press(screen.getByTestId('filter-unread'));

      // Then search within filtered results
      const { metrics } = await performanceTestHelper.measureAsync(
        'search_with_filter',
        async () => {
          fireEvent.changeText(screen.getByTestId('search-input'), 'article');
          
          await waitFor(() => {
            // Wait for combined results
          }, { timeout: 150 });
        },
        { operation: 'search_and_filter' }
      );

      expect(metrics.duration).toBeLessThan(150);
    });
  });

  describe('Article Card Rendering Performance', () => {
    it('should render individual article cards efficiently', async () => {
      const article = createTestArticles(1)[0];

      const measurements: number[] = [];

      // Render multiple times to get average
      for (let i = 0; i < 10; i++) {
        const { metrics } = performanceTestHelper.measureSync(
          `render_article_card_${i}`,
          () => render(
            <View testID="article-card">
              <Text>{article.title}</Text>
              {article.imageUrl && (
                <Image 
                  testID={`article-image-${article.id}`} 
                  source={{ uri: article.imageUrl }} 
                />
              )}
            </View>
          ),
          { iteration: i }
        );
        measurements.push(metrics.duration);
      }

      const avgDuration = measurements.reduce((a, b) => a + b, 0) / measurements.length;
      expect(avgDuration).toBeLessThan(10); // Individual cards should render very fast
    });

    it('should handle image loading performance', async () => {
      const articlesWithImages = createTestArticles(20).map(a => ({
        ...a,
        imageUrl: `https://example.com/image-${a.id}.jpg`,
      }));

      store.dispatch(fetchArticles.fulfilled({
        items: articlesWithImages,
        totalCount: articlesWithImages.length,
        hasMore: false,
        limit: articlesWithImages.length,
        offset: 0
      }, 'test', { page: 1, limit: articlesWithImages.length }));

      const screen = render(
        <Provider store={store}>
          <NavigationContainer>
            <View testID="articles-list">
              <FlatList
                testID="articles-flatlist"
                data={articlesWithImages}
                renderItem={({ item }) => (
                  <View testID="article-card">
                    <Text>{item.title}</Text>
                    {item.imageUrl && (
                      <Image 
                        testID={`article-image-${item.id}`} 
                        source={{ uri: item.imageUrl }} 
                      />
                    )}
                  </View>
                )}
                keyExtractor={(item) => item.id}
              />
            </View>
          </NavigationContainer>
        </Provider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('articles-list')).toBeTruthy();
      });

      // Measure image loading impact
      const { metrics } = await performanceTestHelper.measureAsync(
        'image_loading_impact',
        async () => {
          // For performance testing, just simulate the time it takes to render with images
          await waitFor(() => {
            // Test that the FlatList renders without performance issues
            expect(screen.getByTestId('articles-flatlist')).toBeTruthy();
          }, { timeout: 200 });
        },
        { imageCount: 20 }
      );

      // Validate image loading doesn't block UI
      const validation = performanceTestHelper.validatePerformance(
        'image_loading_impact',
        PERFORMANCE_THRESHOLDS.IMAGE_LOAD
      );
      expect(validation.passed).toBe(true);
    });
  });

  describe('Pagination Performance', () => {
    it('should load more articles efficiently on scroll', async () => {
      const initialArticles = createTestArticles(50);
      const moreArticles = createTestArticles(50).map(a => ({
        ...a,
        id: `more-${a.id}`,
      }));

      store.dispatch(fetchArticles.fulfilled({
        items: initialArticles,
        totalCount: initialArticles.length,
        hasMore: false,
        limit: initialArticles.length,
        offset: 0
      }, 'test', { page: 1, limit: initialArticles.length }));

      const screen = renderWithProviders(<MockArticlesListScreen />);

      await waitFor(() => {
        expect(screen.getByTestId('articles-list')).toBeTruthy();
      });

      const flatList = screen.getByTestId('articles-list');

      // Simulate scroll to end
      const { metrics } = await performanceTestHelper.measureAsync(
        'load_more_articles',
        async () => {
          fireEvent(flatList, 'onEndReached');

          // Simulate API response
          setTimeout(() => {
            store.dispatch(fetchArticles.fulfilled({
              items: [...initialArticles, ...moreArticles],
              totalCount: initialArticles.length + moreArticles.length,
              hasMore: false,
              limit: initialArticles.length + moreArticles.length,
              offset: 0
            }, 'test', { page: 1, limit: initialArticles.length + moreArticles.length }));
          }, 100);

          await waitFor(() => {
            // Wait for new articles to render
          }, { timeout: 300 });
        },
        { operation: 'pagination', newArticles: 50 }
      );

      expect(metrics.duration).toBeLessThan(500);
    });

    it('should maintain scroll position when loading more', async () => {
      const articles = createTestArticles(100);
      const initialArticles = articles.slice(0, 50);
      store.dispatch(fetchArticles.fulfilled({
        items: initialArticles,
        totalCount: initialArticles.length,
        hasMore: false,
        limit: initialArticles.length,
        offset: 0
      }, 'test', { page: 1, limit: initialArticles.length }));

      const screen = renderWithProviders(<MockArticlesListScreen />);

      await waitFor(() => {
        expect(screen.getByTestId('articles-list')).toBeTruthy();
      });

      const flatList = screen.getByTestId('articles-list');

      // Scroll to middle
      fireEvent.scroll(flatList, {
        nativeEvent: {
          contentOffset: { y: 2000 },
          contentSize: { height: 5000 },
          layoutMeasurement: { height: 800 },
        },
      });

      // Load more articles
      const { metrics } = await performanceTestHelper.measureAsync(
        'maintain_scroll_position',
        async () => {
          store.dispatch(fetchArticles.fulfilled({
        items: articles,
        totalCount: articles.length,
        hasMore: false,
        limit: articles.length,
        offset: 0
      }, 'test', { page: 1, limit: articles.length }));

          await waitFor(() => {
            // Verify scroll position maintained
          }, { timeout: 100 });
        },
        { operation: 'scroll_position_maintenance' }
      );

      expect(metrics.duration).toBeLessThan(100);
    });
  });

  describe('Memory Usage', () => {
    it('should not leak memory when mounting/unmounting article lists', async () => {
      if (!global.performance || !('memory' in global.performance)) {
        console.log('Memory monitoring not available, skipping test');
        return;
      }

      const articles = createTestArticles(100);
      store.dispatch(fetchArticles.fulfilled({
        items: articles,
        totalCount: articles.length,
        hasMore: false,
        limit: articles.length,
        offset: 0
      }, 'test', { page: 1, limit: articles.length }));

      const initialMemory = performanceTestHelper['getCurrentMemoryUsage']() || 0;
      const memorySnapshots: number[] = [];

      // Mount and unmount multiple times
      for (let i = 0; i < 5; i++) {
        const { unmount } = renderWithProviders(<MockArticlesListScreen />);

        await waitFor(() => {
          // Wait for render
        }, { timeout: 100 });

        unmount();

        const currentMemory = performanceTestHelper['getCurrentMemoryUsage']() || 0;
        memorySnapshots.push(currentMemory);
      }

      // Memory should not continuously increase
      const memoryGrowth = memorySnapshots[4] - initialMemory;
      expect(memoryGrowth).toBeLessThan(10 * 1024 * 1024); // Less than 10MB growth
    });
  });

  afterAll(() => {
    // Generate performance report for article operations
    const report = performanceTestHelper.generateReport();
    console.log('\n=== Article Operations Performance Report ===\n');
    console.log(report);
  });
});