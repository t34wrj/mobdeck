/**
 * Simple Logger for Mobile App
 * Basic logging with development/production modes
 */

class SimpleLogger {
  private isDev = __DEV__;

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
}

export const logger = new SimpleLogger();
