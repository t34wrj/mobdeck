import React, { useEffect, useState } from 'react';
import { View, Image, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { readeckApiService } from '../services/ReadeckApiService';
import { MainScreenProps } from '../navigation/types';
import { colors } from '../components/theme';

const ArticleScreen: React.FC<MainScreenProps<'ArticleDetail'>> = ({
  navigation: _navigation,
  route,
}) => {
  const { articleId } = route.params;
  const [article, setArticle] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getArticle = async () => {
      try {
        const response = await readeckApiService.getArticle(articleId);
        setArticle(response.data);
      } catch (error) {
        console.error('Error fetching article:', error);
      } finally {
        setLoading(false);
      }
    };

    getArticle();
  }, [articleId]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size='large' color={colors.primary[500]} />
      </View>
    );
  }

  if (!article) {
    return (
      <View style={styles.errorContainer}>
        <Text>Error loading article.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {article.image && (
        <Image source={{ uri: article.image }} style={styles.image} />
      )}
      <Text style={styles.title}>{article.title}</Text>
      {article.author && <Text style={styles.author}>By {article.author}</Text>}
      {article.publishedAt && (
        <Text style={styles.publishDate}>Published: {article.publishedAt}</Text>
      )}
      {article.summary && <Text style={styles.summary}>{article.summary}</Text>}
      <Text style={styles.content}>{article.content}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: colors.neutral[50],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: 200,
    borderRadius: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginVertical: 8,
  },
  author: {
    fontSize: 14,
    color: colors.neutral[700],
    marginBottom: 4,
  },
  publishDate: {
    fontSize: 12,
    color: colors.neutral[500],
    marginBottom: 8,
  },
  summary: {
    fontSize: 16,
    color: colors.neutral[600],
    marginBottom: 8,
  },
  content: {
    fontSize: 14,
    lineHeight: 20,
  },
});

export default ArticleScreen;
