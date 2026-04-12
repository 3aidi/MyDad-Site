(function () {
  function initSearch() {
    const input = document.getElementById('globalSearchInput');
    const resultsEl = document.getElementById('globalSearchResults');
    const filterBar = document.getElementById('studentFilterBar');
    const resetBtn = document.getElementById('studentFiltersReset');

    if (!input || !resultsEl) return;

    let debounceTimer = null;
    let latestResults = [];

    function closeResults() {
      resultsEl.innerHTML = '';
      resultsEl.classList.remove('open');
    }

    function normalizeResults(payload) {
      const out = [];
      const classes = Array.isArray(payload.classes) ? payload.classes : [];
      const units = Array.isArray(payload.units) ? payload.units : [];
      const lessons = Array.isArray(payload.lessons) ? payload.lessons : [];

      classes.forEach((c) => {
        out.push({
          type: 'class',
          id: c.id,
          label: c.name,
          subtitle: 'صف دراسي',
          navigateTo: `/class/${c.id}`
        });
      });

      units.forEach((u) => {
        out.push({
          type: 'unit',
          id: u.id,
          term: u.term,
          category: u.category,
          label: u.title,
          subtitle: `وحدة · ${u.class_name || ''}`,
          navigateTo: `/unit/${u.id}`
        });
      });

      lessons.forEach((l) => {
        out.push({
          type: 'lesson',
          id: l.id,
          term: l.term,
          category: l.unit_category,
          label: l.title,
          subtitle: `درس · ${l.class_name || ''} · ${l.unit_title || ''}`,
          navigateTo: `/lesson/${l.id}`
        });
      });

      return out;
    }

    function renderResults() {
      const filtered = window.StudentFilters
        ? window.StudentFilters.apply(latestResults)
        : latestResults;

      if (!filtered.length) {
        resultsEl.innerHTML = '<div class="search-empty">لا توجد نتائج مطابقة.</div>';
        resultsEl.classList.add('open');
        return;
      }

      const html = filtered
        .map((item) => {
          const typeLabel =
            item.type === 'class'
              ? 'صف'
              : item.type === 'unit'
              ? 'وحدة'
              : 'درس';
          return `
            <button type="button" class="search-result-item" data-navigate="${item.navigateTo}">
              <div class="search-result-main">
                <span class="search-result-title">${escapeHtml(item.label)}</span>
                <span class="search-result-subtitle">${escapeHtml(item.subtitle || '')}</span>
              </div>
              <span class="search-result-type">${typeLabel}</span>
            </button>
          `;
        })
        .join('');

      resultsEl.innerHTML = html;
      resultsEl.classList.add('open');
    }

    async function performSearch(query) {
      if (!query || query.length < 2) {
        latestResults = [];
        closeResults();
        return;
      }

      try {
        resultsEl.innerHTML = '<div class="search-loading"><i class="fas fa-circle-notch fa-spin"></i> جاري البحث...</div>';
        resultsEl.classList.add('open');

        const data = await api.get(`/api/search?q=${encodeURIComponent(query)}`);
        latestResults = normalizeResults(data);
        renderResults();
      } catch (e) {
        console.error('Search error', e);
        resultsEl.innerHTML = '<div class="search-error">فشل البحث، حاول مرة أخرى.</div>';
        resultsEl.classList.add('open');
      }
    }

    input.addEventListener('input', (e) => {
      const value = e.target.value.trim();
      clearTimeout(debounceTimer);

      if (!value) {
        latestResults = [];
        closeResults();
        return;
      }

      debounceTimer = setTimeout(() => performSearch(value), 300);
    });

    document.addEventListener('click', (e) => {
      const container = document.querySelector('.student-global-search');
      if (!container) return;
      if (!container.contains(e.target)) {
        closeResults();
      }
    });

    if (filterBar && window.StudentFilters) {
      filterBar.addEventListener('click', (e) => {
        const chip = e.target.closest('.filter-chip');
        if (!chip) return;

        const type = chip.getAttribute('data-filter-type');
        const value = chip.getAttribute('data-filter-value');

        if (!type || !value) return;

        chip.classList.toggle('active');

        if (type === 'type') {
          window.StudentFilters.toggleType(value);
        } else if (type === 'term') {
          window.StudentFilters.toggleTerm(value);
        }

        if (latestResults.length) {
          renderResults();
        }
      });
    }

    if (resetBtn && window.StudentFilters) {
      resetBtn.addEventListener('click', () => {
        window.StudentFilters.reset();
        document
          .querySelectorAll('.filter-chip')
          .forEach((chip) => chip.classList.remove('active'));
        if (latestResults.length) {
          renderResults();
        }
      });
    }
  }

  document.addEventListener('DOMContentLoaded', initSearch);
})();

