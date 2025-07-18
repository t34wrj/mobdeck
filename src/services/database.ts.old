import SQLite from 'react-native-sqlite-storage';

const databaseName = 'Readeck.db';
const _databaseVersion = '1.0';
const _databaseDisplayName = 'Readeck Database';
const _databaseSize = 200000;

let db: SQLite.SQLiteDatabase;

const initDatabase = () => {
  db = SQLite.openDatabase(
    {
      name: databaseName,
      location: 'default',
    },
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
  db.transaction((tx: any) => {
    tx.executeSql(
      'CREATE TABLE IF NOT EXISTS articles (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, summary TEXT, content TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)',
      [],
      () => {
        console.log('Articles table created successfully');
      },
      (error: any) => {
        console.error('Error creating articles table: ', error);
      }
    );
  });
};

const insertArticle = (title: string, summary: string, content: string) => {
  db.transaction((tx: any) => {
    tx.executeSql(
      'INSERT INTO articles (title, summary, content) VALUES (?, ?, ?)',
      [title, summary, content],
      () => {
        console.log('Article inserted successfully');
      },
      (error: any) => {
        console.error('Error inserting article: ', error);
      }
    );
  });
};

const getArticles = (callback: (articles: any[]) => void) => {
  db.transaction((tx: any) => {
    tx.executeSql(
      'SELECT * FROM articles',
      [],
      (_tx: any, results: any) => {
        const articles: any[] = [];
        for (let i = 0; i < results.rows.length; i++) {
          articles.push(results.rows.item(i));
        }
        callback(articles);
      },
      (error: any) => {
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
