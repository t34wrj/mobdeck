import React from 'react';
import { TextInput, View, StyleSheet, Button } from 'react-native';

interface SearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearchSubmit: () => void;
}

const SearchBar: React.FC<SearchBarProps> = ({
  searchQuery,
  onSearchChange,
  onSearchSubmit,
}) => {
  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder='Search articles...'
        value={searchQuery}
        onChangeText={onSearchChange}
        onSubmitEditing={onSearchSubmit}
      />
      <Button title='Search' onPress={onSearchSubmit} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 10,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
    marginRight: 10,
  },
});

export default SearchBar;
