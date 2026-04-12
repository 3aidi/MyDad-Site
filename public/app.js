// Premium Student Platform - core logic
(function () {
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  if (path === '/admin') window.location.replace('/admin/login');
})();

/**
 * UTILS & HELPERS
 */
const escapeHtml = (unsafe) => {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

const extractYouTubeId = (url) => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

/**
 * ROUTER
 */
class AppRouter {
  constructor() {
    this.routes = {};
    this.currentPath = '';
    window.addEventListener('popstate', () => this.handleRoute());
  }

  on(path, handler) {
    this.routes[path] = handler;
  }

  navigate(path) {
    if (window.location.pathname === path) return;
    window.history.pushState({}, '', path);
    this.handleRoute();
  }

  handleRoute() {
    const path = window.location.pathname;
    this.currentPath = path;

    // Update Sidebar Activations
    document.querySelectorAll('[data-navigate]').forEach(el => {
      const target = el.getAttribute('data-navigate');
      if (target === '/' && path === '/') el.classList.add('active');
      else if (target !== '/' && path.startsWith(target)) el.classList.add('active');
      else el.classList.remove('active');
    });

    if (path === '/' || path === '') this.routes['/']?.();
    else if (path === '/classes') this.routes['/classes']?.();
    else if (path.startsWith('/class/')) this.routes['/class/:id']?.(path.split('/')[2]);
    else if (path.startsWith('/unit/')) this.routes['/unit/:id']?.(path.split('/')[2]);
    else if (path.startsWith('/lesson/')) this.routes['/lesson/:id']?.(path.split('/')[2]);
    else this.renderError('الصفحة غير موجودة');

    // Smooth scroll to top on navigate
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  renderError(msg) {
    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="animate-up" style="text-align: center; padding: 4rem;">
        <i class="fas fa-triangle-exclamation" style="font-size: 4rem; color: var(--accent-rose); margin-bottom: 2rem;"></i>
        <h2>عذراً، حدث خطأ</h2>
        <p style="color: var(--text-muted); margin-bottom: 2rem;">${msg}</p>
        <button class="btn btn-primary" style="margin: 0 auto;" onclick="router.navigate('/')">
          <i class="fas fa-home"></i> العودة للرئيسية
        </button>
      </div>
    `;
  }
}

const api = {
  async get(url, options = {}) {
    try {
      const res = await fetch(url, options);
      if (!res.ok) throw new Error('فشل في جلب البيانات');
      return await res.json();
    } catch (e) {
      console.error(e);
      throw e;
    }
  }
};

/**
 * Identity / School Settings
 * Single source of truth from backend (/api/settings/identity)
 */
async function loadIdentity() {
  const fallback =
    (window.APP_CONFIG && window.APP_CONFIG.IDENTITY) || {};

  try {
    const identity = await api.get('/api/settings/identity', {
      cache: 'no-store'
    });
    window.APP_IDENTITY = identity || fallback;
  } catch (_) {
    window.APP_IDENTITY = fallback;
  }

  const identity = window.APP_IDENTITY || fallback;

  // Apply to document title
  if (identity.platformLabel || identity.schoolName) {
    const baseTitle = identity.platformLabel || fallback.platformLabel || 'المنصة التعليمية';
    const school = identity.schoolName || fallback.schoolName || '';
    document.title = school ? `${baseTitle} - ${school}` : baseTitle;
  }

  // Apply to sidebar labels
  document
    .querySelectorAll('[data-identity="platform-label"]')
    .forEach((el) => {
      el.textContent = identity.platformLabel || fallback.platformLabel || el.textContent;
    });

  document
    .querySelectorAll('[data-identity="school-name"]')
    .forEach((el) => {
      el.textContent = identity.schoolName || fallback.schoolName || el.textContent;
    });
}



/**
 * Build embeddable viewer URL for documents
 */
function buildFileViewerUrl(rawUrl, type = 'pdf') {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const url = rawUrl.trim();
  if (!/^https?:\/\//i.test(url)) return null;

  try {
    const encodedSrc = encodeURIComponent(url);
    const officeTypes = ['pptx', 'ppt', 'docx', 'doc', 'xlsx', 'xls'];
    if (officeTypes.includes(type)) {
      // Use Office Online Viewer for Office Docs
      return `https://view.officeapps.live.com/op/embed.aspx?src=${encodedSrc}`;
    } else if (type === 'pdf') {
      // Use Google Docs Viewer for PDFs
      return `https://docs.google.com/viewer?url=${encodedSrc}&embedded=true`;
    }
  } catch (_) {
    return null;
  }
}


/**
 * Force download for Cloudinary URLs (Note: raw files don't support fl_attachment via URL)
 */
function getDownloadUrl(url) {
  return url || '';
}


/** Fetch dashboard data (classes + units). Fallback: if dashboard-data fails, use classes only. */
async function getDashboardData() {
  try {
    const data = await api.get('/api/classes/dashboard-data');
    return { classes: data.classes || [], units: data.units || [] };
  } catch (err) {
    const classes = await api.get('/api/classes');
    return { classes: Array.isArray(classes) ? classes : [], units: [] };
  }
}

const router = new AppRouter();
const app = document.getElementById('app');

/**
 * Shared renderer for class cards (student views)
 */
function renderClassCards(classes, units) {
  return classes.map((cls) => {
    const classUnitsCount = units.filter((u) => u.class_id === cls.id).length;
    return `
        <div class="premium-card animate-up" data-navigate="/class/${cls.id}">
          <div class="card-icon"><i class="fas fa-book-bookmark"></i></div>
          <h3 class="card-title">${escapeHtml(cls.name)}</h3>
          <p class="card-desc">استعرض جميع الوحدات والدروس المتاحة لهذا الصف الدراسي بترتيب منظم.</p>
          <div class="card-footer">
            <div class="card-stat">
              <i class="fas fa-layer-group"></i>
              <span>${classUnitsCount} وحدات</span>
            </div>
            <div class="btn-arrow"><i class="fas fa-arrow-left"></i></div>
          </div>
        </div>
      `;
  }).join('');
}

/**
 * SIDEBAR LOGIC
 */
const setupSidebar = () => {
  const toggle = document.getElementById('sidebarToggle');
  const sidebar = document.getElementById('sidebar');
  if (toggle && sidebar) {
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      sidebar.classList.toggle('active');
    });

    // Close sidebar on click away
    document.addEventListener('click', (e) => {
      if (sidebar.classList.contains('active') && !sidebar.contains(e.target)) {
        sidebar.classList.remove('active');
      }
    });

    // Handle navigation clicks
    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-navigate]');
      if (el) {
        router.navigate(el.getAttribute('data-navigate'));
        if (window.innerWidth < 1024) sidebar.classList.remove('active');
      }
    });
  }
};

/**
 * PAGE RENDERERS
 */

// 1. Dashboard Landing
router.on('/', async () => {
  try {
    app.innerHTML = '<div class="loading"><i class="fas fa-circle-notch fa-spin"></i><span>تحميل المنصة...</span></div>';

    const { classes, units } = await getDashboardData();

    if (window.StudentDashboard && typeof window.StudentDashboard.render === 'function') {
      window.StudentDashboard.render(app, { classes, units });
    } else {
      const classesHTML = renderClassCards(classes, units.slice(0, 6));
      app.innerHTML = `
        <div class="dashboard">
          <div class="animate-up">
            <h1 class="page-title">مرحباً بك في رحلتك التعليمية</h1>
            <p class="page-subtitle">اختر صفك الدراسي وابدأ في استكشاف دروسك اليوم بتجربة ممتعة وسهلة.</p>
          </div>
          <div class="cards-grid">
            ${classesHTML || '<p>لا توجد صفوف مضافة حالياً.</p>'}
          </div>
        </div>
      `;
    }
  } catch (e) {
    router.renderError(e.message);
  }
});

// 2. Classes List Page (all classes – for nav "الصفوف الدراسية" and Back from class)
router.on('/classes', async () => {
  try {
    app.innerHTML = '<div class="loading"><i class="fas fa-circle-notch fa-spin"></i><span>تحميل الصفوف...</span></div>';

    const { classes, units } = await getDashboardData();

    const classesHTML = renderClassCards(classes, units);

    app.innerHTML = `
      <div class="class-hub">
        <div class="animate-up">
          <h1 class="page-title">الصفوف الدراسية</h1>
          <p class="page-subtitle">اختر صفك الدراسي لاستعراض الوحدات والدروس.</p>
        </div>
        <div class="cards-grid">
          ${classesHTML || '<p>لا توجد صفوف مضافة حالياً.</p>'}
        </div>
      </div>
    `;
  } catch (e) {
    router.renderError(e.message);
  }
});

// 3. Units Page (Class Hub – inside a class)
router.on('/class/:id', async (classId) => {
  try {
    app.innerHTML = '<div class="loading"><i class="fas fa-circle-notch fa-spin"></i><span>تحميل الوحدات...</span></div>';

    const [cls, units] = await Promise.all([
      api.get(`/api/classes/${classId}`),
      api.get(`/api/units/class/${classId}`)
    ]);

    if (window.StudentActivity && typeof window.StudentActivity.recordClassVisit === 'function') {
      window.StudentActivity.recordClassVisit(classId);
    }

    const term1 = units.filter(u => u.term === '1');
    const term2 = units.filter(u => u.term === '2');

    const renderUnitList = (unitList) => {
      if (!unitList.length) return '<div class="animate-up" style="text-align:center; padding: 2rem; color: var(--text-light);">لا توجد وحدات بعد.</div>';
      return unitList.map((u, i) => `
        <div class="unit-row animate-up" data-navigate="/unit/${u.id}" style="animation-delay: ${i * 0.1}s">
          <div class="unit-number">${i + 1}</div>
          <div class="unit-info">
            <h3 class="unit-title">${escapeHtml(u.title)}</h3>
            <div class="unit-meta">
              <span><i class="fas fa-file-lines"></i> وحدة دراسية</span>
            </div>
          </div>
          <div class="btn-arrow"><i class="fas fa-chevron-left"></i></div>
        </div>
      `).join('');
    };

    app.innerHTML = `
      <div class="class-hub">
        <div class="animate-up">
           <button class="btn btn-secondary btn-sm" style="margin-bottom:1rem;" data-navigate="/">
              <i class="fas fa-arrow-right"></i> كل الصفوف
           </button>
           <h1 class="page-title">${escapeHtml(cls.name)}</h1>
           <p class="page-subtitle">استعرض المحتوى الدراسي المقسم حسب الفصل الدراسي الأول والثاني.</p>
        </div>

        <div class="term-tabs animate-up">
          <button class="term-tab active" data-term="1">الفصل الأول</button>
          <button class="term-tab" data-term="2">الفصل الثاني</button>
        </div>

        <div id="term-content-1" class="term-content">
          ${renderUnitList(term1)}
        </div>
        <div id="term-content-2" class="term-content" style="display:none">
          ${renderUnitList(term2)}
        </div>
      </div>
    `;

    // Tab Logic
    document.querySelectorAll('.term-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.term-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const term = btn.getAttribute('data-term');
        document.getElementById('term-content-1').style.display = term === '1' ? 'block' : 'none';
        document.getElementById('term-content-2').style.display = term === '2' ? 'block' : 'none';
      });
    });

  } catch (e) {
    router.renderError(e.message);
  }
});

// 3. Lessons List (Unit Hub)
router.on('/unit/:id', async (unitId) => {
  try {
    app.innerHTML = '<div class="loading"><i class="fas fa-circle-notch fa-spin"></i><span>تحميل الدروس...</span></div>';

    const [unit, lessons] = await Promise.all([
      api.get(`/api/units/${unitId}`),
      api.get(`/api/lessons/unit/${unitId}`)
    ]);

    if (window.StudentActivity && typeof window.StudentActivity.recordUnitVisit === 'function') {
      window.StudentActivity.recordUnitVisit(unit.id, unit.class_id);
    }

    const lessonsHTML = lessons.map((l, i) => `
      <div class="premium-card animate-up" data-navigate="/lesson/${l.id}" style="animation-delay: ${i * 0.1}s">
        <div class="lesson-thumb"><i class="fas fa-graduation-cap"></i></div>
        <h3 class="card-title" style="font-size: 1.25rem;">${escapeHtml(l.title)}</h3>
        <div class="card-footer">
           <div class="btn-arrow"><i class="fas fa-play" style="font-size: 0.8rem;"></i></div>
        </div>
      </div>
    `).join('');

    app.innerHTML = `
      <div class="unit-hub">
        <div class="animate-up">
           <button class="btn btn-secondary btn-sm" data-navigate="/class/${unit.class_id}">
              <i class="fas fa-arrow-right"></i> عودة للوحدات
           </button>
           <h1 class="page-title">${escapeHtml(unit.title)}</h1>
           <p class="page-subtitle">قائمة الدروس المتاحة في هذه الوحدة.</p>
        </div>

        <div class="cards-grid">
          ${lessonsHTML || '<p>لا توجد دروس في هذه الوحدة حالياً.</p>'}
        </div>
      </div>
    `;
  } catch (e) {
    router.renderError(e.message);
  }
});

// 4. Lesson Content (Reader View)
router.on('/lesson/:id', async (lessonId) => {
  try {
    app.innerHTML = '<div class="loading"><i class="fas fa-circle-notch fa-spin"></i><span>تحميل الدرس...</span></div>';

    const lesson = await api.get(`/api/lessons/${lessonId}`);

    if (window.StudentActivity && typeof window.StudentActivity.recordLessonVisit === 'function') {
      window.StudentActivity.recordLessonVisit(lesson.id);
    }

    // Process Files, Videos and Images
    let mediaHTML = '';

    if (lesson.files && lesson.files.length > 0) {
      mediaHTML += `<div class="lesson-files-section" style="margin: 2rem 0;">
        <h3 style="margin-bottom: 1rem; color: var(--text-dark); display: flex; align-items: center; gap: 0.5rem;">
          <i class="fas fa-file-download" style="color: var(--primary);"></i> ملفات الدرس
        </h3>
        <div style="display: grid; gap: 1rem; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));">
      `;

      lesson.files.forEach(file => {
        const type = String(file.file_type || 'file').toLowerCase();
        let icon = 'fa-file';
        let color = '#94a3b8';

        const iconMap = {
          'pdf': { icon: 'fa-file-pdf', color: '#dc2626' },
          'pptx': { icon: 'fa-file-powerpoint', color: '#ea580c' },
          'ppt': { icon: 'fa-file-powerpoint', color: '#ea580c' },
          'docx': { icon: 'fa-file-word', color: '#2563eb' },
          'doc': { icon: 'fa-file-word', color: '#2563eb' },
          'xlsx': { icon: 'fa-file-excel', color: '#16a34a' },
          'xls': { icon: 'fa-file-excel', color: '#16a34a' },
          'zip': { icon: 'fa-file-archive', color: '#6366f1' },
          'rar': { icon: 'fa-file-archive', color: '#6366f1' },
          '7z': { icon: 'fa-file-archive', color: '#6366f1' },
          'png': { icon: 'fa-file-image', color: '#8b5cf6' },
          'jpg': { icon: 'fa-file-image', color: '#8b5cf6' },
          'jpeg': { icon: 'fa-file-image', color: '#8b5cf6' },
          'webp': { icon: 'fa-file-image', color: '#8b5cf6' },
          'txt': { icon: 'fa-file-lines', color: '#64748b' },
          'csv': { icon: 'fa-file-csv', color: '#10b981' }
        };

        if (iconMap[type]) {
          icon = iconMap[type].icon;
          color = iconMap[type].color;
        }

        const viewerUrl = buildFileViewerUrl(file.url, type);
        const downloadUrl = file.url || '#';

        mediaHTML += `
          <div style="background: white; border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 1.25rem; display: flex; flex-direction: column; gap: 1rem; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
            <div style="display: flex; align-items: flex-start; gap: 1rem;">
              <div style="font-size: 2.2rem; min-width: 40px; text-align: center; color: ${color};">
                <i class="fas ${icon}"></i>
              </div>
              <div style="flex: 1; overflow: hidden;">
                <h4 style="margin: 0 0 0.25rem 0; color: var(--text-dark); font-size: 1.1rem; line-height: 1.4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(file.title || 'ملف مرفق')}</h4>
                ${file.description ? `<p style="margin: 0; font-size: 0.85rem; color: var(--text-muted); line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${escapeHtml(file.description)}</p>` : ''}
              </div>
            </div>
            <div style="display: flex; gap: 0.5rem; margin-top: auto;">
              ${viewerUrl ? `
              <a href="${escapeHtml(viewerUrl)}" target="_blank" class="btn btn-primary btn-sm" style="flex: 1;">
                <i class="fas fa-external-link-alt"></i> فتح
              </a>` : ''}
              <a href="${escapeHtml(downloadUrl)}" download class="btn btn-secondary btn-sm" style="flex: 1;">
                <i class="fas fa-download"></i> تحميل
              </a>
            </div>
          </div>
        `;
      });

      mediaHTML += `</div></div>`;
    }

    if (lesson.videos?.length) {
      mediaHTML += lesson.videos.map(v => {
        const vidId = extractYouTubeId(v.video_url);
        if (!vidId) return '';

        const position = v.position || 'bottom';
        const explanationHtml = v.explanation ? `<div class="media-text-content" style="padding: 1.5rem; background: #fff; flex: 1;">${escapeHtml(v.explanation)}</div>` : '';
        const videoIframe = `
          <div style="flex: 2; min-width: 300px; line-height: 0;">
            <iframe width="100%" height="450" 
              src="https://www.youtube-nocookie.com/embed/${vidId}?origin=${window.location.origin}&rel=0" 
              frameborder="0" 
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
              referrerpolicy="strict-origin-when-cross-origin" 
              allowfullscreen></iframe>
          </div>`;

        let layoutStyle = 'margin: 2rem 0; border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-lg); background: #fff; display: flex;';
        if (position === 'top') layoutStyle += ' flex-direction: column-reverse;';
        else if (position === 'side') layoutStyle += ' flex-direction: row; flex-wrap: wrap; align-items: stretch;';
        else layoutStyle += ' flex-direction: column;';

        return `<div style="${layoutStyle}">${videoIframe}${explanationHtml}</div>`;
      }).join('');
    }

    if (lesson.images?.length) {
      mediaHTML += lesson.images.map(img => {
        const position = img.position || 'bottom';
        const captionHtml = img.caption ? `<div class="media-text-content" style="padding: 1.25rem; background: #fff; flex: 1;">${escapeHtml(img.caption)}</div>` : '';
        const imageElement = `
          <div style="flex: 2; min-width: 300px; line-height: 0;">
            <img src="${img.image_path}" style="width: 100%; display: block;">
          </div>`;

        let layoutStyle = 'margin: 2rem 0; border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-md); background: #fff; display: flex;';
        if (position === 'top') layoutStyle += ' flex-direction: column-reverse;';
        else if (position === 'side') layoutStyle += ' flex-direction: row; flex-wrap: wrap; align-items: center;';
        else layoutStyle += ' flex-direction: column;';

        return `<div style="${layoutStyle}">${imageElement}${captionHtml}</div>`;
      }).join('');
    }

    app.innerHTML = `
      <div class="lesson-reader">
        <div class="reader-container animate-up">
           <div class="reader-header">
             <button class="btn btn-secondary btn-sm" style="margin-bottom: 2rem;" data-navigate="/unit/${lesson.unit_id}">
                <i class="fas fa-arrow-right"></i> عودة للوحدة
             </button>
             <h1 style="font-size: 2.5rem; color: var(--text-main); line-height: 1.4;">${escapeHtml(lesson.title)}</h1>
             <div style="margin-top: 1rem; color: var(--text-light); font-weight: 700;">
                <span><i class="fas fa-calendar"></i> ${new Date(lesson.created_at || Date.now()).toLocaleDateString('ar-EG')}</span>
             </div>
           </div>

           <div class="lesson-content">
             ${mediaHTML}
             ${lesson.content ? lesson.content.split('\n').map(p => p.trim() ? `<p>${escapeHtml(p)}</p>` : '').join('') : ''}
           </div>
        </div>
      </div>
    `;
  } catch (e) {
    router.renderError(e.message);
  }
});

// Start the APP
document.addEventListener('DOMContentLoaded', async () => {
  await loadIdentity();
  setupSidebar();
  router.handleRoute();
});
