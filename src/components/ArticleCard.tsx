import React, { memo, useCallback, useMemo } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Image,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { Text } from './ui/Text';
import { theme } from './ui/theme';
import { Article } from '../types';

export interface ArticleCardProps {
  article: Article;
  onPress: () => void;
  onLongPress?: () => void;
  onToggleFavorite?: () => void;
  onToggleArchive?: () => void;
  loading?: boolean;
  style?: ViewStyle;
}

export const ArticleCard: React.FC<ArticleCardProps> = memo(
  ({
    article,
    onPress,
    onLongPress,
    onToggleFavorite,
    onToggleArchive,
    loading = false,
    style,
  }) => {
    const formatDate = useCallback((dateString: string): string => {
      const date = new Date(dateString);
      const now = new Date();
      const diffInHours = Math.floor(
        (now.getTime() - date.getTime()) / (1000 * 60 * 60)
      );

      if (diffInHours < 1) {
        return 'Just now';
      } else if (diffInHours < 24) {
        return `${diffInHours}h ago`;
      } else if (diffInHours < 168) {
        // 7 days
        return `${Math.floor(diffInHours / 24)}d ago`;
      } else {
        return date.toLocaleDateString();
      }
    }, []);

    const formatReadTime = useCallback((minutes?: number): string => {
      if (!minutes || isNaN(minutes) || minutes <= 0) return '';
      return `${Math.round(minutes)} min read`;
    }, []);

    const formattedDate = useMemo(
      () => formatDate(article.createdAt),
      [formatDate, article.createdAt]
    );
    const formattedReadTime = useMemo(
      () => formatReadTime(article.readTime),
      [formatReadTime, article.readTime]
    );

    const sourceHostname = useMemo(() => {
      if (!article.sourceUrl) return null;
      try {
        return new URL(article.sourceUrl).hostname;
      } catch {
        return article.sourceUrl;
      }
    }, [article.sourceUrl]);

    const containerStyle = useMemo(
      () => [styles.container, article.isRead && { opacity: 0.7 }, style],
      [article.isRead, style]
    );

    return (
      <TouchableOpacity
        style={containerStyle}
        onPress={onPress}
        onLongPress={onLongPress}
        activeOpacity={0.7}
        disabled={loading}
        accessibilityRole='button'
        accessibilityLabel={`Article: ${article.title}`}
        accessibilityHint='Tap to read article'
        testID='article-card-container'
      >
        <View style={styles.content}>
          {article.imageUrl && (
            <Image
              source={{ uri: article.imageUrl }}
              style={styles.image}
              resizeMode='cover'
              testID='article-image'
            />
          )}

          <View style={styles.textContent}>
            <Text
              variant='h6'
              numberOfLines={2}
              ellipsizeMode='tail'
              style={[
                styles.title,
                ...(article.isRead ? [styles.readTitle] : []),
              ]}
            >
              {article.title || 'Untitled'}
            </Text>

            {article.summary && article.summary.trim() && (
              <Text
                variant='body2'
                numberOfLines={3}
                ellipsizeMode='tail'
                style={styles.summary}
              >
                {String(article.summary).trim()}
              </Text>
            )}

            <View style={styles.metadata}>
              <Text variant='caption' style={styles.date}>
                {formattedDate}
              </Text>

              {!!article.readTime && (
                <Text variant='caption' style={styles.separator}>
                  •
                </Text>
              )}
              {!!article.readTime && (
                <Text variant='caption' style={styles.readTime}>
                  {formattedReadTime}
                </Text>
              )}

              {sourceHostname ? (
                <Text variant='caption' style={styles.separator}>
                  •
                </Text>
              ) : null}
              {sourceHostname ? (
                <Text
                  variant='caption'
                  numberOfLines={1}
                  ellipsizeMode='tail'
                  style={styles.source}
                >
                  {sourceHostname}
                </Text>
              ) : null}
            </View>

            {article.tags && article.tags.length > 0 && (
              <View style={styles.tagsContainer} testID='tags-container'>
                {article.tags.slice(0, 3).map(tag => (
                  <View key={tag} style={styles.tag}>
                    <Text variant='caption' style={styles.tagText}>
                      {tag}
                    </Text>
                  </View>
                ))}
                {article.tags.length > 3 && (
                  <Text variant='caption' style={styles.moreTagsText}>
                    +{article.tags.length - 3}
                  </Text>
                )}
              </View>
            )}
          </View>

          <View style={styles.statusIndicators}>
            {article.isFavorite && (
              <View
                style={styles.favoriteIndicator}
                testID='favorite-indicator'
              >
                <Text variant='caption' style={styles.favoriteIcon}>
                  ♥
                </Text>
              </View>
            )}

            {article.isArchived && (
              <View style={styles.archivedIndicator} testID='archive-indicator'>
                <Text variant='caption' style={styles.archivedIcon}>
                  📦
                </Text>
              </View>
            )}

            {article.isRead && (
              <View style={styles.readIndicator}>
                <Text variant='caption' style={styles.readIcon}>
                  ✓
                </Text>
              </View>
            )}
          </View>

          <View style={styles.actionButtons}>
            {onToggleFavorite && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={onToggleFavorite}
                testID='favorite-button'
                accessibilityLabel={
                  article.isFavorite
                    ? 'Remove from favorites'
                    : 'Add to favorites'
                }
                accessibilityRole='button'
              >
                <Text variant='caption' style={styles.actionButtonText}>
                  {article.isFavorite ? '♥' : '♡'}
                </Text>
              </TouchableOpacity>
            )}

            {onToggleArchive && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={onToggleArchive}
                testID='archive-button'
                accessibilityLabel={
                  article.isArchived ? 'Unarchive article' : 'Archive article'
                }
                accessibilityRole='button'
              >
                <Text variant='caption' style={styles.actionButtonText}>
                  {article.isArchived ? '📤' : '📦'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison function for React.memo optimization
    const prevArticle = prevProps.article;
    const nextArticle = nextProps.article;

    // Check if article properties that affect rendering have changed
    if (
      prevArticle.id !== nextArticle.id ||
      prevArticle.title !== nextArticle.title ||
      prevArticle.summary !== nextArticle.summary ||
      prevArticle.imageUrl !== nextArticle.imageUrl ||
      prevArticle.sourceUrl !== nextArticle.sourceUrl ||
      prevArticle.createdAt !== nextArticle.createdAt ||
      prevArticle.readTime !== nextArticle.readTime ||
      prevArticle.isRead !== nextArticle.isRead ||
      prevArticle.isFavorite !== nextArticle.isFavorite ||
      prevArticle.isArchived !== nextArticle.isArchived ||
      JSON.stringify(prevArticle.tags) !== JSON.stringify(nextArticle.tags)
    ) {
      return false; // Re-render
    }

    // Check other props
    if (
      prevProps.loading !== nextProps.loading ||
      prevProps.onPress !== nextProps.onPress ||
      prevProps.onLongPress !== nextProps.onLongPress ||
      prevProps.onToggleFavorite !== nextProps.onToggleFavorite ||
      prevProps.onToggleArchive !== nextProps.onToggleArchive
    ) {
      return false; // Re-render
    }

    // Compare style prop (shallow comparison for performance)
    if (prevProps.style !== nextProps.style) {
      return false; // Re-render
    }

    return true; // Skip re-render
  }
);

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.neutral[50],
    borderRadius: theme.borderRadius.md,
    marginHorizontal: theme.spacing[4],
    marginVertical: theme.spacing[2],
    ...theme.shadows.sm,
  },
  content: {
    flexDirection: 'row',
    padding: theme.spacing[4],
    alignItems: 'flex-start',
  },
  image: {
    width: 80,
    height: 80,
    borderRadius: theme.borderRadius.base,
    marginRight: theme.spacing[3],
  },
  textContent: {
    flex: 1,
    minHeight: 80,
  },
  title: {
    marginBottom: theme.spacing[2],
    color: theme.colors.neutral[900],
  },
  readTitle: {
    color: theme.colors.neutral[600],
  },
  summary: {
    marginBottom: theme.spacing[3],
    color: theme.colors.neutral[700],
  },
  metadata: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing[2],
  },
  date: {
    color: theme.colors.neutral[500],
  },
  separator: {
    color: theme.colors.neutral[400],
    marginHorizontal: theme.spacing[1],
  },
  readTime: {
    color: theme.colors.neutral[500],
  },
  source: {
    color: theme.colors.neutral[500],
    flex: 1,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  tag: {
    backgroundColor: theme.colors.primary[100],
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: theme.spacing[2],
    paddingVertical: theme.spacing[1],
    marginRight: theme.spacing[1],
    marginBottom: theme.spacing[1],
  },
  tagText: {
    color: theme.colors.primary[700],
    fontSize: theme.typography.fontSize.xs,
  },
  moreTagsText: {
    color: theme.colors.neutral[500],
    marginLeft: theme.spacing[1],
  },
  statusIndicators: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingLeft: theme.spacing[2],
  },
  favoriteIndicator: {
    marginBottom: theme.spacing[1],
  },
  favoriteIcon: {
    color: theme.colors.error[500],
    fontSize: 16,
  } as TextStyle,
  archivedIndicator: {
    marginBottom: theme.spacing[1],
  },
  archivedIcon: {
    fontSize: 14,
  } as TextStyle,
  readIndicator: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  readIcon: {
    color: theme.colors.success[500],
    fontSize: 14,
    fontWeight: 'bold',
  } as TextStyle,
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: theme.spacing[2],
  },
  actionButton: {
    padding: theme.spacing[2],
    marginRight: theme.spacing[2],
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.neutral[100],
  },
  actionButtonText: {
    fontSize: 16,
  } as TextStyle,
});

export default ArticleCard;
