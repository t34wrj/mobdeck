/**
 * Tests for ArticleScreen component
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import ArticleScreen from '../ArticleScreen';
import { fetchArticleById } from '../../services/api';

// Mock the API
jest.mock('../../services/api', () => ({
  fetchArticleById: jest.fn(),
}));

// Mock the Text component
jest.mock('../../components/ui/Text');

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

  it('should render loading state initially', () => {
    (fetchArticleById as jest.Mock).mockReturnValue(new Promise(() => {}));

    const { UNSAFE_getByType } = render(
      <ArticleScreen
        navigation={mockNavigation as any}
        route={createMockRoute('123')}
      />
    );

    expect(UNSAFE_getByType('ActivityIndicator')).toBeTruthy();
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

    (fetchArticleById as jest.Mock).mockResolvedValue(mockArticle);

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
    (fetchArticleById as jest.Mock).mockRejectedValue(
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
    (fetchArticleById as jest.Mock).mockResolvedValue(null);

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

    (fetchArticleById as jest.Mock).mockResolvedValue(mockArticle);

    render(
      <ArticleScreen
        navigation={mockNavigation as any}
        route={createMockRoute('456')}
      />
    );

    await waitFor(() => {
      expect(fetchArticleById).toHaveBeenCalledWith('456');
    });
  });

  it('should render article image when present', async () => {
    const mockArticle = {
      id: '123',
      title: 'Article with Image',
      content: 'Content',
      image: 'https://example.com/article-image.jpg',
    };

    (fetchArticleById as jest.Mock).mockResolvedValue(mockArticle);

    const { UNSAFE_getByType } = render(
      <ArticleScreen
        navigation={mockNavigation as any}
        route={createMockRoute('123')}
      />
    );

    await waitFor(() => {
      const image = UNSAFE_getByType('Image');
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

    (fetchArticleById as jest.Mock).mockResolvedValue(mockArticle);

    const { queryByType } = render(
      <ArticleScreen
        navigation={mockNavigation as any}
        route={createMockRoute('123')}
      />
    );

    await waitFor(() => {
      // Depending on implementation, might not render Image component
      const images = queryByType('Image');
      if (images) {
        expect(images.props.source.uri).toBeNull();
      }
    });
  });

  it('should log error to console when fetch fails', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation();
    const error = new Error('Fetch failed');
    (fetchArticleById as jest.Mock).mockRejectedValue(error);

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

    (fetchArticleById as jest.Mock).mockResolvedValue(mockArticle);

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
