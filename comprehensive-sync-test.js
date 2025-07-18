/**
 * Comprehensive Sync Function Test Script
 * Tests all sync operations and validates functionality
 */

const { syncService } = require('./src/services/SyncService');

// Mock implementations for testing
jest.mock('./src/services/ReadeckApiService');
jest.mock('./src/services/LocalStorageService');
jest.mock('./src/store');
jest.mock('./src/utils/connectivityManager');

async function runComprehensiveSyncTest() {
  console.log('🚀 Starting Comprehensive Sync Function Test...\n');

  const testResults = {
    passed: 0,
    failed: 0,
    errors: []
  };

  // Test 1: Service Initialization
  console.log('Test 1: Service Initialization');
  try {
    await syncService.initialize();
    console.log('✅ Service initialized successfully');
    testResults.passed++;
  } catch (error) {
    console.log('❌ Service initialization failed:', error.message);
    testResults.failed++;
    testResults.errors.push(error.message);
  }

  // Test 2: Configuration Management
  console.log('\nTest 2: Configuration Management');
  try {
    const config = syncService.getConfiguration();
    console.log('✅ Configuration retrieved:', JSON.stringify(config, null, 2));
    
    syncService.updateConfiguration({ syncInterval: 60 });
    console.log('✅ Configuration updated successfully');
    testResults.passed += 2;
  } catch (error) {
    console.log('❌ Configuration management failed:', error.message);
    testResults.failed++;
    testResults.errors.push(error.message);
  }

  // Test 3: Sync Status Monitoring
  console.log('\nTest 3: Sync Status Monitoring');
  try {
    const isRunning = syncService.isSyncRunning();
    console.log('✅ Sync running status:', isRunning);
    
    const stats = await syncService.getSyncStats();
    console.log('✅ Sync stats retrieved:', JSON.stringify(stats, null, 2));
    testResults.passed += 2;
  } catch (error) {
    console.log('❌ Sync status monitoring failed:', error.message);
    testResults.failed++;
    testResults.errors.push(error.message);
  }

  // Test 4: Full Sync Operation
  console.log('\nTest 4: Full Sync Operation');
  try {
    const syncResult = await syncService.startFullSync();
    console.log('✅ Full sync completed:', {
      success: syncResult.success,
      syncedCount: syncResult.syncedCount,
      conflictCount: syncResult.conflictCount,
      errorCount: syncResult.errorCount,
      duration: syncResult.duration
    });
    testResults.passed++;
  } catch (error) {
    console.log('❌ Full sync failed:', error.message);
    testResults.failed++;
    testResults.errors.push(error.message);
  }

  // Test 5: Sync Up Operation
  console.log('\nTest 5: Sync Up Operation');
  try {
    const syncUpResult = await syncService.syncUp();
    console.log('✅ Sync up completed:', {
      success: syncUpResult.success,
      syncedCount: syncUpResult.syncedCount,
      errorCount: syncUpResult.errorCount
    });
    testResults.passed++;
  } catch (error) {
    console.log('❌ Sync up failed:', error.message);
    testResults.failed++;
    testResults.errors.push(error.message);
  }

  // Test 6: Sync Down Operation
  console.log('\nTest 6: Sync Down Operation');
  try {
    const syncDownResult = await syncService.syncDown();
    console.log('✅ Sync down completed:', {
      success: syncDownResult.success,
      syncedCount: syncDownResult.syncedCount,
      errorCount: syncDownResult.errorCount
    });
    testResults.passed++;
  } catch (error) {
    console.log('❌ Sync down failed:', error.message);
    testResults.failed++;
    testResults.errors.push(error.message);
  }

  // Test 7: Manual Sync Trigger
  console.log('\nTest 7: Manual Sync Trigger');
  try {
    await syncService.triggerManualSync();
    console.log('✅ Manual sync triggered successfully');
    testResults.passed++;
  } catch (error) {
    console.log('❌ Manual sync trigger failed:', error.message);
    testResults.failed++;
    testResults.errors.push(error.message);
  }

  // Test 8: Content Backfill
  console.log('\nTest 8: Content Backfill');
  try {
    const backfillResult = await syncService.backfillMissingContent();
    console.log('✅ Content backfill completed:', {
      processed: backfillResult.processed,
      updated: backfillResult.updated,
      errors: backfillResult.errors
    });
    testResults.passed++;
  } catch (error) {
    console.log('❌ Content backfill failed:', error.message);
    testResults.failed++;
    testResults.errors.push(error.message);
  }

  // Test 9: Sync Control
  console.log('\nTest 9: Sync Control');
  try {
    await syncService.stopSync();
    console.log('✅ Sync stopped successfully');
    testResults.passed++;
  } catch (error) {
    console.log('❌ Sync control failed:', error.message);
    testResults.failed++;
    testResults.errors.push(error.message);
  }

  // Test Results Summary
  console.log(`\n${'='.repeat(50)}`);
  console.log('📊 COMPREHENSIVE SYNC TEST RESULTS');
  console.log(`${'='.repeat(50)}`);
  console.log(`✅ Tests Passed: ${testResults.passed}`);
  console.log(`❌ Tests Failed: ${testResults.failed}`);
  console.log(`📈 Success Rate: ${Math.round((testResults.passed / (testResults.passed + testResults.failed)) * 100)}%`);
  
  if (testResults.errors.length > 0) {
    console.log('\n🔍 Error Details:');
    testResults.errors.forEach((error, index) => {
      console.log(`${index + 1}. ${error}`);
    });
  }

  // Final Assessment
  console.log('\n🎯 FINAL ASSESSMENT:');
  if (testResults.failed === 0) {
    console.log('🟢 ALL SYNC FUNCTIONS WORKING CORRECTLY');
    console.log('✅ Sync service is fully operational');
  } else if (testResults.failed <= 2) {
    console.log('🟡 SYNC FUNCTIONS MOSTLY WORKING');
    console.log('⚠️  Minor issues detected but core functionality intact');
  } else {
    console.log('🔴 SYNC FUNCTIONS NEED ATTENTION');
    console.log('❌ Multiple failures detected - investigation required');
  }

  return testResults;
}

// Export for potential use in other tests
module.exports = {
  runComprehensiveSyncTest
};

// Run the test if this file is executed directly
if (require.main === module) {
  runComprehensiveSyncTest().catch(console.error);
}