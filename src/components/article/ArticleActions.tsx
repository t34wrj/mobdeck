import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '../ui/Text';
import { Button } from '../ui/Button';
import { theme } from '../ui/theme';
import { Article } from '../../types';

interface ArticleActionsProps {
  article: Article;
  showActions: boolean;
  onToggleActions: () => void;
  onToggleFavorite: () => void;
  onToggleArchive: () => void;
  onToggleRead: () => void;
  onManageLabels: () => void;
  onShare: () => void;
  onDelete: () => void;
  loading: {
    update: boolean;
    delete: boolean;
  };
}

export const ArticleActions: React.FC<ArticleActionsProps> = ({
  article,
  showActions,
  onToggleActions,
  onToggleFavorite,
  onToggleArchive,
  onToggleRead,
  onManageLabels,
  onShare,
  onDelete,
  loading,
}) => (
  <View style={styles.actionsContainer}>
    <Button
      variant='ghost'
      size='sm'
      onPress={onToggleActions}
      style={styles.actionToggle}
    >
      <Text>{showActions ? 'Hide Actions' : 'Show Actions'}</Text>
    </Button>

    {showActions && (
      <View style={styles.actionsGrid}>
        <Button
          variant='outline'
          size='sm'
          onPress={onToggleFavorite}
          style={styles.actionButton}
          loading={loading.update}
        >
          <Text>{article.isFavorite ? 'Unfavorite' : 'Favorite'}</Text>
        </Button>

        <Button
          variant='outline'
          size='sm'
          onPress={onToggleArchive}
          style={styles.actionButton}
          loading={loading.update}
        >
          <Text>{article.isArchived ? 'Unarchive' : 'Archive'}</Text>
        </Button>

        <Button
          variant='outline'
          size='sm'
          onPress={onToggleRead}
          style={styles.actionButton}
          loading={loading.update}
        >
          <Text>{article.isRead ? 'Mark Unread' : 'Mark Read'}</Text>
        </Button>

        <Button
          variant='outline'
          size='sm'
          onPress={onManageLabels}
          style={styles.actionButton}
        >
          <Text>Manage Labels</Text>
        </Button>

        <Button
          variant='outline'
          size='sm'
          onPress={onShare}
          style={styles.actionButton}
        >
          <Text>Share</Text>
        </Button>

        <Button
          variant='destructive'
          size='sm'
          onPress={onDelete}
          style={styles.actionButton}
          loading={loading.delete}
        >
          <Text>Delete</Text>
        </Button>
      </View>
    )}
  </View>
);

const styles = StyleSheet.create({
  actionsContainer: {
    padding: theme.spacing[4],
    backgroundColor: theme.colors.neutral[50],
    borderTopWidth: 1,
    borderTopColor: theme.colors.neutral[200],
  },
  actionToggle: {
    alignSelf: 'center',
    marginBottom: theme.spacing[3],
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: theme.spacing[2],
  },
  actionButton: {
    flexBasis: '48%',
    marginBottom: theme.spacing[2],
  },
});