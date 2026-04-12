(function () {
  const defaultState = () => ({
    types: new Set(['class', 'unit', 'lesson']),
    terms: new Set(['1', '2'])
  });

  const state = defaultState();

  function toggleInSet(set, value) {
    if (!value) return;
    if (set.has(value)) {
      set.delete(value);
    } else {
      set.add(value);
    }
  }

  function apply(items) {
    return items.filter((item) => {
      // Type filter
      if (item.type && state.types.size && !state.types.has(item.type)) {
        return false;
      }

      // Term filter (only for items that have term)
      if (item.term && state.terms.size && !state.terms.has(String(item.term))) {
        return false;
      }

      return true;
    });
  }

  function reset() {
    const fresh = defaultState();
    state.types = fresh.types;
    state.terms = fresh.terms;
  }

  window.StudentFilters = {
    state,
    toggleType(type) {
      toggleInSet(state.types, type);
    },
    toggleTerm(term) {
      toggleInSet(state.terms, String(term));
    },
    reset,
    apply
  };
})();

