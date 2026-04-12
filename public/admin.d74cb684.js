// Admin Router
class AdminRouter {
  constructor() {
    this.routes = {};
    this.currentUser = null;
  }

  on(path, handler) {
    this.routes[path] = handler;
  }

  async navigate(path) {
    if (path !== '/admin/login') {
      const isAuth = await this.checkAuth();
      if (!isAuth) {
        window.history.pushState({}, '', '/admin/login');
        this.handleRoute();
        return;
      }
    }
    window.history.pushState({}, '', path);
    await this.handleRoute();
  }

  async checkAuth() {
    try {
      const response = await fetch('/api/auth/verify');
      const data = await safeParseJson(response);
      if (data.authenticated) {
        this.currentUser = data.admin;
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  async handleRoute() {
    const path = window.location.pathname;
    if (path === '/admin/login' || path === '/admin' || path === '/admin.html') {
      await this.routes['/admin/login']?.();
    } else if (path === '/admin/dashboard') {
      await this.routes['/admin/dashboard']?.();
    } else if (path === '/admin/classes') {
      await this.routes['/admin/classes']?.();
    } else if (path === '/admin/units') {
      await this.routes['/admin/units']?.();
    } else if (path === '/admin/lessons') {
      await this.routes['/admin/lessons']?.();
    } else if (path === '/admin/settings') {
      await this.routes['/admin/settings']?.();
    } else {
      await this.navigate('/admin/dashboard');
    }
  }
}

function safeParseJson(response) {
  return response.text().then(text => {
    if (!text) return response.ok ? {} : null;
    try {
      return JSON.parse(text);
    } catch (error) {
      return response.ok ? {} : null;
    }
  });
}

const adminApi = {
  async get(url) {
    try {
      const response = await fetch(url);
      if (response.status === 401 || response.status === 403) {
        router.navigate('/admin/login');
        throw new Error('غير مصرح');
      }
      if (!response.ok) {
        const errorData = await safeParseJson(response);
        const error = new Error(errorData?.error || errorData?.message || 'فشل تحميل البيانات');
        error.apiError = errorData;
        console.error('API GET Error:', url, errorData);
        throw error;
      }
      return safeParseJson(response);
    } catch (error) {
      console.error('API GET Exception:', url, error);
      throw error;
    }
  },

  async post(url, data) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (response.status === 401 || response.status === 403) {
        router.navigate('/admin/login');
        throw new Error('غير مصرح');
      }
      if (!response.ok) {
        const errorData = await safeParseJson(response);
        const error = new Error(errorData.error || 'حدث خطأ');
        error.apiError = errorData;
        throw error;
      }
      return safeParseJson(response);
    } catch (error) {
      throw error;
    }
  },

  async put(url, data) {
    try {
      const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (response.status === 401 || response.status === 403) {
        router.navigate('/admin/login');
        throw new Error('غير مصرح');
      }
      if (!response.ok) {
        const errorData = await safeParseJson(response);
        const error = new Error(errorData.error || `فشل التحديث (${response.status})`);
        error.apiError = errorData;
        error.status = response.status;
        throw error;
      }
      return safeParseJson(response);
    } catch (error) {
      throw error;
    }
  },

  async delete(url) {
    try {
      const response = await fetch(url, { method: 'DELETE' });
      if (response.status === 401 || response.status === 403) {
        router.navigate('/admin/login');
        throw new Error('غير مصرح');
      }
      if (!response.ok) throw new Error('فشل الحذف');
      return safeParseJson(response);
    } catch (error) {
      throw error;
    }
  }
};

const router = new AdminRouter();
const app = document.getElementById('admin-app');

function getIdentity() {
  if (window.APP_IDENTITY) return window.APP_IDENTITY;
  return (window.APP_CONFIG && window.APP_CONFIG.IDENTITY) || {};
}

console.log('Admin app element:', app);
console.log('Router initialized:', router);

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showAlert(message, type = 'success') {
  const alertClass = type === 'error' ? 'alert-error' : 'alert-success';
  const alert = document.createElement('div');
  alert.className = `alert ${alertClass}`;
  alert.innerHTML = `<span>${escapeHtml(message)}</span>`;
  const content = document.querySelector('.admin-content');
  if (content) {
    content.insertBefore(alert, content.firstChild);
    setTimeout(() => alert.remove(), 5000);
  }
}

function initCustomSelects(container = document) {
  const selects = container.querySelectorAll('select:not(.custom-select-hidden):not(.native-select)');
  selects.forEach(select => {
    if (select.closest('.custom-select-wrapper')) return;
    const options = Array.from(select.options).map(opt => ({
      value: opt.value,
      label: opt.text,
      selected: opt.selected || select.value === opt.value
    }));
    const wrapper = document.createElement('div');
    wrapper.className = 'custom-select-wrapper';
    const selectedOption = options.find(o => o.selected) || options[0];
    const displayLabel = selectedOption ? selectedOption.label : (select.getAttribute('placeholder') || 'اختر...');
    wrapper.innerHTML = `
      <div class="custom-select-trigger">
        <span>${escapeHtml(displayLabel)}</span>
        <i class="fas fa-chevron-down dropdown-chevron"></i>
      </div>
      <div class="custom-options">
        ${options.map(opt => `
          <div class="custom-option ${select.value === opt.value ? 'selected' : ''}" data-value="${opt.value}">
            ${escapeHtml(opt.label)}
          </div>
        `).join('')}
      </div>
    `;
    select.classList.add('custom-select-hidden');
    select.style.display = 'none';
    select.parentNode.insertBefore(wrapper, select);
    const trigger = wrapper.querySelector('.custom-select-trigger');
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = wrapper.classList.contains('open');
      document.querySelectorAll('.custom-select-wrapper').forEach(w => w.classList.remove('open'));
      if (!isOpen) wrapper.classList.add('open');
    });
    wrapper.querySelectorAll('.custom-option').forEach(opt => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        const newVal = opt.getAttribute('data-value');
        select.value = newVal;
        trigger.querySelector('span').textContent = opt.textContent.trim();
        wrapper.querySelectorAll('.custom-option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        wrapper.classList.remove('open');
        select.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });
  });
}

document.addEventListener('click', () => {
  document.querySelectorAll('.custom-select-wrapper').forEach(w => w.classList.remove('open'));
});

const originalNavigate = router.navigate;
router.navigate = function (...args) {
  return originalNavigate.apply(this, args).then(() => {
    initCustomSelects();
  });
};

const observer = new MutationObserver((mutations) => {
  mutations.forEach(mutation => {
    if (mutation.addedNodes.length) initCustomSelects();
  });
});
observer.observe(document.body, { childList: true, subtree: true });

function showConfirmModal(title, message) {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 400px;">
        <div class="modal-header">
          <h2>${escapeHtml(title)}</h2>
          <button type="button" class="modal-close" data-action="modal-close">&times;</button>
        </div>
        <div style="padding: 1.5rem; color: #334155; line-height: 1.6;">${message}</div>
        <div class="btn-group">
          <button type="button" class="btn btn-danger" data-action="confirm-yes"><i class="fas fa-trash"></i> نعم، احذفه</button>
          <button type="button" class="btn btn-secondary" data-action="confirm-no"><i class="fas fa-times"></i> إلغاء</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    window.addEventListener('confirmResolved', function handler() {
      window.removeEventListener('confirmResolved', handler);
      resolve(window.confirmResult);
    }, { once: true });
  });
}

function adminLayout(content, activeNav) {
  const identity = getIdentity();
  const platformLabel = identity.platformLabel || 'المنصة التعليمية';
  const schoolName = identity.schoolName || '';
  const adminName = identity.adminName || 'إدارة المدرسة';
  const adminRole = identity.adminRole || 'مسؤول النظام التعليمي';
  return `
    <div class="admin-layout">
      <button type="button" class="hamburger" id="hamburgerBtn" data-action="toggle-sidebar">
        <span></span><span></span><span></span>
      </button>
      <div class="sidebar-overlay" id="sidebarOverlay" data-action="toggle-sidebar" role="button" tabindex="0"></div>
      <aside class="sidebar" id="adminSidebar">
        <div class="sidebar-header">
          <div class="logo"><i class="fas fa-graduation-cap"></i></div>
          <h2>${escapeHtml(adminName)}</h2>
          <p>${escapeHtml(adminRole)}</p>
          <p style="font-size: 0.8rem; color: var(--light-text); margin-top: 0.25rem;">${escapeHtml(schoolName)}</p>
        </div>
        <nav>
          <a href="/admin/dashboard" class="${activeNav === 'dashboard' ? 'active' : ''}"><i class="fas fa-chart-line"></i> لوحة المعلومات</a>
          <a href="/admin/classes" class="${activeNav === 'classes' ? 'active' : ''}"><i class="fas fa-book-open"></i> الصفوف الدراسية</a>
          <a href="/admin/units" class="${activeNav === 'units' ? 'active' : ''}"><i class="fas fa-folder-open"></i> الوحدات الدراسية</a>
          <a href="/admin/lessons" class="${activeNav === 'lessons' ? 'active' : ''}"><i class="fas fa-file-alt"></i> الدروس</a>
          <a href="/admin/settings" class="${activeNav === 'settings' ? 'active' : ''}"><i class="fas fa-cog"></i> إعدادات المدرسة</a>
        </nav>
        <div class="sidebar-footer" dir="rtl">
          <p>مسجل الدخول:</p>
          <div class="teacher-badge-admin">
            <span>${router.currentUser?.username || 'مدير'}</span>
            <i class="fas fa-user-tie"></i>
          </div>
          <button type="button" class="logout-badge" data-action="logout">تسجيل الخروج <i class="fas fa-sign-out-alt"></i></button>
        </div>
      </aside>
      <main class="admin-main">${content}</main>
    </div>
  `;
}

async function logout() {
  try {
    await adminApi.post('/api/auth/logout', {});
    router.navigate('/admin/login');
  } catch (error) {
    console.error('Logout error:', error);
  }
}

function toggleSidebar() {
  const sidebar = document.getElementById('adminSidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const hamburger = document.getElementById('hamburgerBtn');
  if (sidebar && overlay && hamburger) {
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
    hamburger.classList.toggle('active');
  }
}

router.on('/admin/login', async () => {
  if (!app) { console.error('Admin app element not found!'); return; }
  let identity = getIdentity();
  try {
    const dynamicIdentity = await adminApi.get('/api/settings/identity');
    if (dynamicIdentity) { window.APP_IDENTITY = dynamicIdentity; identity = dynamicIdentity; }
  } catch (_) { }
  const platformLabel = identity.platformLabel || 'المنصة التعليمية';
  const schoolName = identity.schoolName || '';
  const platformFullTitle = schoolName ? `${platformLabel} - ${schoolName}` : platformLabel;
  document.title = `لوحة التحكم - ${platformFullTitle}`;
  app.innerHTML = `
    <div class="login-container">
      <div class="login-form-wrapper">
        <div class="container">
          <div class="heading">تسجيل الدخول</div>
          <p class="welcome-text">${escapeHtml(schoolName ? `نظام إدارة المحتوى التعليمي لـ ${schoolName}` : 'نظام إدارة المحتوى التعليمي للمدرسة')}</p>
          <form id="login-form" class="form">
            <input required class="input" type="text" name="username" id="username" placeholder="اسم المستخدم" />
            <input required class="input" type="password" name="password" id="password" placeholder="كلمة المرور" />
            <span class="forgot-password"><a href="#">هل نسيت كلمة المرور؟</a></span>
            <div id="login-error" style="display: none;" class="alert alert-error"></div>
            <input class="login-button" type="submit" value="دخول" />
          </form>
        </div>
      </div>
    </div>
  `;
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('login-error');
    errorDiv.style.display = 'none';
    errorDiv.textContent = '';
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      if (!response.ok) {
        const data = await safeParseJson(response);
        throw new Error(response.status === 401 ? 'كلمة المرور غير صحيحة' : (data.error || 'حدث خطأ'));
      }
      await safeParseJson(response);
      router.navigate('/admin/dashboard');
    } catch (error) {
      errorDiv.textContent = error.message;
      errorDiv.style.display = 'block';
    }
  });
});

router.on('/admin/dashboard', async () => {
  try {
    try {
      const dynamicIdentity = await adminApi.get('/api/settings/identity');
      if (dynamicIdentity) window.APP_IDENTITY = dynamicIdentity;
    } catch (_) { }
    const identity = getIdentity();
    const platformLabel = identity.platformLabel || 'المنصة التعليمية';
    const schoolName = identity.schoolName || '';
    document.title = `لوحة المعلومات - ${schoolName ? `${platformLabel} - ${schoolName}` : platformLabel}`;
    const [classes, units] = await Promise.all([adminApi.get('/api/classes'), adminApi.get('/api/units')]);
    const term1Units = units.filter(u => u.term == '1' || u.term == 1).length;
    const term2Units = units.filter(u => u.term == '2' || u.term == 2).length;
    app.innerHTML = adminLayout(`
      <div class="admin-header"><h1>لوحة المعلومات</h1><p>نظرة عامة على المحتوى التعليمي</p></div>
      <div class="admin-content">
        <div class="stats-grid stats-grid-compact">
          <div class="stat-card stat-card-compact"><h3>إجمالي الوحدات</h3><div class="number">${units.length}</div></div>
          <div class="stat-card stat-card-compact"><h3>إجمالي الصفوف</h3><div class="number">${classes.length}</div></div>
          <div class="stat-card stat-card-compact"><h3>وحدات الفصل الأول</h3><div class="number">${term1Units}</div></div>
          <div class="stat-card stat-card-compact"><h3>وحدات الفصل الثاني</h3><div class="number">${term2Units}</div></div>
        </div>
        <div class="quick-actions">
          <h3>إجراءات سريعة</h3>
          <div style="display: flex; gap: 1rem; margin-top: 1rem; flex-wrap: wrap;">
            <button type="button" class="btn btn-primary" data-action="navigate" data-path="/admin/classes"><i class="fas fa-book-open"></i> إدارة الصفوف</button>
            <button type="button" class="btn btn-primary" data-action="navigate" data-path="/admin/units"><i class="fas fa-folder-open"></i> إدارة الوحدات</button>
            <button type="button" class="btn btn-primary" data-action="navigate" data-path="/admin/lessons"><i class="fas fa-file-alt"></i> إدارة الدروس</button>
          </div>
        </div>
      </div>
    `, 'dashboard');
  } catch (error) {
    app.innerHTML = adminLayout(`<div class="alert alert-error">Error loading dashboard</div>`, 'dashboard');
  }
});

router.on('/admin/classes', async () => {
  try {
    const identity = getIdentity();
    document.title = `الصفوف الدراسية - ${identity.platformLabel || 'المنصة التعليمية'}`;
    const classes = await adminApi.get('/api/classes');
    const classesHTML = classes.length === 0
      ? '<div class="empty-state" style="padding: 3rem; text-align: center;"><div class="empty-state-icon"><i class="fas fa-book"></i></div><p>لا توجد صفوف دراسية بعد. قم بإنشاء صف دراسي أول!</p></div>'
      : classes.map((cls) => `
          <div class="admin-class-card" data-id="${cls.id}">
            <div class="admin-class-card-header">
              <div class="admin-class-card-info">
                <h3 class="admin-class-card-title">${escapeHtml(cls.name || cls.name_ar)}</h3>
                <p class="admin-class-card-date"><i class="fas fa-calendar-alt"></i> ${new Date(cls.created_at).toLocaleDateString('ar-SA')}</p>
              </div>
            </div>
            <div class="admin-class-card-actions">
              <button type="button" class="btn btn-primary" data-action="edit-class" data-id="${cls.id}" data-name="${escapeHtml((cls.name || cls.name_ar)).replace(/"/g, '&quot;')}" title="تعديل الصف"><i class="fas fa-edit"></i></button>
              <button type="button" class="btn btn-danger" data-action="delete-class" data-id="${cls.id}" data-name="${escapeHtml((cls.name || cls.name_ar)).replace(/"/g, '&quot;')}" title="حذف الصف"><i class="fas fa-trash"></i></button>
            </div>
          </div>
        `).join('');
    app.innerHTML = adminLayout(`
      <div class="admin-header">
        <h1>إدارة الصفوف الدراسية</h1>
        <button type="button" class="btn btn-primary" data-action="show-create-class"><i class="fas fa-plus"></i> صف جديد</button>
      </div>
      <div class="admin-content">
        <div class="admin-classes-grid" id="admin-classes-list">${classesHTML}</div>
      </div>
    `, 'classes');
    setTimeout(() => {
      const el = document.getElementById('admin-classes-list');
      if (el && window.Sortable) {
        new Sortable(el, {
          animation: 150, ghostClass: 'sortable-ghost', dragClass: 'sortable-drag', delay: 100, delayOnTouchOnly: true,
          onEnd: async function () {
            const ids = Array.from(el.children).map(child => parseInt(child.getAttribute('data-id'))).filter(id => !isNaN(id));
            try { await adminApi.post('/api/classes/reorder', { order: ids }); } catch (e) { showAlert('فشل تحديث الترتيب', 'error'); }
          }
        });
      }
    }, 50);
  } catch (error) {
    app.innerHTML = adminLayout(`<div class="alert alert-error">Error loading classes</div>`, 'classes');
  }
});

window.showCreateClassForm = function () {
  const modal = document.createElement('div');
  modal.className = 'modal active';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header"><h2>إضافة صف دراسي جديد</h2><button type="button" class="modal-close" data-action="modal-close">&times;</button></div>
      <form id="create-class-form">
        <div class="form-group">
          <label for="class-name"><i class="fas fa-book-open"></i> اسم الصف *</label>
          <input type="text" id="class-name" required autofocus placeholder="مثال: الصف الأول" dir="rtl">
          <small style="color: #666;">يرجى إدخال اسم الصف بالأحرف العربية فقط</small>
        </div>
        <div style="color: #ef4444; margin: 1rem 0; padding: 0.75rem; background: #fee2e2; border-radius: 4px; display: none;" id="class-error"><i class="fas fa-exclamation-circle"></i> <span id="class-error-msg"></span></div>
        <div class="btn-group">
          <button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> حفظ الصف</button>
          <button type="button" class="btn btn-secondary" data-action="modal-close"><i class="fas fa-times"></i> إلغاء</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
  const classNameInput = document.getElementById('class-name');
  const errorDiv = document.getElementById('class-error');
  const errorMsg = document.getElementById('class-error-msg');
  classNameInput.addEventListener('input', (e) => {
    const arabicPattern = /^[\u0600-\u06FF\s]*$/;
    errorDiv.style.display = (e.target.value && !arabicPattern.test(e.target.value)) ? 'block' : 'none';
    if (errorDiv.style.display === 'block') errorMsg.textContent = 'يجب أن يحتوي على أحرف عربية فقط';
  });
  document.getElementById('create-class-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = classNameInput.value.trim();
    if (!name) { errorDiv.style.display = 'block'; errorMsg.textContent = 'اسم الصف مطلوب'; return; }
    if (!/^[\u0600-\u06FF\s]+$/.test(name)) { errorDiv.style.display = 'block'; errorMsg.textContent = 'يجب أن يحتوي على أحرف عربية فقط'; return; }
    try { await adminApi.post('/api/classes', { name }); modal.remove(); router.navigate('/admin/classes'); showAlert('تم إضافة الصف بنجاح!'); }
    catch (error) { errorDiv.style.display = 'block'; errorMsg.textContent = error.message; }
  });
};

window.editClass = function (id, name) {
  const modal = document.createElement('div');
  modal.className = 'modal active';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header"><h2>تعديل الصف الدراسي</h2><button type="button" class="modal-close" data-action="modal-close">&times;</button></div>
      <form id="edit-class-form">
        <div class="form-group">
          <label for="edit-class-name"><i class="fas fa-book-open"></i> اسم الصف *</label>
          <input type="text" id="edit-class-name" value="${escapeHtml(name || '')}" required autofocus dir="rtl">
          <small style="color: #666;">يرجى إدخال اسم الصف بالأحرف العربية فقط</small>
        </div>
        <div style="color: #ef4444; margin: 1rem 0; padding: 0.75rem; background: #fee2e2; border-radius: 4px; display: none;" id="edit-class-error"><i class="fas fa-exclamation-circle"></i> <span id="edit-class-error-msg"></span></div>
        <div class="btn-group">
          <button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> حفظ التغييرات</button>
          <button type="button" class="btn btn-secondary" data-action="modal-close"><i class="fas fa-times"></i> إلغاء</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
  const classNameInput = document.getElementById('edit-class-name');
  const errorDiv = document.getElementById('edit-class-error');
  const errorMsg = document.getElementById('edit-class-error-msg');
  classNameInput.addEventListener('input', (e) => {
    errorDiv.style.display = (e.target.value && !/^[\u0600-\u06FF\s]*$/.test(e.target.value)) ? 'block' : 'none';
    if (errorDiv.style.display === 'block') errorMsg.textContent = 'يجب أن يحتوي على أحرف عربية فقط';
  });
  document.getElementById('edit-class-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nameVal = classNameInput.value.trim();
    if (!nameVal) { errorDiv.style.display = 'block'; errorMsg.textContent = 'اسم الصف مطلوب'; return; }
    if (!/^[\u0600-\u06FF\s]+$/.test(nameVal)) { errorDiv.style.display = 'block'; errorMsg.textContent = 'يجب أن يحتوي على أحرف عربية فقط'; return; }
    try { await adminApi.put(`/api/classes/${id}`, { name: nameVal }); modal.remove(); router.navigate('/admin/classes'); showAlert('تم تحديث الصف بنجاح!'); }
    catch (error) { errorDiv.style.display = 'block'; errorMsg.textContent = error.message; }
  });
};

window.deleteClass = async function (id, name) {
  const confirmed = await showConfirmModal('حذف الصف الدراسي', `<p>هل أنت متأكد من حذف "<strong>${escapeHtml(name)}</strong>"؟</p><p style="color: #ef4444; margin-top: 0.5rem; font-size: 0.9rem;"><i class="fas fa-exclamation-triangle"></i> سيتم حذف جميع الوحدات والدروس التابعة لهذا الصف.</p>`);
  if (!confirmed) return;
  try { await adminApi.delete(`/api/classes/${id}`); router.navigate('/admin/classes'); showAlert('تم حذف الصف بنجاح!'); }
  catch (error) { showAlert(error.message, 'error'); }
};

window.showClassTermModal = async function (classId, className) {
  const modal = document.createElement('div');
  modal.className = 'modal active';
  modal.innerHTML = `<div class="modal-content" style="max-width: 800px;"><div class="modal-header"><h2><i class="fas fa-folder-open"></i> ${escapeHtml(className)}</h2><button type="button" class="modal-close" data-action="modal-close">×</button></div><div style="padding: 1.5rem;"><div style="text-align: center; padding: 2rem;"><i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: var(--primary-color);"></i></div></div></div>`;
  document.body.appendChild(modal);
  try {
    const allUnits = await adminApi.get('/api/units');
    const classUnits = allUnits.filter(u => u.class_id == classId);
    const term1Units = classUnits.filter(u => u.term == '1' || u.term == 1);
    const term2Units = classUnits.filter(u => u.term == '2' || u.term == 2);
    const renderUnitRow = (unit, termNum) => `
      <div class="units-modal-row" style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: #f8fafc; border-radius: 8px; margin-bottom: 0.5rem;">
        <span style="font-weight: 600;">${escapeHtml(unit.title || unit.title_ar)}</span>
        <div style="display: flex; gap: 0.5rem;">
          <button type="button" class="btn btn-primary" data-action="edit-unit" data-id="${unit.id}" data-title="${escapeHtml(unit.title || unit.title_ar).replace(/"/g, '&quot;')}" data-class-id="${unit.class_id}" data-category="${unit.category || 'P'}" data-term="${termNum}"><i class="fas fa-edit"></i> تعديل</button>
          <button type="button" class="btn btn-sm btn-danger" data-action="delete-unit" data-id="${unit.id}" data-title="${escapeHtml(unit.title || unit.title_ar).replace(/"/g, '&quot;')}"><i class="fas fa-trash"></i></button>
        </div>
      </div>`;
    const renderTermSection = (units, termLabel, termNum) => `
      <div style="margin-bottom: 1.5rem;">
        <h3 style="margin: 0 0 0.75rem 0; padding: 0.75rem 1rem; background: var(--gradient-primary); color: white; border-radius: 8px; font-size: 1rem;"><i class="fas fa-book-open"></i> ${termLabel}</h3>
        <div style="max-height: 200px; overflow-y: auto;">${units.length === 0 ? '<p style="text-align: center; color: var(--light-text); padding: 1rem;">لا توجد وحدات</p>' : units.map(u => renderUnitRow(u, termNum)).join('')}</div>
      </div>`;
    modal.querySelector('.modal-content').innerHTML = `
      <div class="modal-header"><h2><i class="fas fa-folder-open"></i> ${escapeHtml(className)}</h2><button type="button" class="modal-close" data-action="modal-close">×</button></div>
      <div style="padding: 1.5rem;">
        ${renderTermSection(term1Units, 'الفصل الأول', '1')}
        ${renderTermSection(term2Units, 'الفصل الثاني', '2')}
        <div style="text-align: center; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-color);">
          <button type="button" class="btn btn-primary" data-action="show-create-unit"><i class="fas fa-plus"></i> إنشاء وحدة جديدة</button>
        </div>
      </div>`;
  } catch (error) {
    modal.querySelector('.modal-content').innerHTML = `<div class="modal-header"><h2>${escapeHtml(className)}</h2><button type="button" class="modal-close" data-action="modal-close">×</button></div><div style="padding: 2rem; text-align: center; color: #ef4444;"><i class="fas fa-exclamation-circle"></i> خطأ في تحميل الوحدات</div>`;
  }
};

router.on('/admin/units', async () => {
  try {
    const identity = getIdentity();
    document.title = `إدارة الوحدات - ${identity.platformLabel || 'المنصة التعليمية'}`;
    const [classes, allUnits, lessons] = await Promise.all([adminApi.get('/api/classes'), adminApi.get('/api/units'), adminApi.get('/api/lessons')]);
    window.availableClasses = classes;
    const totalUnits = allUnits.length;
    const term1Count = allUnits.filter(u => u.term == '1' || u.term == 1).length;
    const term2Count = allUnits.filter(u => u.term == '2' || u.term == 2).length;
    const classOptions = classes.map(c => `<option value="${c.id}">${escapeHtml(c.name || c.name_ar)}</option>`).join('');
    const renderUnitRow = (unit, cls) => {
      const termNum = unit.term || '1';
      const unitLessons = lessons.filter(l => l.unit_id == unit.id);
      const titleAttr = escapeHtml(unit.title || unit.title_ar).replace(/"/g, '&quot;');
      return `
        <tr class="units-table-row" data-id="${unit.id}" data-class-id="${cls.id}" data-term="${termNum}" data-title="${escapeHtml(unit.title || unit.title_ar).toLowerCase()}">
          <td style="padding: 0.75rem 1rem;"><div style="display: flex; align-items: center; gap: 0.75rem;"><i class="fas fa-grip-vertical" style="color: var(--text-light); cursor: grab;" title="اسحب للترتيب"></i><span style="font-weight: 700;">${escapeHtml(unit.title || unit.title_ar)}</span></div></td>
          <td style="padding: 0.75rem 1rem;"><span class="unit-term-badge unit-term-${termNum}">الفصل ${termNum == '1' ? 'الأول' : 'الثاني'}</span></td>
          <td style="text-align: center; padding: 0.75rem 1rem;"><a href="/admin/lessons?unitId=${unit.id}" class="unit-lessons-link" data-navigate="true"><span class="unit-lessons-count">${unitLessons.length} دروس</span></a></td>
          <td style="padding: 0.75rem 1rem;">
            <div class="table-actions">
              <button type="button" class="btn btn-primary btn-sm" data-action="edit-unit" data-id="${unit.id}" data-title="${titleAttr}" data-class-id="${unit.class_id}" data-category="${unit.category || 'P'}" data-term="${termNum}"><i class="fas fa-edit"></i> تعديل</button>
              <button type="button" class="btn btn-sm btn-danger" data-action="delete-unit" data-id="${unit.id}" data-title="${titleAttr}"><i class="fas fa-trash"></i></button>
            </div>
          </td>
        </tr>`;
    };
    const renderUnitsByClass = () => {
      if (classes.length === 0) return '<div class="empty-state" style="padding: 4rem; text-align: center;"><i class="fas fa-book-open" style="font-size: 3rem; color: #cbd5e1; margin-bottom: 1rem;"></i><p>لا توجد صفوف دراسية. قم بإنشاء صف أولاً!</p></div>';
      return classes.map(cls => {
        const classUnits = allUnits.filter(u => u.class_id == cls.id);
        if (classUnits.length === 0) return '';
        return `
          <div class="units-class-section" data-class-id="${cls.id}">
            <div class="units-class-section-header"><h3>${escapeHtml(cls.name || cls.name_ar)}</h3><span class="units-class-meta">${classUnits.length} وحدة · ${lessons.filter(l => classUnits.some(u => u.id == l.unit_id)).length} درس</span></div>
            <div class="units-table-wrap">
              <table class="units-table">
                <thead><tr><th>عنوان الوحدة</th><th>الفصل</th><th>محتويات</th><th>تحكم</th></tr></thead>
                <tbody class="sortable-units-body" data-class-id="${cls.id}">${classUnits.map(u => renderUnitRow(u, cls)).join('')}</tbody>
              </table>
            </div>
          </div>`;
      }).filter(html => html).join('');
    };
    const unitsContent = renderUnitsByClass() || '<div class="empty-state" style="padding: 5rem; text-align: center; background: white; border-radius: 20px;"><p style="font-size: 1.25rem; color: #94a3b8;">لا توجد وحدات. قم بإضافة وحدات جديدة!</p></div>';
    app.innerHTML = adminLayout(`
      <div class="admin-header"><h1>إدارة الوحدات</h1><button type="button" class="btn btn-primary" data-action="show-create-unit"><i class="fas fa-plus"></i> إنشاء وحدة جديدة</button></div>
      <div class="admin-content" style="max-width: 1400px; margin: 0 auto;">
        <div class="stats-grid stats-grid-compact" style="margin-bottom: 1.5rem;">
          <div class="stat-card stat-card-compact"><h3>إجمالي الوحدات</h3><div class="number">${totalUnits}</div></div>
          <div class="stat-card stat-card-compact"><h3>إجمالي الصفوف</h3><div class="number">${classes.length}</div></div>
          <div class="stat-card stat-card-compact"><h3>وحدات الفصل الأول</h3><div class="number">${term1Count}</div></div>
          <div class="stat-card stat-card-compact"><h3>وحدات الفصل الثاني</h3><div class="number">${term2Count}</div></div>
        </div>
        <div class="admin-filter-bar">
          <div class="units-search-container"><i class="fas fa-search"></i><input type="text" id="units-search-input" class="units-search-input" placeholder="البحث في عناوين الوحدات (أدخل 3 أحرف على الأقل)..."></div>
          <div style="display: flex; gap: 0.75rem; align-items: center;">
            <span style="font-weight: 700; color: #475569; font-size: 0.95rem;">تصفية:</span>
            <select id="filter-class"><option value="">جميع الصفوف</option>${classOptions}</select>
            <select id="filter-term"><option value="">جميع الفصول</option><option value="1">الفصل الأول</option><option value="2">الفصل الثاني</option></select>
          </div>
          <button type="button" class="btn btn-sm" style="background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; padding: 0.7rem 1rem; border-radius: 10px;" data-action="reset-units-filters"><i class="fas fa-undo"></i> إعادة ضبط</button>
        </div>
        <div id="units-dashboard-list">${unitsContent}</div>
      </div>
    `, 'units');
    initCustomSelects();
    setTimeout(() => {
      document.querySelectorAll('.sortable-units-body').forEach(el => {
        if (window.Sortable) {
          new Sortable(el, {
            animation: 150, handle: '.fa-grip-vertical', ghostClass: 'sortable-ghost',
            onEnd: async function () {
              const ids = Array.from(el.children).map(child => parseInt(child.getAttribute('data-id'))).filter(id => !isNaN(id));
              try { await adminApi.post('/api/units/reorder', { order: ids }); showAlert('تم تحديث الترتيب بنجاح'); }
              catch (e) { showAlert('فشل تحديث الترتيب', 'error'); }
            }
          });
        }
      });
      const params = new URLSearchParams(window.location.search);
      const classIdUrl = params.get('classId');
      const termUrl = params.get('term');
      if (classIdUrl || termUrl) {
        const classSelector = document.getElementById('filter-class');
        const termSelector = document.getElementById('filter-term');
        if (classIdUrl && classSelector) classSelector.value = classIdUrl;
        if (termUrl && termSelector) termSelector.value = termUrl;
        filterUnitsDashboard();
      }
      const filterClassEl = document.getElementById('filter-class');
      const filterTermEl = document.getElementById('filter-term');
      const searchInput = document.getElementById('units-search-input');
      if (filterClassEl) filterClassEl.addEventListener('change', filterUnitsDashboard);
      if (filterTermEl) filterTermEl.addEventListener('change', filterUnitsDashboard);
      if (searchInput) searchInput.addEventListener('input', filterUnitsDashboard);
    }, 150);
  } catch (error) {
    app.innerHTML = adminLayout(`<div class="alert alert-error">حدث خطأ أثناء تحميل الوحدات: ${error.message}</div>`, 'units');
  }
});

window.filterUnitsDashboard = function () {
  const searchTerm = document.getElementById('units-search-input')?.value?.toLowerCase() || '';
  const classFilter = document.getElementById('filter-class')?.value || '';
  const termFilter = document.getElementById('filter-term')?.value || '';
  document.querySelectorAll('.units-class-section').forEach(section => {
    const sectionClassId = section.getAttribute('data-class-id');
    let visibleRowsCount = 0;
    section.querySelectorAll('.units-table-row').forEach(row => {
      const matches = (searchTerm.length < 3 || row.getAttribute('data-title').includes(searchTerm)) && (!classFilter || row.getAttribute('data-class-id') === classFilter) && (!termFilter || row.getAttribute('data-term') === termFilter);
      row.style.display = matches ? '' : 'none';
      if (matches) visibleRowsCount++;
    });
    section.style.display = (visibleRowsCount > 0 && (!classFilter || sectionClassId === classFilter)) ? 'block' : 'none';
  });
};

window.resetUnitsFilters = function () {
  const searchInput = document.getElementById('units-search-input');
  const classSelect = document.getElementById('filter-class');
  const termSelect = document.getElementById('filter-term');
  if (searchInput) searchInput.value = '';
  if (classSelect) classSelect.value = '';
  if (termSelect) termSelect.value = '';
  filterUnitsDashboard();
};

window.showCreateUnitForm = async function (preSelectedClassId = null, preSelectedTerm = null) {
  let classes = window.availableClasses;
  if (!classes || classes.length === 0) {
    try { classes = await adminApi.get('/api/classes'); window.availableClasses = classes; }
    catch (e) { classes = []; }
  }
  const classOptions = classes.map(cls => `<option value="${cls.id}" ${preSelectedClassId == cls.id ? 'selected' : ''}>${escapeHtml(cls.name || cls.name_ar)}</option>`).join('');
  const modal = document.createElement('div');
  modal.className = 'modal active';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header"><h2>إضافة وحدة دراسية جديدة</h2><button type="button" class="modal-close" data-action="modal-close">×</button></div>
      <form id="create-unit-form">
        <div class="form-group"><label for="unit-title">عنوان الوحدة *</label><input type="text" id="unit-title" required autofocus placeholder="مثال: الوحدة الأولى" dir="rtl"><small style="color: #666;">يرجى إدخال عنوان الوحدة بالأحرف العربية فقط</small></div>
        <div class="form-group"><label for="unit-class">الصف الدراسي *</label><select id="unit-class" required ${preSelectedClassId ? 'disabled' : ''}><option value="">اختر صفا دراسيا...</option>${classOptions}</select>${preSelectedClassId ? `<input type="hidden" id="unit-class-hidden" value="${preSelectedClassId}">` : ''}</div>
        <div class="form-group"><label for="unit-term">الترم الدراسي *</label><select id="unit-term" required ${preSelectedTerm ? 'disabled' : ''}><option value="">اختر الترم...</option><option value="1" ${preSelectedTerm == '1' ? 'selected' : ''}>الترم الأول</option><option value="2" ${preSelectedTerm == '2' ? 'selected' : ''}>الترم الثاني</option></select>${preSelectedTerm ? `<input type="hidden" id="unit-term-hidden" value="${preSelectedTerm}">` : ''}</div>
        <div style="color: #ef4444; margin: 1rem 0; padding: 0.75rem; background: #fee2e2; border-radius: 4px; display: none;" id="unit-error"><i class="fas fa-exclamation-circle"></i> <span id="unit-error-msg"></span></div>
        <div class="btn-group"><button type="submit" class="btn btn-success">حفظ الوحدة</button><button type="button" class="btn btn-secondary" data-action="modal-close">إلغاء</button></div>
      </form>
    </div>`;
  document.body.appendChild(modal);
  const titleInput = document.getElementById('unit-title');
  const errorDiv = document.getElementById('unit-error');
  const errorMsg = document.getElementById('unit-error-msg');
  titleInput.addEventListener('input', (e) => {
    errorDiv.style.display = (e.target.value && !/^[\u0600-\u06FF\s]*$/.test(e.target.value)) ? 'block' : 'none';
    if (errorDiv.style.display === 'block') errorMsg.textContent = 'يجب أن يحتوي على أحرف عربية فقط';
  });
  document.getElementById('create-unit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = titleInput.value.trim();
    const classId = preSelectedClassId || document.getElementById('unit-class').value;
    const term = preSelectedTerm || document.getElementById('unit-term').value;
    if (!title) { errorDiv.style.display = 'block'; errorMsg.textContent = 'عنوان الوحدة مطلوب'; return; }
    if (!classId) { errorDiv.style.display = 'block'; errorMsg.textContent = 'الصف الدراسي مطلوب'; return; }
    if (!term) { errorDiv.style.display = 'block'; errorMsg.textContent = 'الترم الدراسي مطلوب'; return; }
    if (!/^[\u0600-\u06FF\s]+$/.test(title)) { errorDiv.style.display = 'block'; errorMsg.textContent = 'يجب أن يحتوي على أحرف عربية فقط'; return; }
    try { await adminApi.post('/api/units', { title, class_id: classId, category: 'P', term }); modal.remove(); router.navigate(`/admin/units?classId=${classId}&term=${term}`); showAlert('تم إضافة الوحدة بنجاح!'); }
    catch (error) { errorDiv.style.display = 'block'; errorMsg.textContent = error.message; }
  });
};

window.editUnit = function (id, title, classId, category = 'P', term = '1') {
  const classOptions = window.availableClasses.map(cls => `<option value="${cls.id}" ${cls.id === classId ? 'selected' : ''}>${escapeHtml(cls.name || cls.name_ar)}</option>`).join('');
  const modal = document.createElement('div');
  modal.className = 'modal active';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header"><h2>تعديل الوحدة</h2><button type="button" class="modal-close" data-action="modal-close">×</button></div>
      <form id="edit-unit-form">
        <div class="form-group"><label for="edit-unit-title">عنوان الوحدة *</label><input type="text" id="edit-unit-title" value="${escapeHtml(title || '')}" required autofocus dir="rtl"></div>
        <div class="form-group"><label for="edit-unit-class">الصف الدراسي *</label><select id="edit-unit-class" required>${classOptions}</select></div>
        <div class="form-group"><label for="edit-unit-term">الترم الدراسي *</label><select id="edit-unit-term" required><option value="1" ${term == '1' ? 'selected' : ''}>الترم الأول</option><option value="2" ${term == '2' ? 'selected' : ''}>الترم الثاني</option></select></div>
        <div style="color: #ef4444; margin: 1rem 0; padding: 0.75rem; background: #fee2e2; border-radius: 4px; display: none;" id="edit-unit-error"><i class="fas fa-exclamation-circle"></i> <span id="edit-unit-error-msg"></span></div>
        <div class="btn-group"><button type="submit" class="btn btn-primary">حفظ التغييرات</button><button type="button" class="btn btn-secondary" data-action="modal-close">إلغاء</button></div>
      </form>
    </div>`;
  document.body.appendChild(modal);
  const titleInput = document.getElementById('edit-unit-title');
  const errorDiv = document.getElementById('edit-unit-error');
  const errorMsg = document.getElementById('edit-unit-error-msg');
  titleInput.addEventListener('input', (e) => {
    errorDiv.style.display = (e.target.value && !/^[\u0600-\u06FF\s]*$/.test(e.target.value)) ? 'block' : 'none';
    if (errorDiv.style.display === 'block') errorMsg.textContent = 'يجب أن يحتوي على أحرف عربية فقط';
  });
  document.getElementById('edit-unit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const titleVal = titleInput.value.trim();
    const classIdVal = document.getElementById('edit-unit-class').value;
    const termVal = document.getElementById('edit-unit-term').value;
    if (!titleVal) { errorDiv.style.display = 'block'; errorMsg.textContent = 'عنوان الوحدة مطلوب'; return; }
    if (!/^[\u0600-\u06FF\s]+$/.test(titleVal)) { errorDiv.style.display = 'block'; errorMsg.textContent = 'يجب أن يحتوي على أحرف عربية فقط'; return; }
    try { await adminApi.put(`/api/units/${id}`, { title: titleVal, class_id: classIdVal, category: 'P', term: termVal }); modal.remove(); router.navigate(`/admin/units?classId=${classIdVal}`); showAlert('تم تحديث الوحدة بنجاح!'); }
    catch (error) { errorDiv.style.display = 'block'; errorMsg.textContent = error.message; }
  });
};

window.deleteUnit = async function (id, title) {
  const confirmed = await showConfirmModal('حذف الوحدة الدراسية', `<p>هل أنت متأكد من حذف "<strong>${escapeHtml(title)}</strong>"؟</p><p style="color: #ef4444; margin-top: 0.5rem; font-size: 0.9rem;"><i class="fas fa-exclamation-triangle"></i> سيتم حذف جميع الدروس التابعة لهذه الوحدة.</p>`);
  if (!confirmed) return;
  try {
    await adminApi.delete(`/api/units/${id}`);
    const params = new URLSearchParams(window.location.search);
    const classId = params.get('classId');
    router.navigate(classId ? `/admin/units?classId=${classId}` : '/admin/units');
    showAlert('تم حذف الوحدة بنجاح!');
  } catch (error) { showAlert(error.message, 'error'); }
};

router.on('/admin/lessons', async () => {
  try {
    const params = new URLSearchParams(window.location.search);
    const unitIdUrl = params.get('unitId');
    const identity = getIdentity();
    document.title = `إدارة الدروس - ${identity.platformLabel || 'المنصة التعليمية'}`;
    const [lessons, units, classes] = await Promise.all([adminApi.get('/api/lessons'), adminApi.get('/api/units'), adminApi.get('/api/classes')]);
    window.availableUnits = units;
    window.availableClasses = classes;
    const classOptions = classes.map(c => `<option value="${c.id}">${escapeHtml(c.name || c.name_ar)}</option>`).join('');
    const renderLessonRow = (lesson) => {
      const termNum = lesson.term || '1';
      return `
        <tr class="lessons-table-row" data-id="${lesson.id}" data-class-id="${lesson.class_id}" data-unit-id="${lesson.unit_id}" data-term="${termNum}" data-title="${escapeHtml(lesson.title || lesson.title_ar).toLowerCase()}">
          <td><span class="lesson-title-cell">${escapeHtml(lesson.title || lesson.title_ar)}</span></td>
          <td><span class="lesson-unit-badge">${escapeHtml(lesson.unit_title)}</span></td>
          <td><span class="unit-term-badge unit-term-${termNum}">الفصل ${termNum == '1' ? 'الأول' : 'الثاني'}</span></td>
          <td>
            <div class="table-actions">
              <button type="button" class="btn btn-sm btn-primary" data-action="edit-lesson" data-id="${lesson.id}"><i class="fas fa-edit"></i> تعديل</button>
              <button type="button" class="btn btn-sm btn-info" data-action="manage-questions" data-id="${lesson.id}" data-title="${escapeHtml((lesson.title || lesson.title_ar)).replace(/"/g, '&quot;')}"><i class="fas fa-question-circle"></i> الأسئلة</button>
              <button type="button" class="btn btn-sm btn-danger" data-action="delete-lesson" data-id="${lesson.id}" data-title="${escapeHtml((lesson.title || lesson.title_ar)).replace(/"/g, '&quot;')}"><i class="fas fa-trash"></i></button>
            </div>
          </td>
        </tr>`;
    };
    const renderLessonsByClass = () => {
      if (classes.length === 0) return '';
      return classes.map(cls => {
        const classLessons = lessons.filter(l => l.class_id == cls.id);
        if (classLessons.length === 0) return '';
        return `
          <div class="lessons-class-section" data-class-id="${cls.id}">
            <div class="units-class-section-header"><h3>${escapeHtml(cls.name || cls.name_ar)}</h3><span class="units-class-meta">${classLessons.length} درس</span></div>
            <div class="units-table-wrap">
              <table class="units-table lessons-table">
                <thead><tr><th>عنوان الدرس</th><th>الوحدة</th><th>الفصل</th><th>تحكم</th></tr></thead>
                <tbody>${classLessons.map(renderLessonRow).join('')}</tbody>
              </table>
            </div>
          </div>`;
      }).join('');
    };
    const lessonsContent = renderLessonsByClass() || '<div class="empty-state" style="padding: 5rem; text-align: center; background: white; border-radius: 20px;"><p style="font-size: 1.25rem; color: #94a3b8;">لا توجد دروس مطابقة. قم بإضافة دروس جديدة!</p></div>';
    app.innerHTML = adminLayout(`
      <div class="admin-header"><h1>إدارة الدروس</h1><button type="button" class="btn btn-primary" data-action="show-create-lesson"><i class="fas fa-plus"></i> إنشاء درس جديد</button></div>
      <div class="admin-content" style="max-width: 1400px; margin: 0 auto;">
        <div class="admin-filter-bar">
          <div class="units-search-container"><i class="fas fa-search"></i><input type="text" id="lessons-search-input" class="units-search-input" placeholder="البحث في عناوين الدروس (3 أحرف على الأقل)..."></div>
          <div style="display: flex; gap: 0.75rem; align-items: center;">
            <span style="font-weight: 700; color: #475569; font-size: 0.95rem;">تصفية:</span>
            <select id="filter-lesson-class"><option value="">جميع الصفوف</option>${classOptions}</select>
            <select id="filter-lesson-term"><option value="">جميع الفصول</option><option value="1">الفصل الأول</option><option value="2">الفصل الثاني</option></select>
          </div>
          <button type="button" class="btn btn-sm" style="background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; padding: 0.7rem 1rem; border-radius: 10px;" data-action="reset-lessons-filters"><i class="fas fa-undo"></i> إعادة ضبط</button>
        </div>
        <div id="lessons-dashboard-list">${lessonsContent}</div>
      </div>
    `, 'lessons');
    initCustomSelects();
    setTimeout(() => {
      if (unitIdUrl) {
        const unit = units.find(u => u.id == unitIdUrl);
        if (unit) {
          const classSelector = document.getElementById('filter-lesson-class');
          const termSelector = document.getElementById('filter-lesson-term');
          if (classSelector) classSelector.value = unit.class_id;
          if (termSelector) termSelector.value = unit.term;
          filterLessonsDashboard();
        }
      }
      const searchInput = document.getElementById('lessons-search-input');
      const filterClassEl = document.getElementById('filter-lesson-class');
      const filterTermEl = document.getElementById('filter-lesson-term');
      if (searchInput) searchInput.addEventListener('input', filterLessonsDashboard);
      if (filterClassEl) filterClassEl.addEventListener('change', filterLessonsDashboard);
      if (filterTermEl) filterTermEl.addEventListener('change', filterLessonsDashboard);
    }, 100);
  } catch (error) {
    app.innerHTML = adminLayout(`<div class="alert alert-error">حدث خطأ أثناء تحميل الدروس</div>`, 'lessons');
  }
});

router.on('/admin/settings', async () => {
  try {
    let identity;
    try { identity = await adminApi.get('/api/settings/identity'); if (identity) window.APP_IDENTITY = identity; }
    catch (_) { identity = getIdentity(); }
    const platformLabel = identity.platformLabel || 'المنصة التعليمية';
    const schoolName = identity.schoolName || '';
    document.title = `إعدادات المدرسة - ${schoolName ? `${platformLabel} - ${schoolName}` : platformLabel}`;
    app.innerHTML = adminLayout(`
      <div class="admin-header"><h1>إعدادات هوية المدرسة</h1><p>تحديث اسم المدرسة وطريقة ظهور النظام التعليمي للطلاب</p></div>
      <div class="admin-content">
        <form id="school-identity-form" class="admin-form">
          <div class="form-group"><label for="school-name"><i class="fas fa-school"></i> اسم المدرسة *</label><input type="text" id="school-name" required value="${escapeHtml(identity.schoolName || '')}" dir="rtl" /></div>
          <div class="form-group"><label for="platform-label"><i class="fas fa-graduation-cap"></i> اسم المنصة *</label><input type="text" id="platform-label" required value="${escapeHtml(identity.platformLabel || 'المنصة التعليمية')}" dir="rtl" /></div>
          <div class="form-group"><label for="admin-name"><i class="fas fa-users-cog"></i> جهة الإدارة المعروضة *</label><input type="text" id="admin-name" required value="${escapeHtml(identity.adminName || 'إدارة المدرسة')}" dir="rtl" /></div>
          <div class="form-group"><label for="admin-role"><i class="fas fa-id-badge"></i> وصف جهة الإدارة *</label><input type="text" id="admin-role" required value="${escapeHtml(identity.adminRole || 'مسؤول النظام التعليمي')}" dir="rtl" /></div>
          <div id="settings-error" class="alert alert-error" style="display: none; margin-top: 1rem;"></div>
          <div class="btn-group"><button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> حفظ الإعدادات</button></div>
        </form>
      </div>
    `, 'settings');
    document.getElementById('school-identity-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const errorDiv = document.getElementById('settings-error');
      errorDiv.style.display = 'none';
      const schoolNameInput = document.getElementById('school-name').value.trim();
      const platformLabelInput = document.getElementById('platform-label').value.trim();
      const adminNameInput = document.getElementById('admin-name').value.trim();
      const adminRoleInput = document.getElementById('admin-role').value.trim();
      if (!schoolNameInput || !platformLabelInput || !adminNameInput || !adminRoleInput) { errorDiv.style.display = 'block'; errorDiv.textContent = 'جميع الحقول مطلوبة'; return; }
      try {
        const updated = await adminApi.put('/api/settings/identity', { schoolName: schoolNameInput, platformLabel: platformLabelInput, adminName: adminNameInput, adminRole: adminRoleInput });
        if (updated) window.APP_IDENTITY = updated;
        showAlert('تم تحديث إعدادات المدرسة بنجاح!');
        router.navigate('/admin/settings');
      } catch (error) { errorDiv.style.display = 'block'; errorDiv.textContent = error.message || 'فشل تحديث الإعدادات'; }
    });
  } catch (error) {
    app.innerHTML = adminLayout(`<div class="alert alert-error">فشل تحميل إعدادات المدرسة</div>`, 'settings');
  }
});

window.filterLessonsDashboard = function () {
  const searchTerm = document.getElementById('lessons-search-input')?.value?.toLowerCase() || '';
  const classFilter = document.getElementById('filter-lesson-class')?.value || '';
  const termFilter = document.getElementById('filter-lesson-term')?.value || '';
  document.querySelectorAll('.lessons-class-section').forEach(section => {
    const sectionClassId = section.getAttribute('data-class-id');
    let visibleRowsCount = 0;
    section.querySelectorAll('.lessons-table-row').forEach(row => {
      const matches = (searchTerm.length < 3 || row.getAttribute('data-title').includes(searchTerm)) && (!classFilter || row.getAttribute('data-class-id') === classFilter) && (!termFilter || row.getAttribute('data-term') === termFilter);
      row.style.display = matches ? '' : 'none';
      if (matches) visibleRowsCount++;
    });
    section.style.display = (visibleRowsCount > 0 && (!classFilter || sectionClassId === classFilter)) ? 'block' : 'none';
  });
};

window.resetLessonsFilters = function () {
  const searchInput = document.getElementById('lessons-search-input');
  const classSelect = document.getElementById('filter-lesson-class');
  const termSelect = document.getElementById('filter-lesson-term');
  if (searchInput) searchInput.value = '';
  if (classSelect) classSelect.value = '';
  if (termSelect) termSelect.value = '';
  filterLessonsDashboard();
};

window.showCreateLessonForm = async function () {
  let classes = window.availableClasses;
  let allUnits = window.availableUnits;
  if (!classes || !allUnits) {
    try {
      const [c, u] = await Promise.all([adminApi.get('/api/classes'), adminApi.get('/api/units')]);
      classes = c; allUnits = u;
      window.availableClasses = classes; window.availableUnits = allUnits;
    } catch (e) { classes = classes || []; allUnits = allUnits || []; }
  }
  classes = classes || []; allUnits = allUnits || [];
  const classOptions = classes.map(c => `<option value="${c.id}">${escapeHtml(c.name || c.name_ar)}</option>`).join('');
  const modal = document.createElement('div');
  modal.className = 'modal active';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header"><h2>إضافة درس جديد</h2><button type="button" class="modal-close" data-action="modal-close">×</button></div>
      <form id="create-lesson-form">
        <div class="form-group"><label for="lesson-term">الفصل الدراسي *</label><select id="lesson-term" required><option value="">اختر الفصل...</option><option value="1">الفصل الأول</option><option value="2">الفصل الثاني</option></select></div>
        <div class="form-group"><label for="lesson-class">الصف الدراسي *</label><select id="lesson-class" required><option value="">اختر الصف...</option>${classOptions}</select></div>
        <div class="form-group"><label for="lesson-unit">الوحدة الدراسية *</label><select id="lesson-unit" class="native-select" required><option value="">اختر الفصل والصف أولاً...</option></select></div>
        <div class="form-group"><label for="lesson-title">عنوان الدرس *</label><input type="text" id="lesson-title" required placeholder="مثال: درس الفيزياء" dir="rtl"><small style="color: #666;">يرجى إدخال عنوان الدرس بالأحرف العربية فقط</small></div>
        <div class="form-group"><label><i class="fab fa-youtube"></i> الفيديوهات (اختياري)</label><div id="videos-container"></div><button type="button" class="btn btn-secondary btn-sm" data-action="add-video-field">+ إضافة فيديو</button></div>
        <div class="form-group"><label><i class="fas fa-image"></i> الصور (اختياري)</label><div id="images-container"></div><button type="button" class="btn btn-secondary btn-sm" data-action="add-image-field">+ إضافة صورة</button></div>
        <div class="form-group"><label><i class="fas fa-file-alt"></i> الملفات المرفقة (PDF / PPTX) (اختياري)</label><div id="files-container"></div><button type="button" class="btn btn-secondary btn-sm" data-action="add-file-field">+ إضافة ملف</button><small style="color: #64748b; display: block; margin-top: 0.5rem;">رفع ملفات بصيغة PDF أو مسودات PowerPoint مع عنوان ووصف.</small></div>
        <div style="color: #ef4444; margin: 1rem 0; padding: 0.75rem; background: #fee2e2; border-radius: 4px; display: none;" id="lesson-error"><i class="fas fa-exclamation-circle"></i> <span id="lesson-error-msg"></span></div>
        <div class="btn-group"><button type="submit" class="btn btn-success">حفظ الدرس</button><button type="button" class="btn btn-secondary" data-action="modal-close">إلغاء</button></div>
      </form>
    </div>`;
  document.body.appendChild(modal);
  const termSelect = document.getElementById('lesson-term');
  const classSelect = document.getElementById('lesson-class');
  const unitSelect = document.getElementById('lesson-unit');
  const titleInput = document.getElementById('lesson-title');
  const errorDiv = document.getElementById('lesson-error');
  const errorMsg = document.getElementById('lesson-error-msg');
  const unitsForForm = allUnits.length ? allUnits : (window.availableUnits || []);
  function updateUnitOptions() {
    const term = termSelect?.value || '';
    const classId = classSelect?.value || '';
    if (!term || !classId) { unitSelect.innerHTML = '<option value="">اختر الفصل والصف أولاً...</option>'; return; }
    const filtered = unitsForForm.filter(u => String(u.term || '1').trim() === String(term).trim() && Number(u.class_id) === Number(classId));
    unitSelect.innerHTML = '<option value="">اختر وحدة دراسية...</option>';
    filtered.forEach(unit => { const opt = document.createElement('option'); opt.value = unit.id; opt.textContent = escapeHtml(unit.title || unit.title_ar); unitSelect.appendChild(opt); });
    if (filtered.length === 0) unitSelect.innerHTML = '<option value="">لا توجد وحدات في هذا الفصل والصف</option>';
  }
  if (termSelect) termSelect.addEventListener('change', updateUnitOptions);
  if (classSelect) classSelect.addEventListener('change', updateUnitOptions);
  setTimeout(updateUnitOptions, 0);
  titleInput.addEventListener('input', (e) => {
    errorDiv.style.display = (e.target.value && !/^[\u0600-\u06FF\s]*$/.test(e.target.value)) ? 'block' : 'none';
    if (errorDiv.style.display === 'block') errorMsg.textContent = 'يجب أن يحتوي على أحرف عربية فقط';
  });
  window.videoFieldCount = 0; window.imageFieldCount = 0; window.fileFieldCount = 0;
  addVideoField(); addFileField();
  document.getElementById('create-lesson-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = titleInput.value.trim();
    const unitId = document.getElementById('lesson-unit').value;
    if (!title) { errorDiv.style.display = 'block'; errorMsg.textContent = 'عنوان الدرس مطلوب'; return; }
    if (!unitId) { errorDiv.style.display = 'block'; errorMsg.textContent = 'الوحدة الدراسية مطلوبة'; return; }
    if (!/^[\u0600-\u06FF\s]+$/.test(title)) { errorDiv.style.display = 'block'; errorMsg.textContent = 'يجب أن يحتوي على أحرف عربية فقط'; return; }
    try {
      const videos = [];
      document.querySelectorAll('#videos-container [data-video-index]').forEach(el => {
        const url = el.querySelector('input[type="url"]').value;
        if (url) videos.push({ video_url: url, video_position: el.querySelector('select[name="position"]').value, video_size: 'medium', video_explanation: el.querySelector('textarea').value });
      });
      const images = [];
      document.querySelectorAll('#images-container [data-image-index]').forEach(el => {
        const imagePath = el.getAttribute('data-image-path');
        if (imagePath) images.push({ image_path: imagePath, image_position: el.querySelector('select[name="image-position"]').value, image_size: 'medium', image_caption: el.querySelector('textarea').value });
      });
      const files = [];
      document.querySelectorAll('#files-container [data-file-index]').forEach(el => {
        const url = el.querySelector('.file-url-input').value;
        if (url) files.push({ url, file_type: el.querySelector('.file-type-input').value, title: el.querySelector('.file-title-input').value, description: el.querySelector('.file-desc-input').value });
      });
      await adminApi.post('/api/lessons', { title, unit_id: unitId, content: '', videos, images, files });
      modal.remove(); router.navigate('/admin/lessons'); showAlert('تم إضافة الدرس بنجاح!');
    } catch (error) { errorDiv.style.display = 'block'; errorMsg.textContent = error.message; }
  });
};

window.addVideoField = function () {
  const container = document.getElementById('videos-container');
  if (!container) return;
  const index = window.videoFieldCount++;
  const videoField = document.createElement('div');
  videoField.setAttribute('data-video-index', index);
  videoField.style.cssText = 'background: #f8fafc; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; border: 1px solid #e2e8f0;';
  videoField.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;"><label style="font-weight: 600;">الفيديو ${index + 1}</label><button type="button" class="btn btn-danger btn-xs" data-action="remove-video-block">حذف</button></div>
    <input type="url" placeholder="https://www.youtube.com/watch?v=..." style="width: 100%; padding: 0.5rem; margin-bottom: 0.5rem; border: 1px solid #e2e8f0; border-radius: 4px;">
    <select name="position" style="padding: 0.5rem; border: 1px solid #e2e8f0; border-radius: 4px; margin-bottom: 0.5rem;"><option value="bottom">أسفل الفيديو</option><option value="top">أعلى الفيديو</option><option value="side">بجانب الفيديو</option></select>
    <textarea placeholder="شرح هذا الفيديو..." style="width: 100%; padding: 0.5rem; border: 1px solid #e2e8f0; border-radius: 4px; min-height: 60px; resize: vertical;"></textarea>`;
  container.appendChild(videoField);
};

window.addImageField = function (imagePath = '', position = 'bottom', size = 'medium', caption = '') {
  const container = document.getElementById('images-container');
  if (!container) return;
  const index = window.imageFieldCount++;
  const imageField = document.createElement('div');
  imageField.setAttribute('data-image-index', index);
  imageField.setAttribute('data-image-path', imagePath);
  imageField.style.cssText = 'background: #f8fafc; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; border: 1px solid #e2e8f0;';
  imageField.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;"><label style="font-weight: 600;">الصورة ${index + 1}</label><button type="button" class="btn btn-danger btn-xs" data-action="remove-image-block">حذف</button></div>
    ${imagePath ? `<div style="background: white; padding: 0.5rem; border-radius: 4px; margin-bottom: 0.5rem; border: 1px solid #e2e8f0;"><img src="${imagePath}" style="max-width: 100%; max-height: 150px; border-radius: 4px;"></div>` : ''}
    <input type="file" accept="image/*" class="lesson-image-upload" style="width: 100%; padding: 0.5rem; margin-bottom: 0.5rem; border: 1px solid #e2e8f0; border-radius: 4px;">
    <select name="image-position" style="padding: 0.5rem; border: 1px solid #e2e8f0; border-radius: 4px; margin-bottom: 0.5rem;"><option value="bottom" ${position === 'bottom' ? 'selected' : ''}>أسفل الصورة</option><option value="top" ${position === 'top' ? 'selected' : ''}>أعلى الصورة</option><option value="side" ${position === 'side' ? 'selected' : ''}>بجانب الصورة</option></select>
    <textarea placeholder="نص توضيحي للصورة..." style="width: 100%; padding: 0.5rem; border: 1px solid #e2e8f0; border-radius: 4px; min-height: 60px; resize: vertical;">${escapeHtml(caption)}</textarea>`;
  container.appendChild(imageField);
};

window.uploadImage = async function (input) {
  const file = input.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { showAlert('الرجاء اختيار ملف صورة صحيح', 'error'); return; }
  const formData = new FormData();
  formData.append('image', file);
  try {
    const response = await fetch('/api/lessons/upload-image', { method: 'POST', body: formData });
    const data = await safeParseJson(response);
    if (!response.ok) throw new Error(data.error || 'فشل تحميل الصورة');
    const imageField = input.closest('[data-image-index]');
    imageField.setAttribute('data-image-path', data.imagePath);
    let preview = imageField.querySelector('div[style*="background: white"]');
    if (!preview) { preview = document.createElement('div'); preview.style.cssText = 'background: white; padding: 0.5rem; border-radius: 4px; margin-bottom: 0.5rem; border: 1px solid #e2e8f0;'; input.parentNode.insertBefore(preview, input.nextSibling); }
    preview.innerHTML = `<img src="${data.imagePath}" style="max-width: 100%; max-height: 150px; border-radius: 4px;">`;
    showAlert('تم رفع الصورة بنجاح!');
  } catch (error) { showAlert('خطأ في رفع الصورة: ' + error.message, 'error'); }
};

window.fileFieldCount = 0;
window.editFileFieldCount = 0;

window.addFileField = function (fileData = { file_type: 'pdf', url: '', title: '', description: '' }, isEdit = false) {
  const containerId = isEdit ? 'edit-files-container' : 'files-container';
  const container = document.getElementById(containerId);
  if (!container) return;
  const countVar = isEdit ? 'editFileFieldCount' : 'fileFieldCount';
  const index = window[countVar]++;
  const fieldId = `file-block-${Date.now()}-${index}`;
  const fileBlock = document.createElement('div');
  fileBlock.setAttribute('data-file-index', index);
  fileBlock.id = fieldId;
  fileBlock.style.cssText = 'background: #f8fafc; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; border: 1px solid #e2e8f0;';
  const currentUrl = fileData.url || '';
  fileBlock.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;"><label style="font-weight: 600;">الملف المرفق ${index + 1}</label><button type="button" class="btn btn-danger btn-xs" data-action="remove-file-block">حذف</button></div>
    <input type="text" placeholder="عنوان الملف (مثال: ملخص الوحدة)..." value="${escapeHtml(fileData.title || '')}" class="file-title-input" style="width: 100%; padding: 0.5rem; margin-bottom: 0.5rem; border: 1px solid #e2e8f0; border-radius: 4px;">
    <div class="file-upload-section" style="margin-bottom: 0.5rem;">
      ${currentUrl ? `<div style="margin-bottom: 0.5rem; font-size: 0.9em; background: #e2e8f0; padding: 0.5rem; border-radius: 4px;"><a href="${currentUrl}" target="_blank">عرض الملف الحالي</a> ✓</div>` : ''}
      <input type="file" class="lesson-file-upload" data-block-id="${fieldId}" style="width: 100%; padding: 0.5rem; border: 1px solid #e2e8f0; border-radius: 4px;">
      <input type="hidden" class="file-url-input" value="${currentUrl}">
      <input type="hidden" class="file-type-input" value="${escapeHtml(fileData.file_type || 'pdf')}">
      <div class="file-upload-status" style="margin-top: 0.5rem; font-weight: bold; font-size: 0.9em;"></div>
    </div>
    <textarea placeholder="وصف الملف..." class="file-desc-input" style="width: 100%; padding: 0.5rem; border: 1px solid #e2e8f0; border-radius: 4px; min-height: 40px; resize: vertical;">${escapeHtml(fileData.description || '')}</textarea>`;
  container.appendChild(fileBlock);
};

window.addEditFileField = function (url = '', file_type = 'pdf', title = '', description = '') {
  window.addFileField({ url, file_type, title, description }, true);
};

window.uploadFileAjax = async function (file, blockId) {
  const block = document.getElementById(blockId);
  if (!block) return;
  const statusDiv = block.querySelector('.file-upload-status');
  const urlInput = block.querySelector('.file-url-input');
  const typeInput = block.querySelector('.file-type-input');
  const titleInput = block.querySelector('.file-title-input');
  const ext = file.name.split('.').pop().toLowerCase();
  typeInput.value = ext || 'file';
  if (!titleInput.value) titleInput.value = file.name;
  statusDiv.textContent = 'جارٍ رفع الملف إلى السحابة...';
  statusDiv.style.color = '#eab308';
  try {
    const formData = new FormData();
    formData.append('file', file);
    const CLOUD_NAME = (window.APP_CONFIG && window.APP_CONFIG.CLOUDINARY_CLOUD_NAME) || 'YOUR_CLOUD_NAME';
    const UPLOAD_PRESET = (window.APP_CONFIG && window.APP_CONFIG.CLOUDINARY_UPLOAD_PRESET) || 'pdfuploader';
    const uploadUrl = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/raw/upload`;
    formData.append('upload_preset', UPLOAD_PRESET);
    const response = await fetch(uploadUrl, { method: 'POST', body: formData });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'فشل رفع الملف إلى السحابة');
    urlInput.value = data.secure_url;
    statusDiv.textContent = '✔ تم رفع الملف بنجاح!';
    statusDiv.style.color = '#10b981';
    showAlert('تم رفع الملف بنجاح!');
  } catch (error) {
    statusDiv.textContent = '❌ فشل الرفع: ' + error.message;
    statusDiv.style.color = '#ef4444';
    urlInput.value = '';
    showAlert('خطأ في رفع الملف: ' + error.message, 'error');
  }
};

window.editLesson = async function (id) {
  try {
    const lesson = await adminApi.get(`/api/lessons/${id}`);
    let classes = window.availableClasses;
    let allUnits = window.availableUnits;
    if (!classes || !allUnits) {
      const [c, u] = await Promise.all([adminApi.get('/api/classes'), adminApi.get('/api/units')]);
      classes = c; allUnits = u;
      window.availableClasses = classes; window.availableUnits = allUnits;
    }
    classes = classes || []; allUnits = allUnits || [];
    const currentUnit = allUnits.find(u => u.id == lesson.unit_id);
    const preTerm = currentUnit ? String(currentUnit.term || '1').trim() : '1';
    const preClassId = currentUnit ? String(currentUnit.class_id) : '';
    const classOptions = classes.map(c => `<option value="${c.id}" ${c.id == preClassId ? 'selected' : ''}>${escapeHtml(c.name || c.name_ar)}</option>`).join('');
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header"><h2>تعديل الدرس</h2><button type="button" class="modal-close" data-action="modal-close">×</button></div>
        <form id="edit-lesson-form">
          <div class="form-group"><label for="edit-lesson-term">الفصل الدراسي *</label><select id="edit-lesson-term" required><option value="">اختر الفصل...</option><option value="1" ${preTerm === '1' ? 'selected' : ''}>الفصل الأول</option><option value="2" ${preTerm === '2' ? 'selected' : ''}>الفصل الثاني</option></select></div>
          <div class="form-group"><label for="edit-lesson-class">الصف الدراسي *</label><select id="edit-lesson-class" required><option value="">اختر الصف...</option>${classOptions}</select></div>
          <div class="form-group"><label for="edit-lesson-unit">الوحدة الدراسية *</label><select id="edit-lesson-unit" class="native-select" required><option value="">اختر الفصل والصف أولاً...</option></select></div>
          <div class="form-group"><label for="edit-lesson-title">عنوان الدرس *</label><input type="text" id="edit-lesson-title" value="${escapeHtml(lesson.title || lesson.title_ar)}" required dir="rtl"></div>
          <div class="form-group"><label><i class="fab fa-youtube"></i> الفيديوهات (اختياري)</label><div id="edit-videos-container"></div><button type="button" class="btn btn-secondary btn-sm" data-action="add-edit-video-field">+ إضافة فيديو</button></div>
          <div class="form-group"><label><i class="fas fa-image"></i> الصور (اختياري)</label><div id="edit-images-container"></div><button type="button" class="btn btn-secondary btn-sm" data-action="add-edit-image-field">+ إضافة صورة</button></div>
          <div class="form-group"><label><i class="fas fa-file-alt"></i> الملفات المرفقة (PDF / PPTX) (اختياري)</label><div id="edit-files-container"></div><button type="button" class="btn btn-secondary btn-sm" data-action="add-edit-file-field">+ إضافة ملف</button></div>
          <div style="color: #ef4444; margin: 1rem 0; padding: 0.75rem; background: #fee2e2; border-radius: 4px; display: none;" id="edit-lesson-error"><i class="fas fa-exclamation-circle"></i> <span id="edit-lesson-error-msg"></span></div>
          <div class="btn-group"><button type="submit" class="btn btn-primary">حفظ التغييرات</button><button type="button" class="btn btn-secondary" data-action="modal-close">إلغاء</button></div>
        </form>
      </div>`;
    document.body.appendChild(modal);
    const termSelect = document.getElementById('edit-lesson-term');
    const classSelect = document.getElementById('edit-lesson-class');
    const unitSelect = document.getElementById('edit-lesson-unit');
    const titleInput = document.getElementById('edit-lesson-title');
    const errorDiv = document.getElementById('edit-lesson-error');
    const errorMsg = document.getElementById('edit-lesson-error-msg');
    function updateEditUnitOptions() {
      const term = termSelect?.value || '';
      const classId = classSelect?.value || '';
      if (!term || !classId) { unitSelect.innerHTML = '<option value="">اختر الفصل والصف أولاً...</option>'; return; }
      const filtered = allUnits.filter(u => String(u.term || '1').trim() === String(term).trim() && Number(u.class_id) === Number(classId));
      unitSelect.innerHTML = '<option value="">اختر وحدة دراسية...</option>';
      filtered.forEach(unit => { const opt = document.createElement('option'); opt.value = unit.id; opt.textContent = escapeHtml(unit.title || unit.title_ar); if (unit.id == lesson.unit_id) opt.selected = true; unitSelect.appendChild(opt); });
      if (filtered.length === 0) unitSelect.innerHTML = '<option value="">لا توجد وحدات في هذا الفصل والصف</option>';
    }
    if (termSelect) termSelect.addEventListener('change', updateEditUnitOptions);
    if (classSelect) classSelect.addEventListener('change', updateEditUnitOptions);
    setTimeout(updateEditUnitOptions, 0);
    titleInput.addEventListener('input', (e) => {
      errorDiv.style.display = (e.target.value && !/^[\u0600-\u06FF\s]*$/.test(e.target.value)) ? 'block' : 'none';
      if (errorDiv.style.display === 'block') errorMsg.textContent = 'يجب أن يحتوي على أحرف عربية فقط';
    });
    window.editVideoFieldCount = 0; window.editImageFieldCount = 0; window.editFileFieldCount = 0;
    if (lesson.videos && lesson.videos.length > 0) lesson.videos.forEach(v => addEditVideoField(v.video_url, v.position, v.size, v.explanation));
    else addEditVideoField();
    if (lesson.images && lesson.images.length > 0) lesson.images.forEach(img => addEditImageField(img.image_path, img.position, img.size, img.caption));
    if (lesson.files && lesson.files.length > 0) lesson.files.forEach(f => addEditFileField(f.url, f.file_type, f.title, f.description));
    else addEditFileField();
    document.getElementById('edit-lesson-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = titleInput.value.trim();
      const unitId = document.getElementById('edit-lesson-unit').value;
      if (!title) { errorDiv.style.display = 'block'; errorMsg.textContent = 'عنوان الدرس مطلوب'; return; }
      if (!unitId) { errorDiv.style.display = 'block'; errorMsg.textContent = 'الوحدة الدراسية مطلوبة'; return; }
      if (!/^[\u0600-\u06FF\s]+$/.test(title)) { errorDiv.style.display = 'block'; errorMsg.textContent = 'يجب أن يحتوي على أحرف عربية فقط'; return; }
      try {
        const videos = [];
        document.querySelectorAll('#edit-videos-container [data-video-index]').forEach(el => { const url = el.querySelector('input[type="url"]').value; if (url && url.trim()) videos.push({ video_url: url, video_position: el.querySelector('select[name="position"]').value, video_size: 'large', video_explanation: el.querySelector('textarea').value || '' }); });
        const images = [];
        document.querySelectorAll('#edit-images-container [data-image-index]').forEach(el => { const imagePath = el.getAttribute('data-image-path'); if (imagePath && imagePath.trim()) images.push({ image_path: imagePath, image_position: el.querySelector('select[name="image-position"]').value, image_size: 'medium', image_caption: el.querySelector('textarea').value || '' }); });
        const files = [];
        document.querySelectorAll('#edit-files-container [data-file-index]').forEach(el => { const url = el.querySelector('.file-url-input').value; if (url && url.trim()) files.push({ url, file_type: el.querySelector('.file-type-input').value, title: el.querySelector('.file-title-input').value, description: el.querySelector('.file-desc-input').value }); });
        await adminApi.put(`/api/lessons/${id}`, { title, unit_id: unitId, content: '', videos, images, files });
        modal.remove(); router.navigate('/admin/lessons'); showAlert('تم تحديث الدرس بنجاح!');
      } catch (error) {
        errorDiv.style.display = 'block';
        errorMsg.textContent = error.message;
        errorMsg.style.whiteSpace = 'pre-wrap';
      }
    });
  } catch (error) { showAlert('خطأ في تحميل الدرس: ' + error.message, 'error'); }
};

window.deleteLesson = async function (id, title) {
  const confirmed = await showConfirmModal('حذف الدرس', `<p>هل أنت متأكد من حذف "<strong>${escapeHtml(title)}</strong>"؟</p>`);
  if (!confirmed) return;
  try { await adminApi.delete(`/api/lessons/${id}`); router.navigate('/admin/lessons'); showAlert('تم حذف الدرس بنجاح!'); }
  catch (error) { showAlert(error.message, 'error'); }
};

window.addEventListener('popstate', () => router.handleRoute());

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => router.handleRoute());
} else {
  router.handleRoute();
}

window.addEditVideoField = function (url = '', position = 'bottom', size = 'medium', explanation = '') {
  const container = document.getElementById('edit-videos-container');
  if (!container) return;
  const index = window.editVideoFieldCount++;
  const videoField = document.createElement('div');
  videoField.setAttribute('data-video-index', index);
  videoField.style.cssText = 'background: #f8fafc; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; border: 1px solid #e2e8f0;';
  videoField.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;"><label style="font-weight: 600;">الفيديو ${index + 1}</label><button type="button" class="btn btn-danger btn-xs" data-action="remove-video-block">حذف</button></div>
    <input type="url" value="${escapeHtml(url)}" placeholder="https://www.youtube.com/watch?v=..." style="width: 100%; padding: 0.5rem; margin-bottom: 0.5rem; border: 1px solid #e2e8f0; border-radius: 4px;">
    <select name="position" style="padding: 0.5rem; border: 1px solid #e2e8f0; border-radius: 4px; margin-bottom: 0.5rem;"><option value="bottom" ${position === 'bottom' ? 'selected' : ''}>أسفل الفيديو</option><option value="top" ${position === 'top' ? 'selected' : ''}>أعلى الفيديو</option><option value="side" ${position === 'side' ? 'selected' : ''}>بجانب الفيديو</option></select>
    <textarea placeholder="شرح هذا الفيديو..." style="width: 100%; padding: 0.5rem; border: 1px solid #e2e8f0; border-radius: 4px; min-height: 60px; resize: vertical;">${escapeHtml(explanation)}</textarea>`;
  container.appendChild(videoField);
};

window.addEditImageField = function (imagePath = '', position = 'bottom', size = 'medium', caption = '') {
  const container = document.getElementById('edit-images-container');
  if (!container) return;
  const index = window.editImageFieldCount++;
  const imageField = document.createElement('div');
  imageField.setAttribute('data-image-index', index);
  imageField.setAttribute('data-image-path', imagePath);
  imageField.style.cssText = 'background: #f8fafc; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; border: 1px solid #e2e8f0;';
  imageField.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;"><label style="font-weight: 600;">الصورة ${index + 1}</label><button type="button" class="btn btn-danger btn-xs" data-action="remove-image-block">حذف</button></div>
    ${imagePath ? `<div style="background: white; padding: 0.5rem; border-radius: 4px; margin-bottom: 0.5rem; border: 1px solid #e2e8f0;"><img src="${imagePath}" style="max-width: 100%; max-height: 150px; border-radius: 4px;"></div>` : ''}
    <input type="file" accept="image/*" class="lesson-edit-image-upload" style="width: 100%; padding: 0.5rem; margin-bottom: 0.5rem; border: 1px solid #e2e8f0; border-radius: 4px;">
    <select name="image-position" style="padding: 0.5rem; border: 1px solid #e2e8f0; border-radius: 4px; margin-bottom: 0.5rem;"><option value="bottom" ${position === 'bottom' ? 'selected' : ''}>أسفل الصورة</option><option value="top" ${position === 'top' ? 'selected' : ''}>أعلى الصورة</option><option value="side" ${position === 'side' ? 'selected' : ''}>بجانب الصورة</option></select>
    <textarea placeholder="نص توضيحي للصورة..." style="width: 100%; padding: 0.5rem; border: 1px solid #e2e8f0; border-radius: 4px; min-height: 60px; resize: vertical;">${escapeHtml(caption)}</textarea>`;
  container.appendChild(imageField);
};

window.uploadEditImage = async function (input) {
  const file = input.files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append('image', file);
  try {
    const response = await fetch('/api/lessons/upload-image', { method: 'POST', body: formData });
    if (!response.ok) throw new Error('Upload failed');
    const data = await safeParseJson(response);
    const imageField = input.closest('[data-image-index]');
    imageField.setAttribute('data-image-path', data.imagePath);
    let preview = imageField.querySelector('div[style*="background: white"]');
    if (!preview) { preview = document.createElement('div'); preview.style.cssText = 'background: white; padding: 0.5rem; border-radius: 4px; margin-bottom: 0.5rem; border: 1px solid #e2e8f0;'; input.parentNode.insertBefore(preview, input.nextSibling); }
    preview.innerHTML = `<img src="${data.imagePath}" style="max-width: 100%; max-height: 150px; border-radius: 4px;">`;
    showAlert('تم رفع الصورة بنجاح!');
  } catch (error) { showAlert('خطأ في رفع الصورة: ' + error.message, 'error'); }
};

// ==================== QUESTIONS MANAGEMENT ====================

window.manageQuestions = async function (lessonId, lessonTitle) {
  try {
    const questions = await adminApi.get(`/api/lessons/${lessonId}/questions/admin`);
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'questions-modal';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 900px;">
        <div class="modal-header"><h2><i class="fas fa-question-circle"></i> إدارة أسئلة: ${escapeHtml(lessonTitle)}</h2><button type="button" class="modal-close" data-action="modal-close">×</button></div>
        <div class="modal-body" style="max-height: 70vh; overflow-y: auto;">
          <div class="questions-list-admin" id="questions-list-admin">
            ${questions.length === 0 ? '<div class="empty-questions"><i class="fas fa-clipboard-list" style="font-size: 3rem; opacity: 0.3; margin-bottom: 1rem;"></i><p>لا توجد أسئلة لهذا الدرس بعد</p></div>' : questions.map((q, idx) => renderQuestionAdmin(q, idx, lessonId)).join('')}
          </div>
          <div class="add-question-section" style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 2px solid #e2e8f0;">
            <h4 style="margin-bottom: 1rem;"><i class="fas fa-plus-circle"></i> إضافة سؤال جديد</h4>
            <div class="form-group"><label>نص السؤال *</label><textarea id="new-q-text" rows="2" placeholder="أدخل نص السؤال هنا..." style="width: 100%;"></textarea></div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
              <div class="form-group"><label>أ) الخيار الأول *</label><input type="text" id="new-q-a" placeholder="الخيار أ"></div>
              <div class="form-group"><label>ب) الخيار الثاني *</label><input type="text" id="new-q-b" placeholder="الخيار ب"></div>
              <div class="form-group"><label>ج) الخيار الثالث *</label><input type="text" id="new-q-c" placeholder="الخيار ج"></div>
              <div class="form-group"><label>د) الخيار الرابع *</label><input type="text" id="new-q-d" placeholder="الخيار د"></div>
            </div>
            <div class="form-group"><label>الإجابة الصحيحة *</label><select id="new-q-correct" style="width: 200px;"><option value="">اختر الإجابة الصحيحة</option><option value="A">أ</option><option value="B">ب</option><option value="C">ج</option><option value="D">د</option></select></div>
            <button type="button" class="btn btn-primary" data-action="add-question" data-lesson-id="${lessonId}"><i class="fas fa-plus"></i> إضافة السؤال</button>
          </div>
        </div>
        <div class="modal-footer" style="padding: 1rem; border-top: 1px solid #e2e8f0; text-align: left;">
          <button type="button" class="btn btn-secondary" data-action="close-questions-modal">إغلاق</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
  } catch (error) { showAlert('خطأ في تحميل الأسئلة: ' + error.message, 'error'); }
};

function renderQuestionAdmin(q, idx, lessonId) {
  return `
    <div class="question-admin-card" id="admin-q-${q.id}" style="background: #f8fafc; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; border: 1px solid #e2e8f0;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
        <span style="background: linear-gradient(135deg, #1e3a8a, #0891b2); color: white; padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.85rem;">السؤال ${idx + 1}</span>
        <div>
          <button type="button" class="btn btn-sm btn-primary" data-action="edit-question" data-question-id="${q.id}" data-lesson-id="${lessonId}"><i class="fas fa-edit"></i></button>
          <button type="button" class="btn btn-sm btn-danger" data-action="delete-question" data-question-id="${q.id}" data-lesson-id="${lessonId}"><i class="fas fa-trash"></i></button>
        </div>
      </div>
      <p style="font-weight: 600; margin-bottom: 0.75rem;">${escapeHtml(q.question_text)}</p>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; font-size: 0.9rem;">
        <div style="padding: 0.5rem; background: ${q.correct_answer === 'A' ? '#dcfce7' : 'white'}; border-radius: 4px; border: 1px solid ${q.correct_answer === 'A' ? '#22c55e' : '#e2e8f0'};"><strong>أ)</strong> ${escapeHtml(q.option_a)} ${q.correct_answer === 'A' ? '<i class="fas fa-check" style="color: #22c55e;"></i>' : ''}</div>
        <div style="padding: 0.5rem; background: ${q.correct_answer === 'B' ? '#dcfce7' : 'white'}; border-radius: 4px; border: 1px solid ${q.correct_answer === 'B' ? '#22c55e' : '#e2e8f0'};"><strong>ب)</strong> ${escapeHtml(q.option_b)} ${q.correct_answer === 'B' ? '<i class="fas fa-check" style="color: #22c55e;"></i>' : ''}</div>
        <div style="padding: 0.5rem; background: ${q.correct_answer === 'C' ? '#dcfce7' : 'white'}; border-radius: 4px; border: 1px solid ${q.correct_answer === 'C' ? '#22c55e' : '#e2e8f0'};"><strong>ج)</strong> ${escapeHtml(q.option_c)} ${q.correct_answer === 'C' ? '<i class="fas fa-check" style="color: #22c55e;"></i>' : ''}</div>
        <div style="padding: 0.5rem; background: ${q.correct_answer === 'D' ? '#dcfce7' : 'white'}; border-radius: 4px; border: 1px solid ${q.correct_answer === 'D' ? '#22c55e' : '#e2e8f0'};"><strong>د)</strong> ${escapeHtml(q.option_d)} ${q.correct_answer === 'D' ? '<i class="fas fa-check" style="color: #22c55e;"></i>' : ''}</div>
      </div>
    </div>`;
}

window.addQuestion = async function (lessonId) {
  const questionText = document.getElementById('new-q-text').value.trim();
  const optionA = document.getElementById('new-q-a').value.trim();
  const optionB = document.getElementById('new-q-b').value.trim();
  const optionC = document.getElementById('new-q-c').value.trim();
  const optionD = document.getElementById('new-q-d').value.trim();
  const correctAnswer = document.getElementById('new-q-correct').value;
  if (!questionText || !optionA || !optionB || !optionC || !optionD || !correctAnswer) { showAlert('جميع الحقول مطلوبة', 'error'); return; }
  try {
    await adminApi.post(`/api/lessons/${lessonId}/questions`, { question_text: questionText, option_a: optionA, option_b: optionB, option_c: optionC, option_d: optionD, correct_answer: correctAnswer });
    showAlert('تم إضافة السؤال بنجاح!');
    document.getElementById('questions-modal').remove();
    manageQuestions(lessonId, '');
  } catch (error) { showAlert('خطأ في إضافة السؤال: ' + error.message, 'error'); }
};

window.editQuestion = async function (questionId, lessonId) {
  try {
    const questions = await adminApi.get(`/api/lessons/${lessonId}/questions/admin`);
    const q = questions.find(question => question.id === questionId);
    if (!q) { showAlert('السؤال غير موجود', 'error'); return; }
    const editModal = document.createElement('div');
    editModal.className = 'modal active';
    editModal.style.zIndex = '10001';
    editModal.innerHTML = `
      <div class="modal-content" style="max-width: 700px;">
        <div class="modal-header"><h2><i class="fas fa-edit"></i> تعديل السؤال</h2><button type="button" class="modal-close" data-action="modal-close">×</button></div>
        <div class="modal-body">
          <div class="form-group"><label>نص السؤال *</label><textarea id="edit-q-text" rows="2" style="width: 100%;">${escapeHtml(q.question_text)}</textarea></div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div class="form-group"><label>أ) الخيار الأول *</label><input type="text" id="edit-q-a" value="${escapeHtml(q.option_a)}"></div>
            <div class="form-group"><label>ب) الخيار الثاني *</label><input type="text" id="edit-q-b" value="${escapeHtml(q.option_b)}"></div>
            <div class="form-group"><label>ج) الخيار الثالث *</label><input type="text" id="edit-q-c" value="${escapeHtml(q.option_c)}"></div>
            <div class="form-group"><label>د) الخيار الرابع *</label><input type="text" id="edit-q-d" value="${escapeHtml(q.option_d)}"></div>
          </div>
          <div class="form-group"><label>الإجابة الصحيحة *</label><select id="edit-q-correct" style="width: 200px;"><option value="A" ${q.correct_answer === 'A' ? 'selected' : ''}>أ</option><option value="B" ${q.correct_answer === 'B' ? 'selected' : ''}>ب</option><option value="C" ${q.correct_answer === 'C' ? 'selected' : ''}>ج</option><option value="D" ${q.correct_answer === 'D' ? 'selected' : ''}>د</option></select></div>
        </div>
        <div class="modal-footer" style="padding: 1rem; border-top: 1px solid #e2e8f0;">
          <button type="button" class="btn btn-primary" data-action="save-question-edit" data-question-id="${questionId}" data-lesson-id="${lessonId}"><i class="fas fa-save"></i> حفظ التغييرات</button>
          <button type="button" class="btn btn-secondary" data-action="modal-close">إلغاء</button>
        </div>
      </div>`;
    document.body.appendChild(editModal);
  } catch (error) { showAlert('خطأ في تحميل السؤال: ' + error.message, 'error'); }
};

window.saveQuestionEdit = async function (questionId, lessonId) {
  const questionText = document.getElementById('edit-q-text').value.trim();
  const optionA = document.getElementById('edit-q-a').value.trim();
  const optionB = document.getElementById('edit-q-b').value.trim();
  const optionC = document.getElementById('edit-q-c').value.trim();
  const optionD = document.getElementById('edit-q-d').value.trim();
  const correctAnswer = document.getElementById('edit-q-correct').value;
  if (!questionText || !optionA || !optionB || !optionC || !optionD || !correctAnswer) { showAlert('جميع الحقول مطلوبة', 'error'); return; }
  try {
    await adminApi.put(`/api/lessons/${lessonId}/questions/${questionId}`, { question_text: questionText, option_a: optionA, option_b: optionB, option_c: optionC, option_d: optionD, correct_answer: correctAnswer });
    showAlert('تم تحديث السؤال بنجاح!');
    document.querySelectorAll('.modal').forEach(m => { if (m.style.zIndex === '10001') m.remove(); });
    const questions = await adminApi.get(`/api/lessons/${lessonId}/questions/admin`);
    const listContainer = document.getElementById('questions-list-admin');
    if (listContainer) listContainer.innerHTML = questions.length === 0 ? '<div class="empty-questions"><p>لا توجد أسئلة لهذا الدرس بعد</p></div>' : questions.map((q, idx) => renderQuestionAdmin(q, idx, lessonId)).join('');
  } catch (error) { showAlert('خطأ في تحديث السؤال: ' + error.message, 'error'); }
};

window.deleteQuestion = async function (questionId, lessonId) {
  const confirmed = await showConfirmModal('حذف السؤال', '<p>هل أنت متأكد من حذف هذا السؤال؟</p>');
  if (!confirmed) return;
  try {
    await adminApi.delete(`/api/lessons/${lessonId}/questions/${questionId}`);
    showAlert('تم حذف السؤال بنجاح!');
    const card = document.getElementById(`admin-q-${questionId}`);
    if (card) card.remove();
    const listContainer = document.getElementById('questions-list-admin');
    if (listContainer && listContainer.children.length === 0) listContainer.innerHTML = '<div class="empty-questions"><p>لا توجد أسئلة لهذا الدرس بعد</p></div>';
  } catch (error) { showAlert('خطأ في حذف السؤال: ' + error.message, 'error'); }
};

document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href]');
  if (a && a.href.startsWith(window.location.origin) && document.getElementById('admin-app')?.contains(a)) {
    e.preventDefault();
    router.navigate(a.getAttribute('href'));
  }
});

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const action = el.getAttribute('data-action');
  if (action === 'modal-close') { el.closest('.modal')?.remove(); return; }
  if (action === 'confirm-yes' || action === 'confirm-no') {
    const modal = el.closest('.modal');
    if (modal) { modal.remove(); window.confirmResult = (action === 'confirm-yes'); window.dispatchEvent(new Event('confirmResolved')); }
    return;
  }
  if (action === 'toggle-sidebar') { toggleSidebar(); return; }
  if (action === 'navigate') { const path = el.getAttribute('data-path'); if (path) { e.preventDefault(); router.navigate(path); } return; }
  if (action === 'logout') { e.preventDefault(); logout(); return; }
  if (action === 'show-create-class') { showCreateClassForm(); return; }
  if (action === 'show-create-unit') { showCreateUnitForm(); return; }
  if (action === 'show-create-lesson') { showCreateLessonForm(); return; }
  if (action === 'reset-units-filters') { resetUnitsFilters(); return; }
  if (action === 'reset-lessons-filters') { resetLessonsFilters(); return; }
  if (action === 'edit-class') { const id = el.getAttribute('data-id'); const name = el.getAttribute('data-name') || ''; if (id) editClass(parseInt(id, 10), name); return; }
  if (action === 'delete-class') { const id = el.getAttribute('data-id'); const name = el.getAttribute('data-name') || ''; if (id) deleteClass(parseInt(id, 10), name); return; }
  if (action === 'edit-unit') { const id = el.getAttribute('data-id'); const title = el.getAttribute('data-title') || ''; const classId = el.getAttribute('data-class-id'); const category = el.getAttribute('data-category') || 'P'; const term = el.getAttribute('data-term') || '1'; if (id && classId) editUnit(parseInt(id, 10), title, parseInt(classId, 10), category, term); return; }
  if (action === 'delete-unit') { const id = el.getAttribute('data-id'); const title = el.getAttribute('data-title') || ''; if (id) deleteUnit(parseInt(id, 10), title); return; }
  if (action === 'edit-lesson') { const id = el.getAttribute('data-id'); if (id) editLesson(parseInt(id, 10)); return; }
  if (action === 'manage-questions') { const id = el.getAttribute('data-id'); const title = el.getAttribute('data-title') || ''; if (id) manageQuestions(parseInt(id, 10), title); return; }
  if (action === 'delete-lesson') { const id = el.getAttribute('data-id'); const title = el.getAttribute('data-title') || ''; if (id) deleteLesson(parseInt(id, 10), title); return; }
  if (action === 'add-video-field') { addVideoField(); return; }
  if (action === 'add-image-field') { addImageField(); return; }
  if (action === 'add-file-field') { addFileField(); return; }
  if (action === 'add-edit-video-field') { addEditVideoField(); return; }
  if (action === 'add-edit-image-field') { addEditImageField(); return; }
  if (action === 'add-edit-file-field') { window.addEditFileField(); return; }
  if (action === 'remove-video-block') { el.closest('[data-video-index]')?.remove(); return; }
  if (action === 'remove-image-block') { el.closest('[data-image-index]')?.remove(); return; }
  if (action === 'remove-file-block') { el.closest('[data-file-index]')?.remove(); return; }
  if (action === 'add-question') { const lessonId = el.getAttribute('data-lesson-id'); if (lessonId) addQuestion(parseInt(lessonId, 10)); return; }
  if (action === 'close-questions-modal') { el.closest('.modal')?.remove(); return; }
  if (action === 'edit-question') { const qId = el.getAttribute('data-question-id'); const lessonId = el.getAttribute('data-lesson-id'); if (qId && lessonId) editQuestion(parseInt(qId, 10), parseInt(lessonId, 10)); return; }
  if (action === 'delete-question') { const qId = el.getAttribute('data-question-id'); const lessonId = el.getAttribute('data-lesson-id'); if (qId && lessonId) deleteQuestion(parseInt(qId, 10), parseInt(lessonId, 10)); return; }
  if (action === 'save-question-edit') { const questionId = el.getAttribute('data-question-id'); const lessonId = el.getAttribute('data-lesson-id'); if (questionId && lessonId) saveQuestionEdit(parseInt(questionId, 10), parseInt(lessonId, 10)); return; }
});

// ✅ CSP-friendly delegated change handler (no inline onchange)
document.addEventListener('change', (e) => {
  if (e.target.classList.contains('lesson-image-upload')) {
    uploadImage(e.target);
  } else if (e.target.classList.contains('lesson-edit-image-upload')) {
    uploadEditImage(e.target);
  } else if (e.target.classList.contains('lesson-file-upload')) {
    const blockId = e.target.getAttribute('data-block-id');
    if (e.target.files[0] && blockId) {
      window.uploadFileAjax(e.target.files[0], blockId);
    }
  }
});

router.navigate(window.location.pathname + window.location.search);