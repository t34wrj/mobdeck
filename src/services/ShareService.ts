import { NativeModules } from 'react-native';
import { SharedData } from '../types';
import DatabaseService from './DatabaseService';
// import { localStorageService } from './LocalStorageService'; // Currently unused
// import { DBSyncMetadata } from '../types/database'; // Currently unused

const { MobdeckShareModule } = NativeModules;

export class ShareService {
  /**
   * Gets shared data from Android intent if available
   * @returns Promise resolving to shared data or null
   */
  static async getSharedData(): Promise<SharedData | null> {
    try {
      console.log('ShareService: Checking for MobdeckShareModule...', {
        hasMobdeckShareModule: !!MobdeckShareModule,
        hasGetSharedDataMethod:
          MobdeckShareModule &&
          typeof MobdeckShareModule.getSharedData === 'function',
      });

      if (
        !MobdeckShareModule ||
        typeof MobdeckShareModule.getSharedData !== 'function'
      ) {
        // MobdeckShareModule is only available when app is launched via share intent
        console.log(
          'ShareService: MobdeckShareModule not available or missing getSharedData method'
        );
        return null;
      }

      console.log(
        'ShareService: Calling MobdeckShareModule.getSharedData()...'
      );
      const data = await MobdeckShareModule.getSharedData();

      console.log('ShareService: Raw response from native module:', data);

      if (data) {
        console.log('ShareService: Retrieved shared data:', data);
        return {
          text: data.text,
          subject: data.subject,
          timestamp: data.timestamp,
        };
      }

      console.log('ShareService: No shared data available');
      return null;
    } catch (error) {
      console.error('ShareService: Error getting shared data:', error);
      return null;
    }
  }

  /**
   * Clears any pending shared data
   * @returns Promise resolving to success status
   */
  static async clearSharedData(): Promise<boolean> {
    try {
      if (
        !MobdeckShareModule ||
        typeof MobdeckShareModule.clearSharedData !== 'function'
      ) {
        // MobdeckShareModule is only available when app is launched via share intent
        return false;
      }

      return await MobdeckShareModule.clearSharedData();
    } catch (error) {
      console.error('Error clearing shared data:', error);
      return false;
    }
  }

  /**
   * Extracts URL from shared text content
   * @param text The shared text content
   * @returns Extracted URL or null if no valid URL found
   */
  static extractUrl(text: string): string | null {
    // Enhanced URL regex that handles various URL formats
    const urlRegex =
      /https?:\/\/(?:[-\w.])+(?:[:\d]+)?(?:\/(?:[\w/_.])*(?:\?(?:[\w&=%.])*)?(?:#(?:[\w.])*)?)?/gi;
    const matches = text.match(urlRegex);

    if (matches && matches.length > 0) {
      return matches[0]; // Return the first found URL
    }

    return null;
  }

  /**
   * Validates if the shared content contains a valid URL
   * @param sharedData The shared data object
   * @returns True if contains valid URL, false otherwise
   */
  static isValidUrlShare(sharedData: SharedData): boolean {
    if (!sharedData.text) {
      return false;
    }

    const url = this.extractUrl(sharedData.text);
    return url !== null;
  }

  /**
   * Formats shared data for article creation
   * @param sharedData The shared data object
   * @returns Formatted data for article creation
   */
  static formatForArticle(
    sharedData: SharedData
  ): { url: string; title?: string } | null {
    const url = this.extractUrl(sharedData.text);

    if (!url) {
      return null;
    }

    return {
      url,
      title: sharedData.subject || 'Shared Article',
    };
  }

  /**
   * Queues shared URL for offline processing
   * @param sharedData The shared data object
   * @returns Promise resolving to queue ID or null if failed
   */
  static async queueSharedUrl(sharedData: SharedData): Promise<string | null> {
    try {
      const articleData = this.formatForArticle(sharedData);
      if (!articleData) {
        return null;
      }

      const db = DatabaseService;

      // Ensure database is initialized before attempting to queue
      await db.initialize();

      const queueId = `shared_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Store in sync_metadata table for offline processing
      const result = await db.createSyncMetadata({
        entity_type: 'shared_url',
        entity_id: queueId,
        operation: 'create',
        local_timestamp: Date.now(),
        server_timestamp: null,
        sync_status: 'pending',
        conflict_resolution: null,
        retry_count: 0,
        error_message: JSON.stringify(articleData), // Store article data in error_message field
      });

      if (result.success) {
        console.log(
          'ShareService: Shared URL queued for offline processing:',
          queueId
        );
        return queueId;
      }

      return null;
    } catch (error) {
      console.error('ShareService: Error queuing shared URL:', error);
      return null;
    }
  }

  /**
   * Gets pending shared URLs from offline queue
   * @returns Promise resolving to array of pending shared URLs
   */
  static async getPendingSharedUrls(): Promise<
    Array<{
      id: string;
      url: string;
      title: string;
      timestamp: number;
    }>
  > {
    try {
      const db = DatabaseService;
      const result = await db.getSyncMetadata({
        entityType: 'shared_url',
        syncStatus: 'pending',
      });

      if (result.success && result.data && result.data.items) {
        return result.data.items
          .map(item => {
            try {
              const articleData = JSON.parse(item.error_message || '{}');
              return {
                id: item.entity_id,
                url: articleData.url || '',
                title: articleData.title || 'Shared Article',
                timestamp: item.local_timestamp,
              };
            } catch (e) {
              console.error('ShareService: Error parsing queued URL data:', e);
              return {
                id: item.entity_id,
                url: '',
                title: 'Invalid Share Data',
                timestamp: item.local_timestamp,
              };
            }
          })
          .filter(item => item.url); // Filter out invalid entries
      }

      return [];
    } catch (error) {
      console.error('ShareService: Error getting pending shared URLs:', error);
      return [];
    }
  }

  /**
   * Removes processed shared URL from queue
   * @param queueId The queue ID to remove
   * @returns Promise resolving to success status
   */
  static async removeFromQueue(queueId: string): Promise<boolean> {
    try {
      const db = DatabaseService;
      // Get the item by entity_id using a direct SQL query
      const sql =
        'SELECT * FROM sync_metadata WHERE entity_type = ? AND entity_id = ?';
      const queryResult = await db.executeSql(sql, ['shared_url', queueId]);

      if (queryResult.rows.length > 0) {
        const item = queryResult.rows.item(0);
        const deleteResult = await db.deleteSyncMetadata(item.id);
        return deleteResult.success;
      }

      return false;
    } catch (error) {
      console.error('ShareService: Error removing from queue:', error);
      return false;
    }
  }
}
