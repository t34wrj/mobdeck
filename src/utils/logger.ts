/**
 * Simple Logger for Mobile App
 * Basic logging with development/production modes
 */

class SimpleLogger {
  private isDev = typeof globalThis !== 'undefined' && globalThis.__DEV__;
  private performanceTimers: Map<string, number> = new Map();

  debug(message: string, data?: any): void {
    if (this.isDev) {
      console.debug(`[DEBUG] ${message}`, data);
    }
  }

  info(message: string, data?: any): void {
    if (this.isDev) {
      console.info(`[INFO] ${message}`, data);
    }
  }

  warn(message: string, data?: any): void {
    console.warn(`[WARN] ${message}`, data);
  }

  error(message: string, data?: any): void {
    console.error(`[ERROR] ${message}`, data);
  }

  startPerformanceTimer(id: string): void {
    this.performanceTimers.set(id, Date.now());
  }

  endPerformanceTimer(id: string): number {
    const startTime = this.performanceTimers.get(id);
    if (startTime) {
      const duration = Date.now() - startTime;
      this.performanceTimers.delete(id);
      if (this.isDev) {
        console.debug(`[PERF] ${id}: ${duration}ms`);
      }
      return duration;
    }
    return 0;
  }
}

export const logger = new SimpleLogger();
