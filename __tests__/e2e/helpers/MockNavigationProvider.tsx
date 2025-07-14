/**
 * Mock Navigation Provider
 * Provides navigation context for E2E testing of screen components
 */

import React from 'react';

// Mock navigation functions
export const mockNavigate = jest.fn();
export const mockGoBack = jest.fn();
export const mockReset = jest.fn();
export const mockSetOptions = jest.fn();
export const mockDispatch = jest.fn();
export const mockIsFocused = jest.fn(() => true);
export const mockAddListener = jest.fn();
export const mockRemoveListener = jest.fn();

// Mock navigation object
export const mockNavigation = {
  navigate: mockNavigate,
  goBack: mockGoBack,
  reset: mockReset,
  setOptions: mockSetOptions,
  dispatch: mockDispatch,
  isFocused: mockIsFocused,
  addListener: mockAddListener,
  removeListener: mockRemoveListener,
  getState: jest.fn(() => ({
    routes: [],
    index: 0,
    key: 'test-state',
  })),
  getId: jest.fn(() => 'test-id'),
  getParent: jest.fn(),
  push: jest.fn(),
  pop: jest.fn(),
  popToTop: jest.fn(),
  replace: jest.fn(),
  canGoBack: jest.fn(() => false),
};

// Mock route object factory
export const createMockRoute = (
  params: any = {},
  name: string = 'TestScreen'
) => ({
  key: `${name}-test-key`,
  name,
  params,
});

interface MockNavigationProviderProps {
  children: React.ReactNode;
  initialRouteName?: string;
  initialParams?: Record<string, any>;
}

/**
 * Provides a mock navigation context for testing screen components
 */
export const MockNavigationProvider: React.FC<MockNavigationProviderProps> = ({
  children,
}) => {
  // Simple wrapper that just returns children for testing
  return React.createElement(React.Fragment, {}, children);
};

/**
 * Resets all mock navigation functions
 */
export const resetNavigationMocks = () => {
  mockNavigate.mockClear();
  mockGoBack.mockClear();
  mockReset.mockClear();
  mockSetOptions.mockClear();
  mockDispatch.mockClear();
  mockIsFocused.mockClear();
  mockAddListener.mockClear();
  mockRemoveListener.mockClear();
};

/**
 * Mock navigation hook that returns the mock navigation object
 */
export const useMockNavigation = () => mockNavigation;

/**
 * Mock route hook that returns a test route
 */
export const useMockRoute = (params: any = {}, name: string = 'TestScreen') =>
  createMockRoute(params, name);

/**
 * Higher-order component that wraps a screen component with mock navigation
 */
export const withMockNavigation = <P extends object>(
  Component: React.ComponentType<P>
) => {
  return (props: P) => (
    <MockNavigationProvider>
      <Component {...props} />
    </MockNavigationProvider>
  );
};

/**
 * Creates a mock navigation context for testing navigation behavior
 */
export const createMockNavigationContext = (
  overrides: Partial<typeof mockNavigation> = {}
) => ({
  ...mockNavigation,
  ...overrides,
});

export default MockNavigationProvider;
