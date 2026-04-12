(function () {
  const RECENT_CLASSES_KEY = 'student_recent_classes';
  const VISITED_UNITS_KEY = 'student_visited_units';
  const VISITED_LESSONS_KEY = 'student_visited_lessons';

  function safeJsonParse(value, fallback) {
    if (!value) return fallback;
    try {
      return JSON.parse(value);
    } catch (_) {
      return fallback;
    }
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function upsertById(list, idKey, payload, maxItems) {
    const map = new Map();
    const merged = [];

    const all = [payload, ...list];
    for (const item of all) {
      if (!item || item[idKey] == null) continue;
      const key = String(item[idKey]);
      if (!map.has(key)) {
        map.set(key, true);
        merged.push(item);
      }
      if (merged.length >= maxItems) break;
    }
    return merged;
  }

  const StudentActivity = {
    recordClassVisit(classId) {
      if (!classId) return;
      const raw = localStorage.getItem(RECENT_CLASSES_KEY);
      const current = safeJsonParse(raw, []);
      const updated = upsertById(
        current,
        'classId',
        { classId: Number(classId), visitedAt: nowIso() },
        10
      );
      localStorage.setItem(RECENT_CLASSES_KEY, JSON.stringify(updated));
    },

    getRecentClassIds(limit = 3) {
      const raw = localStorage.getItem(RECENT_CLASSES_KEY);
      const current = safeJsonParse(raw, []);
      return current
        .sort((a, b) => new Date(b.visitedAt) - new Date(a.visitedAt))
        .slice(0, limit)
        .map((item) => item.classId);
    },

    recordUnitVisit(unitId, classId) {
      if (!unitId || !classId) return;
      const raw = localStorage.getItem(VISITED_UNITS_KEY);
      const current = safeJsonParse(raw, []);
      const updated = upsertById(
        current,
        'unitId',
        { unitId: Number(unitId), classId: Number(classId), visitedAt: nowIso() },
        200
      );
      localStorage.setItem(VISITED_UNITS_KEY, JSON.stringify(updated));
    },

    getVisitedUnits() {
      const raw = localStorage.getItem(VISITED_UNITS_KEY);
      return safeJsonParse(raw, []);
    },

    getVisitedUnitsForClass(classId) {
      const all = this.getVisitedUnits();
      const targetId = Number(classId);
      return all.filter((u) => u.classId === targetId);
    },

    recordLessonVisit(lessonId) {
      if (!lessonId) return;
      const raw = localStorage.getItem(VISITED_LESSONS_KEY);
      const current = safeJsonParse(raw, []);
      const updated = upsertById(
        current,
        'lessonId',
        { lessonId: Number(lessonId), visitedAt: nowIso() },
        500
      );
      localStorage.setItem(VISITED_LESSONS_KEY, JSON.stringify(updated));
    },

    getVisitedLessons() {
      const raw = localStorage.getItem(VISITED_LESSONS_KEY);
      return safeJsonParse(raw, []);
    }
  };

  function getStudentDisplayName() {
    return 'طالبنا العزيز';
  }

  function getLastVisitedLesson(units) {
    const raw = localStorage.getItem(VISITED_LESSONS_KEY);
    const lessons = safeJsonParse(raw, []);
    if (!lessons.length) return null;

    // Most recent first
    const last = lessons.sort((a, b) => new Date(b.visitedAt) - new Date(a.visitedAt))[0];
    return last;
  }

  function renderHero(classes, units) {
    const lastLesson = getLastVisitedLesson(units);
    const studentName = getStudentDisplayName();
    const totalClasses = classes.length;
    const visitedLessonsCount = StudentActivity.getVisitedLessons().length;

    let actionButton = `
      <button class="dashboard-hero-action" data-navigate="/classes">
        <i class="fas fa-compass"></i> استكشف المناهج
      </button>`;

    if (lastLesson) {
      actionButton = `
        <button class="dashboard-hero-action" data-navigate="/lesson/${lastLesson.lessonId}">
          <i class="fas fa-play"></i> استكمال التعلم
        </button>`;
    }

    return `
      <section class="dashboard-hero animate-premium">
        <div class="dashboard-hero-content">
          <div class="dashboard-hero-badge">
            <i class="fas fa-bolt"></i> نظرة عامة على نشاطك
          </div>
          <h1 class="dashboard-hero-title">مرحباً بك، ${studentName}</h1>
          <p class="dashboard-hero-subtitle">لديك خطة دراسية نشطة. استمر في المتابعة لتحقيق أفضل النتائج التعليمية.</p>
          ${actionButton}
        </div>

        <div class="dashboard-hero-stats">
          <div class="hero-stat-glass-card">
            <div class="hero-stat-icon"><i class="fas fa-graduation-cap"></i></div>
            <div class="hero-stat-info">
              <span class="hero-stat-value">${totalClasses}</span>
              <span class="hero-stat-label">الصفوف الدراسية</span>
            </div>
          </div>
          <div class="hero-stat-glass-card">
            <div class="hero-stat-icon"><i class="fas fa-check-double"></i></div>
            <div class="hero-stat-info">
              <span class="hero-stat-value">${visitedLessonsCount}</span>
              <span class="hero-stat-label">الدروس المكتملة</span>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  function renderBentoGrid(classes, units) {
    if (!classes.length) return '<p>لا توجد صفوف مضافة حالياً.</p>';

    const featured = classes[0]; // Take the first one as featured
    const others = classes.slice(1, 5); // Take up to 4 more

    let html = '<div class="bento-grid animate-premium" style="animation-delay: 0.2s;">';

    // 1. Featured spotlight item (Large)
    html += `
      <div class="bento-item bento-featured" data-navigate="/class/${featured.id}">
        <div class="bento-card-header">
          <span class="bento-label">ترشيح المنصة</span>
          <div class="bento-icon-box"><i class="fas fa-award"></i></div>
        </div>
        <div class="featured-spotlight">
          <div class="spotlight-info">
            <h2 class="bento-title">${escapeHtml(featured.name)}</h2>
            <p class="bento-desc">ابدأ في استكشاف هذا الصف التعليمي المتميز. يحتوي على مجموعة من الوحدات والدروس المنسقة بعناية.</p>
            <div class="spotlight-meta">
              <span class="meta-pill"><i class="fas fa-layer-group"></i> ${units.filter(u => u.class_id === featured.id).length} وحدات</span>
              <span class="meta-pill"><i class="fas fa-clock"></i> محتوى متكامل</span>
            </div>
          </div>
          <div style="margin-top: auto;">
             <button class="btn btn-primary">ابدأ الآن <i class="fas fa-arrow-left"></i></button>
          </div>
        </div>
      </div>
    `;

    // 2. Regular bento items
    others.forEach((cls, idx) => {
      const unitCount = units.filter(u => u.class_id === cls.id).length;
      const icons = ['graduation-cap', 'book-open', 'atom', 'brain'];
      const icon = icons[idx % icons.length];

      html += `
        <div class="bento-item" data-navigate="/class/${cls.id}">
          <div class="bento-card-header">
            <div class="bento-icon-box" style="background: rgba(37, 99, 235, 0.05);"><i class="fas fa-${icon}"></i></div>
          </div>
          <h3 class="bento-title" style="font-size: 1.15rem;">${escapeHtml(cls.name)}</h3>
          <p class="bento-desc" style="font-size: 0.8rem;">${unitCount} وحدات تعليمية</p>
        </div>
      `;
    });

    // 3. Stats bento (Wide)
    const visitedUnits = StudentActivity.getVisitedUnits().length;
    html += `
      <div class="bento-item bento-wide animate-premium" style="display: flex; align-items: center; justify-content: space-between; background: #0f172a; color: white; border: 1px solid rgba(255,255,255,0.05); padding: 2rem;">
        <div style="text-align: right;">
          <h3 class="bento-title" style="color: white; margin-bottom: 0.5rem;">إحصائياتك</h3>
          <p class="bento-desc" style="color: rgba(255,255,255,0.6); font-size: 0.95rem;">لقد أنهيت ${visitedUnits} وحدات دراسية بنجاح.</p>
        </div>
        <div class="hero-stat-icon" style="width: 60px; height: 60px; background: rgba(56, 189, 248, 0.15); color: #38bdf8; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; border: 1px solid rgba(56, 189, 248, 0.3);">
            <span style="font-weight: 900;">${visitedUnits}</span>
        </div>
      </div>
    `;

    html += '</div>';
    return html;
  }

  function renderDashboard(appEl, data) {
    const classes = Array.isArray(data.classes) ? data.classes : [];
    const units = Array.isArray(data.units) ? data.units : [];

    appEl.innerHTML = `
      <div class="dashboard">
        ${renderHero(classes, units)}

        <section class="dashboard-section">
          <div class="dashboard-section-header">
            <h2 style="font-size: 1.5rem;"><i class="fas fa-grid-2"></i> استكشف رحلتك التعليمية</h2>
            <p>اختر ما تريد تعلمه اليوم من بين صفوفك الدراسية المتاحة.</p>
          </div>
          ${renderBentoGrid(classes, units)}
        </section>
      </div>
    `;
  }

  window.StudentActivity = StudentActivity;
  window.StudentDashboard = {
    render: renderDashboard
  };
})();

