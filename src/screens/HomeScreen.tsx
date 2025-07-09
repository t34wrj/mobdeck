import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { fetchArticles, selectAllArticles, setFilters } from '../store/slices/articlesSlice';
import ArticleCard from '../components/ArticleCard';
import SearchBar from '../components/SearchBar';
import { Text } from '../components/ui/Text';
import { MainScreenProps } from '../navigation/types';
import { RootState, AppDispatch } from '../store';
import { theme } from '../components/ui/theme';

const HomeScreen: React.FC<MainScreenProps<'ArticlesList'>> = ({
  navigation,
  route,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const articles = useSelector(selectAllArticles);
  const { loading, error } = useSelector((state: RootState) => ({
    loading: state.articles.loading.fetch,
    error: state.articles.error.fetch,
  }));
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    // Only fetch articles if authenticated
    if (isAuthenticated) {
      dispatch(fetchArticles({}));
    }
  }, [dispatch, isAuthenticated]);

  const renderItem = ({ item }) => (
    <ArticleCard 
      article={item} 
      onPress={() => {
        // TODO: Navigate to article detail screen
        console.log('Article pressed:', item.id);
      }}
    />
  );

  if (!isAuthenticated) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Please log in to view your articles</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary[500]} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  const handleSearch = () => {
    dispatch(setFilters({ searchQuery }));
    dispatch(fetchArticles({ searchQuery }));
  };

  return (
    <View style={styles.container}>
      <SearchBar 
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={handleSearch}
      />
      <FlatList
        data={articles}
        renderItem={renderItem}
        keyExtractor={item => item.id.toString()}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: theme.colors.neutral[50],
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    backgroundColor: theme.colors.neutral[50],
  },
  errorText: {
    fontSize: 16,
    color: theme.colors.error[500],
    textAlign: 'center',
  },
});

export default HomeScreen;
