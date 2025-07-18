import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
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
import { contentOperationCoordinator } from '../utils/ContentOperationCoordinator';

export const useArticleContent = (
  article: Article | undefined,
  articleId: string
) => {
  const dispatch = useAppDispatch();
  const [refreshing, setRefreshing] = useState(false);
  const [contentFetched, setContentFetched] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  
  // Use Redux for content loading state
  const isContentLoading = useAppSelector(state => selectContentLoading(state, articleId));
  const contentError = useAppSelector(state => selectContentError(state, articleId));
  
  // Error recovery constants
  const MAX_RETRY_ATTEMPTS = 3;
  const RETRY_DELAYS = useMemo(() => [1000, 2000, 4000], []); // Exponential backoff: 1s, 2s, 4s
  const CONTENT_TIMEOUT = 30000; // 30 seconds
  
  // Use ref to track the last article ID to prevent unnecessary resets
  const lastArticleId = useRef<string | null>(null);
  const lastContentLength = useRef<number>(0);
  
  // Cleanup on unmount - cancel any active operations for this article
  useEffect(() => {
    return () => {
      if (articleId) {
        contentOperationCoordinator.cancelContentFetch(articleId);
      }
    };
  }, [articleId]);

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
          '[useArticleContent] Article has no content, attempting to fetch via coordinator...'
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
            setRetryCount(0); // Reset retry count on success
          } catch (syncErr) {
            console.error(
              '[useArticleContent] Failed to sync local article to server:',
              syncErr
            );
            const errorMessage = syncErr.message || 'Failed to sync article';
            dispatch(setContentError({ articleId, error: errorMessage }));
            setContentFetched(false);
            dispatch(setContentLoading({ articleId, loading: false }));
          }
        } else if (article.contentUrl) {
          try {
            // Use ContentOperationCoordinator for individual content fetching with timeout
            const content = await Promise.race([
              contentOperationCoordinator.requestContentFetch({
                articleId: article.id,
                type: 'individual',
                priority: 'high', // User-initiated operations have high priority
                timeout: CONTENT_TIMEOUT, // 30 second timeout for individual operations
                debounceMs: 500 // 500ms debouncing for rapid navigation
              }),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Content fetch timeout')), CONTENT_TIMEOUT)
              )
            ]);

            console.log(
              '[useArticleContent] Article content fetched via coordinator'
            );

            dispatch(
              updateArticleLocalWithDB({
                id: articleId,
                updates: { content },
              })
            );
            dispatch(setContentLoading({ articleId, loading: false }));
            setRetryCount(0); // Reset retry count on success
          } catch (fetchErr) {
            console.error(
              '[useArticleContent] Failed to auto-fetch content via coordinator:',
              fetchErr
            );
            const errorMessage = fetchErr.message || 'Failed to fetch content';
            dispatch(setContentError({ articleId, error: errorMessage }));
            setContentFetched(false);
            dispatch(setContentLoading({ articleId, loading: false }));
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
  }, [article, articleId, dispatch, contentFetched, isContentLoading, CONTENT_TIMEOUT]);

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
        // Use coordinator for refresh operations with high priority and timeout
        try {
          const content = await Promise.race([
            contentOperationCoordinator.requestContentFetch({
              articleId: article.id,
              type: 'individual',
              priority: 'high', // Manual refresh has highest priority
              timeout: CONTENT_TIMEOUT,
              debounceMs: 0 // No debouncing for manual refresh
            }),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Refresh timeout')), CONTENT_TIMEOUT)
            )
          ]);
          
          // Get article metadata
          const articleMeta = await readeckApiService.getArticleWithContent(article.id);
          updatedArticle = {
            ...articleMeta,
            content
          };
        } catch {
          console.log('[useArticleContent] Coordinator refresh failed, falling back to direct API call');
          // Fallback to direct API call if coordinator fails
          updatedArticle = await readeckApiService.getArticleWithContent(
            article.id
          );
        }
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
      setRetryCount(0); // Reset retry count on successful refresh
      dispatch(setContentLoading({ articleId, loading: false }));
    } catch (refreshErr) {
      console.error(
        '[useArticleContent] Failed to refresh article:',
        refreshErr
      );
      const errorMessage = refreshErr.message || 'Failed to refresh';
      dispatch(setContentError({ articleId, error: errorMessage }));
      setContentFetched(false);
      
      // Don't show alert for manual refresh - let UI handle error display
      console.log('[useArticleContent] Refresh failed, error state set for UI handling');
    } finally {
      setRefreshing(false);
      dispatch(setContentLoading({ articleId, loading: false }));
    }
  }, [article, dispatch, articleId, CONTENT_TIMEOUT]);

  // Retry mechanism with exponential backoff
  const retryFetch = useCallback(async () => {
    if (!article || retryCount >= MAX_RETRY_ATTEMPTS || isRetrying) {
      return;
    }

    setIsRetrying(true);
    const currentRetry = retryCount + 1;
    setRetryCount(currentRetry);
    
    // Clear previous error
    dispatch(setContentError({ articleId, error: null }));
    dispatch(setContentLoading({ articleId, loading: true }));
    
    console.log(`[useArticleContent] Retry attempt ${currentRetry}/${MAX_RETRY_ATTEMPTS}`);
    
    try {
      // Wait for retry delay with exponential backoff
      if (currentRetry > 1) {
        const delay = RETRY_DELAYS[currentRetry - 2] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
        console.log(`[useArticleContent] Waiting ${delay}ms before retry`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      let content: string;
      
      if (article.id.startsWith('local_')) {
        // Handle local articles
        const createdArticle = await readeckApiService.createArticleWithMetadata({
          title: article.title,
          url: article.url,
        });
        const serverArticle = await readeckApiService.getArticleWithContent(createdArticle.id);
        content = serverArticle.content || '';
      } else {
        // Use coordinator for retry with timeout
        content = await Promise.race([
          contentOperationCoordinator.requestContentFetch({
            articleId: article.id,
            type: 'individual',
            priority: 'high',
            timeout: CONTENT_TIMEOUT,
            debounceMs: 0 // No debouncing for retry
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Retry timeout')), CONTENT_TIMEOUT)
          )
        ]);
      }
      
      // Success - update content
      dispatch(
        updateArticleLocalWithDB({
          id: articleId,
          updates: { content },
        })
      );
      
      setContentFetched(true);
      setRetryCount(0); // Reset on success
      console.log(`[useArticleContent] Retry ${currentRetry} successful`);
      
    } catch (retryErr) {
      console.error(`[useArticleContent] Retry ${currentRetry} failed:`, retryErr);
      
      const errorMessage = retryErr.message || 'Retry failed';
      const enhancedMessage = currentRetry >= MAX_RETRY_ATTEMPTS 
        ? `${errorMessage} (Maximum retries reached)`
        : `${errorMessage} (Retry ${currentRetry}/${MAX_RETRY_ATTEMPTS})`;
        
      dispatch(setContentError({ articleId, error: enhancedMessage }));
      setContentFetched(false);
    } finally {
      setIsRetrying(false);
      dispatch(setContentLoading({ articleId, loading: false }));
    }
  }, [article, articleId, dispatch, retryCount, isRetrying, MAX_RETRY_ATTEMPTS, RETRY_DELAYS, CONTENT_TIMEOUT]);

  return {
    refreshing,
    isLoading: isContentLoading || isRetrying,
    hasError: !!contentError,
    error: contentError,
    retryCount,
    canRetry: retryCount < MAX_RETRY_ATTEMPTS && !isRetrying,
    isRetrying,
    handleRefresh,
    retryFetch,
  };
};
