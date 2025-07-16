// Mock for react-native-sqlite-storage
export interface MockSQLiteResult {
  rows: {
    _array: any[];
    length: number;
    item: (index: number) => any;
  };
  rowsAffected: number;
  insertId?: number;
}

export interface MockSQLiteTransaction {
  executeSql: (
    sql: string,
    params?: any[],
    success?: (tx: MockSQLiteTransaction, result: MockSQLiteResult) => void,
    error?: (tx: MockSQLiteTransaction, error: any) => void
  ) => void;
}

export interface MockSQLiteDatabase {
  transaction: (
    callback: (tx: MockSQLiteTransaction) => void,
    error?: (error: any) => void,
    success?: () => void
  ) => void;
  readTransaction: (
    callback: (tx: MockSQLiteTransaction) => void,
    error?: (error: any) => void,
    success?: () => void
  ) => void;
  close: (success?: () => void, error?: (error: any) => void) => void;
  executeSql: (
    sql: string,
    params?: any[],
    success?: (result: MockSQLiteResult) => void,
    error?: (error: any) => void
  ) => void;
}

// Mock database storage
const mockTables: { [tableName: string]: any[] } = {};

const createMockResult = (
  rows: any[] = [],
  rowsAffected: number = 0
): MockSQLiteResult => ({
  rows: {
    _array: rows,
    length: rows.length,
    item: (index: number) => rows[index],
  },
  rowsAffected,
  insertId: rowsAffected > 0 ? Math.floor(Math.random() * 1000) : undefined,
});

const executeMockSql = (sql: string, params: any[] = []): MockSQLiteResult => {
  const normalizedSql = sql.toLowerCase().trim();

  if (normalizedSql.startsWith('create table')) {
    const match = sql.match(/create table\s+(\w+)/i);
    if (match) {
      const tableName = match[1];
      if (!mockTables[tableName]) {
        mockTables[tableName] = [];
      }
    }
    return createMockResult([], 0);
  }

  if (normalizedSql.startsWith('insert into')) {
    const match = sql.match(/insert into\s+(\w+)/i);
    if (match) {
      const tableName = match[1];
      if (!mockTables[tableName]) {
        mockTables[tableName] = [];
      }
      const newRecord = { id: mockTables[tableName].length + 1, ...params };
      mockTables[tableName].push(newRecord);
      return createMockResult([], 1);
    }
  }

  if (normalizedSql.startsWith('select')) {
    const match = sql.match(/from\s+(\w+)/i);
    if (match) {
      const tableName = match[1];
      const rows = mockTables[tableName] || [];
      return createMockResult(rows, 0);
    }
  }

  if (normalizedSql.startsWith('update')) {
    const match = sql.match(/update\s+(\w+)/i);
    if (match) {
      const tableName = match[1];
      const rows = mockTables[tableName] || [];
      return createMockResult([], rows.length);
    }
  }

  if (normalizedSql.startsWith('delete')) {
    const match = sql.match(/from\s+(\w+)/i);
    if (match) {
      const tableName = match[1];
      const rowCount = mockTables[tableName]?.length || 0;
      mockTables[tableName] = [];
      return createMockResult([], rowCount);
    }
  }

  return createMockResult([], 0);
};

const createMockTransaction = (): MockSQLiteTransaction => ({
  executeSql: jest.fn((sql, params = [], success, error) => {
    try {
      const result = executeMockSql(sql, params);
      if (success) {
        success(createMockTransaction(), result);
      }
    } catch (err) {
      if (error) {
        error(createMockTransaction(), err);
      }
    }
  }),
});

const createMockDatabase = (): MockSQLiteDatabase => ({
  transaction: jest.fn((callback, error, success) => {
    try {
      callback(createMockTransaction());
      if (success) success();
    } catch (err) {
      if (error) error(err);
    }
  }),
  readTransaction: jest.fn((callback, error, success) => {
    try {
      callback(createMockTransaction());
      if (success) success();
    } catch (err) {
      if (error) error(err);
    }
  }),
  close: jest.fn((success, _error) => {
    if (success) success();
  }),
  executeSql: jest.fn((sql, params = [], success, error) => {
    try {
      const result = executeMockSql(sql, params);
      if (success) success(result);
    } catch (err) {
      if (error) error(err);
    }
  }),
});

export const mockSQLiteStorage = {
  openDatabase: jest.fn(() => createMockDatabase()),
  enablePromise: jest.fn(),
  DEBUG: jest.fn(),

  // Test utilities
  __clearMockTables: () => {
    Object.keys(mockTables).forEach(key => delete mockTables[key]);
  },
  __getMockTables: () => ({ ...mockTables }),
  __addMockData: (tableName: string, data: any[]) => {
    mockTables[tableName] = data;
  },
};

// Prevent Jest from treating this file as a test suite
if (typeof describe !== 'undefined') {
  describe.skip('SQLite Storage Mock', () => {
    it('should be skipped', () => {});
  });
}
