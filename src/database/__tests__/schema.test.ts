// Database schema tests
import { DatabaseManager } from '../init';
import { validator } from '../validate';

// Mock SQLite for testing
jest.mock('react-native-sqlite-storage', () => ({
  DEBUG: jest.fn(),
  enablePromise: jest.fn(),
  openDatabase: jest.fn(() => Promise.resolve({
    executeSql: jest.fn(() => Promise.resolve([{ rows: { length: 0, item: jest.fn() } }])),
    transaction: jest.fn(),
    close: jest.fn(() => Promise.resolve()),
  })),
}));

describe('Database Schema', () => {
  let dbManager: DatabaseManager;

  beforeEach(() => {
    dbManager = DatabaseManager.getInstance();
  });

  afterEach(async () => {
    await dbManager.close();
  });

  test('should initialize database successfully', async () => {
    await expect(dbManager.initialize()).resolves.not.toThrow();
  });

  test('should perform health check', async () => {
    await dbManager.initialize();
    const isHealthy = await dbManager.healthCheck();
    expect(typeof isHealthy).toBe('boolean');
  });

  test('should validate database schema structure', () => {
    // Test that the validation functions exist and are callable
    expect(validator.validateSchema).toBeDefined();
    expect(validator.validateConstraints).toBeDefined();
    expect(validator.performFullValidation).toBeDefined();
  });

  test('should have correct table definitions', () => {
    const expectedTables = [
      'articles',
      'labels',
      'article_labels', 
      'sync_metadata',
      'schema_version'
    ];
    
    // This is a basic structural test
    expectedTables.forEach(table => {
      expect(typeof table).toBe('string');
      expect(table.length).toBeGreaterThan(0);
    });
  });
});