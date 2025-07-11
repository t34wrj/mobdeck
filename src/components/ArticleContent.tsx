import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Image,
  Dimensions,
  TouchableOpacity,
  Modal,
  ScrollView as RNScrollView,
} from 'react-native';
import { Text } from './ui/Text';
import { theme } from './ui/theme';

export interface ArticleContentProps {
  content: string;
  summary?: string;
  imageUrl?: string;
  fontSize?: 'small' | 'medium' | 'large';
  fontFamily?: string;
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

export const ArticleContent: React.FC<ArticleContentProps> = ({
  content,
  summary,
  imageUrl,
  fontSize = 'medium',
  fontFamily = theme.typography.fontFamily.regular,
}) => {
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [imageError, setImageError] = useState(false);

  const contentStyles = {
    fontSize: FontSizes[fontSize].body,
    lineHeight: FontSizes[fontSize].lineHeight,
    fontFamily,
  };

  // Simple HTML content parser for basic formatting
  const parseContent = (htmlContent: string): React.ReactNode[] => {
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
    const paragraphs = processedContent.split(/\n\s*\n/).filter(p => p.trim());

    return paragraphs.map((paragraph, index) => {
      // Check if it's likely a heading (short line followed by content)
      const isHeading =
        paragraph.length < 100 &&
        index < paragraphs.length - 1 &&
        !paragraph.endsWith('.') &&
        !paragraph.endsWith('!') &&
        !paragraph.endsWith('?');

      if (isHeading) {
        return (
          <Text
            key={index}
            variant='h6'
            style={[
              styles.heading,
              {
                fontSize: FontSizes[fontSize].body * 1.2,
                lineHeight: FontSizes[fontSize].lineHeight * 1.2,
                fontFamily,
              },
            ]}
          >
            {paragraph}
          </Text>
        );
      }

      return (
        <Text
          key={index}
          variant='body1'
          style={[styles.paragraph, contentStyles]}
        >
          {paragraph}
        </Text>
      );
    });
  };

  // Handle image load error
  const handleImageError = () => {
    setImageError(true);
  };

  // Handle image press
  const handleImagePress = () => {
    if (!imageError && imageUrl) {
      setImageModalVisible(true);
    }
  };

  // Render image with fallback
  const renderImage = (style: any, resizeMode: any = 'cover') => {
    if (!imageUrl || imageError) {
      return null;
    }

    return (
      <Image
        source={{ uri: imageUrl }}
        style={style}
        resizeMode={resizeMode}
        onError={handleImageError}
      />
    );
  };

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
          <Text variant='h6' style={styles.summaryTitle}>
            Summary
          </Text>
          <Text variant='body1' style={[styles.summary, contentStyles]}>
            {summary}
          </Text>
        </View>
      )}

      {/* Content */}
      <View style={styles.contentContainer}>
        {content && content.trim() ? (
          parseContent(content)
        ) : (
          <Text variant='body1' style={[styles.noContent, contentStyles]}>
            No content available for this article.{'\n\n'}Pull down to refresh to try loading the content from the server.
          </Text>
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
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  imageContainer: {
    backgroundColor: theme.colors.neutral[100],
    marginBottom: theme.spacing[4],
  },
  image: {
    width: '100%',
    height: 200,
    borderRadius: theme.borderRadius.base,
  },
  summaryContainer: {
    padding: theme.spacing[4],
    backgroundColor: theme.colors.info[50],
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.info[500],
    marginBottom: theme.spacing[4],
    marginHorizontal: theme.spacing[4],
    borderRadius: theme.borderRadius.base,
  },
  summaryTitle: {
    marginBottom: theme.spacing[2],
    color: theme.colors.info[700],
    fontWeight: theme.typography.fontWeight.semibold,
  },
  summary: {
    color: theme.colors.info[800],
  },
  contentContainer: {
    paddingHorizontal: theme.spacing[4],
    paddingBottom: theme.spacing[4],
  },
  paragraph: {
    marginBottom: theme.spacing[4],
    color: theme.colors.neutral[800],
    textAlign: 'left',
  },
  heading: {
    marginBottom: theme.spacing[3],
    marginTop: theme.spacing[2],
    color: theme.colors.neutral[900],
    fontWeight: theme.typography.fontWeight.semibold,
  },
  noContent: {
    textAlign: 'center',
    color: theme.colors.neutral[500],
    fontStyle: 'italic',
    marginTop: theme.spacing[6],
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
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
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: theme.spacing[4],
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: theme.borderRadius.full,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: theme.colors.neutral[50],
    fontSize: 20,
    fontWeight: theme.typography.fontWeight.bold,
  },
});

export default ArticleContent;
