import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { useLocaleDateFormatter } from './useLocaleSettings';

export const useSettingsData = () => {
  const { formatDate } = useLocaleDateFormatter();
  
  const { user, loading: authLoading } = useSelector(
    (state: RootState) => state.auth
  );
  const { config: syncConfig, stats } = useSelector(
    (state: RootState) => state.sync
  );

  const formatLastSync = () => {
    if (!stats.lastSyncDuration) return 'Never';
    const duration = Math.round(stats.lastSyncDuration / 1000);
    return `${duration}s ago`;
  };

  const formatDataTransfer = () => {
    const { bytesDownloaded, bytesUploaded } = stats.dataTransfer;
    const totalMB = (bytesDownloaded + bytesUploaded) / (1024 * 1024);
    return totalMB > 0.1 ? `${totalMB.toFixed(1)} MB` : '< 0.1 MB';
  };

  return {
    user,
    authLoading,
    syncConfig,
    stats,
    formatDate,
    formatLastSync,
    formatDataTransfer,
  };
};