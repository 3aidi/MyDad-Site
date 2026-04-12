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

  function buildContinueLearning(classes, units) {
    const recentClassIds = StudentActivity.getRecentClassIds(3);
    if (!recentClassIds.length) return [];

    const byId = new Map(classes.map((c) => [c.id, c]));
    const result = [];

    for (const classId of recentClassIds) {
      const cls = byId.get(classId);
      if (!cls) continue;
      const classUnits = units.filter((u) => u.class_id === cls.id);
      const visitedUnits = StudentActivity.getVisitedUnitsForClass(cls.id);
      const totalUnits = classUnits.length || 1;
      const visitedCount = visitedUnits.length;
      const progress = Math.max(0, Math.min(100, Math.round((visitedCount / totalUnits) * 100)));

      result.push({
        cls,
        totalUnits,
        visitedCount,
        progress
      });
    }

    return result;
  }

  function pickFeaturedClasses(classes, limit = 6) {
    if (classes.length <= limit) return classes.slice();
    return classes.slice(0, limit);
  }

  function renderContinueCards(items, units) {
    if (!items.length) {
      return `
        <div class="premium-card dashboard-empty-card">
          <h3 class="card-title">ابدأ رحلتك التعليمية</h3>
          <p class="card-desc">لم تقم بفتح أي صف دراسي بعد. ابدأ من صفحة الصفوف الدراسية.</p>
          <div class="card-footer">
            <button class="btn btn-primary" type="button" data-navigate="/classes">
              <i class="fas fa-th-large"></i> استعراض كل الصفوف
            </button>
          </div>
        </div>
      `;
    }

    return items
      .map((item) => {
        const { cls, progress } = item;
        const safeProgress = isNaN(progress) ? 0 : progress;
        return `
          <div class="premium-card dashboard-continue-card" data-navigate="/class/${cls.id}">
            <div class="card-icon"><i class="fas fa-play-circle"></i></div>
            <h3 class="card-title">${escapeHtml(cls.name)}</h3>
            <div class="dashboard-progress-row">
              <div class="dashboard-progress-text">
                <span>${safeProgress}% مكتمل</span>
              </div>
              <div class="dashboard-progress-bar">
                <div class="dashboard-progress-bar-inner" style="width: ${safeProgress}%;"></div>
              </div>
            </div>
            <div class="card-footer dashboard-continue-footer">
              <button class="btn btn-secondary btn-block" type="button">
                <i class="fas fa-play"></i> استئناف
              </button>
            </div>
          </div>
        `;
      })
      .join('');
  }

  function renderQuickStats(classes, units) {
    const totalClasses = classes.length;
    const totalUnits = units.length;
    const visitedUnitsCount = StudentActivity.getVisitedUnits().length;
    const visitedLessonsCount = StudentActivity.getVisitedLessons().length;

    return `
      <div class="dashboard-stats-grid">
        <div class="premium-card dashboard-stat-card">
          <p class="dashboard-stat-label">الصفوف في خطتك</p>
          <h2 class="dashboard-stat-value">${totalClasses}</h2>
        </div>
        <div class="premium-card dashboard-stat-card">
          <p class="dashboard-stat-label">إجمالي الوحدات</p>
          <h2 class="dashboard-stat-value">${totalUnits}</h2>
        </div>
        <div class="premium-card dashboard-stat-card">
          <p class="dashboard-stat-label">وحدات تمت زيارتها</p>
          <h2 class="dashboard-stat-value">${visitedUnitsCount}</h2>
        </div>
        <div class="premium-card dashboard-stat-card">
          <p class="dashboard-stat-label">دروس تمت زيارتها</p>
          <h2 class="dashboard-stat-value">${visitedLessonsCount}</h2>
        </div>
      </div>
    `;
  }

  function renderDashboard(appEl, data) {
    const classes = Array.isArray(data.classes) ? data.classes : [];
    const units = Array.isArray(data.units) ? data.units : [];

    const studentName = getStudentDisplayName();
    const continueItems = buildContinueLearning(classes, units);
    const featured = pickFeaturedClasses(classes, 6);
    const featuredHtml = renderClassCards(featured, units);

    appEl.innerHTML = `
      <div class="dashboard">
        <section class="dashboard-section dashboard-welcome animate-up">
          <div class="dashboard-welcome-main">
            <h1 class="page-title">مرحباً بك، <span class="dashboard-student-name">${studentName}</span></h1>
            <p class="page-subtitle">تابع رحلتك التعليمية، واستكشف الصفوف والدروس بسهولة من مكان واحد.</p>
          </div>
          <div class="dashboard-welcome-stats">
            ${renderQuickStats(classes, units)}
          </div>
        </section>

        <section class="dashboard-section animate-up">
          <div class="dashboard-section-header">
            <h2><i class="fas fa-arrow-rotate-right"></i> متابعة التعلم</h2>
            <p>استكمل من حيث توقفت مؤخراً.</p>
          </div>
          <div class="cards-grid dashboard-continue-grid">
            ${renderContinueCards(continueItems, units)}
          </div>
        </section>

        <section class="dashboard-section animate-up">
          <div class="dashboard-section-header">
            <h2><i class="fas fa-star"></i> صفوف مقترحة</h2>
            <p>مجموعة مختارة من الصفوف للبدء السريع.</p>
          </div>
          <div class="cards-grid">
            ${featuredHtml || '<p>لا توجد صفوف مضافة حالياً.</p>'}
          </div>
        </section>
      </div>
    `;
  }

  window.StudentActivity = StudentActivity;
  window.StudentDashboard = {
    render: renderDashboard
  };
})();

