import React, { useEffect } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArticleContent } from '../../components/ArticleContent';
import { LabelManagementModal } from '../../components/LabelManagementModal';
import { ArticleHeader } from '../../components/article/ArticleHeader';
import { ArticleActions } from '../../components/article/ArticleActions';
import {
  ArticleLoadingState,
  ArticleErrorState,
} from '../../components/article/ArticleErrorStates';
import { theme } from "../../components/theme"';
import { MainScreenProps } from '../../navigation/types';
import { RootState } from '../../store';
import { selectArticleById } from '../../store/slices/articlesSlice';
import { useArticleContent } from '../../hooks/useArticleContent';
import { useArticleActions } from '../../hooks/useArticleActions';

type ArticleDetailScreenProps = MainScreenProps<'ArticleDetail'>;

export const ArticleDetailScreen: React.FC<ArticleDetailScreenProps> = ({
  navigation,
  route,
}) => {
  const insets = useSafeAreaInsets();
  const { articleId } = route.params;

  const article = useSelector((state: RootState) =>
    selectArticleById(state, articleId)
  );

  const { loading, error } = useSelector((state: RootState) => state.articles);

  const { refreshing, handleRefresh } = useArticleContent(article, articleId);

  const {
    showActions,
    setShowActions,
    showLabelModal,
    setShowLabelModal,
    handleToggleFavorite,
    handleToggleArchive,
    handleToggleRead,
    handleShare,
    handleDelete,
    handleManageLabels,
    handleLabelsChanged,
  } = useArticleActions(article, articleId, navigation);

  // Set navigation title
  useEffect(() => {
    if (article?.title) {
      navigation.setOptions({
        title:
          article.title.length > 30
            ? `${article.title.substring(0, 30)}...`
            : article.title,
      });
    }
  }, [article?.title, navigation]);

  // Format date
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Show loading state
  if (loading.fetch && !article) {
    return <ArticleLoadingState />;
  }

  // Show error state
  if (error.fetch && !article) {
    return (
      <ArticleErrorState
        title='Article Not Found'
        message="The article you're looking for could not be loaded."
        onGoBack={() => navigation.goBack()}
      />
    );
  }

  // Show article not found
  if (!article) {
    return (
      <ArticleErrorState
        title='Article Not Found'
        message='This article may have been deleted or moved.'
        onGoBack={() => navigation.goBack()}
      />
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary[500]]}
            tintColor={theme.colors.primary[500]}
          />
        }
      >
        <ArticleHeader article={article} formatDate={formatDate} />

        <ArticleContent
          content={article.content}
          summary={article.summary}
          imageUrl={article.imageUrl}
        />

        <ArticleActions
          article={article}
          showActions={showActions}
          onToggleActions={() => setShowActions(!showActions)}
          onToggleFavorite={handleToggleFavorite}
          onToggleArchive={handleToggleArchive}
          onToggleRead={handleToggleRead}
          onManageLabels={handleManageLabels}
          onShare={handleShare}
          onDelete={handleDelete}
          loading={loading}
        />
      </ScrollView>

      {/* Label Management Modal */}
      {article && (
        <LabelManagementModal
          visible={showLabelModal}
          onClose={() => setShowLabelModal(false)}
          articleId={articleId}
          articleTitle={article.title}
          currentLabels={article.tags || []}
          onLabelsChanged={handleLabelsChanged}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.neutral[100],
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: theme.spacing[6],
  },
});

export default ArticleDetailScreen;
