import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import LoginScreen from '../screens/auth/LoginScreen';
import SetupScreen from '../screens/auth/SetupScreen';
import { AuthStackParamList } from './types';

const Stack = createStackNavigator<AuthStackParamList>();

const AuthNavigator: React.FC = () => {
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
        name="Login"
        component={LoginScreen}
        options={{
          title: 'Login to Readeck',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Setup"
        component={SetupScreen}
        options={{
          title: 'Setup',
        }}
      />
    </Stack.Navigator>
  );
};

export default AuthNavigator;