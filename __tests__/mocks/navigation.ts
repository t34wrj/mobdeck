// Mock for @react-navigation/native
import { NavigationProp, RouteProp } from '@react-navigation/native';

export type MockNavigationProp = {
  navigate: jest.MockedFunction<NavigationProp<any>['navigate']>;
  goBack: jest.MockedFunction<NavigationProp<any>['goBack']>;
  dispatch: jest.MockedFunction<NavigationProp<any>['dispatch']>;
  setOptions: jest.MockedFunction<NavigationProp<any>['setOptions']>;
  isFocused: jest.MockedFunction<NavigationProp<any>['isFocused']>;
  canGoBack: jest.MockedFunction<NavigationProp<any>['canGoBack']>;
  getId: jest.MockedFunction<NavigationProp<any>['getId']>;
  getParent: jest.MockedFunction<NavigationProp<any>['getParent']>;
  getState: jest.MockedFunction<NavigationProp<any>['getState']>;
  addListener: jest.MockedFunction<NavigationProp<any>['addListener']>;
  removeListener: jest.MockedFunction<NavigationProp<any>['removeListener']>;
  reset: jest.MockedFunction<NavigationProp<any>['reset']>;
  setParams: jest.MockedFunction<NavigationProp<any>['setParams']>;
  push: jest.MockedFunction<any>;
  pop: jest.MockedFunction<any>;
  popToTop: jest.MockedFunction<any>;
  replace: jest.MockedFunction<any>;
};

export const createMockNavigation = (): MockNavigationProp => ({
  navigate: jest.fn(),
  goBack: jest.fn(),
  dispatch: jest.fn(),
  setOptions: jest.fn(),
  isFocused: jest.fn(() => true),
  canGoBack: jest.fn(() => false),
  getId: jest.fn(() => 'mock-screen-id'),
  getParent: jest.fn(() => undefined),
  getState: jest.fn(() => ({
    key: 'mock-state-key',
    index: 0,
    routeNames: ['MockScreen'],
    routes: [{ key: 'mock-route-key', name: 'MockScreen' }],
    type: 'stack',
    stale: false,
  })),
  addListener: jest.fn(() => jest.fn()),
  removeListener: jest.fn(),
  reset: jest.fn(),
  setParams: jest.fn(),
  push: jest.fn(),
  pop: jest.fn(),
  popToTop: jest.fn(),
  replace: jest.fn(),
});

export type MockRouteProp = {
  key: string;
  name: string;
  params?: any;
  path?: string;
};

export const createMockRoute = (name: string = 'MockScreen', params: any = {}): MockRouteProp => ({
  key: `mock-route-${name}`,
  name,
  params,
});

export const mockNavigationHooks = {
  useNavigation: jest.fn(() => createMockNavigation()),
  useRoute: jest.fn(() => createMockRoute()),
  useFocusEffect: jest.fn((callback: () => void) => {
    // Immediately call the callback for testing purposes
    callback();
  }),
  useNavigationState: jest.fn((selector: (state: any) => any) => 
    selector({
      key: 'mock-state-key',
      index: 0,
      routeNames: ['MockScreen'],
      routes: [{ key: 'mock-route-key', name: 'MockScreen' }],
      type: 'stack',
      stale: false,
    })
  ),
  useIsFocused: jest.fn(() => true),
};

export const mockNavigationComponents = {
  NavigationContainer: ({ children }: { children: React.ReactNode }) => children,
  createStackNavigator: jest.fn(() => ({
    Navigator: ({ children }: { children: React.ReactNode }) => children,
    Screen: ({ children }: { children: React.ReactNode }) => children,
  })),
  createBottomTabNavigator: jest.fn(() => ({
    Navigator: ({ children }: { children: React.ReactNode }) => children,
    Screen: ({ children }: { children: React.ReactNode }) => children,
  })),
};