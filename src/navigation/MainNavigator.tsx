import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { ArticlesListScreen } from '../screens/main/ArticlesListScreen';
import { ArticleDetailScreen } from '../screens/main/ArticleDetailScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { MainStackParamList } from './types';

const Stack = createStackNavigator<MainStackParamList>();

const MainNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#2196F3',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Stack.Screen
        name="ArticlesList"
        component={ArticlesListScreen}
        options={{
          title: 'Articles',
        }}
      />
      <Stack.Screen
        name="ArticleDetail"
        component={ArticleDetailScreen}
        options={({ route }) => ({
          title: route.params?.title || 'Article',
        })}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Settings',
        }}
      />
    </Stack.Navigator>
  );
};

export default MainNavigator;