import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Share,
  Alert,
  RefreshControl,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../../components/ui/Text';
import { Button } from '../../components/ui/Button';
import { ArticleContent } from '../../components/ArticleContent';
import { LabelManagementModal } from '../../components/LabelManagementModal';
import { theme } from '../../components/ui/theme';
import { MainScreenProps } from '../../navigation/types';
import { RootState } from '../../store';
import {
  selectArticleById,
  updateArticle,
  deleteArticle,
  updateArticleLocal,
  updateArticleLocalWithDB,
} from '../../store/slices/articlesSlice';
import { articlesApiService } from '../../services/ArticlesApiService';
import { Article } from '../../types';

type ArticleDetailScreenProps = MainScreenProps<'ArticleDetail'>;

export const ArticleDetailScreen: React.FC<ArticleDetailScreenProps> = ({
  navigation,
  route,
}) => {
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const { articleId } = route.params;

  const article = useSelector((state: RootState) =>
    selectArticleById(state, articleId)
  );

  const { loading, error } = useSelector((state: RootState) => state.articles);

  const [refreshing, setRefreshing] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [contentFetched, setContentFetched] = useState(false);

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


  // Fetch content on first load if not already present
  useEffect(() => {
    const fetchContentIfNeeded = async () => {
      if (!article || contentFetched) return;
      
      // Check if article has no content
      if (!article.content) {
        setContentFetched(true);
        console.log('[ArticleDetailScreen] Article has no content, attempting to fetch...');
        
        // If it's a local article (offline-saved), try to sync to server first
        if (article.id.startsWith('local_')) {
          console.log('[ArticleDetailScreen] Local article detected, attempting to sync to server...');
          console.log('[ArticleDetailScreen] Article details:', {
            id: article.id,
            title: article.title,
            url: article.url,
            hasContent: !!article.content,
            contentLength: article.content?.length || 0
          });
          
          try {
            // Create article on server first
            console.log('[ArticleDetailScreen] Creating article on server...');
            const createdArticle = await articlesApiService.createArticle({
              title: article.title,
              url: article.url,
            });
            
            console.log('[ArticleDetailScreen] Article created on server, now fetching full content...');
            // Fetch the full article with content
            const serverArticle = await articlesApiService.getArticle(createdArticle.id);
            
            console.log('[ArticleDetailScreen] Article with content fetched successfully!');
            console.log('[ArticleDetailScreen] Server article:', {
              id: serverArticle.id,
              title: serverArticle.title,
              hasContent: !!serverArticle.content,
              contentLength: serverArticle.content?.length || 0,
              contentPreview: serverArticle.content?.substring(0, 100) || 'NO_CONTENT',
              hasImageUrl: !!serverArticle.imageUrl,
              hasSummary: !!serverArticle.summary
            });
            
            // Update local article with server data and content
            const updateData = {
              content: serverArticle.content || '',
              summary: serverArticle.summary || '',
              imageUrl: serverArticle.imageUrl || '',
            };
            
            console.log('[ArticleDetailScreen] Updating local article with server data:', {
              contentLength: updateData.content.length,
              summaryLength: updateData.summary.length,
              hasImageUrl: !!updateData.imageUrl
            });
            
            dispatch(
              updateArticleLocalWithDB({
                id: articleId,
                updates: updateData,
              })
            );
            
            // Show success message to user
            setTimeout(() => {
              if (serverArticle.content && serverArticle.content.length > 0) {
                console.log('[ArticleDetailScreen] Content fetched successfully, length:', serverArticle.content.length);
              } else {
                console.log('[ArticleDetailScreen] No content was fetched from server');
              }
            }, 1000);
            
          } catch (error) {
            console.error('[ArticleDetailScreen] Failed to sync local article to server:', error);
            console.error('[ArticleDetailScreen] Error details:', {
              message: error.message,
              stack: error.stack,
              name: error.name
            });
            
            // Show user-friendly error message
            console.log('[ArticleDetailScreen] Will try again on manual refresh');
          }
        } 
        // If it's a server article with contentUrl, fetch content
        else if (article.contentUrl) {
          console.log('[ArticleDetailScreen] Server article with contentUrl, fetching content...');
          try {
            const htmlContent = await articlesApiService.getArticleContent(article.contentUrl);
            console.log('[ArticleDetailScreen] Auto-fetched content, length:', htmlContent.length);
            
            dispatch(
              updateArticleLocalWithDB({
                id: articleId,
                updates: { content: htmlContent },
              })
            );
          } catch (error) {
            console.error('[ArticleDetailScreen] Failed to auto-fetch content:', error);
          }
        }
      }
    };

    fetchContentIfNeeded();
  }, [article, articleId, dispatch, contentFetched]);

  // Handle refresh - fetch full content
  const handleRefresh = useCallback(async () => {
    if (!article) return;

    setRefreshing(true);
    try {
      console.log('[ArticleDetailScreen] Manual refresh - fetching full content...');
      console.log('[ArticleDetailScreen] Current article state:', {
        id: article.id,
        title: article.title,
        hasContent: !!article.content,
        contentLength: article.content?.length || 0,
        contentPreview: article.content?.substring(0, 50) || 'NO_CONTENT'
      });
      
      let updatedArticle;
      
      // Handle local articles differently
      if (article.id.startsWith('local_')) {
        console.log('[ArticleDetailScreen] Refreshing local article - creating on server first...');
        // For local articles, create on server first, then fetch full content
        const createdArticle = await articlesApiService.createArticle({
          title: article.title,
          url: article.url,
        });
        console.log('[ArticleDetailScreen] Article created, now fetching full content...');
        updatedArticle = await articlesApiService.getArticle(createdArticle.id);
      } else {
        // For server articles, fetch existing article
        updatedArticle = await articlesApiService.getArticle(article.id);
      }
      
      console.log('[ArticleDetailScreen] Refresh response:', {
        hasContent: !!updatedArticle.content,
        contentLength: updatedArticle.content?.length || 0,
        contentPreview: updatedArticle.content?.substring(0, 100) || 'NO_CONTENT',
        fullArticleKeys: Object.keys(updatedArticle),
        hasContentUrl: !!updatedArticle.contentUrl
      });
      
      // Content should already be fetched by getArticle method
      // Log the result for debugging
      
      // Debug: Show all fields being updated
      const updateData = {
        content: updatedArticle.content,
        summary: updatedArticle.summary,
        title: updatedArticle.title,
        imageUrl: updatedArticle.imageUrl,
        updatedAt: updatedArticle.updatedAt,
      };
      
      console.log('[ArticleDetailScreen] Dispatching updates:', {
        content: updateData.content?.substring(0, 100) || 'NO_CONTENT',
        contentLength: updateData.content?.length || 0,
        summary: updateData.summary?.substring(0, 50) || 'NO_SUMMARY',
        title: updateData.title
      });
      
      // Update local state with fresh content
      dispatch(
        updateArticleLocal({
          id: article.id,
          updates: updateData,
        })
      );
      
      console.log('[ArticleDetailScreen] Article updated via refresh');
      
      // Show alert with debugging info to user
      Alert.alert(
        'Refresh Complete',
        `Content fetched: ${updatedArticle.content ? 'YES' : 'NO'}\nContent length: ${updatedArticle.content?.length || 0} chars\nFields available: ${Object.keys(updatedArticle).join(', ')}`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('[ArticleDetailScreen] Failed to refresh article:', error);
      Alert.alert(
        'Refresh Failed',
        `Unable to fetch latest article content. Error: ${error.message || 'Unknown error'}`,
        [{ text: 'OK' }]
      );
    } finally {
      setRefreshing(false);
    }
  }, [article, dispatch]);

  // Handle favorite toggle
  const handleToggleFavorite = useCallback(async () => {
    if (!article) return;

    try {
      await dispatch(
        updateArticle({
          id: articleId,
          updates: { isFavorite: !article.isFavorite },
        })
      ).unwrap();
    } catch (error) {
      Alert.alert(
        'Error',
        'Failed to update favorite status. Please try again.',
        [{ text: 'OK' }]
      );
    }
  }, [article, articleId, dispatch]);

  // Handle archive toggle
  const handleToggleArchive = useCallback(async () => {
    if (!article) return;

    try {
      await dispatch(
        updateArticle({
          id: articleId,
          updates: { isArchived: !article.isArchived },
        })
      ).unwrap();
    } catch (error) {
      Alert.alert(
        'Error',
        'Failed to update archive status. Please try again.',
        [{ text: 'OK' }]
      );
    }
  }, [article, articleId, dispatch]);

  // Handle read toggle
  const handleToggleRead = useCallback(async () => {
    if (!article) return;

    try {
      await dispatch(
        updateArticle({
          id: articleId,
          updates: { isRead: !article.isRead },
        })
      ).unwrap();
    } catch (error) {
      Alert.alert('Error', 'Failed to update read status. Please try again.', [
        { text: 'OK' },
      ]);
    }
  }, [article, articleId, dispatch]);

  // Handle share
  const handleShare = useCallback(async () => {
    if (!article) return;

    try {
      await Share.share({
        message: `${article.title}\n\n${article.url}`,
        url: article.url,
        title: article.title,
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to share article. Please try again.', [
        { text: 'OK' },
      ]);
    }
  }, [article]);

  // Handle delete
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
              await dispatch(deleteArticle({ id: articleId })).unwrap();
              navigation.goBack();
            } catch (error) {
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

  // Handle label management
  const handleManageLabels = useCallback(() => {
    setShowLabelModal(true);
  }, []);

  // Handle labels changed
  const handleLabelsChanged = useCallback(
    (labelIds: string[]) => {
      // Update the article's tags in the Redux store and database
      dispatch(
        updateArticleLocalWithDB({
          id: articleId,
          updates: { tags: labelIds },
        })
      );
    },
    [articleId, dispatch]
  );

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
    return (
      <View style={[styles.container, styles.centeredContainer]}>
        <ActivityIndicator size='large' color={theme.colors.primary[500]} />
        <Text variant='body1' style={styles.loadingText}>
          Loading article...
        </Text>
      </View>
    );
  }

  // Show error state
  if (error.fetch && !article) {
    return (
      <View style={[styles.container, styles.centeredContainer]}>
        <Text variant='h6' style={styles.errorTitle}>
          Article Not Found
        </Text>
        <Text variant='body1' style={styles.errorMessage}>
          The article you're looking for could not be loaded.
        </Text>
        <Button
          variant='outline'
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          Go Back
        </Button>
      </View>
    );
  }

  // Show article not found
  if (!article) {
    return (
      <View style={[styles.container, styles.centeredContainer]}>
        <Text variant='h6' style={styles.errorTitle}>
          Article Not Found
        </Text>
        <Text variant='body1' style={styles.errorMessage}>
          This article may have been deleted or moved.
        </Text>
        <Button
          variant='outline'
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          Go Back
        </Button>
      </View>
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
        {/* Article Header */}
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
              onPress={() => {
                // TODO: Open source URL in browser
                Alert.alert('Source', article.sourceUrl);
              }}
            >
              <Text variant='caption' style={styles.sourceUrl}>
                {(() => {
                  try {
                    return new URL(article.sourceUrl).hostname;
                  } catch {
                    return article.sourceUrl;
                  }
                })()}
              </Text>
            </TouchableOpacity>
          )}

          {/* Tags */}
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

        {/* Article Content */}
        <ArticleContent
          content={article.content}
          summary={article.summary}
          imageUrl={article.imageUrl}
        />

        {/* Actions Section */}
        <View style={styles.actionsContainer}>
          <Button
            variant='ghost'
            size='sm'
            onPress={() => setShowActions(!showActions)}
            style={styles.actionToggle}
          >
            {showActions ? 'Hide Actions' : 'Show Actions'}
          </Button>

          {showActions && (
            <View style={styles.actionsGrid}>
              <Button
                variant='outline'
                size='sm'
                onPress={handleToggleFavorite}
                style={styles.actionButton}
                loading={loading.update}
              >
                {article.isFavorite ? 'Unfavorite' : 'Favorite'}
              </Button>

              <Button
                variant='outline'
                size='sm'
                onPress={handleToggleArchive}
                style={styles.actionButton}
                loading={loading.update}
              >
                {article.isArchived ? 'Unarchive' : 'Archive'}
              </Button>

              <Button
                variant='outline'
                size='sm'
                onPress={handleToggleRead}
                style={styles.actionButton}
                loading={loading.update}
              >
                {article.isRead ? 'Mark Unread' : 'Mark Read'}
              </Button>

              <Button
                variant='outline'
                size='sm'
                onPress={handleManageLabels}
                style={styles.actionButton}
              >
                Manage Labels
              </Button>

              <Button
                variant='outline'
                size='sm'
                onPress={handleShare}
                style={styles.actionButton}
              >
                Share
              </Button>

              <Button
                variant='destructive'
                size='sm'
                onPress={handleDelete}
                style={styles.actionButton}
                loading={loading.delete}
              >
                Delete
              </Button>
            </View>
          )}
        </View>
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
  centeredContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing[6],
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: theme.spacing[6],
  },
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
  loadingText: {
    marginTop: theme.spacing[2],
    textAlign: 'center',
    color: theme.colors.neutral[600],
  },
  errorTitle: {
    marginBottom: theme.spacing[2],
    textAlign: 'center',
    color: theme.colors.error[700],
  },
  errorMessage: {
    marginBottom: theme.spacing[4],
    textAlign: 'center',
    color: theme.colors.neutral[600],
  },
  backButton: {
    marginTop: theme.spacing[2],
  },
});

export default ArticleDetailScreen;
