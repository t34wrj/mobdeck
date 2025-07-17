import { useCallback, useState } from 'react';
import { useAppDispatch } from '../store';
import { Alert, Share } from 'react-native';
import { Article } from '../types';
import {
  updateArticle,
  deleteArticle,
  updateArticleLocalWithDB,
} from '../store/slices/articlesSlice';

export const useArticleActions = (
  article: Article | undefined,
  articleId: string,
  navigation: any
) => {
  const dispatch = useAppDispatch();
  const [showActions, setShowActions] = useState(false);
  const [showLabelModal, setShowLabelModal] = useState(false);

  const handleToggleFavorite = useCallback(async () => {
    if (!article) return;

    try {
      const result = await dispatch(
        updateArticle({
          id: articleId,
          updates: { isFavorite: !article.isFavorite },
        })
      );
      if (result.meta.requestStatus === 'rejected') {
        throw new Error(result.error?.message || 'Update failed');
      }
    } catch (error) {
      console.error('[useArticleActions] Failed to toggle favorite:', error);
      Alert.alert(
        'Error',
        'Failed to update favorite status. Please try again.',
        [{ text: 'OK' }]
      );
    }
  }, [article, articleId, dispatch]);

  const handleToggleArchive = useCallback(async () => {
    if (!article) return;

    try {
      const result = await dispatch(
        updateArticle({
          id: articleId,
          updates: { isArchived: !article.isArchived },
        })
      );
      if (result.meta.requestStatus === 'rejected') {
        throw new Error(result.error?.message || 'Update failed');
      }
    } catch (error) {
      console.error('[useArticleActions] Failed to toggle archive:', error);
      Alert.alert(
        'Error',
        'Failed to update archive status. Please try again.',
        [{ text: 'OK' }]
      );
    }
  }, [article, articleId, dispatch]);

  const handleToggleRead = useCallback(async () => {
    if (!article) return;

    try {
      const result = await dispatch(
        updateArticle({
          id: articleId,
          updates: { isRead: !article.isRead },
        })
      );
      if (result.meta.requestStatus === 'rejected') {
        throw new Error(result.error?.message || 'Update failed');
      }
    } catch (error) {
      console.error('[useArticleActions] Failed to toggle read:', error);
      Alert.alert('Error', 'Failed to update read status. Please try again.', [
        { text: 'OK' },
      ]);
    }
  }, [article, articleId, dispatch]);

  const handleShare = useCallback(async () => {
    if (!article) return;

    try {
      await Share.share({
        message: `${article.title}\n\n${article.url}`,
        url: article.url,
        title: article.title,
      });
    } catch (error) {
      console.error('[useArticleActions] Failed to share article:', error);
      Alert.alert('Error', 'Failed to share article. Please try again.', [
        { text: 'OK' },
      ]);
    }
  }, [article]);

  const handleDelete = useCallback(() => {
    if (!article) return;

    Alert.alert(
      'Delete Article',
      'Are you sure you want to delete this article? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await dispatch(deleteArticle({ id: articleId }));
              if (result.meta.requestStatus === 'rejected') {
                throw new Error(result.error?.message || 'Delete failed');
              }
              navigation.goBack();
            } catch (error) {
              console.error('[useArticleActions] Failed to delete article:', error);
              Alert.alert(
                'Error',
                'Failed to delete article. Please try again.',
                [{ text: 'OK' }]
              );
            }
          },
        },
      ]
    );
  }, [article, articleId, dispatch, navigation]);

  const handleManageLabels = useCallback(() => {
    setShowLabelModal(true);
  }, []);

  const handleLabelsChanged = useCallback(
    (labelIds: string[]) => {
      dispatch(
        updateArticleLocalWithDB({
          id: articleId,
          updates: { tags: labelIds },
        })
      );
    },
    [articleId, dispatch]
  );

  return {
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
  };
};
