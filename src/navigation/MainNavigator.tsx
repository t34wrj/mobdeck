import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { ArticlesListScreen } from '../screens/main/ArticlesListScreen';
import { ArticleDetailScreen } from '../screens/main/ArticleDetailScreen';
import { SettingsScreen } from '../screens/main/SettingsScreen';
import { MainStackParamList } from './types';
import { theme } from "../components/theme";

const Stack = createStackNavigator<MainStackParamList>();

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

export default MainNavigator;
