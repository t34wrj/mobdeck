/**
 * Share Intent Simulator
 * Simulates Android share intents for E2E testing of share handler functionality
 */

import { SharedData } from '../../../src/types';

export interface ShareIntentSimulationOptions {
  text?: string;
  subject?: string;
  type?: string;
  timestamp?: string;
  sourceApp?: string;
}

/**
 * Simulates Android share intents for testing the ShareHandlerService
 */
export class ShareIntentSimulator {
  private static sharedDataStore: SharedData | null = null;

  /**
   * Simulates sharing a URL from an external app
   */
  static simulateUrlShare(url: string, options: ShareIntentSimulationOptions = {}): void {
    const sharedData: SharedData = {
      text: options.text || url,
      subject: options.subject,
      type: options.type || 'text/plain',
      timestamp: options.timestamp || new Date().toISOString(),
      sourceApp: options.sourceApp || 'test.app',
    };

    this.sharedDataStore = sharedData;
    console.log('[ShareIntentSimulator] Simulated share intent:', sharedData);
  }

  /**
   * Simulates sharing text content with a URL embedded
   */
  static simulateTextWithUrlShare(text: string, url: string, options: ShareIntentSimulationOptions = {}): void {
    const textWithUrl = `${text} ${url}`;
    this.simulateUrlShare(textWithUrl, {
      ...options,
      text: textWithUrl,
      subject: options.subject || text,
    });
  }

  /**
   * Simulates sharing an article from a browser
   */
  static simulateBrowserShare(url: string, title: string, options: ShareIntentSimulationOptions = {}): void {
    this.simulateUrlShare(url, {
      ...options,
      subject: title,
      sourceApp: 'com.android.chrome',
      type: 'text/plain',
    });
  }

  /**
   * Simulates sharing from social media apps
   */
  static simulateSocialMediaShare(url: string, caption: string, platform: 'twitter' | 'facebook' | 'reddit' = 'twitter'): void {
    const sourceApps = {
      twitter: 'com.twitter.android',
      facebook: 'com.facebook.katana',
      reddit: 'com.reddit.frontpage',
    };

    this.simulateUrlShare(url, {
      text: `${caption} ${url}`,
      subject: caption,
      sourceApp: sourceApps[platform],
      type: 'text/plain',
    });
  }

  /**
   * Simulates sharing a news article
   */
  static simulateNewsArticleShare(
    url: string, 
    headline: string, 
    newsSource: string = 'news.app'
  ): void {
    this.simulateUrlShare(url, {
      subject: headline,
      sourceApp: newsSource,
      type: 'text/plain',
    });
  }

  /**
   * Simulates invalid share data scenarios
   */
  static simulateInvalidShare(scenario: 'empty' | 'no-url' | 'malformed-url' | 'unsupported-protocol'): void {
    const scenarios = {
      empty: { text: '', subject: '', type: 'text/plain' },
      'no-url': { text: 'This is just text without any URL', subject: 'No URL Text', type: 'text/plain' },
      'malformed-url': { text: 'Check out this link: htp://malformed.url', subject: 'Malformed URL', type: 'text/plain' },
      'unsupported-protocol': { text: 'file:///local/file/path', subject: 'Local File', type: 'text/plain' },
    };

    const data = scenarios[scenario];
    this.sharedDataStore = {
      ...data,
      timestamp: new Date().toISOString(),
      sourceApp: 'test.invalid.app',
    };
  }

  /**
   * Gets the currently simulated shared data (used by mock ShareModule)
   */
  static getSimulatedSharedData(): SharedData | null {
    return this.sharedDataStore;
  }

  /**
   * Clears the simulated shared data
   */
  static clearSimulatedSharedData(): void {
    this.sharedDataStore = null;
    console.log('[ShareIntentSimulator] Cleared simulated shared data');
  }

  /**
   * Checks if there's simulated shared data available
   */
  static hasSimulatedSharedData(): boolean {
    return this.sharedDataStore !== null;
  }

  /**
   * Creates a mock ShareModule for testing
   */
  static createMockShareModule() {
    return {
      getSharedData: jest.fn().mockImplementation(() => 
        Promise.resolve(this.getSimulatedSharedData())
      ),
      clearSharedData: jest.fn().mockImplementation(() => {
        this.clearSimulatedSharedData();
        return Promise.resolve();
      }),
    };
  }

  /**
   * Simulates common share scenarios for comprehensive testing
   */
  static getCommonShareScenarios(): Array<{
    name: string;
    setup: () => void;
    expectedUrl?: string;
    shouldSucceed: boolean;
  }> {
    return [
      {
        name: 'Simple URL share',
        setup: () => this.simulateUrlShare('https://example.com/article'),
        expectedUrl: 'https://example.com/article',
        shouldSucceed: true,
      },
      {
        name: 'Browser article share',
        setup: () => this.simulateBrowserShare(
          'https://news.example.com/breaking-news',
          'Breaking News: Important Update'
        ),
        expectedUrl: 'https://news.example.com/breaking-news',
        shouldSucceed: true,
      },
      {
        name: 'Social media share',
        setup: () => this.simulateSocialMediaShare(
          'https://blog.example.com/post',
          'Great article about technology!'
        ),
        expectedUrl: 'https://blog.example.com/post',
        shouldSucceed: true,
      },
      {
        name: 'Text with embedded URL',
        setup: () => this.simulateTextWithUrlShare(
          'Check out this interesting article:',
          'https://science.example.com/research'
        ),
        expectedUrl: 'https://science.example.com/research',
        shouldSucceed: true,
      },
      {
        name: 'Empty share data',
        setup: () => this.simulateInvalidShare('empty'),
        shouldSucceed: false,
      },
      {
        name: 'Text without URL',
        setup: () => this.simulateInvalidShare('no-url'),
        shouldSucceed: false,
      },
      {
        name: 'Malformed URL',
        setup: () => this.simulateInvalidShare('malformed-url'),
        shouldSucceed: false,
      },
      {
        name: 'Unsupported protocol',
        setup: () => this.simulateInvalidShare('unsupported-protocol'),
        shouldSucceed: false,
      },
    ];
  }

  /**
   * Resets the simulator state
   */
  static reset(): void {
    this.clearSimulatedSharedData();
  }
}

export default ShareIntentSimulator;