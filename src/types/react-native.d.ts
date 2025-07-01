/// <reference types="@types/react-native" />

declare module 'react-native' {
  export * from '@types/react-native';

  interface NativeModulesStatic {
    ShareModule: {
      getSharedData(): Promise<{
        text: string;
        subject?: string;
        timestamp: number;
      } | null>;
      clearSharedData(): Promise<boolean>;
    };
  }
}

// SQLite type declarations
declare module 'react-native-sqlite-storage' {
  export interface ResultSet {
    insertId: number;
    rowsAffected: number;
    rows: {
      length: number;
      item: (index: number) => any;
      raw: () => any[];
    };
  }

  export interface Transaction {
    executeSql: (
      sql: string,
      params?: any[],
      successCallback?: (tx: Transaction, results: ResultSet) => void,
      errorCallback?: (tx: Transaction, error: any) => void
    ) => void;
  }

  export interface Database {
    executeSql: (sql: string, params?: any[]) => Promise<[ResultSet]>;

    transaction: (
      callback: (tx: Transaction) => void,
      errorCallback?: (error: any) => void,
      successCallback?: () => void
    ) => void;

    close: () => Promise<void>;
  }

  export interface DatabaseParams {
    name: string;
    location?: string;
    createFromLocation?: string;
  }

  export type SQLiteDatabase = Database;

  export function openDatabase(params: DatabaseParams): Promise<Database>;
  export function DEBUG(enabled: boolean): void;
  export function enablePromise(enabled: boolean): void;
}
