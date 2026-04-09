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
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';

// ==================== SECURITY VALIDATION ====================
// Validate critical environment variables on startup
if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'your-super-secret-jwt-key-change-in-production') {
  console.error('[SECURITY ERROR] JWT_SECRET not set or using default value!');
  console.error('[SECURITY ERROR] Application will not start without proper JWT_SECRET');
  process.exit(1);
}

if (isProd && process.env.JWT_SECRET.length < 32) {
  console.error('[SECURITY WARNING] JWT_SECRET should be at least 32 characters in production');
}

// Ensure required tables exist on startup
async function ensureTablesExist() {
  try {
    const isPostgres = process.env.DATABASE_URL && process.env.NODE_ENV === 'production';

    // Create videos table if not exists with try-catch for robustness
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

    // Run database optimization (create indexes)
    const { optimizeDatabase } = require('./src/database/optimizeDatabase');
    await optimizeDatabase();
  } catch (error) {
    console.error('Warning: Database setup error:', error.message);
  }
}

// Run table check after a short delay to allow DB connection
setTimeout(ensureTablesExist, 1000);

// CORS Configuration (for production when frontend/backend are separate)
const corsOptions = {
  origin: process.env.FRONTEND_URL || `http://localhost:${PORT}`,
  credentials: true, // Allow cookies
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

if (isProd) {
  app.use(cors(corsOptions));
}

// ==================== SECURITY MIDDLEWARE ====================
// Helmet - Set secure HTTP headers
// In development: Disable CSP to allow inline scripts
// In production: Enable strict CSP for security
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

// Rate Limiting - Prevent brute force attacks
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Increased to 1000 for local dev
  message: { error: 'عدد كبير من الطلبات. يرجى المحاولة لاحقاً' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limiting for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Increased to 100 for local dev
  message: { error: 'عدد كبير من محاولات تسجيل الدخول. يرجى المحاولة بعد 15 دقيقة' },
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to API routes
app.use('/api/', apiLimiter);
app.use('/api/auth/login', authLimiter);

// Middleware
app.use(compression());
app.use(express.json({ limit: '10mb' })); // Limit payload size
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Cache Control Middleware
// Static assets (CSS, JS, images) are cached but use versioning for cache-busting
// HTML files are never cached to ensure users always get the latest version

app.use((req, res, next) => {
  const reqPath = req.path.toLowerCase();

  // Never cache HTML files - always fetch fresh
  if (reqPath.endsWith('.html') || reqPath === '/' || reqPath.startsWith('/admin')) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  // Cache static assets (CSS, JS, fonts, images) for 7 days in production
  // These use version query parameters for cache-busting (e.g., style.css?v=1.0.1)
  else if (reqPath.match(/\.(css|js|woff2?|ttf|eot|svg|png|jpg|jpeg|gif|ico)$/)) {
    const maxAge = isProd ? 7 * 24 * 60 * 60 : 0; // 7 days in seconds for production
    res.setHeader('Cache-Control', `public, max-age=${maxAge}`);
  }

  next();
});

// API Routes (mounted before static so /api/* is never served as files)
app.use('/api/auth', authRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/units', unitRoutes);
app.use('/api/lessons', lessonRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/search', searchRoutes);

// Unmatched API paths must return 404 JSON, not HTML
app.use('/api', (req, res, next) => {
  res.status(404).json({ error: 'Resource not found' });
});

// Serve static files (CSS, JS, images from /public)
app.use(express.static(path.join(__dirname, 'public'), {
  etag: true,
  maxAge: 0
}));

// Redirect /admin and /admin/ to admin login page
app.get('/admin', (req, res) => {
  res.redirect(302, '/admin/login');
});
app.get('/admin/', (req, res) => {
  res.redirect(302, '/admin/login');
});

// Serve admin pages (protected on API level)
app.get('/admin/*', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Serve public pages
app.get('*', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404 handler (before global error handler)
app.use((req, res) => {
  res.status(404).json({ error: 'Resource not found' });
});

// Global error handling middleware
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;

  // Log error details server-side
  console.error(`[ERROR] ${status} - ${err.message}`);
  if (!isProd) {
    console.error(err.stack);
  }

  // Never expose internal error details in production
  const errorResponse = {
    error: isProd ? 'حدث خطأ في الخادم' : err.message
  };

  // Include stack trace only in development
  if (!isProd && err.stack) {
    errorResponse.stack = err.stack;
  }

  res.status(status).json(errorResponse);
});

// Graceful shutdown handler
let httpServer;
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  if (httpServer) {
    httpServer.close(() => {
      console.log('HTTP server closed');
      if (db.close) {
        db.close();
      }
    });
  }
});

// Initialize DB then start server
initializeDatabase().then(() => {
  // Check tables
  return ensureTablesExist();
}).then(() => {
  httpServer = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Admin panel: http://localhost:${PORT}/admin/login`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}).catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
