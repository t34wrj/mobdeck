import { logger } from './logger';

interface PerformanceMetrics {
  operationName: string;
  duration: number;
  memoryUsed?: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

interface PerformanceThresholds {
  maxDuration: number;
  maxMemoryUsage?: number;
}

class PerformanceTestHelper {
  private metrics: PerformanceMetrics[] = [];
  private activeTimers: Map<string, number> = new Map();

  /**
   * Get performance timing with fallback to Date.now()
   */
  private getPerformanceNow(): number {
    try {
      if (typeof (global as any)?.performance?.now === 'function') {
        return (global as any).performance.now();
      }
    } catch (error) {
      // Performance API not available
    }
    return Date.now();
  }

  /**
   * Start timing an operation
   */
  startOperation(operationName: string): void {
    const startTime = this.getPerformanceNow();
    this.activeTimers.set(operationName, startTime);
    logger.info(`Performance test started: ${operationName}`);
  }

  /**
   * End timing an operation and record metrics
   */
  endOperation(
    operationName: string,
    metadata?: Record<string, any>
  ): PerformanceMetrics {
    const startTime = this.activeTimers.get(operationName);
    if (!startTime) {
      throw new Error(`No active timer found for operation: ${operationName}`);
    }

    const duration = this.getPerformanceNow() - startTime;
    const memoryUsed = this.getCurrentMemoryUsage();

    const metrics: PerformanceMetrics = {
      operationName,
      duration,
      memoryUsed,
      timestamp: new Date(),
      metadata,
    };

    this.metrics.push(metrics);
    this.activeTimers.delete(operationName);

    logger.info(`Performance test completed: ${operationName}`, {
      duration: `${duration.toFixed(2)}ms`,
      memory: memoryUsed ? `${(memoryUsed / 1024 / 1024).toFixed(2)}MB` : 'N/A',
    });

    return metrics;
  }

  /**
   * Measure async operation performance
   */
  async measureAsync<T>(
    operationName: string,
    operation: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<{ result: T; metrics: PerformanceMetrics }> {
    this.startOperation(operationName);
    try {
      const result = await operation();
      const metrics = this.endOperation(operationName, metadata);
      return { result, metrics };
    } catch (error) {
      this.endOperation(operationName, { ...metadata, error: true });
      throw error;
    }
  }

  /**
   * Measure sync operation performance
   */
  measureSync<T>(
    operationName: string,
    operation: () => T,
    metadata?: Record<string, any>
  ): { result: T; metrics: PerformanceMetrics } {
    this.startOperation(operationName);
    try {
      const result = operation();
      const metrics = this.endOperation(operationName, metadata);
      return { result, metrics };
    } catch (error) {
      this.endOperation(operationName, { ...metadata, error: true });
      throw error;
    }
  }

  /**
   * Validate performance against thresholds
   */
  validatePerformance(
    operationName: string,
    thresholds: PerformanceThresholds
  ): { passed: boolean; metrics?: PerformanceMetrics; violations: string[] } {
    const metrics = this.metrics.find(m => m.operationName === operationName);
    if (!metrics) {
      return { passed: false, violations: ['No metrics found for operation'] };
    }

    const violations: string[] = [];

    if (metrics.duration > thresholds.maxDuration) {
      violations.push(
        `Duration ${metrics.duration.toFixed(2)}ms exceeds threshold ${thresholds.maxDuration}ms`
      );
    }

    if (thresholds.maxMemoryUsage && metrics.memoryUsed) {
      if (metrics.memoryUsed > thresholds.maxMemoryUsage) {
        violations.push(
          `Memory usage ${(metrics.memoryUsed / 1024 / 1024).toFixed(2)}MB exceeds threshold ${(
            thresholds.maxMemoryUsage /
            1024 /
            1024
          ).toFixed(2)}MB`
        );
      }
    }

    return {
      passed: violations.length === 0,
      metrics,
      violations,
    };
  }

  /**
   * Get average performance metrics for an operation
   */
  getAverageMetrics(operationName: string): {
    averageDuration: number;
    averageMemory?: number;
    sampleSize: number;
  } {
    const operationMetrics = this.metrics.filter(
      m => m.operationName === operationName
    );
    if (operationMetrics.length === 0) {
      return { averageDuration: 0, sampleSize: 0 };
    }

    const totalDuration = operationMetrics.reduce(
      (sum, m) => sum + m.duration,
      0
    );
    const averageDuration = totalDuration / operationMetrics.length;

    const metricsWithMemory = operationMetrics.filter(
      m => m.memoryUsed !== undefined
    );
    const averageMemory =
      metricsWithMemory.length > 0
        ? metricsWithMemory.reduce((sum, m) => sum + (m.memoryUsed || 0), 0) /
          metricsWithMemory.length
        : undefined;

    return {
      averageDuration,
      averageMemory,
      sampleSize: operationMetrics.length,
    };
  }

  /**
   * Generate performance report
   */
  generateReport(): string {
    const report: string[] = ['=== Performance Test Report ===\n'];

    const operationNames = Array.from(
      new Set(this.metrics.map(m => m.operationName))
    );

    operationNames.forEach(operationName => {
      const avgMetrics = this.getAverageMetrics(operationName);
      const operationMetrics = this.metrics.filter(
        m => m.operationName === operationName
      );

      report.push(`\nOperation: ${operationName}`);
      report.push(`Samples: ${avgMetrics.sampleSize}`);
      report.push(
        `Average Duration: ${avgMetrics.averageDuration.toFixed(2)}ms`
      );

      if (avgMetrics.averageMemory) {
        report.push(
          `Average Memory: ${(avgMetrics.averageMemory / 1024 / 1024).toFixed(2)}MB`
        );
      }

      // Find min/max durations
      const durations = operationMetrics.map(m => m.duration);
      report.push(`Min Duration: ${Math.min(...durations).toFixed(2)}ms`);
      report.push(`Max Duration: ${Math.max(...durations).toFixed(2)}ms`);
    });

    return report.join('\n');
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.metrics = [];
    this.activeTimers.clear();
  }

  /**
   * Get current memory usage if available
   */
  private getCurrentMemoryUsage(): number | undefined {
    try {
      if (
        (global as any)?.performance &&
        'memory' in (global as any).performance
      ) {
        return (global as any).performance.memory.usedJSHeapSize;
      }
    } catch (error) {
      // Memory API not available
    }
    return undefined;
  }
}

export const performanceTestHelper = new PerformanceTestHelper();

// Performance thresholds for common operations
export const PERFORMANCE_THRESHOLDS = {
  ARTICLE_LIST_RENDER: { maxDuration: 1000 }, // 1 second
  ARTICLE_SEARCH: { maxDuration: 500 }, // 500ms
  SYNC_OPERATION: { maxDuration: 30000 }, // 30 seconds
  NAVIGATION: { maxDuration: 300 }, // 300ms
  API_CALL: { maxDuration: 5000 }, // 5 seconds
  DATABASE_QUERY: { maxDuration: 100 }, // 100ms
  IMAGE_LOAD: { maxDuration: 2000 }, // 2 seconds
};
