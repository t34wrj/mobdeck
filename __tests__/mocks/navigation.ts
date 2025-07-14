// Mock for @react-navigation/native
import {
  NavigationProp,
  RouteProp,
  ParamListBase,
  NavigationState,
} from '@react-navigation/native';
import * as React from 'react';

export type MockNavigationProp<T extends ParamListBase = ParamListBase> =
  jest.Mocked<NavigationProp<T>>;

export const createMockNavigation = <
  T extends ParamListBase = ParamListBase,
>(): MockNavigationProp<T> =>
  ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    dispatch: jest.fn(),
    setOptions: jest.fn(),
    isFocused: jest.fn(() => true),
    canGoBack: jest.fn(() => false),
    getId: jest.fn(() => 'mock-screen-id'),
    getParent: jest.fn(),
    getState: jest.fn(
      () =>
        ({
          key: 'mock-state-key',
          index: 0,
          routeNames: ['MockScreen'],
          routes: [
            { key: 'mock-route-key', name: 'MockScreen', params: undefined },
          ],
          type: 'stack',
          stale: false,
          history: [],
        }) as NavigationState
    ),
    addListener: jest.fn(() => jest.fn()),
    removeListener: jest.fn(),
    reset: jest.fn(),
    setParams: jest.fn(),
  }) as unknown as MockNavigationProp<T>;

export type MockRouteProp<
  T extends ParamListBase = ParamListBase,
  K extends keyof T = keyof T,
> = jest.Mocked<RouteProp<T, K>>;

export const createMockRoute = <
  T extends ParamListBase = ParamListBase,
  K extends keyof T = keyof T,
>(
  name: string = 'MockScreen',
  params: T[K] = {} as T[K]
): MockRouteProp<T, K> =>
  ({
    key: `mock-route-${name}`,
    name: name as K,
    params,
  }) as unknown as MockRouteProp<T, K>;

export const mockNavigationHooks = {
  useNavigation: jest.fn(() => createMockNavigation()),
  useRoute: jest.fn(() => createMockRoute()),
  useFocusEffect: jest.fn((callback: () => void | (() => void)) => {
    // Immediately call the callback for testing purposes
    const cleanup = callback();
    // Return cleanup function if provided
    return typeof cleanup === 'function' ? cleanup : undefined;
  }),
  useNavigationState: jest.fn(<T>(selector: (state: NavigationState) => T) =>
    selector({
      key: 'mock-state-key',
      index: 0,
      routeNames: ['MockScreen'],
      routes: [
        { key: 'mock-route-key', name: 'MockScreen', params: undefined },
      ],
      type: 'stack',
      stale: false,
      history: [],
    } as NavigationState)
  ),
  useIsFocused: jest.fn(() => true),
};

export const mockNavigationComponents = {
  NavigationContainer: ({ children }: { children: React.ReactNode }) =>
    children as React.ReactElement,
  createStackNavigator: jest.fn(() => ({
    Navigator: ({ children }: { children: React.ReactNode }) =>
      children as React.ReactElement,
    Screen: ({ children }: { children: React.ReactNode }) =>
      children as React.ReactElement,
  })),
  createBottomTabNavigator: jest.fn(() => ({
    Navigator: ({ children }: { children: React.ReactNode }) =>
      children as React.ReactElement,
    Screen: ({ children }: { children: React.ReactNode }) =>
      children as React.ReactElement,
  })),
};
