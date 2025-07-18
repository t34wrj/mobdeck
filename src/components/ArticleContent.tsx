import React, { useState, memo, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Image,
  Dimensions,
  TouchableOpacity,
  Modal,
  ScrollView as RNScrollView,
} from 'react-native';
import { SimpleText as Text } from './SimpleText';
import { theme } from './theme';

export interface ArticleContentProps {
  content: string;
  summary?: string;
  imageUrl?: string;
  fontSize?: 'small' | 'medium' | 'large';
  fontFamily?: string;
  isLoading?: boolean;
  hasError?: boolean;
  error?: string | null;
  retryCount?: number;
  canRetry?: boolean;
  isRetrying?: boolean;
  onRetry?: () => void;
  onManualRefresh?: () => void;
  contentLoading?: boolean;
  contentError?: boolean;
}

const { width: screenWidth } = Dimensions.get('window');

const FontSizes = {
  small: {
    body: theme.typography.fontSize.sm,
    lineHeight: theme.typography.lineHeight.sm,
  },
  medium: {
    body: theme.typography.fontSize.base,
    lineHeight: theme.typography.lineHeight.base,
  },
  large: {
    body: theme.typography.fontSize.lg,
    lineHeight: theme.typography.lineHeight.lg,
  },
};

export const ArticleContent: React.FC<ArticleContentProps> = memo(
  ({
    content,
    summary,
    imageUrl,
    fontSize = 'medium',
    fontFamily = theme.typography.fontFamily.regular,
    isLoading = false,
    hasError = false,
    error = null,
    retryCount = 0,
    canRetry = false,
    isRetrying = false,
    onRetry,
    onManualRefresh,
    contentLoading = false,
    contentError = false,
  }) => {
    const [imageModalVisible, setImageModalVisible] = useState(false);
    const [imageError, setImageError] = useState(false);

    const contentStyles = useMemo(
      () => ({
        fontSize: FontSizes[fontSize].body,
        lineHeight: FontSizes[fontSize].lineHeight,
        fontFamily,
      }),
      [fontSize, fontFamily]
    );

    // Memoize the expensive HTML content parser
    const parseContent = useCallback(
      (htmlContent: string): React.ReactNode[] => {
        // Remove HTML tags and convert basic formatting
        // This is a simplified parser - in production, consider using a proper HTML parser
        const processedContent = htmlContent
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<\/p>/gi, '\n\n')
          .replace(/<p[^>]*>/gi, '')
          .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, '\n\n$1\n\n')
          .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '$1')
          .replace(/<b[^>]*>(.*?)<\/b>/gi, '$1')
          .replace(/<em[^>]*>(.*?)<\/em>/gi, '$1')
          .replace(/<i[^>]*>(.*?)<\/i>/gi, '$1')
          .replace(/<[^>]*>/g, '') // Remove remaining HTML tags
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&#34;/g, '"')
          .replace(/&#8216;/g, "'")
          .replace(/&#8217;/g, "'")
          .replace(/&#8220;/g, '"')
          .replace(/&#8221;/g, '"')
          .replace(/&#8212;/g, '—')
          .replace(/&#8211;/g, '–')
          .replace(/&nbsp;/g, ' ')
          .replace(/&rsquo;/g, "'")
          .replace(/&lsquo;/g, "'")
          .replace(/&rdquo;/g, '"')
          .replace(/&ldquo;/g, '"')
          .replace(/&mdash;/g, '—')
          .replace(/&ndash;/g, '–')
          .trim();

        // Split into paragraphs and render
        const paragraphs = processedContent
          .split(/\n\s*\n/)
          .filter(p => p.trim());

        return paragraphs.map((paragraph, index) => {
          // Check if it's likely a heading (short line followed by content)
          const isHeading =
            paragraph.length < 100 &&
            index < paragraphs.length - 1 &&
            !paragraph.endsWith('.') &&
            !paragraph.endsWith('!') &&
            !paragraph.endsWith('?');

          // Check if it's a quote or highlighted text
          const isQuote = paragraph.startsWith('"') && paragraph.endsWith('"');
          
          // Check if it's a list item
          const isListItem = paragraph.match(/^[•·\-*]\s+/) || paragraph.match(/^\d+\.\s+/);

          if (isHeading) {
            return (
              <Text
                key={index}
                variant='h3'
                style={[
                  styles.heading,
                  {
                    fontSize: FontSizes[fontSize].body * 1.3,
                    lineHeight: FontSizes[fontSize].lineHeight * 1.3,
                    fontFamily,
                  },
                ]}
              >
                {paragraph}
              </Text>
            );
          }

          if (isQuote) {
            return (
              <View key={index} style={styles.quoteContainer}>
                <Text
                  variant='body'
                  style={[styles.quote, contentStyles]}
                >
                  {paragraph}
                </Text>
              </View>
            );
          }

          if (isListItem) {
            return (
              <View key={index} style={styles.listItemContainer}>
                <Text
                  variant='body'
                  style={[styles.listItem, contentStyles]}
                >
                  {paragraph}
                </Text>
              </View>
            );
          }

          return (
            <Text
              key={index}
              variant='body'
              style={[styles.paragraph, contentStyles]}
            >
              {paragraph}
            </Text>
          );
        });
      },
      [contentStyles, fontSize, fontFamily]
    );

    // Handle image load error
    const handleImageError = useCallback(() => {
      setImageError(true);
    }, []);

    // Handle image press
    const handleImagePress = useCallback(() => {
      if (!imageError && imageUrl) {
        setImageModalVisible(true);
      }
    }, [imageError, imageUrl]);

    // Render image with fallback
    const renderImage = useCallback(
      (style: any, resizeMode: any = 'cover') => {
        if (!imageUrl || imageError) {
          return null;
        }

        return (
          <Image
            source={{ uri: imageUrl }}
            style={style}
            resizeMode={resizeMode}
            onError={handleImageError}
            testID="article-image"
          />
        );
      },
      [imageUrl, imageError, handleImageError]
    );

    // Memoize parsed content to avoid re-parsing on every render
    const parsedContent = useMemo(() => {
      if (content && content.trim()) {
        return parseContent(content);
      }
      return null;
    }, [content, parseContent]);

    // Determine the overall loading state
    const isContentLoading = isLoading || contentLoading || isRetrying;
    const hasContentError = hasError || contentError;
    const hasContent = content && content.trim().length > 0;
    
    // Get error message with retry information
    const getErrorMessage = useCallback(() => {
      if (!hasContentError) return '';
      
      const baseMessage = error || 'Failed to load content';
      
      if (retryCount > 0) {
        return `${baseMessage} (Attempt ${retryCount}/3)`;
      }
      
      return baseMessage;
    }, [hasContentError, error, retryCount]);
    
    // Get loading message with retry information
    const getLoadingMessage = useCallback(() => {
      if (isRetrying) {
        return `Retrying... (${retryCount}/3)`;
      }
      return 'Loading content...';
    }, [isRetrying, retryCount]);

    return (
      <View style={styles.container}>
        {/* Article Image */}
        {imageUrl && !imageError && (
          <TouchableOpacity
            style={styles.imageContainer}
            onPress={handleImagePress}
            activeOpacity={0.8}
          >
            {renderImage(styles.image)}
          </TouchableOpacity>
        )}

        {/* Summary */}
        {summary && (
          <View style={styles.summaryContainer}>
            <Text variant='h3' style={styles.summaryTitle}>
              Summary
            </Text>
            <Text variant='body' style={[styles.summary, contentStyles]}>
              {summary}
            </Text>
          </View>
        )}

        {/* Content */}
        <View style={styles.contentContainer}>
          {isContentLoading ? (
            <View style={styles.loadingContainer}>
              <Text variant='body' style={[styles.loadingText, contentStyles]}>
                {getLoadingMessage()}
              </Text>
              {isRetrying && (
                <View style={styles.retryProgress}>
                  <Text variant='body' style={[styles.retryProgressText, contentStyles]}>
                    Please wait...
                  </Text>
                </View>
              )}
            </View>
          ) : hasContentError ? (
            <View style={styles.errorContainer}>
              <Text variant='body' style={[styles.errorTitle, contentStyles]}>
                Content Loading Error
              </Text>
              <Text variant='body' style={[styles.errorText, contentStyles]}>
                {getErrorMessage()}
              </Text>
              
              <View style={styles.errorActions}>
                {onRetry && canRetry && (
                  <TouchableOpacity
                    style={[styles.retryButton, styles.primaryButton]}
                    onPress={onRetry}
                    activeOpacity={0.7}
                    disabled={isRetrying}
                  >
                    <Text variant='body' style={styles.retryButtonText}>
                      {isRetrying ? 'Retrying...' : `Retry (${retryCount}/3)`}
                    </Text>
                  </TouchableOpacity>
                )}
                
                {onManualRefresh && (
                  <TouchableOpacity
                    style={[styles.retryButton, styles.secondaryButton]}
                    onPress={onManualRefresh}
                    activeOpacity={0.7}
                    disabled={isRetrying}
                  >
                    <Text variant='body' style={styles.secondaryButtonText}>
                      Manual Refresh
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              
              {retryCount >= 3 && (
                <View style={styles.maxRetriesContainer}>
                  <Text variant='body' style={[styles.maxRetriesText, contentStyles]}>
                    Maximum retry attempts reached. Try manual refresh or check your connection.
                  </Text>
                </View>
              )}
            </View>
          ) : hasContent && parsedContent ? (
            parsedContent
          ) : (
            <View style={styles.noContentContainer}>
              <Text variant='body' style={[styles.noContent, contentStyles]}>
                No content available for this article.
              </Text>
              {onManualRefresh && (
                <TouchableOpacity
                  style={[styles.retryButton, styles.secondaryButton, styles.noContentButton]}
                  onPress={onManualRefresh}
                  activeOpacity={0.7}
                >
                  <Text variant='body' style={styles.secondaryButtonText}>
                    Try Loading Content
                  </Text>
                </TouchableOpacity>
              )}
              <Text variant='body' style={[styles.noContentHint, contentStyles]}>
                Pull down to refresh to try loading from the server.
              </Text>
            </View>
          )}
        </View>

        {/* Image Modal */}
        <Modal
          visible={imageModalVisible}
          transparent={true}
          animationType='fade'
          onRequestClose={() => setImageModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <TouchableOpacity
              style={styles.modalBackground}
              onPress={() => setImageModalVisible(false)}
              activeOpacity={1}
            >
              <View style={styles.modalContent}>
                <RNScrollView
                  contentContainerStyle={styles.modalScrollContent}
                  maximumZoomScale={3}
                  minimumZoomScale={1}
                  showsHorizontalScrollIndicator={false}
                  showsVerticalScrollIndicator={false}
                >
                  {renderImage(styles.modalImage, 'contain')}
                </RNScrollView>

                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setImageModalVisible(false)}
                >
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </View>
        </Modal>
      </View>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison function for React.memo optimization
    return (
      prevProps.content === nextProps.content &&
      prevProps.summary === nextProps.summary &&
      prevProps.imageUrl === nextProps.imageUrl &&
      prevProps.fontSize === nextProps.fontSize &&
      prevProps.fontFamily === nextProps.fontFamily &&
      prevProps.isLoading === nextProps.isLoading &&
      prevProps.hasError === nextProps.hasError &&
      prevProps.error === nextProps.error &&
      prevProps.retryCount === nextProps.retryCount &&
      prevProps.canRetry === nextProps.canRetry &&
      prevProps.isRetrying === nextProps.isRetrying &&
      prevProps.onRetry === nextProps.onRetry &&
      prevProps.onManualRefresh === nextProps.onManualRefresh &&
      prevProps.contentLoading === nextProps.contentLoading &&
      prevProps.contentError === nextProps.contentError
    );
  }
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  imageContainer: {
    backgroundColor: theme.colors.neutral[50],
    marginBottom: theme.spacing[5],
    marginHorizontal: theme.spacing[4],
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    ...theme.shadows.sm,
  },
  image: {
    width: '100%',
    height: 240,
    borderRadius: theme.borderRadius.lg,
  },
  summaryContainer: {
    padding: theme.spacing[5],
    backgroundColor: theme.colors.accent[50],
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.accent[500],
    marginBottom: theme.spacing[5],
    marginHorizontal: theme.spacing[4],
    borderRadius: theme.borderRadius.lg,
    borderTopRightRadius: theme.borderRadius.lg,
    borderBottomRightRadius: theme.borderRadius.lg,
    ...theme.shadows.sm,
  },
  summaryTitle: {
    marginBottom: theme.spacing[3],
    color: theme.colors.dark[700],
    fontWeight: theme.typography.fontWeight.bold,
    fontSize: theme.typography.fontSize.lg,
  },
  summary: {
    color: theme.colors.dark[600],
    lineHeight: theme.typography.lineHeight.lg,
  },
  contentContainer: {
    paddingHorizontal: theme.spacing[4],
    paddingBottom: theme.spacing[6],
  },
  paragraph: {
    marginBottom: theme.spacing[5],
    color: theme.colors.neutral[800],
    textAlign: 'left',
    lineHeight: theme.typography.lineHeight.lg,
  },
  heading: {
    marginBottom: theme.spacing[3],
    marginTop: theme.spacing[6],
    color: theme.colors.dark[700],
    fontWeight: theme.typography.fontWeight.bold,
    paddingLeft: theme.spacing[3],
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.primary[500],
  },
  quoteContainer: {
    marginBottom: theme.spacing[5],
    marginHorizontal: theme.spacing[2],
    paddingLeft: theme.spacing[4],
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.secondary[400],
    backgroundColor: theme.colors.secondary[50],
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing[3],
    paddingRight: theme.spacing[4],
  },
  quote: {
    fontStyle: 'italic',
    color: theme.colors.dark[600],
    fontSize: theme.typography.fontSize.md,
    lineHeight: theme.typography.lineHeight.md,
  },
  listItemContainer: {
    marginBottom: theme.spacing[3],
    paddingLeft: theme.spacing[4],
    flexDirection: 'row',
  },
  listItem: {
    flex: 1,
    color: theme.colors.neutral[700],
    paddingLeft: theme.spacing[2],
  },
  noContentContainer: {
    marginTop: theme.spacing[4],
    marginBottom: theme.spacing[6],
  },
  noContent: {
    textAlign: 'center',
    color: theme.colors.neutral[600],
    fontStyle: 'italic',
    marginBottom: theme.spacing[4],
    padding: theme.spacing[6],
    backgroundColor: theme.colors.neutral[50],
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.neutral[200],
    borderStyle: 'dashed',
  },
  noContentButton: {
    alignSelf: 'center',
    marginBottom: theme.spacing[3],
  },
  noContentHint: {
    textAlign: 'center',
    color: theme.colors.neutral[400],
    fontSize: theme.typography.fontSize.sm,
    fontStyle: 'italic',
  },
  loadingContainer: {
    textAlign: 'center',
    padding: theme.spacing[8],
    backgroundColor: theme.colors.neutral[50],
    borderRadius: theme.borderRadius.lg,
    marginTop: theme.spacing[4],
    marginBottom: theme.spacing[6],
  },
  loadingText: {
    textAlign: 'center',
    color: theme.colors.neutral[600],
    fontStyle: 'italic',
    marginBottom: theme.spacing[2],
  },
  errorContainer: {
    padding: theme.spacing[6],
    backgroundColor: theme.colors.primary[50],
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.primary[200],
    marginTop: theme.spacing[4],
    marginBottom: theme.spacing[6],
  },
  errorTitle: {
    textAlign: 'center',
    color: theme.colors.primary[800],
    fontWeight: theme.typography.fontWeight.semibold,
    fontSize: theme.typography.fontSize.lg,
    marginBottom: theme.spacing[3],
  },
  errorText: {
    textAlign: 'center',
    color: theme.colors.primary[700],
    marginBottom: theme.spacing[5],
    lineHeight: theme.typography.lineHeight.lg,
  },
  errorActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing[3],
    marginBottom: theme.spacing[4],
  },
  retryButton: {
    paddingHorizontal: theme.spacing[5],
    paddingVertical: theme.spacing[3],
    borderRadius: theme.borderRadius.md,
    minWidth: 120,
  },
  primaryButton: {
    backgroundColor: theme.colors.primary[500],
  },
  secondaryButton: {
    backgroundColor: theme.colors.neutral[100],
    borderWidth: 1,
    borderColor: theme.colors.neutral[300],
  },
  retryButtonText: {
    color: theme.colors.neutral[50],
    fontWeight: theme.typography.fontWeight.medium,
    textAlign: 'center',
  },
  secondaryButtonText: {
    color: theme.colors.neutral[700],
    fontWeight: theme.typography.fontWeight.medium,
    textAlign: 'center',
  },
  retryProgress: {
    marginTop: theme.spacing[3],
    alignItems: 'center',
  },
  retryProgressText: {
    color: theme.colors.neutral[500],
    fontSize: theme.typography.fontSize.sm,
    fontStyle: 'italic',
  },
  maxRetriesContainer: {
    backgroundColor: theme.colors.secondary[50],
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing[4],
    borderWidth: 1,
    borderColor: theme.colors.secondary[200],
  },
  maxRetriesText: {
    textAlign: 'center',
    color: theme.colors.secondary[700],
    fontSize: theme.typography.fontSize.sm,
    lineHeight: theme.typography.lineHeight.sm,
  },
  // Modal styles with enhanced design
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(8, 61, 119, 0.95)', // Yale Blue with opacity
  },
  modalBackground: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing[4],
  },
  modalImage: {
    width: screenWidth - theme.spacing[8],
    height: undefined,
    aspectRatio: 1,
    maxHeight: '80%',
    borderRadius: theme.borderRadius.lg,
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: theme.spacing[4],
    backgroundColor: theme.colors.primary[500],
    borderRadius: theme.borderRadius.full,
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.md,
  },
  closeButtonText: {
    color: theme.colors.neutral[50],
    fontSize: 24,
    fontWeight: theme.typography.fontWeight.bold,
  },
});

export default ArticleContent;
