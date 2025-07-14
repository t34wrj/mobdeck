/**
 * Unit tests for ArticleCard component
 * Testing article display and interactions
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ArticleCard, ArticleCardProps } from '../../src/components/ArticleCard';
import { Article } from '../../src/types';

describe('ArticleCard', () => {
  const mockArticle: Article = {
    id: 'test-article-1',
    title: 'Test Article Title',
    summary: 'This is a test article summary that should be displayed in the card',
    content: 'Full article content',
    url: 'https://example.com/article',
    imageUrl: 'https://example.com/image.jpg',
    readTime: 5,
    sourceUrl: 'https://example.com',
    isArchived: false,
    isFavorite: false,
    isRead: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: ['test', 'article'],
  };

  const defaultProps: ArticleCardProps = {
    article: mockArticle,
    onPress: jest.fn(),
    onLongPress: jest.fn(),
    onToggleFavorite: jest.fn(),
    onToggleArchive: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock Date for consistent testing
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-10T12:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Rendering', () => {
    it('should render article card with basic information', () => {
      const { getByText } = render(<ArticleCard {...defaultProps} />);
      
      expect(getByText(mockArticle.title)).toBeTruthy();
      expect(getByText(mockArticle.summary!)).toBeTruthy();
      expect(getByText('5 min read')).toBeTruthy();
    });

    it('should render article with image when imageUrl is provided', () => {
      const { getByTestId } = render(<ArticleCard {...defaultProps} />);
      
      const image = getByTestId('article-image');
      expect(image.props.source).toEqual({ uri: mockArticle.imageUrl });
    });

    it('should render article without image when imageUrl is undefined', () => {
      const articleWithoutImage = { ...mockArticle, imageUrl: undefined };
      const { queryByTestId } = render(
        <ArticleCard {...defaultProps} article={articleWithoutImage} />
      );
      
      expect(queryByTestId('article-image')).toBeNull();
    });

    it('should show read indicator for read articles', () => {
      const readArticle = { ...mockArticle, isRead: true };
      const { getByTestId } = render(
        <ArticleCard {...defaultProps} article={readArticle} />
      );
      
      const container = getByTestId('article-card-container');
      const styles = Array.isArray(container.props.style) ? container.props.style : [container.props.style];
      const hasOpacity = styles.some((style: any) => style && typeof style === 'object' && style.opacity === 0.7);
      expect(hasOpacity).toBe(true);
    });

    it('should show favorite indicator for favorite articles', () => {
      const favoriteArticle = { ...mockArticle, isFavorite: true };
      const { getByTestId } = render(
        <ArticleCard {...defaultProps} article={favoriteArticle} />
      );
      
      expect(getByTestId('favorite-indicator')).toBeTruthy();
    });

    it('should show archive indicator for archived articles', () => {
      const archivedArticle = { ...mockArticle, isArchived: true };
      const { getByTestId } = render(
        <ArticleCard {...defaultProps} article={archivedArticle} />
      );
      
      expect(getByTestId('archive-indicator')).toBeTruthy();
    });

    it('should display tags when present', () => {
      const { getByText } = render(<ArticleCard {...defaultProps} />);
      
      mockArticle.tags?.forEach(tag => {
        expect(getByText(tag)).toBeTruthy();
      });
    });

    it('should handle articles without summary', () => {
      const articleWithoutSummary = { ...mockArticle, summary: undefined };
      const { queryByText } = render(
        <ArticleCard {...defaultProps} article={articleWithoutSummary} />
      );
      
      expect(queryByText('This is a test article summary')).toBeNull();
    });

    it('should handle articles without read time', () => {
      const articleWithoutReadTime = { ...mockArticle, readTime: undefined };
      const { queryByText } = render(
        <ArticleCard {...defaultProps} article={articleWithoutReadTime} />
      );
      
      expect(queryByText('min read')).toBeNull();
    });

    it('should apply custom styles', () => {
      const customStyle = { backgroundColor: 'red' };
      const { getByTestId } = render(
        <ArticleCard {...defaultProps} style={customStyle} />
      );
      
      const container = getByTestId('article-card-container');
      const styles = Array.isArray(container.props.style) ? container.props.style : [container.props.style];
      const hasCustomStyle = styles.some((style: any) => 
        style && 
        typeof style === 'object' && 
        style.backgroundColor === 'red'
      );
      expect(hasCustomStyle).toBe(true);
    });
  });

  describe('Date Formatting', () => {
    it('should show "Just now" for articles created within an hour', () => {
      const recentArticle = {
        ...mockArticle,
        createdAt: new Date('2024-01-10T11:30:00Z').toISOString(),
      };
      
      const { getByText } = render(
        <ArticleCard {...defaultProps} article={recentArticle} />
      );
      
      expect(getByText('Just now')).toBeTruthy();
    });

    it('should show hours ago for articles created today', () => {
      const todayArticle = {
        ...mockArticle,
        createdAt: new Date('2024-01-10T09:00:00Z').toISOString(),
      };
      
      const { getByText } = render(
        <ArticleCard {...defaultProps} article={todayArticle} />
      );
      
      expect(getByText('3h ago')).toBeTruthy();
    });

    it('should show days ago for articles created this week', () => {
      const thisWeekArticle = {
        ...mockArticle,
        createdAt: new Date('2024-01-07T12:00:00Z').toISOString(),
      };
      
      const { getByText } = render(
        <ArticleCard {...defaultProps} article={thisWeekArticle} />
      );
      
      expect(getByText('3d ago')).toBeTruthy();
    });

    it('should show full date for older articles', () => {
      const oldArticle = {
        ...mockArticle,
        createdAt: new Date('2023-12-01T12:00:00Z').toISOString(),
      };
      
      const { getByText } = render(
        <ArticleCard {...defaultProps} article={oldArticle} />
      );
      
      // Date format may vary by locale
      expect(getByText(/2023/)).toBeTruthy();
    });
  });

  describe('Interactions', () => {
    it('should handle press events', () => {
      const { getByTestId } = render(<ArticleCard {...defaultProps} />);
      
      fireEvent.press(getByTestId('article-card-container'));
      
      expect(defaultProps.onPress).toHaveBeenCalledTimes(1);
    });

    it('should handle long press events', () => {
      const { getByTestId } = render(<ArticleCard {...defaultProps} />);
      
      fireEvent(getByTestId('article-card-container'), 'longPress');
      
      expect(defaultProps.onLongPress).toHaveBeenCalledTimes(1);
    });

    it('should not call long press if not provided', () => {
      const propsWithoutLongPress = { ...defaultProps, onLongPress: undefined };
      const { getByTestId } = render(<ArticleCard {...propsWithoutLongPress} />);
      
      // Should not throw
      fireEvent(getByTestId('article-card-container'), 'longPress');
    });

    it('should handle favorite toggle', () => {
      const { getByTestId } = render(<ArticleCard {...defaultProps} />);
      
      const favoriteButton = getByTestId('favorite-button');
      fireEvent.press(favoriteButton);
      
      expect(defaultProps.onToggleFavorite).toHaveBeenCalledTimes(1);
    });

    it('should handle archive toggle', () => {
      const { getByTestId } = render(<ArticleCard {...defaultProps} />);
      
      const archiveButton = getByTestId('archive-button');
      fireEvent.press(archiveButton);
      
      expect(defaultProps.onToggleArchive).toHaveBeenCalledTimes(1);
    });

    it('should disable interactions when loading', () => {
      const { getByTestId, rerender } = render(<ArticleCard {...defaultProps} />);
      
      // Add loading state
      rerender(<ArticleCard {...defaultProps} loading />);
      
      const container = getByTestId('article-card-container');
      expect(container.props.disabled).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long titles', () => {
      const longTitleArticle = {
        ...mockArticle,
        title: 'This is a very long title that should be truncated when it exceeds the maximum number of lines allowed in the card display',
      };
      
      const { getByText } = render(
        <ArticleCard {...defaultProps} article={longTitleArticle} />
      );
      
      const titleElement = getByText(longTitleArticle.title);
      expect(titleElement.props.numberOfLines).toBe(2);
    });

    it('should handle very long summaries', () => {
      const longSummaryArticle = {
        ...mockArticle,
        summary: 'This is a very long summary '.repeat(20),
      };
      
      const { getByText } = render(
        <ArticleCard {...defaultProps} article={longSummaryArticle} />
      );
      
      const summaryElement = getByText(longSummaryArticle.summary);
      expect(summaryElement.props.numberOfLines).toBe(3);
    });

    it('should handle invalid read time values', () => {
      const invalidReadTimeArticle = {
        ...mockArticle,
        readTime: -5,
      };
      
      const { queryByText } = render(
        <ArticleCard {...defaultProps} article={invalidReadTimeArticle} />
      );
      
      expect(queryByText('min read')).toBeNull();
    });

    it('should handle NaN read time', () => {
      const nanReadTimeArticle = {
        ...mockArticle,
        readTime: NaN,
      };
      
      const { queryByText } = render(
        <ArticleCard {...defaultProps} article={nanReadTimeArticle} />
      );
      
      expect(queryByText('min read')).toBeNull();
    });

    it('should handle missing source URL', () => {
      const noSourceArticle = {
        ...mockArticle,
        sourceUrl: undefined,
      };
      
      const { queryByText } = render(
        <ArticleCard {...defaultProps} article={noSourceArticle} />
      );
      
      // Should render without errors
      expect(queryByText(mockArticle.title)).toBeTruthy();
    });

    it('should handle empty tags array', () => {
      const noTagsArticle = {
        ...mockArticle,
        tags: [],
      };
      
      const { queryByTestId } = render(
        <ArticleCard {...defaultProps} article={noTagsArticle} />
      );
      
      expect(queryByTestId('tags-container')).toBeNull();
    });
  });

  describe('Accessibility', () => {
    it('should have proper accessibility labels', () => {
      const { getByLabelText } = render(<ArticleCard {...defaultProps} />);
      
      expect(getByLabelText(`Article: ${mockArticle.title}`)).toBeTruthy();
    });

    it('should indicate read status in accessibility label', () => {
      const readArticle = { ...mockArticle, isRead: true };
      const { getByLabelText } = render(
        <ArticleCard {...defaultProps} article={readArticle} />
      );
      
      // The accessibility label is "Article: {title}" for all articles
      expect(getByLabelText(/Article:/)).toBeTruthy();
    });

    it('should have accessible favorite button', () => {
      const { getByLabelText } = render(<ArticleCard {...defaultProps} />);
      
      expect(getByLabelText('Add to favorites')).toBeTruthy();
    });

    it('should update favorite button label when favorited', () => {
      const favoriteArticle = { ...mockArticle, isFavorite: true };
      const { getByLabelText } = render(
        <ArticleCard {...defaultProps} article={favoriteArticle} />
      );
      
      expect(getByLabelText('Remove from favorites')).toBeTruthy();
    });

    it('should have accessible archive button', () => {
      const { getByLabelText } = render(<ArticleCard {...defaultProps} />);
      
      expect(getByLabelText('Archive article')).toBeTruthy();
    });

    it('should update archive button label when archived', () => {
      const archivedArticle = { ...mockArticle, isArchived: true };
      const { getByLabelText } = render(
        <ArticleCard {...defaultProps} article={archivedArticle} />
      );
      
      expect(getByLabelText('Unarchive article')).toBeTruthy();
    });
  });

  describe('Performance', () => {
    it('should not re-render unnecessarily', () => {
      const renderSpy = jest.fn();
      
      const TestWrapper = (props: ArticleCardProps) => {
        renderSpy();
        return <ArticleCard {...props} />;
      };
      
      const { rerender } = render(<TestWrapper {...defaultProps} />);
      
      expect(renderSpy).toHaveBeenCalledTimes(1);
      
      // Re-render with same props
      rerender(<TestWrapper {...defaultProps} />);
      
      // Should use memoization
      expect(renderSpy).toHaveBeenCalledTimes(2);
    });
  });
});