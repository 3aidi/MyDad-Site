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
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';

// ==================== SECURITY VALIDATION ====================
if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'your-super-secret-jwt-key-change-in-production') {
  console.error('---------------------------------------------------------');
  console.error('[CRITICAL SECURITY ERROR] JWT_SECRET not set correctly!');
  console.error('Please set JWT_SECRET in your Railway environment variables.');
  console.error('---------------------------------------------------------');
  if (isProd) {
    console.error('Production mode detected. Server will NOT start without JWT_SECRET.');
    process.exit(1);
  }
}

if (isProd && process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
  console.warn('[SECURITY WARNING] JWT_SECRET should be at least 32 characters in production');
}

// Ensure required tables exist on startup
async function ensureTablesExist() {
  try {
    const isPostgres = process.env.DATABASE_URL && process.env.NODE_ENV === 'production';

    const runSafe = async (sql, desc) => {
      try {
        await db.run(sql);
      } catch (e) {
        if (!isProd) console.log(`Note: Table setup info for "${desc}": ${e.message}`);
      }
    };

    if (isPostgres) {
      await runSafe(`
        CREATE TABLE IF NOT EXISTS videos (
          id SERIAL PRIMARY KEY,
          lesson_id INTEGER NOT NULL,
          video_url TEXT NOT NULL,
          position TEXT DEFAULT 'bottom',
          size TEXT DEFAULT 'large',
          explanation TEXT,
          display_order INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `, 'videos');
      await runSafe(`
        CREATE TABLE IF NOT EXISTS images (
          id SERIAL PRIMARY KEY,
          lesson_id INTEGER NOT NULL,
          image_path TEXT NOT NULL,
          position TEXT DEFAULT 'bottom',
          size TEXT DEFAULT 'medium',
          caption TEXT,
          display_order INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `, 'images');
      await runSafe(`
        CREATE TABLE IF NOT EXISTS questions (
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
        )
      `, 'questions');
    } else {
      await runSafe(`
        CREATE TABLE IF NOT EXISTS videos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          lesson_id INTEGER NOT NULL,
          video_url TEXT NOT NULL,
          position TEXT DEFAULT 'bottom',
          size TEXT DEFAULT 'large',
          explanation TEXT,
          display_order INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
        )
      `, 'videos');
      await runSafe(`
        CREATE TABLE IF NOT EXISTS images (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          lesson_id INTEGER NOT NULL,
          image_path TEXT NOT NULL,
          position TEXT DEFAULT 'bottom',
          size TEXT DEFAULT 'medium',
          caption TEXT,
          display_order INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
        )
      `, 'images');
      await runSafe(`
        CREATE TABLE IF NOT EXISTS questions (
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
        )
      `, 'questions');
    }
    console.log('✓ Database tables verified');

    const { optimizeDatabase } = require('./src/database/optimizeDatabase');
    await optimizeDatabase();
  } catch (error) {
    console.error('Warning: Database setup error:', error.message);
  }
}

// CORS Configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL || true, // true allows all origins in dev, or specify on Railway
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

if (isProd) {
  app.use(cors(corsOptions));
}

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: isProd ? {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      connectSrc: ["'self'", "https://api.cloudinary.com"],
      frameSrc: ["'self'", "https://www.youtube.com", "https://view.officeapps.live.com", "https://res.cloudinary.com"]
    }
  } : false,
  crossOriginEmbedderPolicy: false
}));

// Rate Limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { error: 'عدد كبير من الطلبات. يرجى المحاولة لاحقاً' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', apiLimiter);

// Middlewares
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Cache Control
app.use((req, res, next) => {
  const reqPath = req.path.toLowerCase();
  if (reqPath.endsWith('.html') || reqPath === '/' || reqPath.startsWith('/admin')) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  } else if (reqPath.match(/\.(css|js|woff2?|ttf|eot|svg|png|jpg|jpeg|gif|ico)$/)) {
    const maxAge = isProd ? 7 * 24 * 60 * 60 : 0;
    res.setHeader('Cache-Control', `public, max-age=${maxAge}`);
  }
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/units', unitRoutes);
app.use('/api/lessons', lessonRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/search', searchRoutes);

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Resource not found' });
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/admin', (req, res) => res.redirect(302, '/admin/login'));
app.get('/admin/', (req, res) => res.redirect(302, '/admin/login'));

app.get('/admin/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  console.error(`[ERROR] ${status} - ${err.message}`);
  if (!isProd) console.error(err.stack);
  res.status(status).json({
    error: isProd ? 'حدث خطأ في الخادم' : err.message
  });
});

// Startup
let httpServer;
initializeDatabase()
  .then(() => ensureTablesExist())
  .then(() => {
    httpServer = app.listen(PORT, () => {
      console.log('---------------------------------------------------------');
      console.log(`🚀 Server operational on port ${PORT}`);
      console.log(`🌍 Environment: ${isProd ? 'Production' : 'Development'}`);
      console.log('---------------------------------------------------------');
    });
  })
  .catch(err => {
    console.error('❌ FATAL STARTUP ERROR:', err.message);
    process.exit(1);
  });

process.on('SIGTERM', () => {
  if (httpServer) {
    httpServer.close(() => {
      if (db.close) db.close();
    });
  }
});
