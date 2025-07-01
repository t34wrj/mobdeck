import React from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import type { ViewStyle } from 'react-native';
import { Text } from './ui/Text';
import { theme } from './ui/theme';
import { Article } from '../types';

export interface ArticleCardProps {
  article: Article;
  onPress: () => void;
  onLongPress?: () => void;
  onToggleFavorite?: () => void;
  onToggleArchive?: () => void;
  style?: ViewStyle;
}

export const ArticleCard: React.FC<ArticleCardProps> = ({
  article,
  onPress,
  onLongPress,
  style,
}) => {
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    } else if (diffInHours < 168) { // 7 days
      return `${Math.floor(diffInHours / 24)}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const formatReadTime = (minutes?: number): string => {
    if (!minutes) return '';
    return `${minutes} min read`;
  };

  return (
    <TouchableOpacity
      style={[styles.container, style]}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Article: ${article.title}`}
      accessibilityHint="Tap to read article"
    >
      <View style={styles.content}>
        {article.imageUrl && (
          <Image
            source={{ uri: article.imageUrl }}
            style={styles.image}
            resizeMode="cover"
          />
        )}
        
        <View style={styles.textContent}>
          <Text
            variant="h6"
            numberOfLines={2}
            ellipsizeMode="tail"
            style={[
              styles.title,
              article.isRead && styles.readTitle,
            ]}
          >
            {article.title}
          </Text>
          
          {article.summary && (
            <Text
              variant="body2"
              numberOfLines={3}
              ellipsizeMode="tail"
              style={styles.summary}
            >
              {article.summary}
            </Text>
          )}
          
          <View style={styles.metadata}>
            <Text variant="caption" style={styles.date}>
              {formatDate(article.createdAt)}
            </Text>
            
            {article.readTime && (
              <>
                <Text variant="caption" style={styles.separator}>
                  •
                </Text>
                <Text variant="caption" style={styles.readTime}>
                  {formatReadTime(article.readTime)}
                </Text>
              </>
            )}
            
            {article.sourceUrl && (
              <>
                <Text variant="caption" style={styles.separator}>
                  •
                </Text>
                <Text
                  variant="caption"
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  style={styles.source}
                >
                  {article.sourceUrl && (() => {
                    try {
                      return new URL(article.sourceUrl).hostname;
                    } catch {
                      return article.sourceUrl;
                    }
                  })()}
                </Text>
              </>
            )}
          </View>
          
          {article.tags && article.tags.length > 0 && (
            <View style={styles.tagsContainer}>
              {article.tags.slice(0, 3).map((tag) => (
                <View key={tag} style={styles.tag}>
                  <Text variant="caption" style={styles.tagText}>
                    {tag}
                  </Text>
                </View>
              ))}
              {article.tags.length > 3 && (
                <Text variant="caption" style={styles.moreTagsText}>
                  +{article.tags.length - 3}
                </Text>
              )}
            </View>
          )}
        </View>
        
        <View style={styles.statusIndicators}>
          {article.isFavorite && (
            <View style={styles.favoriteIndicator}>
              <Text style={styles.favoriteIcon}>♥</Text>
            </View>
          )}
          
          {article.isArchived && (
            <View style={styles.archivedIndicator}>
              <Text style={styles.archivedIcon}>📦</Text>
            </View>
          )}
          
          {article.isRead && (
            <View style={styles.readIndicator} />
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

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
  },
  archivedIndicator: {
    marginBottom: theme.spacing[1],
  },
  archivedIcon: {
    fontSize: 14,
  },
  readIndicator: {
    width: 8,
    height: 8,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.success[500],
  },
});

export default ArticleCard;