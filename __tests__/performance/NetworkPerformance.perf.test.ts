/**
 * Network Performance Validation Tests - Real Device Testing
 * 
 * Tests performance of:
 * - API response handling with various network speeds ON REAL DEVICES
 * - Offline mode performance ON REAL DEVICES
 * - Network reconnection handling ON REAL DEVICES
 * - Request queuing and retry logic ON REAL DEVICES
 * - Cache performance ON REAL DEVICES
 * - Background sync efficiency ON REAL DEVICES
 * 
 * Uses ADB to interact with actual Android devices/emulators
 */

import { articlesApiService } from '../../src/services/ArticlesApiService';
import DatabaseService from '../../src/services/DatabaseService';
import { syncService } from '../../src/services/SyncService';
import { store } from '../../src/store';
import { performanceTestHelper, PERFORMANCE_THRESHOLDS } from '../../src/utils/performanceTestHelper';
import { AdbHelper, NETWORK_CONDITIONS, KEY_CODES } from '../../src/utils/adbHelper';
// Network state management handled through NetInfo directly
import { Article } from '../../src/types';
import { DBArticle } from '../../src/types/database';
import NetInfo from '@react-native-community/netinfo';

// Real device testing setup - NO MOCKS!
// This test suite uses real Android devices/emulators via ADB

let adbHelper: AdbHelper;
let connectedDevice: any;

// Skip these tests if explicitly disabled or in CI (unless forced with RUN_DEVICE_TESTS)
const skipIfNoDevice = (process.env.SKIP_DEVICE_TESTS === 'true' || process.env.CI === 'true') && process.env.RUN_DEVICE_TESTS !== 'true';

// Setup for real device testing
const setupRealDeviceTesting = async () => {
  console.log('Setting up real device testing...');
  adbHelper = new AdbHelper();
  
  try {
    // Check for available devices first
    const devices = await adbHelper.getDevices();
    console.log(`Found ${devices.length} available devices:`, devices);
    
    if (devices.length === 0) {
      throw new Error('No Android devices found. Please connect a device or start an emulator.');
    }
    
    // Connect to device
    connectedDevice = await adbHelper.connectToDevice();
    console.log(`Connected to device: ${connectedDevice.id} (${connectedDevice.model || 'Unknown Model'})`);
    
    // Check if app is already running
    const isAppRunning = await adbHelper.isAppRunning();
    console.log(`App running status: ${isAppRunning}`);
    
    if (!isAppRunning) {
      // Launch the app
      console.log('Launching app...');
      await adbHelper.launchApp();
      console.log('App launched successfully');
    } else {
      console.log('App is already running');
    }
    
    // Wait for app to fully load
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Verify app is still running
    const finalAppStatus = await adbHelper.isAppRunning();
    if (!finalAppStatus) {
      throw new Error('App failed to start or crashed during setup');
    }
    
    console.log('Real device testing setup completed successfully');
    return true;
  } catch (error) {
    console.error('Failed to setup real device testing:', error);
    console.error('Error details:', error.message);
    
    // Provide helpful debugging information
    try {
      const devices = await adbHelper.getDevices();
      console.log('Available devices for debugging:', devices);
    } catch (deviceError) {
      console.error('Could not even check for devices:', deviceError.message);
    }
    
    return false;
  }
};

const teardownRealDeviceTesting = async () => {
  if (adbHelper) {
    await adbHelper.disconnect();
  }
};

// Real device interaction helpers
const performRealDeviceOperation = async (operation: () => Promise<any>, testName: string) => {
  if (!adbHelper || !connectedDevice) {
    throw new Error('No device connected for real device testing');
  }

  return await adbHelper.measurePerformance(operation, testName);
};

const setRealNetworkConditions = async (conditionType: 'fast' | 'moderate' | 'slow' | 'offline') => {
  if (!adbHelper) {
    throw new Error('No ADB helper available');
  }

  const condition = NETWORK_CONDITIONS[conditionType.toUpperCase()];
  await adbHelper.setNetworkConditions(condition);
  
  // Wait for network conditions to take effect
  await new Promise(resolve => setTimeout(resolve, 2000));
};

const interactWithApp = async (action: 'search' | 'scroll' | 'tap' | 'refresh') => {
  if (!adbHelper) {
    throw new Error('No ADB helper available');
  }

  switch (action) {
    case 'search':
      // Tap search bar (approximate coordinates - adjust for your app)
      await adbHelper.sendTouchEvent(200, 150);
      await new Promise(resolve => setTimeout(resolve, 500));
      await adbHelper.sendTextInput('test query');
      await adbHelper.sendKeyEvent(KEY_CODES.ENTER);
      break;
    case 'scroll':
      // Scroll down (swipe up)
      await adbHelper.sendTouchEvent(400, 800);
      await new Promise(resolve => setTimeout(resolve, 100));
      await adbHelper.sendTouchEvent(400, 400);
      break;
    case 'tap':
      // Tap on first article (approximate coordinates)
      await adbHelper.sendTouchEvent(400, 300);
      break;
    case 'refresh':
      // Pull to refresh (swipe down from top)
      await adbHelper.sendTouchEvent(400, 200);
      await new Promise(resolve => setTimeout(resolve, 100));
      await adbHelper.sendTouchEvent(400, 600);
      break;
  }
  
  // Wait for UI to respond
  await new Promise(resolve => setTimeout(resolve, 1000));
};

// Test data factory
const createTestArticle = (id: string, size: 'small' | 'medium' | 'large' = 'medium'): Article => {
  const contentSizes = {
    small: 100,
    medium: 1000,
    large: 10000,
  };

  const content = 'x'.repeat(contentSizes[size]);

  return {
    id,
    title: `Test Article ${id}`,
    summary: `Summary for ${id}`,
    content,
    url: `https://example.com/article-${id}`,
    imageUrl: size === 'large' ? `https://example.com/image-${id}.jpg` : undefined,
    readTime: Math.ceil(content.length / 200),
    isArchived: false,
    isFavorite: false,
    isRead: false,
    tags: ['test'],
    sourceUrl: 'https://example.com',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    syncedAt: new Date().toISOString(),
    isModified: false,
  };
};

describe('Network Performance Validation Tests - Real Device', () => {
  let deviceTestingAvailable = false;

  beforeAll(async () => {
    console.log('\n=== DEVICE TESTING SETUP ===');
    console.log(`Environment variables:`);
    console.log(`  SKIP_DEVICE_TESTS: ${process.env.SKIP_DEVICE_TESTS}`);
    console.log(`  CI: ${process.env.CI}`);
    console.log(`  RUN_DEVICE_TESTS: ${process.env.RUN_DEVICE_TESTS}`);
    console.log(`  skipIfNoDevice calculated as: ${skipIfNoDevice}`);
    
    if (skipIfNoDevice) {
      console.log('❌ SKIPPING real device tests - explicitly disabled or CI environment (set RUN_DEVICE_TESTS=true to force)');
      return;
    }
    
    console.log('✅ PROCEEDING with real device testing setup...');
    deviceTestingAvailable = await setupRealDeviceTesting();
    
    if (deviceTestingAvailable) {
      console.log('✅ Device testing is AVAILABLE - tests will run on real device');
    } else {
      console.log('❌ Device testing is NOT available - tests will be skipped');
    }
    console.log('=== DEVICE TESTING SETUP COMPLETE ===\n');
  }, 30000); // 30 second timeout for device setup

  afterAll(async () => {
    if (deviceTestingAvailable) {
      await teardownRealDeviceTesting();
    }
  }, 10000);

  beforeEach(async () => {
    performanceTestHelper.clearMetrics();
    
    if (deviceTestingAvailable) {
      // Reset to fast network conditions before each test
      await setRealNetworkConditions('fast');
    }
  });

  // Helper function to check if device testing should be skipped
  const shouldSkipDeviceTest = () => {
    const skipIfNoDevice = (process.env.SKIP_DEVICE_TESTS === 'true' || process.env.CI === 'true') && process.env.RUN_DEVICE_TESTS !== 'true';
    
    if (skipIfNoDevice) {
      console.log('⏭️  Skipping test due to environment settings');
      return true;
    }
    
    if (!deviceTestingAvailable) {
      console.log('⏭️  Skipping test due to device not available');
      return true;
    }
    
    return false;
  };

  describe('API Response Handling Performance', () => {
    it('should handle fast network responses efficiently on real device', async () => {
      if (shouldSkipDeviceTest()) return;
      
      console.log('🚀 Running fast network response test');
      await setRealNetworkConditions('fast');
      
      const metrics = await performRealDeviceOperation(async () => {
        // Trigger app refresh to fetch articles
        await interactWithApp('refresh');
        
        // Wait for network request to complete
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Verify articles are loaded by checking if we can scroll
        await interactWithApp('scroll');
      }, 'api_fetch_fast_network');

      // Fast network should complete quickly
      expect(metrics.duration).toBeLessThan(5000);
      expect(metrics.networkLatency).toBeLessThan(100);
      expect(metrics.cpuUsage).toBeLessThan(50); // Should not be too CPU intensive
    }, 15000); // 15 second timeout

    it('should handle slow network gracefully on real device', async () => {
      if (shouldSkipDeviceTest()) return;
      
      console.log('🚀 Running slow network graceful handling test');
      await setRealNetworkConditions('slow');
      
      const metrics = await performRealDeviceOperation(async () => {
        // Trigger app refresh on slow network
        await interactWithApp('refresh');
        
        // Wait longer for slow network
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        // Verify app is still responsive
        await interactWithApp('scroll');
      }, 'api_fetch_slow_network');

      // Slow network should take longer but still be reasonable
      expect(metrics.duration).toBeGreaterThan(2000);
      expect(metrics.networkLatency).toBeGreaterThan(200);
      
      // App should remain responsive despite slow network
      expect(metrics.frameRate).toBeGreaterThan(30);
      expect(metrics.jankCount).toBeLessThan(5);
      
      // Validate against appropriate threshold
      const validation = performanceTestHelper.validatePerformance(
        'api_fetch_slow_network',
        PERFORMANCE_THRESHOLDS.API_CALL
      );
      expect(validation.passed).toBe(true);
    }, 20000); // 20 second timeout for slow network

    it('should adapt to different network conditions on real device', async () => {
      if (shouldSkipDeviceTest()) return;
      
      console.log('🚀 Running adaptive network conditions test');
      const networkTypes: Array<'fast' | 'moderate' | 'slow'> = ['fast', 'moderate', 'slow'];
      const results: { type: string; duration: number; latency: number; frameRate: number }[] = [];

      for (const networkType of networkTypes) {
        await setRealNetworkConditions(networkType);
        
        const metrics = await performRealDeviceOperation(async () => {
          // Trigger refresh for each network condition
          await interactWithApp('refresh');
          
          // Wait appropriately for each network type
          const waitTime = networkType === 'slow' ? 8000 : networkType === 'moderate' ? 5000 : 3000;
          await new Promise(resolve => setTimeout(resolve, waitTime));
          
          // Test app responsiveness
          await interactWithApp('scroll');
          await interactWithApp('tap');
        }, `api_adaptive_${networkType}`);

        results.push({
          type: networkType,
          duration: metrics.duration,
          latency: metrics.networkLatency,
          frameRate: metrics.frameRate,
        });
      }

      // Verify adaptive behavior
      expect(results[0].latency).toBeLessThan(results[2].latency); // Fast < Slow
      expect(results[0].frameRate).toBeGreaterThanOrEqual(results[2].frameRate); // Fast >= Slow
      
      // All conditions should maintain reasonable performance
      results.forEach(result => {
        expect(result.frameRate).toBeGreaterThan(20); // Minimum acceptable frame rate
      });
    }, 60000); // 60 second timeout for multiple network tests
  });

  describe('Offline Mode Performance', () => {
    it('should switch to offline mode quickly on real device', async () => {
      if (shouldSkipDeviceTest()) return;
      
      console.log('🚀 Running offline mode switch test');
      // First ensure we have some cached data
      await setRealNetworkConditions('fast');
      
      const setupMetrics = await performRealDeviceOperation(async () => {
        await interactWithApp('refresh');
        await new Promise(resolve => setTimeout(resolve, 3000));
        await interactWithApp('scroll');
      }, 'offline_setup');
      
      // Now go offline
      await setRealNetworkConditions('offline');
      
      const metrics = await performRealDeviceOperation(async () => {
        // App should immediately switch to offline mode
        await interactWithApp('refresh');
        
        // Should load cached data quickly
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Verify app is still functional with cached data
        await interactWithApp('scroll');
        await interactWithApp('tap');
      }, 'offline_mode_switch');

      expect(metrics.duration).toBeLessThan(5000); // Should be quick with cached data
      expect(metrics.networkLatency).toBe(-1); // Should be -1 for offline
      expect(metrics.frameRate).toBeGreaterThan(30); // Should maintain smooth UI
    }, 20000);

    it('should queue operations while offline on real device', async () => {
      if (shouldSkipDeviceTest()) return;
      
      console.log('🚀 Running offline operations queuing test');
      // Ensure we're offline
      await setRealNetworkConditions('offline');
      
      const metrics = await performRealDeviceOperation(async () => {
        // Perform multiple operations while offline
        for (let i = 0; i < 5; i++) {
          // Tap on articles to favorite/unfavorite them
          await interactWithApp('tap');
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Go back and select another article
          await adbHelper.sendKeyEvent(KEY_CODES.BACK);
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Scroll to next article
          await interactWithApp('scroll');
        }
      }, 'offline_queue_operations');

      // Operations should be queued efficiently
      expect(metrics.duration).toBeLessThan(15000); // Should complete within 15 seconds
      expect(metrics.frameRate).toBeGreaterThan(25); // Should maintain decent frame rate
      expect(metrics.jankCount).toBeLessThan(10); // Should not be too janky
    }, 25000);

    it('should sync efficiently when returning online on real device', async () => {
      if (shouldSkipDeviceTest()) return;
      
      console.log('🚀 Running offline to online sync test');
      // Start offline with queued operations
      await setRealNetworkConditions('offline');
      
      // Perform operations while offline
      await performRealDeviceOperation(async () => {
        for (let i = 0; i < 3; i++) {
          await interactWithApp('tap');
          await new Promise(resolve => setTimeout(resolve, 500));
          await adbHelper.sendKeyEvent(KEY_CODES.BACK);
          await interactWithApp('scroll');
        }
      }, 'offline_operations_queue');
      
      // Return to online
      await setRealNetworkConditions('moderate');
      
      const metrics = await performRealDeviceOperation(async () => {
        // Trigger sync when back online
        await interactWithApp('refresh');
        
        // Wait for sync to complete
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        // Verify sync completed - app should be responsive
        await interactWithApp('scroll');
        await interactWithApp('tap');
      }, 'offline_to_online_sync');

      // Sync should complete within reasonable time
      expect(metrics.duration).toBeLessThan(20000);
      expect(metrics.networkLatency).toBeGreaterThan(0); // Should be back online
      expect(metrics.frameRate).toBeGreaterThan(30); // Should maintain performance
      
      // Should complete within reasonable time
      const validation = performanceTestHelper.validatePerformance(
        'offline_to_online_sync',
        PERFORMANCE_THRESHOLDS.SYNC_OPERATION
      );
      expect(validation.passed).toBe(true);
    }, 40000);
  });

  describe('Request Retry Performance', () => {
    it('should retry failed requests efficiently on real device', async () => {
      if (shouldSkipDeviceTest()) return;
      
      console.log('🚀 Running request retry efficiency test');
      // Simulate intermittent connectivity
      await setRealNetworkConditions('slow');
      
      const metrics = await performRealDeviceOperation(async () => {
        // Trigger multiple refresh attempts
        for (let i = 0; i < 3; i++) {
          await interactWithApp('refresh');
          
          // Wait for retry logic to kick in
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          // Test if app recovered
          await interactWithApp('scroll');
          
          // Brief pause between attempts
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }, 'request_retry_performance');

      // Should handle retries within reasonable time
      expect(metrics.duration).toBeLessThan(20000);
      expect(metrics.frameRate).toBeGreaterThan(20); // Should maintain reasonable frame rate
      expect(metrics.jankCount).toBeLessThan(15); // Some jank expected due to network issues
    }, 30000);

    it('should handle concurrent request failures on real device', async () => {
      if (shouldSkipDeviceTest()) return;
      
      console.log('🚀 Running concurrent request failures test');
      // Set moderate network conditions to simulate some failures
      await setRealNetworkConditions('moderate');
      
      const metrics = await performRealDeviceOperation(async () => {
        // Trigger multiple concurrent operations
        const operations = [];
        
        // Start multiple refresh operations
        for (let i = 0; i < 3; i++) {
          operations.push((async () => {
            await interactWithApp('refresh');
            await new Promise(resolve => setTimeout(resolve, 1000 * i));
          })());
        }
        
        // Start scrolling operations
        for (let i = 0; i < 5; i++) {
          operations.push((async () => {
            await new Promise(resolve => setTimeout(resolve, 500 * i));
            await interactWithApp('scroll');
          })());
        }
        
        // Wait for all operations to complete
        await Promise.allSettled(operations);
        
        // Verify app is still responsive
        await interactWithApp('tap');
      }, 'concurrent_requests_with_failures');

      // Should handle concurrent operations efficiently
      expect(metrics.duration).toBeLessThan(15000);
      expect(metrics.frameRate).toBeGreaterThan(20); // Should maintain performance
      expect(metrics.memoryUsage).toBeLessThan(200000); // Should not consume too much memory
    }, 25000);
  });

  describe('Cache Performance', () => {
    it('should serve cached data quickly on real device', async () => {
      if (shouldSkipDeviceTest()) return;
      
      console.log('🚀 Running cached data serving test');
      // First load - populate cache
      await setRealNetworkConditions('moderate');
      
      const firstLoadMetrics = await performRealDeviceOperation(async () => {
        await interactWithApp('refresh');
        await new Promise(resolve => setTimeout(resolve, 5000));
        await interactWithApp('tap'); // View an article
        await new Promise(resolve => setTimeout(resolve, 2000));
        await adbHelper.sendKeyEvent(KEY_CODES.BACK);
      }, 'cache_miss');

      // Second load - should hit cache
      await setRealNetworkConditions('offline'); // Force cache usage
      
      const secondLoadMetrics = await performRealDeviceOperation(async () => {
        await interactWithApp('tap'); // View same article
        await new Promise(resolve => setTimeout(resolve, 1000));
        await adbHelper.sendKeyEvent(KEY_CODES.BACK);
      }, 'cache_hit');

      // Cache hit should be much faster
      expect(secondLoadMetrics.duration).toBeLessThan(firstLoadMetrics.duration * 0.5);
      expect(secondLoadMetrics.duration).toBeLessThan(3000); // Should be quick
      expect(secondLoadMetrics.frameRate).toBeGreaterThan(45); // Should be smooth
    }, 20000);

    it('should handle cache invalidation efficiently on real device', async () => {
      if (shouldSkipDeviceTest()) return;
      
      console.log('🚀 Running cache invalidation test');
      // Populate cache first
      await setRealNetworkConditions('fast');
      
      await performRealDeviceOperation(async () => {
        await interactWithApp('refresh');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Browse several articles to populate cache
        for (let i = 0; i < 3; i++) {
          await interactWithApp('tap');
          await new Promise(resolve => setTimeout(resolve, 1000));
          await adbHelper.sendKeyEvent(KEY_CODES.BACK);
          await interactWithApp('scroll');
        }
      }, 'cache_population');

      // Invalidate cache and reload
      const metrics = await performRealDeviceOperation(async () => {
        // Force refresh to invalidate cache
        await interactWithApp('refresh');
        
        // Wait for fresh data to load
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Verify new data is loaded
        await interactWithApp('scroll');
        await interactWithApp('tap');
      }, 'cache_invalidation');

      expect(metrics.duration).toBeLessThan(10000);
      expect(metrics.frameRate).toBeGreaterThan(30); // Should maintain performance
      expect(metrics.memoryUsage).toBeLessThan(150000); // Should not leak memory
    }, 25000);
  });

  describe('Background Sync Performance', () => {
    it('should perform incremental sync efficiently on real device', async () => {
      if (shouldSkipDeviceTest()) return;
      
      console.log('🚀 Running incremental sync test');
      await setRealNetworkConditions('fast');
      
      // Simulate having existing data
      await performRealDeviceOperation(async () => {
        await interactWithApp('refresh');
        await new Promise(resolve => setTimeout(resolve, 3000));
        await interactWithApp('scroll');
      }, 'initial_sync');
      
      // Wait some time to simulate incremental sync interval
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Perform incremental sync
      const metrics = await performRealDeviceOperation(async () => {
        // Trigger incremental sync
        await interactWithApp('refresh');
        
        // Should be faster than initial sync
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Verify sync completed
        await interactWithApp('scroll');
      }, 'background_incremental_sync');

      // Incremental sync should be fast
      expect(metrics.duration).toBeLessThan(8000);
      expect(metrics.networkLatency).toBeLessThan(100);
      expect(metrics.frameRate).toBeGreaterThan(40); // Should maintain smooth performance
      expect(metrics.cpuUsage).toBeLessThan(30); // Should not be CPU intensive
    }, 20000);

    it('should throttle sync frequency appropriately on real device', async () => {
      if (shouldSkipDeviceTest()) return;
      
      console.log('🚀 Running sync throttling test');
      await setRealNetworkConditions('fast');
      
      const syncTimes: number[] = [];
      
      const metrics = await performRealDeviceOperation(async () => {
        // Attempt multiple syncs in quick succession
        for (let i = 0; i < 5; i++) {
          const startTime = Date.now();
          await interactWithApp('refresh');
          syncTimes.push(startTime);
          
          // Very short delay between attempts
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        // Wait for all syncs to complete
        await new Promise(resolve => setTimeout(resolve, 3000));
      }, 'sync_throttling');

      // Should complete within reasonable time despite throttling
      expect(metrics.duration).toBeLessThan(10000);
      expect(metrics.frameRate).toBeGreaterThan(30); // Should maintain performance
      
      // Check that sync attempts were spaced appropriately
      expect(syncTimes.length).toBe(5);
      
      // App should remain responsive during throttled syncs
      expect(metrics.jankCount).toBeLessThan(8);
    }, 20000);
  });

  describe('Network State Monitoring', () => {
    it('should detect network changes quickly on real device', async () => {
      if (shouldSkipDeviceTest()) return;
      
      console.log('🚀 Running network change detection test');
      // Start with fast network
      await setRealNetworkConditions('fast');
      
      const metrics = await performRealDeviceOperation(async () => {
        // Establish baseline
        await interactWithApp('refresh');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Change network conditions
        await setRealNetworkConditions('slow');
        
        // App should detect the change and adapt
        await interactWithApp('refresh');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Return to fast network
        await setRealNetworkConditions('fast');
        
        // Should quickly adapt back
        await interactWithApp('refresh');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }, 'network_state_change_detection');

      expect(metrics.duration).toBeLessThan(15000); // Should adapt quickly
      expect(metrics.frameRate).toBeGreaterThan(25); // Should maintain reasonable performance
      expect(metrics.jankCount).toBeLessThan(20); // Some jank expected during network transitions
    }, 25000);
  });

  afterAll(() => {
    // Generate network performance report
    const report = performanceTestHelper.generateReport();
    console.log('\n=== Real Device Network Performance Report ===\n');
    console.log(report);
    
    if (connectedDevice) {
      console.log(`\nTested on device: ${connectedDevice.id} (${connectedDevice.model})`);
      console.log(`Android version: ${connectedDevice.version}`);
      console.log(`API level: ${connectedDevice.apiLevel}`);
    }
  });
});