import React from 'react';
import { TextInput, View, StyleSheet } from 'react-native';
import { theme } from './theme';
import { SimpleButton } from './SimpleButton';

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
        placeholderTextColor={theme.colors.neutral[500]}
        value={searchQuery}
        onChangeText={onSearchChange}
        onSubmitEditing={onSearchSubmit}
        accessibilityLabel='Search articles input'
        accessibilityHint='Enter keywords to search your articles'
        accessibilityRole='search'
      />
      <SimpleButton
        title='Search'
        variant='primary'
        size='sm'
        onPress={onSearchSubmit}
        accessibilityLabel='Search button'
        accessibilityHint='Tap to search for articles'
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 10,
    backgroundColor: theme.colors.neutral[100],
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing[2],
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.neutral[400],
    borderRadius: theme.borderRadius.base,
    padding: theme.spacing[3],
    marginRight: theme.spacing[2],
    backgroundColor: theme.colors.neutral[50],
    color: theme.colors.neutral[800],
    minHeight: theme.accessibility.minTouchTarget.height,
    fontSize: theme.typography.fontSize.base,
  },
});

export default SearchBar;
