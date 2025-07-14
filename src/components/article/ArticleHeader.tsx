import React from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import { Text } from '../ui/Text';
import { theme } from '../ui/theme';
import { Article } from '../../types';

interface ArticleHeaderProps {
  article: Article;
  formatDate: (dateString: string) => string;
}

export const ArticleHeader: React.FC<ArticleHeaderProps> = ({
  article,
  formatDate,
}) => {
  const handleSourcePress = () => {
    if (article.sourceUrl) {
      Linking.openURL(article.sourceUrl).catch(() => {
        Alert.alert('Error', 'Unable to open link');
      });
    }
  };

  const formatSourceUrl = (url: string) => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  };

  return (
    <View style={styles.header}>
      <Text variant='h4' style={styles.title}>
        {article.title}
      </Text>

      <View style={styles.metadata}>
        <Text variant='caption' style={styles.metadataText}>
          Added {formatDate(article.createdAt)}
        </Text>

        {!!article.readTime && (
          <>
            <Text variant='caption' style={styles.separator}>
              •
            </Text>
            <Text variant='caption' style={styles.metadataText}>
              {article.readTime} min read
            </Text>
          </>
        )}
      </View>

      {article.sourceUrl && (
        <TouchableOpacity
          style={styles.sourceContainer}
          onPress={handleSourcePress}
        >
          <Text variant='caption' style={styles.sourceUrl}>
            {formatSourceUrl(article.sourceUrl)}
          </Text>
        </TouchableOpacity>
      )}

      {article.tags && article.tags.length > 0 && (
        <View style={styles.tagsContainer}>
          {article.tags.map(tag => (
            <View key={tag} style={styles.tag}>
              <Text variant='caption' style={styles.tagText}>
                {tag}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    padding: theme.spacing[4],
    backgroundColor: theme.colors.neutral[50],
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.neutral[200],
  },
  title: {
    marginBottom: theme.spacing[3],
    color: theme.colors.neutral[900],
    lineHeight: theme.typography.lineHeight['3xl'],
  },
  metadata: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing[2],
  },
  metadataText: {
    color: theme.colors.neutral[600],
  },
  separator: {
    color: theme.colors.neutral[400],
    marginHorizontal: theme.spacing[2],
  },
  sourceContainer: {
    marginBottom: theme.spacing[3],
  },
  sourceUrl: {
    color: theme.colors.primary[600],
    textDecorationLine: 'underline',
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
    marginRight: theme.spacing[2],
    marginBottom: theme.spacing[1],
  },
  tagText: {
    color: theme.colors.primary[700],
    fontSize: theme.typography.fontSize.xs,
  },
});
