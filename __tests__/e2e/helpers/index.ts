/**
 * E2E Test Helpers
 * Centralized exports for all E2E testing utilities
 */

import { ArticleTestDataFactory } from './ArticleTestDataFactory';
export { ArticleTestDataFactory };
export type { ArticleTestDataOptions } from './ArticleTestDataFactory';

import { resetNavigationMocks } from './MockNavigationProvider';
export { 
  MockNavigationProvider, 
  mockNavigation,
  mockNavigate,
  mockGoBack,
  mockReset,
  mockSetOptions,
  mockDispatch,
  resetNavigationMocks,
  useMockNavigation,
  useMockRoute,
  withMockNavigation,
  createMockNavigationContext,
  createMockRoute,
} from './MockNavigationProvider';

import { ShareIntentSimulator } from './ShareIntentSimulator';
import { SyncTestHelper } from './SyncTestHelper';
export { ShareIntentSimulator };
export type { ShareIntentSimulationOptions } from './ShareIntentSimulator';
export { SyncTestHelper };
export type { SyncTestScenario, MockSyncServiceOptions } from './SyncTestHelper';

export interface E2ETestEnvironmentSetup {
  mockShareModule: ReturnType<typeof ShareIntentSimulator.createMockShareModule>;
  mockSyncService: ReturnType<typeof SyncTestHelper.createMockSyncService>;
  mockSyncActions: ReturnType<typeof SyncTestHelper.createMockSyncActions>;
}

/**
 * Comprehensive E2E test setup utility
 * Sets up all necessary mocks and test environment for article management E2E tests
 */
export const setupE2ETestEnvironment = (): E2ETestEnvironmentSetup => {
  // Reset all test helpers
  ArticleTestDataFactory.resetCounter();
  ShareIntentSimulator.reset();
  SyncTestHelper.reset();
  resetNavigationMocks();
  
  // Setup common mocks
  const mockShareModule = ShareIntentSimulator.createMockShareModule();
  const mockSyncService = SyncTestHelper.createMockSyncService();
  const mockSyncActions = SyncTestHelper.createMockSyncActions();
  
  return {
    mockShareModule,
    mockSyncService,
    mockSyncActions,
  };
};

/**
 * Cleanup utility for E2E tests
 */
export const cleanupE2ETestEnvironment = (): void => {
  ArticleTestDataFactory.resetCounter();
  ShareIntentSimulator.reset();
  SyncTestHelper.reset();
  resetNavigationMocks();
  
  // Clear all mock call history
  jest.clearAllMocks();
};

export interface CommonE2EScenarios {
  shareScenarios: ReturnType<typeof ShareIntentSimulator.getCommonShareScenarios>;
  syncScenarios: ReturnType<typeof SyncTestHelper.createSyncScenarios>;
  conflictScenarios: ReturnType<typeof SyncTestHelper.createConflictScenarios>;
  articleStates: ReturnType<typeof ArticleTestDataFactory.createArticleWithStates>;
}

/**
 * Common test scenarios for E2E article management testing
 */
export const getCommonE2EScenarios = (): CommonE2EScenarios => ({
  shareScenarios: ShareIntentSimulator.getCommonShareScenarios(),
  syncScenarios: SyncTestHelper.createSyncScenarios(),
  conflictScenarios: SyncTestHelper.createConflictScenarios(),
  articleStates: ArticleTestDataFactory.createArticleWithStates(),
});

/**
 * Waits for async operations to complete in tests
 */
export const waitForAsyncOperations = async (timeout: number = 5000): Promise<void> => {
  await new Promise<void>(resolve => setTimeout(resolve, 100));
  
  // Wait for any pending promises to resolve
  await new Promise<void>(resolve => setImmediate(resolve));
};

/**
 * Creates a test timeout wrapper for long-running E2E operations
 */
export const withTimeout = <T>(
  operation: () => Promise<T>,
  timeout: number = 10000,
  timeoutMessage: string = 'Operation timed out'
): Promise<T> => {
  return Promise.race([
    operation(),
    new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error(timeoutMessage)), timeout)
    ),
  ]);
};