import { useEffect, useState, useCallback, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { Alert } from 'react-native';
import { Article } from '../types';
import {
  updateArticleLocal,
  updateArticleLocalWithDB,
  setContentLoading,
  setContentError,
  selectContentLoading,
  selectContentError,
} from '../store/slices/articlesSlice';
import { readeckApiService } from '../services/ReadeckApiService';

export const useArticleContent = (
  article: Article | undefined,
  articleId: string
) => {
  const dispatch = useAppDispatch();
  const [refreshing, setRefreshing] = useState(false);
  const [contentFetched, setContentFetched] = useState(false);
  
  // Use Redux for content loading state
  const isContentLoading = useAppSelector(state => selectContentLoading(state, articleId));
  const contentError = useAppSelector(state => selectContentError(state, articleId));
  
  // Use ref to track the last article ID to prevent unnecessary resets
  const lastArticleId = useRef<string | null>(null);
  const lastContentLength = useRef<number>(0);

  // Reset states only when article ID changes or content is actually empty
  useEffect(() => {
    const currentContentLength = article?.content?.length || 0;
    const hasActualContent = currentContentLength > 0;
    
    // Only reset if article ID changed or we lost content
    if (articleId !== lastArticleId.current || currentContentLength < lastContentLength.current) {
      lastArticleId.current = articleId;
      lastContentLength.current = currentContentLength;
      
      if (!hasActualContent) {
        setContentFetched(false);
      } else {
        // We have content, so mark as fetched
        setContentFetched(true);
      }
    } else if (hasActualContent && !contentFetched) {
      // Content appeared, mark as fetched
      setContentFetched(true);
      lastContentLength.current = currentContentLength;
    }
  }, [articleId, article?.content, contentFetched]);

  useEffect(() => {
    const fetchContentIfNeeded = async () => {
      if (!article) return;

      // Only fetch if we don't have content and haven't successfully fetched before
      if (!article.content && !contentFetched && !isContentLoading) {
        dispatch(setContentLoading({ articleId, loading: true }));
        setContentFetched(true);
        console.log(
          '[useArticleContent] Article has no content, attempting to fetch...'
        );

        if (article.id.startsWith('local_')) {
          console.log(
            '[useArticleContent] Local article detected, attempting to sync to server...'
          );

          try {
            const createdArticle =
              await readeckApiService.createArticleWithMetadata({
                title: article.title,
                url: article.url,
              });

            const serverArticle = await readeckApiService.getArticleWithContent(
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
            dispatch(setContentLoading({ articleId, loading: false }));
          } catch (syncErr) {
            console.error(
              '[useArticleContent] Failed to sync local article to server:',
              syncErr
            );
            dispatch(setContentError({ articleId, error: syncErr.message || 'Failed to sync article' }));
            setContentFetched(false);
          }
        } else if (article.contentUrl) {
          try {
            const fullArticle = await readeckApiService.getArticleWithContent(
              article.id
            );
            const htmlContent = fullArticle.content;

            dispatch(
              updateArticleLocalWithDB({
                id: articleId,
                updates: { content: htmlContent },
              })
            );
            dispatch(setContentLoading({ articleId, loading: false }));
          } catch (fetchErr) {
            console.error(
              '[useArticleContent] Failed to auto-fetch content:',
              fetchErr
            );
            dispatch(setContentError({ articleId, error: fetchErr.message || 'Failed to fetch content' }));
            setContentFetched(false);
          }
        }
      }
    };

    // Wrap in try-catch to prevent crashes
    fetchContentIfNeeded().catch(err => {
      console.error('[useArticleContent] Unexpected error in fetchContentIfNeeded:', err);
      dispatch(setContentError({ articleId, error: err.message || 'Unexpected error' }));
      setContentFetched(false);
    });
  }, [article, articleId, dispatch, contentFetched, isContentLoading]);

  const handleRefresh = useCallback(async () => {
    if (!article) return;

    setRefreshing(true);
    dispatch(setContentLoading({ articleId, loading: true }));
    setContentFetched(false);
    try {
      console.log(
        '[useArticleContent] Manual refresh - fetching full content...'
      );

      let updatedArticle;

      if (article.id.startsWith('local_')) {
        const createdArticle =
          await readeckApiService.createArticleWithMetadata({
            title: article.title,
            url: article.url,
          });
        updatedArticle = await readeckApiService.getArticleWithContent(
          createdArticle.id
        );
      } else {
        updatedArticle = await readeckApiService.getArticleWithContent(
          article.id
        );
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
      setContentFetched(true);
      dispatch(setContentLoading({ articleId, loading: false }));
    } catch (refreshErr) {
      console.error(
        '[useArticleContent] Failed to refresh article:',
        refreshErr
      );
      dispatch(setContentError({ articleId, error: refreshErr.message || 'Failed to refresh' }));
      setContentFetched(false);
      Alert.alert(
        'Refresh Failed',
        `Unable to fetch latest article content. Error: ${refreshErr.message || 'Unknown error'}`,
        [{ text: 'OK' }]
      );
    } finally {
      setRefreshing(false);
    }
  }, [article, dispatch, articleId]);

  return {
    refreshing,
    isLoading: isContentLoading,
    hasError: !!contentError,
    handleRefresh,
  };
};
