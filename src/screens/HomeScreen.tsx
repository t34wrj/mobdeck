import React, { useEffect } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { fetchArticles } from '../store/slices/articlesSlice';
import ArticleCard from '../components/ArticleCard';
import SearchBar from '../components/SearchBar';
import { MainScreenProps } from '../navigation/types';

const HomeScreen: React.FC<MainScreenProps<'ArticlesList'>> = ({ navigation, route }) => {
  const dispatch = useDispatch();
  const articles = useSelector((state) => state.articles.items);
  
  useEffect(() => {
    dispatch(fetchArticles());
  }, [dispatch]);

  const renderItem = ({ item }) => (
    <ArticleCard article={item} />
  );

  return (
    <View style={styles.container}>
      <SearchBar />
      <FlatList
        data={articles}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
});

export default HomeScreen;