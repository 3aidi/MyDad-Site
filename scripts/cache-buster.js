const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Configuration
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const HTML_FILES = ['index.html', 'admin.html'];
const ASSETS_TO_HASH = [
    'styles.css',
    'shared-styles.css',
    'admin-styles.css',
    'app.js',
    'admin.js',
    'dashboard.js',
    'filters.js',
    'search.js',
    'config.js'
];

/**
 * Calculates the MD5 hash of a file's content.
 */
function getFileHash(filePath) {
    const content = fs.readFileSync(filePath);
    return crypto.createHash('md5').update(content).digest('hex').substring(0, 8);
}

/**
 * Main function to process assets and update HTML.
 */
function build() {
    console.log('🚀 Starting cache busting build...');

    const manifest = {};

    // 1. Clean up old hashed files
    const files = fs.readdirSync(PUBLIC_DIR);
    files.forEach(file => {
        // Match pattern like name.hash8.ext
        if (file.match(/\.[a-f0-9]{8}\.(css|js)$/)) {
            console.log(`   🧹 Removing old asset: ${file}`);
            fs.unlinkSync(path.join(PUBLIC_DIR, file));
        }
    });

    // 2. Hash assets and create new files
    ASSETS_TO_HASH.forEach(assetName => {
        const sourcePath = path.join(PUBLIC_DIR, assetName);
        if (fs.existsSync(sourcePath)) {
            const hash = getFileHash(sourcePath);
            const ext = path.extname(assetName);
            const base = path.basename(assetName, ext);
            const hashedName = `${base}.${hash}${ext}`;
            
            console.log(`   📦 Hashing ${assetName} -> ${hashedName}`);
            fs.copyFileSync(sourcePath, path.join(PUBLIC_DIR, hashedName));
            manifest[assetName] = hashedName;
        } else {
            console.warn(`   ⚠️  Warning: Asset not found: ${assetName}`);
        }
    });

    // 3. Update HTML files
    HTML_FILES.forEach(htmlFile => {
        const htmlPath = path.join(PUBLIC_DIR, htmlFile);
        if (fs.existsSync(htmlPath)) {
            console.log(`   📝 Updating references in ${htmlFile}...`);
            let content = fs.readFileSync(htmlPath, 'utf8');

            Object.entries(manifest).forEach(([original, hashed]) => {
                // Replace both clean paths and those with existing query strings
                // e.g., /styles.css or /styles.css?v=1.0.0
                const regex = new RegExp(`\\/${original}(\\?v=[^"']*)?`, 'g');
                content = content.replace(regex, `/${hashed}`);
            });

            fs.writeFileSync(htmlPath, content);
        }
    });

    console.log('✅ Build complete! Assets hashed and HTML updated.');
}

try {
    build();
} catch (err) {
    console.error('❌ Build failed:', err);
    process.exit(1);
}
