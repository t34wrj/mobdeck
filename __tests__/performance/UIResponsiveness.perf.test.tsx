/**
 * UI Responsiveness Performance Tests
 * 
 * Tests performance of:
 * - Navigation transitions between screens
 * - Pull-to-refresh functionality
 * - Button press responsiveness
 * - Modal/dialog animations
 * - Gesture handling (swipe, long press)
 * - Input field responsiveness
 */

import React from 'react';
import { 
  render, 
  waitFor, 
  fireEvent, 
  act,
  within
} from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ArticlesListScreen from '../../src/screens/main/ArticlesListScreen';
import ArticleScreen from '../../src/screens/main/ArticleScreen';
import SettingsScreen from '../../src/screens/main/SettingsScreen';
import AuthScreen from '../../src/screens/auth/AuthScreen';
import { store } from '../../src/store';
import { performanceTestHelper, PERFORMANCE_THRESHOLDS } from '../../src/utils/performanceTestHelper';
import { setArticles } from '../../src/store/slices/articlesSlice';
import { Article } from '../../src/types';

// Mock dependencies
jest.mock('../../src/services/ArticlesApiService');
jest.mock('../../src/services/DatabaseService');
jest.mock('../../src/services/SyncService');
jest.mock('react-native-webview', () => ({
  WebView: 'WebView',
}));

const Stack = createNativeStackNavigator();

// Test navigation setup
const TestNavigator: React.FC<{ initialRouteName?: string }> = ({ 
  initialRouteName = 'ArticlesList' 
}) => {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName={initialRouteName}>
        <Stack.Screen name="ArticlesList" component={ArticlesListScreen} />
        <Stack.Screen name="Article" component={ArticleScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="Auth" component={AuthScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

// Test data
const createTestArticle = (id: string): Article => ({
  id,
  title: `Test Article ${id}`,
  summary: `Summary for ${id}`,
  content: `<h1>Article Content</h1><p>This is the content for article ${id}</p>`,
  url: `https://example.com/article-${id}`,
  imageUrl: `https://example.com/image-${id}.jpg`,
  readTime: 5,
  isArchived: false,
  isFavorite: false,
  isRead: false,
  tags: ['test'],
  sourceUrl: 'https://example.com',
  createdAt: new Date(),
  updatedAt: new Date(),
  syncedAt: new Date(),
  isModified: false,
});

describe('UI Responsiveness Performance Tests', () => {
  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <Provider store={store}>
        {component}
      </Provider>
    );
  };

  beforeEach(() => {
    performanceTestHelper.clearMetrics();
    jest.clearAllMocks();
    
    // Setup initial data
    const articles = Array.from({ length: 20 }, (_, i) => 
      createTestArticle(`article-${i}`)
    );
    store.dispatch(setArticles(articles));
  });

  describe('Navigation Transition Performance', () => {
    it('should navigate between screens within threshold', async () => {
      const screen = renderWithProviders(<TestNavigator />);

      await waitFor(() => {
        expect(screen.getByTestId('articles-list')).toBeTruthy();
      });

      // Find first article card
      const articleCards = screen.getAllByTestId(/article-card-.*/);
      expect(articleCards.length).toBeGreaterThan(0);

      // Measure navigation to article detail
      const { metrics: navToArticle } = await performanceTestHelper.measureAsync(
        'navigate_to_article',
        async () => {
          fireEvent.press(articleCards[0]);
          
          await waitFor(() => {
            expect(screen.getByTestId('article-content')).toBeTruthy();
          }, { timeout: 500 });
        },
        { from: 'ArticlesList', to: 'Article' }
      );

      // Validate navigation performance
      const validation = performanceTestHelper.validatePerformance(
        'navigate_to_article',
        PERFORMANCE_THRESHOLDS.NAVIGATION
      );
      expect(validation.passed).toBe(true);

      // Measure back navigation
      const { metrics: navBack } = await performanceTestHelper.measureAsync(
        'navigate_back',
        async () => {
          const backButton = screen.getByTestId('back-button');
          fireEvent.press(backButton);
          
          await waitFor(() => {
            expect(screen.getByTestId('articles-list')).toBeTruthy();
          }, { timeout: 300 });
        },
        { from: 'Article', to: 'ArticlesList' }
      );

      expect(navBack.duration).toBeLessThan(PERFORMANCE_THRESHOLDS.NAVIGATION.maxDuration);
    });

    it('should handle rapid navigation without lag', async () => {
      const screen = renderWithProviders(<TestNavigator />);

      await waitFor(() => {
        expect(screen.getByTestId('articles-list')).toBeTruthy();
      });

      // Rapid navigation test
      const navigationSequence = async () => {
        // Navigate to settings
        fireEvent.press(screen.getByTestId('settings-button'));
        await waitFor(() => screen.getByTestId('settings-screen'), { timeout: 300 });

        // Back to articles
        fireEvent.press(screen.getByTestId('back-button'));
        await waitFor(() => screen.getByTestId('articles-list'), { timeout: 300 });

        // Navigate to article
        const articleCards = screen.getAllByTestId(/article-card-.*/);
        fireEvent.press(articleCards[0]);
        await waitFor(() => screen.getByTestId('article-content'), { timeout: 300 });

        // Back again
        fireEvent.press(screen.getByTestId('back-button'));
        await waitFor(() => screen.getByTestId('articles-list'), { timeout: 300 });
      };

      const { metrics } = await performanceTestHelper.measureAsync(
        'rapid_navigation_sequence',
        navigationSequence,
        { sequence: '4 navigations' }
      );

      // Average time per navigation
      const avgTimePerNav = metrics.duration / 4;
      expect(avgTimePerNav).toBeLessThan(PERFORMANCE_THRESHOLDS.NAVIGATION.maxDuration);
    });
  });

  describe('Pull-to-Refresh Performance', () => {
    it('should handle pull-to-refresh efficiently', async () => {
      const mockRefresh = jest.fn().mockResolvedValue({ items: [] });
      
      const screen = renderWithProviders(<TestNavigator />);

      await waitFor(() => {
        expect(screen.getByTestId('articles-list')).toBeTruthy();
      });

      const scrollView = screen.getByTestId('articles-list');

      // Measure pull-to-refresh performance
      const { metrics } = await performanceTestHelper.measureAsync(
        'pull_to_refresh',
        async () => {
          // Trigger pull-to-refresh
          fireEvent(scrollView, 'onRefresh');

          // Wait for refresh to complete
          await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 100));
          });
        },
        { operation: 'pull_to_refresh' }
      );

      expect(metrics.duration).toBeLessThan(200); // Refresh UI feedback should be immediate
    });

    it('should not block UI during refresh', async () => {
      const screen = renderWithProviders(<TestNavigator />);

      await waitFor(() => {
        expect(screen.getByTestId('articles-list')).toBeTruthy();
      });

      const scrollView = screen.getByTestId('articles-list');

      // Start refresh
      fireEvent(scrollView, 'onRefresh');

      // Try to interact with UI during refresh
      const { metrics } = await performanceTestHelper.measureAsync(
        'interaction_during_refresh',
        async () => {
          // Should still be able to scroll
          fireEvent.scroll(scrollView, {
            nativeEvent: {
              contentOffset: { y: 100 },
              contentSize: { height: 2000 },
              layoutMeasurement: { height: 800 },
            },
          });

          await waitFor(() => {
            // Verify scroll happened
          }, { timeout: 50 });
        },
        { during: 'refresh' }
      );

      expect(metrics.duration).toBeLessThan(50); // UI should remain responsive
    });
  });

  describe('Button Press Responsiveness', () => {
    it('should respond to button presses immediately', async () => {
      const screen = renderWithProviders(<TestNavigator />);

      await waitFor(() => {
        expect(screen.getByTestId('articles-list')).toBeTruthy();
      });

      const buttons = [
        { testId: 'search-button', name: 'search' },
        { testId: 'filter-button', name: 'filter' },
        { testId: 'settings-button', name: 'settings' },
      ];

      for (const button of buttons) {
        const { metrics } = await performanceTestHelper.measureAsync(
          `button_press_${button.name}`,
          async () => {
            const btn = screen.getByTestId(button.testId);
            fireEvent.press(btn);

            // Wait for visual feedback
            await waitFor(() => {
              // Button should show pressed state
            }, { timeout: 16 }); // One frame at 60fps
          },
          { button: button.name }
        );

        expect(metrics.duration).toBeLessThan(16); // Should respond within one frame
      }
    });

    it('should handle rapid button presses', async () => {
      const screen = renderWithProviders(<TestNavigator />);

      await waitFor(() => {
        expect(screen.getByTestId('articles-list')).toBeTruthy();
      });

      const articleCards = screen.getAllByTestId(/article-card-.*/);
      const favoriteButtons = screen.getAllByTestId(/favorite-button-.*/);

      // Rapid favorite toggling
      const { metrics } = await performanceTestHelper.measureAsync(
        'rapid_favorite_toggle',
        async () => {
          for (let i = 0; i < 5; i++) {
            fireEvent.press(favoriteButtons[0]);
            await act(async () => {
              await new Promise(resolve => setTimeout(resolve, 10));
            });
          }
        },
        { toggleCount: 5 }
      );

      const avgTimePerToggle = metrics.duration / 5;
      expect(avgTimePerToggle).toBeLessThan(20);
    });
  });

  describe('Input Field Responsiveness', () => {
    it('should handle text input without lag', async () => {
      const screen = renderWithProviders(<TestNavigator />);

      await waitFor(() => {
        expect(screen.getByTestId('search-input')).toBeTruthy();
      });

      const searchInput = screen.getByTestId('search-input');
      const testText = 'This is a test search query';

      // Measure typing performance
      const { metrics } = await performanceTestHelper.measureAsync(
        'text_input_typing',
        async () => {
          // Simulate typing character by character
          for (let i = 0; i < testText.length; i++) {
            fireEvent.changeText(searchInput, testText.substring(0, i + 1));
            
            // Small delay to simulate typing speed
            await act(async () => {
              await new Promise(resolve => setTimeout(resolve, 5));
            });
          }
        },
        { textLength: testText.length }
      );

      const avgTimePerChar = metrics.duration / testText.length;
      expect(avgTimePerChar).toBeLessThan(10); // Should handle fast typing
    });

    it('should debounce search efficiently', async () => {
      const screen = renderWithProviders(<TestNavigator />);

      await waitFor(() => {
        expect(screen.getByTestId('search-input')).toBeTruthy();
      });

      const searchInput = screen.getByTestId('search-input');
      let searchExecutions = 0;

      // Mock search execution counter
      const originalDispatch = store.dispatch;
      store.dispatch = jest.fn((action) => {
        if (action.type?.includes('search')) {
          searchExecutions++;
        }
        return originalDispatch(action);
      });

      // Type rapidly
      await performanceTestHelper.measureAsync(
        'debounced_search',
        async () => {
          const rapidText = 'rapid typing test';
          for (const char of rapidText) {
            fireEvent.changeText(searchInput, 
              searchInput.props.value + char
            );
          }

          // Wait for debounce
          await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 350));
          });
        },
        { operation: 'debounced_search' }
      );

      // Should only execute search once due to debouncing
      expect(searchExecutions).toBeLessThanOrEqual(2);

      store.dispatch = originalDispatch;
    });
  });

  describe('Gesture Performance', () => {
    it('should handle swipe gestures smoothly', async () => {
      const screen = renderWithProviders(<TestNavigator />);

      await waitFor(() => {
        expect(screen.getByTestId('articles-list')).toBeTruthy();
      });

      const articleCards = screen.getAllByTestId(/article-card-.*/);

      // Measure swipe-to-archive performance
      const { metrics } = await performanceTestHelper.measureAsync(
        'swipe_to_archive',
        async () => {
          // Simulate swipe gesture
          fireEvent(articleCards[0], 'onSwipeableOpen', { direction: 'left' });

          await waitFor(() => {
            // Wait for swipe animation
          }, { timeout: 100 });

          // Trigger archive action
          const archiveButton = screen.getByTestId('swipe-archive-button-0');
          fireEvent.press(archiveButton);
        },
        { gesture: 'swipe_to_archive' }
      );

      expect(metrics.duration).toBeLessThan(200);
    });

    it('should handle long press efficiently', async () => {
      const screen = renderWithProviders(<TestNavigator />);

      await waitFor(() => {
        expect(screen.getByTestId('articles-list')).toBeTruthy();
      });

      const articleCards = screen.getAllByTestId(/article-card-.*/);

      // Measure long press performance
      const { metrics } = await performanceTestHelper.measureAsync(
        'long_press_menu',
        async () => {
          fireEvent(articleCards[0], 'onLongPress');

          await waitFor(() => {
            expect(screen.getByTestId('context-menu')).toBeTruthy();
          }, { timeout: 100 });
        },
        { gesture: 'long_press' }
      );

      expect(metrics.duration).toBeLessThan(100);
    });
  });

  describe('Modal and Dialog Performance', () => {
    it('should show modals without blocking UI', async () => {
      const screen = renderWithProviders(<TestNavigator />);

      await waitFor(() => {
        expect(screen.getByTestId('settings-button')).toBeTruthy();
      });

      // Navigate to settings
      fireEvent.press(screen.getByTestId('settings-button'));

      await waitFor(() => {
        expect(screen.getByTestId('settings-screen')).toBeTruthy();
      });

      // Open about modal
      const { metrics } = await performanceTestHelper.measureAsync(
        'modal_open',
        async () => {
          fireEvent.press(screen.getByTestId('about-button'));

          await waitFor(() => {
            expect(screen.getByTestId('about-modal')).toBeTruthy();
          }, { timeout: 200 });
        },
        { modal: 'about' }
      );

      expect(metrics.duration).toBeLessThan(200);

      // Close modal
      const { metrics: closeMetrics } = await performanceTestHelper.measureAsync(
        'modal_close',
        async () => {
          fireEvent.press(screen.getByTestId('modal-close-button'));

          await waitFor(() => {
            expect(screen.queryByTestId('about-modal')).toBeNull();
          }, { timeout: 200 });
        },
        { modal: 'about', action: 'close' }
      );

      expect(closeMetrics.duration).toBeLessThan(200);
    });
  });

  afterAll(() => {
    // Generate UI responsiveness report
    const report = performanceTestHelper.generateReport();
    console.log('\n=== UI Responsiveness Performance Report ===\n');
    console.log(report);
  });
});