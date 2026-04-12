require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./src/routes/authRoutes');
const classRoutes = require('./src/routes/classRoutes');
const unitRoutes = require('./src/routes/unitRoutes');
const lessonRoutes = require('./src/routes/lessonRoutes');
const settingsRoutes = require('./src/routes/settingsRoutes');
const searchRoutes = require('./src/routes/searchRoutes');
const db = require('./src/database/database');
const initializeDatabase = require('./src/database/initDatabase');

const app = express();

/* ===================== RAILWAY FIX ===================== */
app.set('trust proxy', 1);
const PORT = process.env.PORT;
const isProd = process.env.NODE_ENV === 'production';

/* ===================== SECURITY VALIDATION ===================== */
if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'your-super-secret-jwt-key-change-in-production') {
  console.error('---------------------------------------------------------');
  console.error('[CRITICAL SECURITY ERROR] JWT_SECRET not set correctly!');
  console.error('---------------------------------------------------------');
  if (isProd) process.exit(1);
}

if (isProd && process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
  console.warn('[SECURITY WARNING] JWT_SECRET should be at least 32 characters');
}

/* ===================== DATABASE SETUP ===================== */
async function ensureTablesExist() {
  try {
    const isPostgres = process.env.DATABASE_URL && isProd;

    const runSafe = async (sql) => {
      try {
        await db.run(sql);
      } catch (e) {
        if (!isProd) console.log('Table setup info:', e.message);
      }
    };

    if (isPostgres) {
      await runSafe(`CREATE TABLE IF NOT EXISTS videos (
        id SERIAL PRIMARY KEY,
        lesson_id INTEGER NOT NULL,
        video_url TEXT NOT NULL,
        position TEXT DEFAULT 'bottom',
        size TEXT DEFAULT 'large',
        explanation TEXT,
        display_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);

      await runSafe(`CREATE TABLE IF NOT EXISTS images (
        id SERIAL PRIMARY KEY,
        lesson_id INTEGER NOT NULL,
        image_path TEXT NOT NULL,
        position TEXT DEFAULT 'bottom',
        size TEXT DEFAULT 'medium',
        caption TEXT,
        display_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);

      await runSafe(`CREATE TABLE IF NOT EXISTS questions (
        id SERIAL PRIMARY KEY,
        lesson_id INTEGER NOT NULL,
        question_text TEXT NOT NULL,
        option_a TEXT NOT NULL,
        option_b TEXT NOT NULL,
        option_c TEXT NOT NULL,
        option_d TEXT NOT NULL,
        correct_answer CHAR(1) NOT NULL,
        display_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);
    } else {
      await runSafe(`CREATE TABLE IF NOT EXISTS videos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lesson_id INTEGER NOT NULL,
        video_url TEXT NOT NULL,
        position TEXT DEFAULT 'bottom',
        size TEXT DEFAULT 'large',
        explanation TEXT,
        display_order INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
      )`);

      await runSafe(`CREATE TABLE IF NOT EXISTS images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lesson_id INTEGER NOT NULL,
        image_path TEXT NOT NULL,
        position TEXT DEFAULT 'bottom',
        size TEXT DEFAULT 'medium',
        caption TEXT,
        display_order INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
      )`);

      await runSafe(`CREATE TABLE IF NOT EXISTS questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lesson_id INTEGER NOT NULL,
        question_text TEXT NOT NULL,
        option_a TEXT NOT NULL,
        option_b TEXT NOT NULL,
        option_c TEXT NOT NULL,
        option_d TEXT NOT NULL,
        correct_answer CHAR(1) NOT NULL,
        display_order INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
      )`);
    }

    console.log('✓ Database tables verified');

    const { optimizeDatabase } = require('./src/database/optimizeDatabase');
    await optimizeDatabase();

  } catch (err) {
    console.error('Database setup error:', err.message);
  }
}

/* ===================== MIDDLEWARE ===================== */
const corsOptions = {
  origin: process.env.FRONTEND_URL || true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

if (isProd) app.use(cors(corsOptions));

app.use(helmet({
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  contentSecurityPolicy: isProd ? {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      connectSrc: ["'self'", "https://api.cloudinary.com"],
      frameSrc: ["'self'", "https://www.youtube.com", "https://www.youtube-nocookie.com", "https://view.officeapps.live.com", "https://res.cloudinary.com"]
    }
  } : false,
  crossOriginEmbedderPolicy: false
}));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { error: 'Too many requests' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', apiLimiter);

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

/* ===================== CACHE CONTROL ===================== */
app.use((req, res, next) => {
  const p = req.path.toLowerCase();

  // If not prod, disable cache entirely to avoid Ctrl+F5 issues
  if (!isProd) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  } else if (p.endsWith('.html') || p === '/' || p.startsWith('/admin')) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  } else if (p.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg|woff2?)$/)) {
    res.setHeader('Cache-Control', 'public, max-age=604800');
  }

  next();
});

/* ===================== ROUTES ===================== */
app.use('/api/auth', authRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/units', unitRoutes);
app.use('/api/lessons', lessonRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/search', searchRoutes);

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Resource not found' });
});

/* ===================== STATIC FRONTEND ===================== */
app.use(express.static(path.join(__dirname, 'public')));

app.get('/admin', (req, res) => res.redirect('/admin/login'));
app.get('/admin/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/* ===================== ERROR HANDLER ===================== */
app.use((err, req, res, next) => {
  console.error(err.message);
  res.status(err.status || 500).json({
    error: isProd ? 'Server error' : err.message
  });
});

/* ===================== STARTUP ===================== */
(async () => {
  try {
    await initializeDatabase();
    await ensureTablesExist();

    app.listen(PORT, () => {
      console.log('---------------------------------------------------------');
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌍 Environment: ${isProd ? 'Production' : 'Development'}`);
      console.log('---------------------------------------------------------');
    });

  } catch (err) {
    console.error('FATAL STARTUP ERROR:', err.message);
    process.exit(1);
  }
})();