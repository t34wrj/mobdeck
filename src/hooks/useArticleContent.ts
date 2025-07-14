import { useEffect, useState, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { Alert } from 'react-native';
import { Article } from '../types';
import {
  updateArticleLocal,
  updateArticleLocalWithDB,
} from '../store/slices/articlesSlice';
import { articlesApiService } from '../services/ArticlesApiService';

export const useArticleContent = (
  article: Article | undefined,
  articleId: string
) => {
  const dispatch = useDispatch();
  const [refreshing, setRefreshing] = useState(false);
  const [contentFetched, setContentFetched] = useState(false);

  useEffect(() => {
    setContentFetched(false);
  }, [articleId]);

  useEffect(() => {
    const fetchContentIfNeeded = async () => {
      if (!article) return;

      if (!article.content && !contentFetched) {
        setContentFetched(true);
        console.log(
          '[useArticleContent] Article has no content, attempting to fetch...'
        );

        if (article.id.startsWith('local_')) {
          console.log(
            '[useArticleContent] Local article detected, attempting to sync to server...'
          );

          try {
            const createdArticle = await articlesApiService.createArticle({
              title: article.title,
              url: article.url,
            });

            const serverArticle = await articlesApiService.getArticle(
              createdArticle.id
            );

            console.log(
              '[useArticleContent] Article content fetched from server'
            );

            const updateData = {
              content: serverArticle.content || '',
              summary: serverArticle.summary || '',
              imageUrl: serverArticle.imageUrl || '',
            };

            dispatch(
              updateArticleLocalWithDB({
                id: articleId,
                updates: updateData,
              })
            );
          } catch (syncErr) {
            console.error(
              '[useArticleContent] Failed to sync local article to server:',
              syncErr
            );
          }
        } else if (article.contentUrl) {
          try {
            const htmlContent = await articlesApiService.getArticleContent(
              article.contentUrl
            );

            dispatch(
              updateArticleLocalWithDB({
                id: articleId,
                updates: { content: htmlContent },
              })
            );
          } catch (fetchErr) {
            console.error(
              '[useArticleContent] Failed to auto-fetch content:',
              fetchErr
            );
          }
        }
      }
    };

    fetchContentIfNeeded();
  }, [article, articleId, dispatch, contentFetched]);

  const handleRefresh = useCallback(async () => {
    if (!article) return;

    setRefreshing(true);
    setContentFetched(false);
    try {
      console.log(
        '[useArticleContent] Manual refresh - fetching full content...'
      );

      let updatedArticle;

      if (article.id.startsWith('local_')) {
        const createdArticle = await articlesApiService.createArticle({
          title: article.title,
          url: article.url,
        });
        updatedArticle = await articlesApiService.getArticle(createdArticle.id);
      } else {
        updatedArticle = await articlesApiService.getArticle(article.id);
      }

      const updateData = {
        content: updatedArticle.content,
        summary: updatedArticle.summary,
        title: updatedArticle.title,
        imageUrl: updatedArticle.imageUrl,
        updatedAt: updatedArticle.updatedAt,
      };

      dispatch(
        updateArticleLocal({
          id: article.id,
          updates: updateData,
        })
      );

      console.log('[useArticleContent] Article updated via refresh');
    } catch (refreshErr) {
      console.error(
        '[useArticleContent] Failed to refresh article:',
        refreshErr
      );
      Alert.alert(
        'Refresh Failed',
        `Unable to fetch latest article content. Error: ${refreshErr.message || 'Unknown error'}`,
        [{ text: 'OK' }]
      );
    } finally {
      setRefreshing(false);
    }
  }, [article, dispatch]);

  return {
    refreshing,
    handleRefresh,
  };
};
