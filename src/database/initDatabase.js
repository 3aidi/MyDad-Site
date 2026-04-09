require('dotenv').config();
const bcrypt = require('bcrypt');
const db = require('./database');

async function initializeDatabase() {
  try {
    console.log('Initializing database...');

    const isPostgres = process.env.DATABASE_URL && process.env.NODE_ENV === 'production';

    // Create Admin table
    if (isPostgres) {
      await db.run(`
        CREATE TABLE IF NOT EXISTS admins (
          id SERIAL PRIMARY KEY,
          username TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
    } else {
      await db.run(`
        CREATE TABLE IF NOT EXISTS admins (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
    }
    console.log('✓ Admin table created');

    // Create identity/settings table for school-wide identity
    if (isPostgres) {
      await db.run(`
        CREATE TABLE IF NOT EXISTS identity_settings (
          id SERIAL PRIMARY KEY,
          school_name TEXT NOT NULL,
          platform_label TEXT NOT NULL,
          admin_name TEXT NOT NULL,
          admin_role TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
    } else {
      await db.run(`
        CREATE TABLE IF NOT EXISTS identity_settings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          school_name TEXT NOT NULL,
          platform_label TEXT NOT NULL,
          admin_name TEXT NOT NULL,
          admin_role TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
    }
    console.log('✓ Identity settings table created');

    // Create Classes table
    if (isPostgres) {
      await db.run(`
        CREATE TABLE IF NOT EXISTS classes (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          display_order INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
    } else {
      await db.run(`
        CREATE TABLE IF NOT EXISTS classes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          display_order INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
    }
    console.log('✓ Classes table created');

    // Create Units table
    if (isPostgres) {
      await db.run(`
        CREATE TABLE IF NOT EXISTS units (
          id SERIAL PRIMARY KEY,
          class_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          category TEXT DEFAULT 'P',
          display_order INTEGER DEFAULT 0,
          term TEXT DEFAULT '1',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
        )
      `);
    } else {
      await db.run(`
        CREATE TABLE IF NOT EXISTS units (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          class_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          category TEXT DEFAULT 'P',
          display_order INTEGER DEFAULT 0,
          term TEXT DEFAULT '1',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
        )
      `);
    }
    console.log('✓ Units table created');

    // Create Lessons table
    if (isPostgres) {
      await db.run(`
        CREATE TABLE IF NOT EXISTS lessons (
          id SERIAL PRIMARY KEY,
          unit_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          content TEXT,
          video_url TEXT,
          video_position TEXT DEFAULT 'top',
          video_size TEXT DEFAULT 'large',
          video_explanation TEXT,
          pptx_url TEXT,
          pdf_url TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE
        )
      `);
    } else {
      await db.run(`
        CREATE TABLE IF NOT EXISTS lessons (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          unit_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          content TEXT,
          video_url TEXT,
          video_position TEXT DEFAULT 'top',
          video_size TEXT DEFAULT 'large',
          video_explanation TEXT,
          pptx_url TEXT,
          pdf_url TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE
        )
      `);
    }
    console.log('✓ Lessons table created');

    // Create Files table
    if (isPostgres) {
      await db.run(`
        CREATE TABLE IF NOT EXISTS files (
          id SERIAL PRIMARY KEY,
          lesson_id INTEGER NOT NULL,
          file_type TEXT NOT NULL,
          url TEXT NOT NULL,
          title TEXT,
          description TEXT,
          display_order INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
        )
      `);
    } else {
      await db.run(`
        CREATE TABLE IF NOT EXISTS files (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          lesson_id INTEGER NOT NULL,
          file_type TEXT NOT NULL,
          url TEXT NOT NULL,
          title TEXT,
          description TEXT,
          display_order INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
        )
      `);
    }
    console.log('✓ Files table created');

    // MIGRATION: Ensure new columns exist even if tables existed
    try {
      if (isPostgres) {
        const safeAlter = async (sql, desc) => {
          try {
            await db.run(sql);
          } catch (e) {
            console.log(`Note: Postgres migration skipped for "${desc}": ${e.message}`);
          }
        };
        await safeAlter('ALTER TABLE classes ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0', 'display_order to classes');
        await safeAlter('ALTER TABLE units ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0', 'display_order to units');
        await safeAlter("ALTER TABLE units ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'P'", 'category to units');
        await safeAlter("ALTER TABLE units ADD COLUMN IF NOT EXISTS term TEXT DEFAULT '1'", 'term to units');
        await safeAlter('ALTER TABLE lessons ADD COLUMN IF NOT EXISTS pptx_url TEXT', 'pptx_url to lessons');
        await safeAlter('ALTER TABLE lessons ADD COLUMN IF NOT EXISTS pdf_url TEXT', 'pdf_url to lessons');
      } else {
        // SQLite: Try adding columns, ignore if they exist
        const safeAlter = async (sql) => {
          try { await db.run(sql); } catch (e) { /* ignore duplicate column error */ }
        };
        await safeAlter('ALTER TABLE classes ADD COLUMN display_order INTEGER DEFAULT 0');
        await safeAlter('ALTER TABLE units ADD COLUMN display_order INTEGER DEFAULT 0');
        await safeAlter("ALTER TABLE units ADD COLUMN category TEXT DEFAULT 'P'");
        await safeAlter("ALTER TABLE units ADD COLUMN term TEXT DEFAULT '1'");
        await safeAlter('ALTER TABLE lessons ADD COLUMN pptx_url TEXT');
        await safeAlter('ALTER TABLE lessons ADD COLUMN pdf_url TEXT');
      }
      console.log('✓ Schema migration verified');
    } catch (err) {
      console.log('Migration note:', err.message);
    }

    // Check if admin exists
    const existingAdmin = await db.get('SELECT * FROM admins LIMIT 1');

    if (!existingAdmin) {
      // Create default admin account
      const username = process.env.ADMIN_USERNAME || 'admin';
      const password = process.env.ADMIN_PASSWORD || 'ChangeThisPassword123!';
      const passwordHash = await bcrypt.hash(password, 10);

      await db.run(
        'INSERT INTO admins (username, password_hash) VALUES (?, ?)',
        [username, passwordHash]
      );
      console.log('✓ Default admin account created');
      console.log(`  Username: ${username}`);
      console.log('  ⚠️  Set ADMIN_PASSWORD in production and change default password.');
    } else {
      console.log('✓ Admin account already exists');
    }

    // Ensure there is at least one identity settings row
    const existingIdentity = await db.get('SELECT * FROM identity_settings LIMIT 1');
    if (!existingIdentity) {
      const defaultSchoolName = 'مدرسة أبو فراس الحمداني للتعليم الأساسي';
      const defaultPlatformLabel = 'المنصة التعليمية';
      const defaultAdminName = 'إدارة المدرسة';
      const defaultAdminRole = 'مسؤول النظام التعليمي';

      await db.run(
        'INSERT INTO identity_settings (school_name, platform_label, admin_name, admin_role) VALUES (?, ?, ?, ?)',
        [defaultSchoolName, defaultPlatformLabel, defaultAdminName, defaultAdminRole]
      );
      console.log('✓ Default identity settings created');
    } else {
      console.log('✓ Identity settings already exist');
    }

    console.log('\n✓ Database initialization complete!');
    if (require.main === module) process.exit(0);
  } catch (error) {
    console.error('Error initializing database:', error);
    if (require.main === module) process.exit(1);
    throw error;
  }
}

module.exports = initializeDatabase;

if (require.main === module) {
  initializeDatabase();
}
