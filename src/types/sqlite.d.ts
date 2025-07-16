// Type definitions for react-native-sqlite-storage

declare module 'react-native-sqlite-storage' {
  export interface SQLError {
    code: number;
    message: string;
  }

  export interface SQLResultSet {
    insertId: number;
    rowsAffected: number;
    rows: {
      length: number;
      item(index: number): any;
      raw(): any[];
    };
  }

  export interface SQLTransaction {
    executeSql(
      sql: string,
      params?: any[],
      successCallback?: (tx: SQLTransaction, result: SQLResultSet) => void,
      errorCallback?: (tx: SQLTransaction, error: SQLError) => void
    ): void;
  }

  export interface SQLiteDatabase {
    transaction(
      callback: (tx: SQLTransaction) => void,
      errorCallback?: (error: SQLError) => void,
      successCallback?: () => void
    ): void;

    readTransaction(
      callback: (tx: SQLTransaction) => void,
      errorCallback?: (error: SQLError) => void,
      successCallback?: () => void
    ): void;

    executeSql(
      sql: string,
      params?: any[],
      successCallback?: (result: SQLResultSet) => void,
      errorCallback?: (error: SQLError) => void
    ): void;

    close(
      successCallback?: () => void,
      errorCallback?: (error: SQLError) => void
    ): void;
  }

  export interface SQLiteOptions {
    name: string;
    location?: string;
    createFromLocation?: string;
    androidDatabaseImplementation?: number;
    androidLockWorkaround?: number;
  }

  export function openDatabase(
    options: SQLiteOptions,
    successCallback?: (db: SQLiteDatabase) => void,
    errorCallback?: (error: SQLError) => void
  ): SQLiteDatabase;

  export function enablePromise(enable: boolean): void;

  export default {
    openDatabase,
    enablePromise,
  };
}
