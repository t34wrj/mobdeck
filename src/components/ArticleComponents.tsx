import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { SimpleText } from './SimpleText';
import { SimpleButton } from './SimpleButton';
import { Article } from '../types';

interface ArticleHeaderProps {
  article: Article;
  onToggleActions?: () => void;
}

export const ArticleHeader: React.FC<ArticleHeaderProps> = ({ article, onToggleActions }) => (
  <View style={styles.header}>
    <SimpleText variant="h2" style={styles.title}>
      {article.title}
    </SimpleText>
    <SimpleText variant="caption" style={styles.meta}>
      {article.source} • {article.publishedAt}
    </SimpleText>
    {onToggleActions && (
      <TouchableOpacity onPress={onToggleActions} style={styles.actionsButton}>
        <SimpleText variant="caption" color="#FE5D26">
          Actions
        </SimpleText>
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
        style={[styles.actionButton, { borderColor: '#ef4444' }]}
        textStyle={{ color: '#ef4444' }}
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
    <SimpleText variant="body" style={styles.loadingText}>
      Loading article...
    </SimpleText>
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
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    marginBottom: 8,
    color: '#1f2937',
  },
  meta: {
    color: '#6b7280',
    marginBottom: 8,
  },
  actionsButton: {
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  actions: {
    padding: 16,
    backgroundColor: '#f9fafb',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  actionButton: {
    flexBasis: '48%',
    marginBottom: 8,
  },
  errorContainer: {
    padding: 16,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 8,
    alignItems: 'center',
  },
  errorText: {
    color: '#dc2626',
    textAlign: 'center',
    marginBottom: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  loadingText: {
    color: '#6b7280',
  },
  errorTitle: {
    color: '#dc2626',
    marginBottom: 8,
    textAlign: 'center',
  },
});