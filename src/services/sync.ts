// Legacy sync.ts - DEPRECATED
// This file is deprecated in favor of BackgroundSyncService.ts
// which provides more comprehensive background sync functionality
// using react-native-background-actions

import { fetchArticles } from './api';
import { saveArticlesToDatabase } from './database';

const syncArticles = async () => {
  try {
    const articles = await fetchArticles();
    await saveArticlesToDatabase(articles);
    console.log('Articles synchronized successfully');
  } catch (error) {
    console.error('Error synchronizing articles:', error);
  }
};

// Deprecated functions - use BackgroundSyncService instead
const scheduleSyncJob = () => {
  console.warn('scheduleSyncJob is deprecated. Use BackgroundSyncService.scheduleSync() instead.');
};

const cancelSyncJob = () => {
  console.warn('cancelSyncJob is deprecated. Use BackgroundSyncService.cancelSync() instead.');
};

export { syncArticles, scheduleSyncJob, cancelSyncJob };
