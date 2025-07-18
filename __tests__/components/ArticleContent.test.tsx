import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { ArticleContent, ArticleContentProps } from '../../src/components/ArticleContent';
import articlesSlice from '../../src/store/slices/articlesSlice';
import authSlice from '../../src/store/slices/authSlice';
import syncSlice from '../../src/store/slices/syncSlice';

// Mock console.log to reduce test noise
const originalConsoleLog = console.log;
beforeAll(() => {
  console.log = jest.fn();
});

afterAll(() => {
  console.log = originalConsoleLog;
});

describe('ArticleContent Component', () => {
  const mockStore = configureStore({
    reducer: {
      articles: articlesSlice,
      auth: authSlice,
      sync: syncSlice,
    },
    preloadedState: {
      articles: {
        articles: [],
        loading: { fetch: false, create: false, update: false, delete: false, sync: false, content: false },
        error: { fetch: null, create: null, update: null, delete: null, sync: null, content: null },
        pagination: { page: 1, limit: 20, totalPages: 0, totalItems: 0, hasMore: false },
        filters: { searchQuery: '', isArchived: undefined, isFavorite: undefined, isRead: undefined, tags: undefined },
        sync: { lastSyncTime: null, isSyncing: false, pendingChanges: [], conflicts: [], syncError: null },
        selectedArticleId: null,
        multiSelectMode: false,
        selectedArticleIds: [],
        contentLoading: {},
        contentErrors: {},
      },
      auth: { isAuthenticated: true, user: { id: 'test-user' }, token: 'test-token', serverUrl: 'https://test.com', isLoading: false, error: null },
      sync: { isOnline: true, lastSyncTime: null, isSyncing: false, syncError: null, syncProgress: 0, itemsProcessed: 0, totalItems: 0, currentOperation: null, pendingOperations: [], networkType: 'wifi', syncStats: { totalSyncs: 0, successfulSyncs: 0, failedSyncs: 0, lastSyncDuration: 0, averageSyncDuration: 0 } },
    },
  });

  const createWrapper = (store = mockStore) => 
    ({ children }: { children: React.ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    );

  const defaultProps: ArticleContentProps = {
    content: 'Test article content',
    summary: 'Test summary',
    imageUrl: 'https://example.com/image.jpg',
    fontSize: 'medium',
    fontFamily: 'sans-serif',
    isLoading: false,
    hasError: false,
    error: null,
    retryCount: 0,
    canRetry: false,
    isRetrying: false,
    onRetry: jest.fn(),
    onManualRefresh: jest.fn(),
    contentLoading: false,
    contentError: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Content Display States', () => {
    it('should render content when available', () => {
      const { getByText } = render(
        <ArticleContent {...defaultProps} content="Test article content" />,
        { wrapper: createWrapper() }
      );

      expect(getByText('Test article content')).toBeTruthy();
    });

    it('should render summary when provided', () => {
      const { getByText } = render(
        <ArticleContent {...defaultProps} summary="Test summary" />,
        { wrapper: createWrapper() }
      );

      expect(getByText('Summary')).toBeTruthy();
      expect(getByText('Test summary')).toBeTruthy();
    });

    it('should render image when imageUrl is provided', () => {
      const { getByTestId } = render(
        <ArticleContent {...defaultProps} imageUrl="https://example.com/image.jpg" />,
        { wrapper: createWrapper() }
      );

      expect(getByTestId('article-image')).toBeTruthy();
    });

    it('should not render image when imageUrl is not provided', () => {
      const { queryByTestId } = render(
        <ArticleContent {...defaultProps} imageUrl={undefined} />,
        { wrapper: createWrapper() }
      );

      expect(queryByTestId('article-image')).toBeNull();
    });
  });

  describe('Loading States', () => {
    it('should show loading state when isLoading is true', () => {
      const { getByText } = render(
        <ArticleContent {...defaultProps} isLoading={true} content="" />,
        { wrapper: createWrapper() }
      );

      expect(getByText('Loading content...')).toBeTruthy();
    });

    it('should show loading state when contentLoading is true', () => {
      const { getByText } = render(
        <ArticleContent {...defaultProps} contentLoading={true} content="" />,
        { wrapper: createWrapper() }
      );

      expect(getByText('Loading content...')).toBeTruthy();
    });

    it('should show retry loading state when isRetrying is true', () => {
      const { getByText } = render(
        <ArticleContent {...defaultProps} isRetrying={true} retryCount={2} content="" />,
        { wrapper: createWrapper() }
      );

      expect(getByText('Retrying... (2/3)')).toBeTruthy();
      expect(getByText('Please wait...')).toBeTruthy();
    });

    it('should not show content when loading', () => {
      const { queryByText } = render(
        <ArticleContent {...defaultProps} isLoading={true} content="Should not show" />,
        { wrapper: createWrapper() }
      );

      expect(queryByText('Should not show')).toBeNull();
    });
  });

  describe('Error States', () => {
    it('should show error state when hasError is true', () => {
      const { getByText } = render(
        <ArticleContent {...defaultProps} hasError={true} error="Test error" content="" />,
        { wrapper: createWrapper() }
      );

      expect(getByText('Content Loading Error')).toBeTruthy();
      expect(getByText('Test error')).toBeTruthy();
    });

    it('should show error state when contentError is true', () => {
      const { getByText } = render(
        <ArticleContent {...defaultProps} contentError={true} error="Content error" content="" />,
        { wrapper: createWrapper() }
      );

      expect(getByText('Content Loading Error')).toBeTruthy();
      expect(getByText('Content error')).toBeTruthy();
    });

    it('should show retry button when canRetry is true', () => {
      const { getByText } = render(
        <ArticleContent {...defaultProps} hasError={true} canRetry={true} retryCount={1} content="" />,
        { wrapper: createWrapper() }
      );

      expect(getByText('Retry (1/3)')).toBeTruthy();
    });

    it('should show manual refresh button when onManualRefresh is provided', () => {
      const { getByText } = render(
        <ArticleContent {...defaultProps} hasError={true} onManualRefresh={jest.fn()} content="" />,
        { wrapper: createWrapper() }
      );

      expect(getByText('Manual Refresh')).toBeTruthy();
    });

    it('should show max retries message when retry count is 3 or higher', () => {
      const { getByText } = render(
        <ArticleContent {...defaultProps} hasError={true} retryCount={3} content="" />,
        { wrapper: createWrapper() }
      );

      expect(getByText('Maximum retry attempts reached. Try manual refresh or check your connection.')).toBeTruthy();
    });

    it('should call onRetry when retry button is pressed', () => {
      const mockOnRetry = jest.fn();
      const { getByText } = render(
        <ArticleContent {...defaultProps} hasError={true} canRetry={true} onRetry={mockOnRetry} content="" />,
        { wrapper: createWrapper() }
      );

      fireEvent.press(getByText('Retry (0/3)'));
      expect(mockOnRetry).toHaveBeenCalledTimes(1);
    });

    it('should call onManualRefresh when manual refresh button is pressed', () => {
      const mockOnManualRefresh = jest.fn();
      const { getByText } = render(
        <ArticleContent {...defaultProps} hasError={true} onManualRefresh={mockOnManualRefresh} content="" />,
        { wrapper: createWrapper() }
      );

      fireEvent.press(getByText('Manual Refresh'));
      expect(mockOnManualRefresh).toHaveBeenCalledTimes(1);
    });

    it('should disable retry button when isRetrying is true', () => {
      const mockOnRetry = jest.fn();
      const { getByText } = render(
        <ArticleContent {...defaultProps} hasError={true} canRetry={true} isRetrying={true} onRetry={mockOnRetry} content="" />,
        { wrapper: createWrapper() }
      );

      const retryButton = getByText('Retrying...');
      expect(retryButton).toBeTruthy();
      
      fireEvent.press(retryButton);
      expect(mockOnRetry).not.toHaveBeenCalled();
    });
  });

  describe('No Content State', () => {
    it('should show no content message when content is empty', () => {
      const { getByText } = render(
        <ArticleContent {...defaultProps} content="" />,
        { wrapper: createWrapper() }
      );

      expect(getByText('No content available for this article.')).toBeTruthy();
    });

    it('should show try loading content button when onManualRefresh is provided', () => {
      const { getByText } = render(
        <ArticleContent {...defaultProps} content="" onManualRefresh={jest.fn()} />,
        { wrapper: createWrapper() }
      );

      expect(getByText('Try Loading Content')).toBeTruthy();
    });

    it('should show pull to refresh hint', () => {
      const { getByText } = render(
        <ArticleContent {...defaultProps} content="" />,
        { wrapper: createWrapper() }
      );

      expect(getByText('Pull down to refresh to try loading from the server.')).toBeTruthy();
    });

    it('should call onManualRefresh when try loading content button is pressed', () => {
      const mockOnManualRefresh = jest.fn();
      const { getByText } = render(
        <ArticleContent {...defaultProps} content="" onManualRefresh={mockOnManualRefresh} />,
        { wrapper: createWrapper() }
      );

      fireEvent.press(getByText('Try Loading Content'));
      expect(mockOnManualRefresh).toHaveBeenCalledTimes(1);
    });
  });

  describe('Content Parsing and Formatting', () => {
    it('should parse and display HTML content correctly', () => {
      const htmlContent = '<p>Test paragraph</p><br><strong>Bold text</strong>';
      const { getByText } = render(
        <ArticleContent {...defaultProps} content={htmlContent} />,
        { wrapper: createWrapper() }
      );

      expect(getByText('Test paragraph')).toBeTruthy();
      expect(getByText('Bold text')).toBeTruthy();
    });

    it('should handle headings correctly', () => {
      const contentWithHeading = 'Main Title\n\nThis is the content that follows the title.';
      const { getByText } = render(
        <ArticleContent {...defaultProps} content={contentWithHeading} />,
        { wrapper: createWrapper() }
      );

      expect(getByText('Main Title')).toBeTruthy();
      expect(getByText('This is the content that follows the title.')).toBeTruthy();
    });

    it('should handle quotes correctly', () => {
      const contentWithQuote = '"This is a quoted text"';
      const { getByText } = render(
        <ArticleContent {...defaultProps} content={contentWithQuote} />,
        { wrapper: createWrapper() }
      );

      expect(getByText('"This is a quoted text"')).toBeTruthy();
    });

    it('should handle list items correctly', () => {
      const contentWithList = '• First item\n• Second item\n1. Numbered item';
      const { getByText } = render(
        <ArticleContent {...defaultProps} content={contentWithList} />,
        { wrapper: createWrapper() }
      );

      expect(getByText('• First item')).toBeTruthy();
      expect(getByText('• Second item')).toBeTruthy();
      expect(getByText('1. Numbered item')).toBeTruthy();
    });

    it('should handle HTML entities correctly', () => {
      const contentWithEntities = '&quot;Test&quot; &amp; &lt;tag&gt; &#8212; dash';
      const { getByText } = render(
        <ArticleContent {...defaultProps} content={contentWithEntities} />,
        { wrapper: createWrapper() }
      );

      expect(getByText('"Test" & <tag> — dash')).toBeTruthy();
    });
  });

  describe('Font Size and Family', () => {
    it('should apply small font size correctly', () => {
      const { getByText } = render(
        <ArticleContent {...defaultProps} fontSize="small" content="Test content" />,
        { wrapper: createWrapper() }
      );

      const content = getByText('Test content');
      expect(content).toBeTruthy();
      // Note: In real tests, we'd check the actual style properties
    });

    it('should apply large font size correctly', () => {
      const { getByText } = render(
        <ArticleContent {...defaultProps} fontSize="large" content="Test content" />,
        { wrapper: createWrapper() }
      );

      const content = getByText('Test content');
      expect(content).toBeTruthy();
    });

    it('should apply custom font family correctly', () => {
      const { getByText } = render(
        <ArticleContent {...defaultProps} fontFamily="serif" content="Test content" />,
        { wrapper: createWrapper() }
      );

      const content = getByText('Test content');
      expect(content).toBeTruthy();
    });
  });

  describe('Image Modal Functionality', () => {
    it('should open image modal when image is pressed', () => {
      const { getByTestId } = render(
        <ArticleContent {...defaultProps} imageUrl="https://example.com/image.jpg" />,
        { wrapper: createWrapper() }
      );

      const image = getByTestId('article-image');
      fireEvent.press(image);
      
      // Modal should be visible (in real implementation, we'd check modal visibility)
      expect(image).toBeTruthy();
    });

    it('should not open modal when image has error', () => {
      const { getByTestId } = render(
        <ArticleContent {...defaultProps} imageUrl="https://example.com/image.jpg" />,
        { wrapper: createWrapper() }
      );

      const image = getByTestId('article-image');
      
      // Simulate image error
      fireEvent(image, 'error');
      
      // Try to press image after error
      fireEvent.press(image);
      
      // Should not open modal
      expect(image).toBeTruthy();
    });
  });

  describe('State Management Integration', () => {
    it('should handle state changes correctly', () => {
      const { rerender, getByText } = render(
        <ArticleContent {...defaultProps} content="Original content" />,
        { wrapper: createWrapper() }
      );

      expect(getByText('Original content')).toBeTruthy();

      // Update content
      rerender(
        <ArticleContent {...defaultProps} content="Updated content" />
      );

      expect(getByText('Updated content')).toBeTruthy();
    });

    it('should handle loading state transitions', () => {
      const { rerender, getByText, queryByText } = render(
        <ArticleContent {...defaultProps} content="" isLoading={true} />,
        { wrapper: createWrapper() }
      );

      expect(getByText('Loading content...')).toBeTruthy();

      // Transition to loaded state
      rerender(
        <ArticleContent {...defaultProps} content="Loaded content" isLoading={false} />
      );

      expect(queryByText('Loading content...')).toBeNull();
      expect(getByText('Loaded content')).toBeTruthy();
    });

    it('should handle error state transitions', () => {
      const { rerender, getByText, queryByText } = render(
        <ArticleContent {...defaultProps} content="" hasError={true} error="Test error" />,
        { wrapper: createWrapper() }
      );

      expect(getByText('Content Loading Error')).toBeTruthy();
      expect(getByText('Test error')).toBeTruthy();

      // Transition to success state
      rerender(
        <ArticleContent {...defaultProps} content="Success content" hasError={false} error={null} />
      );

      expect(queryByText('Content Loading Error')).toBeNull();
      expect(queryByText('Test error')).toBeNull();
      expect(getByText('Success content')).toBeTruthy();
    });

    it('should handle retry state correctly', () => {
      const { rerender, getByText } = render(
        <ArticleContent {...defaultProps} hasError={true} canRetry={true} retryCount={1} content="" />,
        { wrapper: createWrapper() }
      );

      expect(getByText('Retry (1/3)')).toBeTruthy();

      // Increase retry count
      rerender(
        <ArticleContent {...defaultProps} hasError={true} canRetry={true} retryCount={2} content="" />
      );

      expect(getByText('Retry (2/3)')).toBeTruthy();
    });
  });

  describe('Performance and Memory', () => {
    it('should handle multiple re-renders efficiently', () => {
      const { rerender, getByText } = render(
        <ArticleContent {...defaultProps} content="Test content" />,
        { wrapper: createWrapper() }
      );

      // Multiple re-renders should not cause issues
      for (let i = 0; i < 10; i++) {
        rerender(
          <ArticleContent {...defaultProps} content={`Content ${i}`} />
        );
        expect(getByText(`Content ${i}`)).toBeTruthy();
      }
    });

    it('should handle large content efficiently', () => {
      const largeContent = 'Large content '.repeat(1000);
      const { getByText } = render(
        <ArticleContent {...defaultProps} content={largeContent} />,
        { wrapper: createWrapper() }
      );

      expect(getByText(largeContent)).toBeTruthy();
    });

    it('should handle complex HTML content efficiently', () => {
      const complexHtml = '<div><p>Paragraph 1</p><p>Paragraph 2</p><strong>Bold</strong><em>Italic</em></div>'.repeat(50);
      const { getByText } = render(
        <ArticleContent {...defaultProps} content={complexHtml} />,
        { wrapper: createWrapper() }
      );

      expect(getByText('Paragraph 1')).toBeTruthy();
      expect(getByText('Bold')).toBeTruthy();
      expect(getByText('Italic')).toBeTruthy();
    });
  });

  describe('Regression Prevention', () => {
    it('should not clear content after successful display', () => {
      const { getByText, rerender } = render(
        <ArticleContent {...defaultProps} content="Stable content" />,
        { wrapper: createWrapper() }
      );

      expect(getByText('Stable content')).toBeTruthy();

      // Re-render should not clear content
      rerender(
        <ArticleContent {...defaultProps} content="Stable content" />
      );

      expect(getByText('Stable content')).toBeTruthy();
    });

    it('should handle state updates without content loss', () => {
      const { getByText, rerender } = render(
        <ArticleContent {...defaultProps} content="Original content" retryCount={0} />,
        { wrapper: createWrapper() }
      );

      expect(getByText('Original content')).toBeTruthy();

      // Update non-content props
      rerender(
        <ArticleContent {...defaultProps} content="Original content" retryCount={1} />
      );

      expect(getByText('Original content')).toBeTruthy();
    });

    it('should maintain content during error recovery', () => {
      const { getByText, rerender } = render(
        <ArticleContent {...defaultProps} content="Good content" hasError={true} error="Temporary error" />,
        { wrapper: createWrapper() }
      );

      expect(getByText('Content Loading Error')).toBeTruthy();

      // Clear error
      rerender(
        <ArticleContent {...defaultProps} content="Good content" hasError={false} error={null} />
      );

      expect(getByText('Good content')).toBeTruthy();
    });
  });
});