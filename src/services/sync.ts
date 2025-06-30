import AsyncStorage from '@react-native-async-storage/async-storage';
import BackgroundJob from 'react-native-background-job';
import { fetchArticles } from './api';
import { saveArticlesToDatabase } from './database';

const SYNC_JOB_KEY = 'articleSyncJob';

const syncArticles = async () => {
  try {
    const articles = await fetchArticles();
    await saveArticlesToDatabase(articles);
    console.log('Articles synchronized successfully');
  } catch (error) {
    console.error('Error synchronizing articles:', error);
  }
};

const scheduleSyncJob = () => {
  const job = {
    jobKey: SYNC_JOB_KEY,
    job: () => syncArticles(),
    period: 15 * 60 * 1000, // 15 minutes
    allowWhileIdle: true,
  };

  BackgroundJob.register(job);
  BackgroundJob.schedule(job);
};

const cancelSyncJob = () => {
  BackgroundJob.cancel(SYNC_JOB_KEY);
};

export { syncArticles, scheduleSyncJob, cancelSyncJob };