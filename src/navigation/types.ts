import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';

export type AuthStackParamList = {
  Login: undefined;
  Setup: undefined;
};

export type MainStackParamList = {
  ArticlesList: undefined;
  ArticleDetail: {
    articleId: string;
    title?: string;
  };
  Settings: undefined;
};

export type AuthNavigationProp<
  T extends keyof AuthStackParamList = keyof AuthStackParamList,
> = StackNavigationProp<AuthStackParamList, T>;

export type MainNavigationProp<
  T extends keyof MainStackParamList = keyof MainStackParamList,
> = StackNavigationProp<MainStackParamList, T>;

export type AuthRouteProp<
  T extends keyof AuthStackParamList = keyof AuthStackParamList,
> = RouteProp<AuthStackParamList, T>;

export type MainRouteProp<
  T extends keyof MainStackParamList = keyof MainStackParamList,
> = RouteProp<MainStackParamList, T>;

export interface AuthScreenProps<
  T extends keyof AuthStackParamList = keyof AuthStackParamList,
> {
  navigation: AuthNavigationProp<T>;
  route: AuthRouteProp<T>;
}

export interface MainScreenProps<
  T extends keyof MainStackParamList = keyof MainStackParamList,
> {
  navigation: MainNavigationProp<T>;
  route: MainRouteProp<T>;
}

declare global {
  namespace ReactNavigation {
    interface RootParamList extends AuthStackParamList, MainStackParamList {}
  }
}
