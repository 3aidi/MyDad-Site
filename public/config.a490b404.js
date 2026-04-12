// Configuration for different environments
const config = {
  // API base URL - change this for production
  API_BASE_URL: window.location.origin,

  // Cloudinary configuration for PDF uploads (unsigned/public only — NO secrets here)
  // Get your cloud name from: https://console.cloudinary.com/
  CLOUDINARY_CLOUD_NAME: 'dm0srrhnh',
  CLOUDINARY_UPLOAD_PRESET: 'pdfuploader',

  // Centralized identity configuration (single source of truth)
  IDENTITY: {
    // Official school name
    schoolName: 'مدرسة أبو فراس الحمداني للتعليم الأساسي',

    // Platform label shown with the school name
    platformLabel: 'المنصة التعليمية',

    // How the admin side should be described (no personal branding)
    adminName: 'إدارة المدرسة',
    adminRole: 'مسؤول النظام التعليمي',

    // Preferred year display for copyright text
    // Use Arabic numerals here if desired (e.g. ٢٠٢٦)
    copyrightYear: '٢٠٢٦',
  },

  // For production deployment with separate backend:
  // Uncomment and set your backend URL:
  // API_BASE_URL: 'https://your-backend.onrender.com',
};

// Export for use in other files
window.APP_CONFIG = config;
