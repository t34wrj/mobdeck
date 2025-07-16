import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { SimpleText } from './SimpleText';
import { SimpleButton } from './SimpleButton';
import { Article } from '../types';
import { theme } from './theme';

interface ArticleHeaderProps {
  article: Article;
  onToggleActions?: () => void;
}

export const ArticleHeader: React.FC<ArticleHeaderProps> = ({ article, onToggleActions }) => (
  <View style={styles.header}>
    <SimpleText variant="h2" style={styles.title}>
      {article.title}
    </SimpleText>
    <Text style={styles.meta}>
      {article.source} • {article.publishedAt}
    </Text>
    {onToggleActions && (
      <TouchableOpacity onPress={onToggleActions} style={styles.actionsButton}>
        <Text style={styles.actionsText}>
          Actions
        </Text>
      </TouchableOpacity>
    )}
  </View>
);

interface ArticleActionsProps {
  article: Article;
  onToggleFavorite: () => void;
  onToggleArchive: () => void;
  onToggleRead: () => void;
  onManageLabels: () => void;
  onShare: () => void;
  onDelete: () => void;
  loading?: boolean;
}

export const ArticleActions: React.FC<ArticleActionsProps> = ({
  article,
  onToggleFavorite,
  onToggleArchive,
  onToggleRead,
  onManageLabels,
  onShare,
  onDelete,
  loading = false,
}) => (
  <View style={styles.actions}>
    <View style={styles.actionsGrid}>
      <SimpleButton
        title={article.isFavorite ? 'Unfavorite' : 'Favorite'}
        variant="outline"
        size="sm"
        onPress={onToggleFavorite}
        style={styles.actionButton}
        loading={loading}
      />
      <SimpleButton
        title={article.isArchived ? 'Unarchive' : 'Archive'}
        variant="outline"
        size="sm"
        onPress={onToggleArchive}
        style={styles.actionButton}
        loading={loading}
      />
      <SimpleButton
        title={article.isRead ? 'Mark Unread' : 'Mark Read'}
        variant="outline"
        size="sm"
        onPress={onToggleRead}
        style={styles.actionButton}
        loading={loading}
      />
      <SimpleButton
        title="Manage Labels"
        variant="outline"
        size="sm"
        onPress={onManageLabels}
        style={styles.actionButton}
      />
      <SimpleButton
        title="Share"
        variant="outline"
        size="sm"
        onPress={onShare}
        style={styles.actionButton}
      />
      <SimpleButton
        title="Delete"
        variant="outline"
        size="sm"
        onPress={onDelete}
        style={[styles.actionButton, styles.deleteButton]}
        textStyle={styles.deleteButtonText}
        loading={loading}
      />
    </View>
  </View>
);

interface ArticleErrorStatesProps {
  error: string;
  onRetry?: () => void;
}

export const ArticleErrorStates: React.FC<ArticleErrorStatesProps> = ({ error, onRetry }) => (
  <View style={styles.errorContainer}>
    <SimpleText variant="body" style={styles.errorText}>
      {error}
    </SimpleText>
    {onRetry && (
      <SimpleButton title="Retry" variant="primary" size="sm" onPress={onRetry} />
    )}
  </View>
);

interface ArticleLoadingStateProps {}

export const ArticleLoadingState: React.FC<ArticleLoadingStateProps> = () => (
  <View style={styles.loadingContainer}>
    <Text style={styles.loadingText}>
      Loading article...
    </Text>
  </View>
);

interface ArticleErrorStateProps {
  title: string;
  message: string;
  onGoBack?: () => void;
}

export const ArticleErrorState: React.FC<ArticleErrorStateProps> = ({ title, message, onGoBack }) => (
  <View style={styles.errorContainer}>
    <SimpleText variant="h3" style={styles.errorTitle}>
      {title}
    </SimpleText>
    <SimpleText variant="body" style={styles.errorText}>
      {message}
    </SimpleText>
    {onGoBack && (
      <SimpleButton title="Go Back" variant="primary" size="sm" onPress={onGoBack} />
    )}
  </View>
);

const styles = StyleSheet.create({
  header: {
    padding: theme.spacing[4],
    backgroundColor: theme.colors.neutral[50],
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.neutral[200],
  },
  title: {
    marginBottom: theme.spacing[2],
    color: theme.colors.neutral[800],
  },
  meta: {
    color: theme.colors.neutral[600],
    marginBottom: theme.spacing[2],
    fontSize: theme.typography.fontSize.sm,
  },
  actionsButton: {
    paddingVertical: theme.spacing[1],
    alignSelf: 'flex-start',
  },
  actionsText: {
    color: theme.colors.primary[500],
    fontSize: theme.typography.fontSize.sm,
  },
  actions: {
    padding: theme.spacing[4],
    backgroundColor: theme.colors.neutral[50],
    borderTopWidth: 1,
    borderTopColor: theme.colors.neutral[200],
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
  deleteButton: {
    borderColor: theme.colors.error[500],
  },
  deleteButtonText: {
    color: theme.colors.error[500],
  },
  errorContainer: {
    padding: theme.spacing[4],
    backgroundColor: theme.colors.error[50],
    borderWidth: 1,
    borderColor: theme.colors.error[200],
    borderRadius: theme.borderRadius.base,
    alignItems: 'center',
  },
  errorText: {
    color: theme.colors.error[600],
    textAlign: 'center',
    marginBottom: theme.spacing[3],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing[4],
  },
  loadingText: {
    color: theme.colors.neutral[600],
    fontSize: theme.typography.fontSize.base,
  },
  errorTitle: {
    color: theme.colors.error[600],
    marginBottom: theme.spacing[2],
    textAlign: 'center',
  },
});