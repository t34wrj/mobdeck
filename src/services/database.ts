import SQLite from 'react-native-sqlite-storage';

const databaseName = 'Readeck.db';
const databaseVersion = '1.0';
const databaseDisplayName = 'Readeck Database';
const databaseSize = 200000;

let db: SQLite.SQLiteDatabase;

const initDatabase = () => {
  db = SQLite.openDatabase(
    databaseName,
    databaseVersion,
    databaseDisplayName,
    databaseSize,
    () => {
      console.log('Database opened successfully');
      createTables();
    },
    error => {
      console.error('Error opening database: ', error);
    }
  );
};

const createTables = () => {
  db.transaction(tx => {
    tx.executeSql(
      'CREATE TABLE IF NOT EXISTS articles (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, summary TEXT, content TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)',
      [],
      () => {
        console.log('Articles table created successfully');
      },
      error => {
        console.error('Error creating articles table: ', error);
      }
    );
  });
};

const insertArticle = (title: string, summary: string, content: string) => {
  db.transaction(tx => {
    tx.executeSql(
      'INSERT INTO articles (title, summary, content) VALUES (?, ?, ?)',
      [title, summary, content],
      () => {
        console.log('Article inserted successfully');
      },
      error => {
        console.error('Error inserting article: ', error);
      }
    );
  });
};

const getArticles = (callback: (articles: any[]) => void) => {
  db.transaction(tx => {
    tx.executeSql(
      'SELECT * FROM articles',
      [],
      (tx, results) => {
        const articles: any[] = [];
        for (let i = 0; i < results.rows.length; i++) {
          articles.push(results.rows.item(i));
        }
        callback(articles);
      },
      error => {
        console.error('Error fetching articles: ', error);
      }
    );
  });
};

const closeDatabase = () => {
  if (db) {
    db.close(
      () => {
        console.log('Database closed successfully');
      },
      error => {
        console.error('Error closing database: ', error);
      }
    );
  }
};

export { initDatabase, insertArticle, getArticles, closeDatabase };
