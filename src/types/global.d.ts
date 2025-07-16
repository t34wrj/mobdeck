// Global type definitions for React Native app

declare global {
  var __DEV__: boolean | undefined;
  
  namespace NodeJS {
    interface Global {
      __DEV__: boolean | undefined;
    }
  }
}

// React Native global types
interface Date {
  toLocaleDateString: (locale?: string, options?: Intl.DateTimeFormatOptions) => string;
}

// Additional global types can be added here
export {};