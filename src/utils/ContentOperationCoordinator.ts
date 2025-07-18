/**
 * ContentOperationCoordinator - Manages coordination between sync service and individual content fetching
 * 
 * Features:
 * - Prevents race conditions between sync and individual content loading
 * - Implements operation locking and debouncing
 * - Provides priority handling (user-initiated operations take precedence)
 * - Manages active operation tracking and cancellation
 */

import { readeckApiService } from '../services/ReadeckApiService';

export interface ContentOperation {
  articleId: string;
  type: 'sync' | 'individual';
  priority: 'high' | 'normal';
  promise: Promise<string>;
  cancel: () => void;
  startTime: number;
}

export interface ContentOperationOptions {
  articleId: string;
  type: 'sync' | 'individual';
  priority?: 'high' | 'normal';
  timeout?: number;
  debounceMs?: number;
}

export class ContentOperationCoordinator {
  private static instance: ContentOperationCoordinator;
  
  // Track active operations by article ID
  private activeOperations = new Map<string, ContentOperation>();
  
  // Debounce timers for content fetching
  private debounceTimers = new Map<string, NodeJS.Timeout>();
  
  // Operation queue for when articles are locked
  private operationQueue = new Map<string, ContentOperationOptions[]>();
  
  // Default configuration
  private readonly defaultTimeout = 30000; // 30 seconds
  private readonly defaultDebounceMs = 500; // 500ms debounce
  
  private constructor() {}
  
  public static getInstance(): ContentOperationCoordinator {
    if (!ContentOperationCoordinator.instance) {
      ContentOperationCoordinator.instance = new ContentOperationCoordinator();
    }
    return ContentOperationCoordinator.instance;
  }
  
  /**
   * Request content fetch with coordination and conflict resolution
   */
  public async requestContentFetch(options: ContentOperationOptions): Promise<string> {
    const {
      articleId,
      type,
      priority = 'normal',
      debounceMs = this.defaultDebounceMs
    } = options;
    
    console.log(`[ContentCoordinator] Content fetch requested for article ${articleId} (type: ${type}, priority: ${priority})`);
    
    // Check if there's already an active operation for this article
    const existingOperation = this.activeOperations.get(articleId);
    
    if (existingOperation) {
      return this.handleExistingOperation(existingOperation, options);
    }
    
    // Apply debouncing for rapid successive requests
    if (debounceMs > 0) {
      return this.debouncedFetch(options);
    }
    
    return this.executeFetch(options);
  }
  
  /**
   * Handle existing operation conflict resolution
   */
  private async handleExistingOperation(
    existingOperation: ContentOperation,
    newOptions: ContentOperationOptions
  ): Promise<string> {
    const { articleId, type, priority = 'normal' } = newOptions;
    
    // If new operation has higher priority, cancel existing and start new
    if (this.shouldPreemptOperation(existingOperation, type, priority)) {
      console.log(`[ContentCoordinator] Preempting existing ${existingOperation.type} operation for article ${articleId} with ${type} operation`);
      
      // Cancel existing operation
      existingOperation.cancel();
      this.activeOperations.delete(articleId);
      
      // Start new operation
      return this.executeFetch(newOptions);
    }
    
    // Otherwise, wait for existing operation to complete
    console.log(`[ContentCoordinator] Waiting for existing ${existingOperation.type} operation to complete for article ${articleId}`);
    try {
      return await existingOperation.promise;
    } catch {
      // If existing operation failed, try new operation
      console.log(`[ContentCoordinator] Existing operation failed, starting new ${type} operation for article ${articleId}`);
      this.activeOperations.delete(articleId);
      return this.executeFetch(newOptions);
    }
  }
  
  /**
   * Determine if new operation should preempt existing operation
   */
  private shouldPreemptOperation(
    existingOperation: ContentOperation,
    newType: string,
    newPriority: string
  ): boolean {
    // Individual operations (user-initiated) always preempt sync operations
    if (newType === 'individual' && existingOperation.type === 'sync') {
      return true;
    }
    
    // High priority operations preempt normal priority
    if (newPriority === 'high' && existingOperation.priority === 'normal') {
      return true;
    }
    
    // Don't preempt if existing operation is the same or higher priority
    return false;
  }
  
  /**
   * Apply debouncing to prevent rapid successive requests
   */
  private async debouncedFetch(options: ContentOperationOptions): Promise<string> {
    const { articleId, debounceMs = this.defaultDebounceMs } = options;
    
    return new Promise((resolve, reject) => {
      // Clear existing debounce timer for this article
      const existingTimer = this.debounceTimers.get(articleId);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }
      
      // Set new debounce timer
      const timer = setTimeout(async () => {
        this.debounceTimers.delete(articleId);
        try {
          const content = await this.executeFetch(options);
          resolve(content);
        } catch (error) {
          reject(error);
        }
      }, debounceMs);
      
      this.debounceTimers.set(articleId, timer);
    });
  }
  
  /**
   * Execute the actual content fetch operation
   */
  private async executeFetch(options: ContentOperationOptions): Promise<string> {
    const {
      articleId,
      type,
      priority = 'normal',
      timeout = this.defaultTimeout
    } = options;
    
    console.log(`[ContentCoordinator] Starting content fetch for article ${articleId}`);
    
    // Create abort controller for cancellation support
    const abortController = new AbortController();
    
    // Create timeout handler
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, timeout);
    
    // Create the operation
    const operation: ContentOperation = {
      articleId,
      type,
      priority,
      promise: this.performContentFetch(articleId, abortController.signal),
      cancel: () => {
        abortController.abort();
        clearTimeout(timeoutId);
      },
      startTime: Date.now()
    };
    
    // Register the operation
    this.activeOperations.set(articleId, operation);
    
    try {
      const content = await operation.promise;
      clearTimeout(timeoutId);
      this.activeOperations.delete(articleId);
      
      // Process any queued operations for this article
      this.processQueuedOperations(articleId);
      
      console.log(`[ContentCoordinator] Content fetch completed for article ${articleId} (${content.length} chars)`);
      return content;
    } catch (error) {
      clearTimeout(timeoutId);
      this.activeOperations.delete(articleId);
      
      // Process any queued operations for this article
      this.processQueuedOperations(articleId);
      
      if (abortController.signal.aborted) {
        throw new Error(`Content fetch cancelled for article ${articleId}`);
      }
      
      console.error(`[ContentCoordinator] Content fetch failed for article ${articleId}:`, error);
      throw error;
    }
  }
  
  /**
   * Perform the actual content fetch using ReadeckApiService
   */
  private async performContentFetch(articleId: string, signal: AbortSignal): Promise<string> {
    try {
      // First try to get article with content
      const article = await readeckApiService.getArticleWithContent(articleId);
      
      if (signal.aborted) {
        throw new Error('Operation cancelled');
      }
      
      // If we have content, return it
      if (article.content && article.content.trim().length > 0) {
        return article.content;
      }
      
      // If no content but contentUrl exists, try to fetch content directly
      if (article.contentUrl) {
        if (signal.aborted) {
          throw new Error('Operation cancelled');
        }
        
        const content = await readeckApiService.getArticleContent(article.contentUrl);
        return content;
      }
      
      // No content available
      throw new Error('No content available for this article');
    } catch (error) {
      if (signal.aborted) {
        throw new Error('Operation cancelled');
      }
      throw error;
    }
  }
  
  /**
   * Process any queued operations for an article after current operation completes
   */
  private processQueuedOperations(articleId: string): void {
    const queuedOperations = this.operationQueue.get(articleId);
    if (queuedOperations && queuedOperations.length > 0) {
      const nextOperation = queuedOperations.shift();
      if (!nextOperation) return;
      this.operationQueue.set(articleId, queuedOperations);
      
      // Execute next operation asynchronously
      this.requestContentFetch(nextOperation).catch(error => {
        console.error(`[ContentCoordinator] Queued operation failed for article ${nextOperation.articleId}:`, error);
      });
    } else {
      this.operationQueue.delete(articleId);
    }
  }
  
  /**
   * Check if an article is currently being fetched
   */
  public isArticleBeingFetched(articleId: string): boolean {
    return this.activeOperations.has(articleId);
  }
  
  /**
   * Get active operation info for an article
   */
  public getActiveOperation(articleId: string): ContentOperation | undefined {
    return this.activeOperations.get(articleId);
  }
  
  /**
   * Cancel content fetch for an article
   */
  public cancelContentFetch(articleId: string): boolean {
    const operation = this.activeOperations.get(articleId);
    if (operation) {
      operation.cancel();
      this.activeOperations.delete(articleId);
      console.log(`[ContentCoordinator] Cancelled content fetch for article ${articleId}`);
      return true;
    }
    return false;
  }
  
  /**
   * Cancel all active operations (useful during app shutdown or logout)
   */
  public cancelAllOperations(): void {
    console.log(`[ContentCoordinator] Cancelling ${this.activeOperations.size} active operations`);
    
    for (const [, operation] of this.activeOperations) {
      operation.cancel();
    }
    
    this.activeOperations.clear();
    this.operationQueue.clear();
    
    // Clear all debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
  }
  
  /**
   * Get statistics about active operations
   */
  public getOperationStats(): {
    activeOperations: number;
    queuedOperations: number;
    syncOperations: number;
    individualOperations: number;
  } {
    const syncOps = Array.from(this.activeOperations.values()).filter(op => op.type === 'sync').length;
    const individualOps = Array.from(this.activeOperations.values()).filter(op => op.type === 'individual').length;
    const queuedOps = Array.from(this.operationQueue.values()).reduce((total, queue) => total + queue.length, 0);
    
    return {
      activeOperations: this.activeOperations.size,
      queuedOperations: queuedOps,
      syncOperations: syncOps,
      individualOperations: individualOps
    };
  }
}

// Export singleton instance
export const contentOperationCoordinator = ContentOperationCoordinator.getInstance();