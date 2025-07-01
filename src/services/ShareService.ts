import { NativeModules } from 'react-native';
import { SharedData } from '../types';

const { ShareModule } = NativeModules;

export class ShareService {
  /**
   * Gets shared data from Android intent if available
   * @returns Promise resolving to shared data or null
   */
  static async getSharedData(): Promise<SharedData | null> {
    try {
      if (!ShareModule) {
        console.warn('ShareModule not available');
        return null;
      }

      const data = await ShareModule.getSharedData();
      if (data) {
        console.log('Retrieved shared data:', data);
        return {
          text: data.text,
          subject: data.subject,
          timestamp: data.timestamp
        };
      }
      return null;
    } catch (error) {
      console.error('Error getting shared data:', error);
      return null;
    }
  }

  /**
   * Clears any pending shared data
   * @returns Promise resolving to success status
   */
  static async clearSharedData(): Promise<boolean> {
    try {
      if (!ShareModule) {
        return false;
      }

      return await ShareModule.clearSharedData();
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
    const urlRegex = /https?:\/\/(?:[-\w.])+(?:[:\d]+)?(?:\/(?:[\w\/_.])*(?:\?(?:[\w&=%.])*)?(?:#(?:[\w.])*)?)?/gi;
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
  static formatForArticle(sharedData: SharedData): { url: string; title?: string } | null {
    const url = this.extractUrl(sharedData.text);
    
    if (!url) {
      return null;
    }

    return {
      url,
      title: sharedData.subject || 'Shared Article'
    };
  }
}