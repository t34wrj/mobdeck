/**
 * Tests for ArticleScreen component
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react-native';

// Mock the ReadeckApiService
jest.mock('../../services/ReadeckApiService', () => ({
  readeckApiService: {
    getArticle: jest.fn(),
  },
}));

// Import the component and dependencies after mocks
import ArticleScreen from '../ArticleScreen';
import { readeckApiService } from '../../services/ReadeckApiService';

// Mock navigation
const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  setOptions: jest.fn(),
};

const createMockRoute = (articleId: string) => ({
  params: { articleId },
  key: 'ArticleScreen',
  name: 'ArticleDetail' as const,
});

describe('ArticleScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should import and exist', () => {
    expect(ArticleScreen).toBeDefined();
    expect(typeof ArticleScreen).toBe('function');
  });

  it('should render loading state initially', () => {
    (readeckApiService.getArticle as jest.Mock).mockReturnValue(
      new Promise(() => {})
    );

    const { getByTestId } = render(
       
      <ArticleScreen
        navigation={mockNavigation as any}
        route={createMockRoute('123')}
      />
    );

    expect(getByTestId('loading-indicator')).toBeTruthy();
  });

  it('should render article content when loaded', async () => {
    const mockArticle = {
      id: '123',
      title: 'Test Article',
      content: 'Test content',
      image: 'https://example.com/image.jpg',
      author: 'Test Author',
      publishedAt: '2024-01-01',
    };

    (readeckApiService.getArticle as jest.Mock).mockResolvedValue({
      data: mockArticle,
    });

    const { getByText } = render(
      <ArticleScreen
        navigation={mockNavigation as any}
        route={createMockRoute('123')}
      />
    );

    await waitFor(() => {
      expect(getByText('Test Article')).toBeTruthy();
      expect(getByText('Test content')).toBeTruthy();
      expect(getByText('By Test Author')).toBeTruthy();
    });
  });

  it('should render error state when article fetch fails', async () => {
    (readeckApiService.getArticle as jest.Mock).mockRejectedValue(
      new Error('Network error')
    );

    const { getByText } = render(
      <ArticleScreen
        navigation={mockNavigation as any}
        route={createMockRoute('123')}
      />
    );

    await waitFor(() => {
      expect(getByText('Error loading article.')).toBeTruthy();
    });
  });

  it('should render error state when article is null', async () => {
    (readeckApiService.getArticle as jest.Mock).mockResolvedValue({
      data: null,
    });

    const { getByText } = render(
      <ArticleScreen
        navigation={mockNavigation as any}
        route={createMockRoute('123')}
      />
    );

    await waitFor(() => {
      expect(getByText('Error loading article.')).toBeTruthy();
    });
  });

  it('should fetch article with correct ID', async () => {
    const mockArticle = {
      id: '456',
      title: 'Another Article',
      content: 'Another content',
    };

    (readeckApiService.getArticle as jest.Mock).mockResolvedValue({
      data: mockArticle,
    });

    render(
      <ArticleScreen
        navigation={mockNavigation as any}
        route={createMockRoute('456')}
      />
    );

    await waitFor(() => {
      expect(readeckApiService.getArticle).toHaveBeenCalledWith('456');
    });
  });

  it('should render article image when present', async () => {
    const mockArticle = {
      id: '123',
      title: 'Article with Image',
      content: 'Content',
      image: 'https://example.com/article-image.jpg',
    };

    (readeckApiService.getArticle as jest.Mock).mockResolvedValue({
      data: mockArticle,
    });

    const { getByTestId } = render(
       
      <ArticleScreen
        navigation={mockNavigation as any}
        route={createMockRoute('123')}
      />
    );

    await waitFor(() => {
      const image = getByTestId('article-image');
      expect(image.props.source.uri).toBe(
        'https://example.com/article-image.jpg'
      );
    });
  });

  it('should handle article without image', async () => {
    const mockArticle = {
      id: '123',
      title: 'Article without Image',
      content: 'Content',
      image: null,
    };

    (readeckApiService.getArticle as jest.Mock).mockResolvedValue({
      data: mockArticle,
    });

    const renderResult = render(
      <ArticleScreen
        navigation={mockNavigation as any}
        route={createMockRoute('123')}
      />
    );

    await waitFor(() => {
      // Check that the content is rendered (image handling varies by implementation)
      expect(renderResult.getByText('Article without Image')).toBeTruthy();
      expect(renderResult.getByText('Content')).toBeTruthy();
    });
  });

  it('should log error to console when fetch fails', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation();
    const error = new Error('Fetch failed');
    (readeckApiService.getArticle as jest.Mock).mockRejectedValue(error);

    render(
      <ArticleScreen
        navigation={mockNavigation as any}
        route={createMockRoute('123')}
      />
    );

    await waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith(
        'Error fetching article:',
        error
      );
    });

    consoleError.mockRestore();
  });

  it('should render published date when available', async () => {
    const mockArticle = {
      id: '123',
      title: 'Test Article',
      content: 'Content',
      publishedAt: '2024-01-15',
    };

    (readeckApiService.getArticle as jest.Mock).mockResolvedValue({
      data: mockArticle,
    });

    const { getByText } = render(
      <ArticleScreen
        navigation={mockNavigation as any}
        route={createMockRoute('123')}
      />
    );

    await waitFor(() => {
      expect(getByText('Published: 2024-01-15')).toBeTruthy();
    });
  });
});
