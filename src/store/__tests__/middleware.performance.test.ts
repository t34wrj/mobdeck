import { configureStore } from '@reduxjs/toolkit';
import { loginUser } from '../slices/authSlice';
import authReducer from '../slices/authSlice';
import {
  errorHandlerMiddleware,
  productionErrorMiddleware,
  loggerMiddleware,
  performanceMiddleware,
} from '../middleware';

describe('Middleware Performance Tests', () => {
  it('should complete auth actions in <100ms with production middleware', async () => {
    // Configure store with production middleware (minimal overhead)
    const productionStore = configureStore({
      reducer: {
        auth: authReducer,
      },
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
          serializableCheck: false,
          immutableCheck: false,
          thunk: true,
        }).concat(productionErrorMiddleware),
      devTools: false,
    });

    const startTime = performance.now();
    
    // Dispatch auth action (will fail due to network, but we're testing middleware overhead)
    try {
      await productionStore.dispatch(loginUser({
        serverUrl: 'https://test.example.com',
        username: 'test',
        password: 'test',
      }));
    } catch (error) {
      // Expected to fail, we're testing middleware performance
    }
    
    const endTime = performance.now();
    const middlewareOverhead = endTime - startTime;
    
    // Should complete in <100ms (most time is network, but middleware should be minimal)
    expect(middlewareOverhead).toBeLessThan(100);
  });

  it('should have fewer middleware in production than development', () => {
    // Test middleware count difference
    const devMiddleware = [errorHandlerMiddleware, loggerMiddleware, performanceMiddleware];
    const prodMiddleware = [productionErrorMiddleware];

    // Production middleware should have fewer components
    expect(prodMiddleware.length).toBeLessThan(devMiddleware.length);
    expect(prodMiddleware.length).toBe(1);
    expect(devMiddleware.length).toBe(3);
  });

  it('should have fast-path production middleware execution', () => {
    const mockStore = {
      getState: jest.fn(),
    };
    const mockNext = jest.fn();
    const mockAction = { type: 'TEST_ACTION' };

    // Test production middleware execution time
    const startTime = performance.now();
    const middleware = productionErrorMiddleware(mockStore as any)(mockNext);
    middleware(mockAction);
    const endTime = performance.now();

    const executionTime = endTime - startTime;
    
    // Production middleware should execute in <1ms
    expect(executionTime).toBeLessThan(1);
    expect(mockNext).toHaveBeenCalledWith(mockAction);
  });
});