import React from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { Text } from '../ui/Text';
import { Button } from '../ui/Button';
import { theme } from '../ui/theme';

interface ArticleLoadingStateProps {
  message?: string;
}

export const ArticleLoadingState: React.FC<ArticleLoadingStateProps> = ({
  message = 'Loading article...',
}) => (
  <View style={[styles.container, styles.centeredContainer]}>
    <ActivityIndicator size='large' color={theme.colors.primary[500]} />
    <Text variant='body1' style={styles.loadingText}>
      {message}
    </Text>
  </View>
);

interface ArticleErrorStateProps {
  title: string;
  message: string;
  onGoBack: () => void;
}

export const ArticleErrorState: React.FC<ArticleErrorStateProps> = ({
  title,
  message,
  onGoBack,
}) => (
  <View style={[styles.container, styles.centeredContainer]}>
    <Text variant='h6' style={styles.errorTitle}>
      {title}
    </Text>
    <Text variant='body1' style={styles.errorMessage}>
      {message}
    </Text>
    <Button variant='outline' onPress={onGoBack} style={styles.backButton}>
      <Text>Go Back</Text>
    </Button>
  </View>
);

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
