const path = require('path');

// Check if using PostgreSQL (production) or SQLite (local)
const usePostgres = !!process.env.DATABASE_URL;

class Database {
  constructor() {
    this.db = null;
    this.isPostgres = usePostgres;
  }

  async connect() {
    if (this.isPostgres) {
      // PostgreSQL connection with simple retry logic
      const { Pool } = require('pg');
      this.db = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 5000, // 5 seconds timeout
      });

      // Verification with retry
      let retries = 5;
      while (retries > 0) {
        try {
          await this.db.query('SELECT 1');
          console.log('✓ Successfully connected to PostgreSQL database');
          return;
        } catch (err) {
          retries--;
          if (retries === 0) {
            console.error('Final attempt to connect to PostgreSQL failed:', err.message);
            throw err;
          }
          console.log(`PostgreSQL connection failed, retrying in 3s... (${retries} retries left)`);
          await new Promise(res => setTimeout(res, 3000));
        }
      }
    } else {
      // SQLite connection
      const sqlite3 = require('sqlite3').verbose();
      const dbPath = path.join(__dirname, '../../database.db');

      return new Promise((resolve, reject) => {
        this.db = new sqlite3.Database(dbPath, (err) => {
          if (err) {
            console.error('Error connecting to database:', err);
            reject(err);
          } else {
            console.log('Connected to SQLite database');
            resolve();
          }
        });
      });
    }
  }

  async run(sql, params = []) {
    if (this.isPostgres) {
      if (!this.db) {
        throw new Error('Database not connected');
      }
      let pgSql = sql;
      let pgParams = params;
      let paramIndex = 1;

      // Better replacement of ? with $n placeholders
      // Note: This is still simple, but handles the basics of our app
      pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);

      const isInsert = /^\s*INSERT\s+INTO\s+/i.test(sql.trim()) && !/RETURNING\s+/i.test(sql);
      if (isInsert) {
        pgSql = pgSql.replace(/;\s*$/, '') + ' RETURNING id';
      }

      try {
        const result = await this.db.query(pgSql, pgParams);
        const id = (isInsert && result.rows && result.rows[0]) ? result.rows[0].id : undefined;
        return { id, changes: result.rowCount };
      } catch (error) {
        console.error('PostgreSQL Run Error:', { sql: pgSql, params: pgParams, error: error.message });
        throw error;
      }
    } else {
      // SQLite
      if (!this.db) {
        throw new Error('Database not connected');
      }
      return new Promise((resolve, reject) => {
        this.db.run(sql, params, function (err) {
          if (err) {
            reject(err);
          } else {
            resolve({ id: this.lastID, changes: this.changes });
          }
        });
      });
    }
  }

  async get(sql, params = []) {
    if (this.isPostgres) {
      if (!this.db) throw new Error('Database not connected');
      let pgSql = sql;
      let paramIndex = 1;
      pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);

      try {
        const result = await this.db.query(pgSql, params);
        return result.rows[0];
      } catch (error) {
        console.error('PostgreSQL Get Error:', { sql: pgSql, params, error: error.message });
        throw error;
      }
    } else {
      if (!this.db) throw new Error('Database not connected');
      return new Promise((resolve, reject) => {
        this.db.get(sql, params, (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row);
          }
        });
      });
    }
  }

  async all(sql, params = []) {
    if (this.isPostgres) {
      if (!this.db) throw new Error('Database not connected');
      let pgSql = sql;
      let paramIndex = 1;
      pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);

      try {
        const result = await this.db.query(pgSql, params);
        return result.rows;
      } catch (error) {
        console.error('PostgreSQL All Error:', { sql: pgSql, params, error: error.message });
        throw error;
      }
    } else {
      if (!this.db) throw new Error('Database not connected');
      return new Promise((resolve, reject) => {
        this.db.all(sql, params, (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        });
      });
    }
  }

  async close() {
    if (this.isPostgres) {
      await this.db.end();
    } else {
      return new Promise((resolve, reject) => {
        this.db.close((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    }
  }
}

const db = new Database();
db.connect().catch(console.error);

module.exports = db;
