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
interface _Date {
  toLocaleDateString: (
    locale?: string,
    options?: Intl.DateTimeFormatOptions
  ) => string;
}

// React Native SQLite Storage types
declare module 'react-native-sqlite-storage' {
  export interface SQLiteOptions {
    name: string;
    location?: string;
    createFromLocation?: string;
    readOnly?: boolean;
  }

  export interface SQLError {
    code: number;
    message: string;
  }

  export interface SQLiteDatabase {
    executeSql(
      statement: string,
      params?: any[],
      successCallback?: (tx: any, results: any) => void,
      errorCallback?: (error: SQLError) => void
    ): void;
    transaction(
      callback: (tx: any) => void,
      errorCallback?: (error: SQLError) => void,
      successCallback?: () => void
    ): void;
    readTransaction(
      callback: (tx: any) => void,
      errorCallback?: (error: SQLError) => void,
      successCallback?: () => void
    ): void;
    close(
      successCallback?: () => void,
      errorCallback?: (error: SQLError) => void
    ): void;
  }

  export namespace SQLite {
    export interface Database {
      executeSql(
        statement: string,
        params?: any[],
        successCallback?: (tx: any, results: any) => void,
        errorCallback?: (error: SQLError) => void
      ): void;
      transaction(
        callback: (tx: any) => void,
        errorCallback?: (error: SQLError) => void,
        successCallback?: () => void
      ): void;
      readTransaction(
        callback: (tx: any) => void,
        errorCallback?: (error: SQLError) => void,
        successCallback?: () => void
      ): void;
      close(
        successCallback?: () => void,
        errorCallback?: (error: SQLError) => void
      ): void;
    }
  }

  export function openDatabase(
    options: SQLiteOptions,
    successCallback?: (db: SQLiteDatabase) => void,
    errorCallback?: (error: SQLError) => void
  ): SQLiteDatabase;

  export function enablePromise(enable: boolean): void;
  export function DEBUG(enable: boolean): void;

  const SQLiteStorage: {
    openDatabase: typeof openDatabase;
    enablePromise: typeof enablePromise;
    DEBUG: typeof DEBUG;
  };

  export default SQLiteStorage;
}

// Network state interface
interface NetworkState {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
  type: string;
  isWifiEnabled: boolean;
}

// AuthCredentials type
interface AuthCredentials {
  username: string;
  password: string;
  serverUrl: string;
}

// Additional global types can be added here
export {};
