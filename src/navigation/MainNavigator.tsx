import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { View, StyleSheet } from 'react-native';
import { ArticlesListScreen } from '../screens/main/ArticlesListScreen';
import { ArticleDetailScreen } from '../screens/main/ArticleDetailScreen';
import { SettingsScreen } from '../screens/main/SettingsScreen';
import { MainStackParamList } from './types';
import { theme } from '../components/ui/theme';
import { Text } from '../components/ui/Text';
import MobdeckLogo from '../components/MobdeckLogo';

const Stack = createStackNavigator<MainStackParamList>();

const CustomHeader: React.FC = () => {
  return (
    <View style={styles.headerContainer}>
      <MobdeckLogo size={28} color={theme.colors.neutral[50]} />
      <Text style={styles.headerTitle}>Mobdeck</Text>
    </View>
  );
};

const MainNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.primary[500],
        },
        headerTintColor: theme.colors.neutral[50],
        headerTitleStyle: {
          fontWeight: 'bold',
          color: theme.colors.neutral[50],
        },
      }}
    >
      <Stack.Screen
        name='ArticlesList'
        component={ArticlesListScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name='ArticleDetail'
        component={ArticleDetailScreen}
        options={({ route }) => ({
          title: route.params?.title || 'Article',
        })}
      />
      <Stack.Screen
        name='Settings'
        component={SettingsScreen}
        options={{
          title: 'Settings',
        }}
      />
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing[2],
  },
  headerTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.neutral[50],
    marginLeft: theme.spacing[2],
  },
});

export default MainNavigator;
