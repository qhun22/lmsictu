document.addEventListener('DOMContentLoaded', () => {
  const storageKey = 'qhun22_subjects';
  const storageWeeklyKey = 'qhun22_subjects_weeks';

  const form = document.getElementById('smh-form');
  const input = document.getElementById('smh-input');
  const list = document.getElementById('smh-list');
  const emptyState = document.getElementById('smh-empty');
  const countNum = document.getElementById('smh-count-num');

  if (!form || !input || !list || !emptyState) return;

  const subjects = loadSubjects();
  const weeklyMap = loadWeeklyMap(); // { subjectName: [ {name, topics[]}, ... ] }

  renderAll();

  // ── Submit form: thêm môn học mới ──
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = input.value.trim();
    if (!name) {
      input.focus();
      shake(input);
      if (window.errorToast) window.errorToast('Lỗi', 'Vui lòng nhập tên môn học');
      return;
    }
    if (subjects.some((s) => s.toLowerCase() === name.toLowerCase())) {
      input.focus();
      shake(input);
      if (window.warningToast) window.warningToast('Trùng tên', `Môn "${name}" đã tồn tại`);
      return;
    }

    subjects.push(name);
    saveSubjects(subjects);
    if (!weeklyMap[name]) {
      weeklyMap[name] = [];
      saveWeeklyMap(weeklyMap);
    }
    renderAll();
    input.value = '';
    input.focus();

    if (window.successToast) window.successToast('Thành công', `Đã thêm môn "${name}"`);
  });

  // ── Delegated click cho list ──
  list.addEventListener('click', async (e) => {
    const btnSettings = e.target.closest('[data-action="settings"]');
    const btnDelete = e.target.closest('[data-action="delete"]');
    const btnAdd = e.target.closest('[data-action="add"]');

    if (btnSettings) {
      const idx = Number(btnSettings.dataset.idx);
      openSettingsModal(subjects[idx]);
    } else if (btnDelete) {
      const idx = Number(btnDelete.dataset.idx);
      const name = subjects[idx];
      const ok = await window.confirmDanger(
        'Xóa môn học?',
        `Bạn có chắc muốn xóa môn "${name}" không?`,
        { confirmLabel: 'Xóa', detail: 'Hành động này không thể hoàn tác.' }
      );
      if (!ok) return;
      subjects.splice(idx, 1);
      delete weeklyMap[name];
      saveSubjects(subjects);
      saveWeeklyMap(weeklyMap);
      renderAll();
      if (window.successToast) window.successToast('Đã xóa', `Đã xóa môn "${name}"`);
    } else if (btnAdd) {
      const idx = Number(btnAdd.dataset.idx);
      openAddWeekModal(subjects[idx]);
    }
  });

  // ── Render ──
  function renderAll() {
    renderCount(subjects.length);
    renderList(subjects);
  }

  function renderCount(count) {
    countNum.textContent = count;
  }

  function renderList(items) {
    if (!items.length) {
      list.innerHTML = '';
      emptyState.hidden = false;
      return;
    }

    emptyState.hidden = true;
    const reversed = [...items].reverse();

    list.innerHTML = reversed.map((name, i) => {
      const realIndex = items.length - 1 - i;
      const weeks = (weeklyMap[name] || []).length;
      return `
        <li class="smh-card" style="animation-delay: ${i * 30}ms">
          <div class="smh-card-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
            </svg>
          </div>
          <div class="smh-card-body">
            <span class="smh-card-name">${escapeHtml(name)}</span>
            <span class="smh-card-meta">${weeks} tuần học</span>
          </div>
          <div class="smh-card-actions">
            <button
              type="button"
              class="smh-action smh-action--settings"
              data-action="settings"
              data-idx="${realIndex}"
              aria-label="Cài đặt môn ${escapeHtml(name)}"
              title="Cài đặt"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </button>
            <button
              type="button"
              class="smh-action smh-action--add"
              data-action="add"
              data-idx="${realIndex}"
              aria-label="Thêm tuần học cho ${escapeHtml(name)}"
              title="Thêm tuần"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>
            <button
              type="button"
              class="smh-action smh-action--delete"
              data-action="delete"
              data-idx="${realIndex}"
              aria-label="Xóa môn ${escapeHtml(name)}"
              title="Xóa"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6M14 11v6"/>
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
              </svg>
            </button>
          </div>
        </li>
      `;
    }).join('');
  }

  // ╔══════════════════════════════════════════════════════════════╗
  // ║  MODAL: Cài đặt môn học                                       ║
  // ╚══════════════════════════════════════════════════════════════╝
  function openSettingsModal(subjectName) {
    const weeks = weeklyMap[subjectName] || [];
    const modal = buildModal({
      modalClass: 'smh-modal--settings',
      title: `Cài đặt: ${escapeHtml(subjectName)}`,
      bodyHTML: `
        <div class="smh-modal-section">
          <label class="smh-modal-label">Đổi tên môn học</label>
          <input
            type="text"
            id="smh-rename-input"
            class="smh-modal-input"
            value="${escapeHtml(subjectName)}"
            maxlength="80"
          />
        </div>

        <div class="smh-modal-section">
          <span class="smh-modal-label">Danh sách tuần học (${weeks.length})</span>
          <ul class="smh-modal-week-list" id="smh-modal-week-list">
            ${renderWeekList(weeks)}
          </ul>
        </div>
      `,
      primaryLabel: 'Lưu',
      onPrimary: () => {
        const newName = document.getElementById('smh-rename-input').value.trim();
        if (!newName) {
          if (window.errorToast) window.errorToast('Lỗi', 'Tên môn học không được trống');
          return false;
        }
        if (newName !== subjectName) {
          const idx = subjects.indexOf(subjectName);
          if (idx === -1) {
            modal.close();
            return;
          }
          if (subjects.some((s, i) => i !== idx && s.toLowerCase() === newName.toLowerCase())) {
            if (window.warningToast) window.warningToast('Trùng tên', `"${newName}" đã tồn tại`);
            return false;
          }
          subjects[idx] = newName;
          weeklyMap[newName] = weeklyMap[subjectName] || [];
          delete weeklyMap[subjectName];
          saveSubjects(subjects);
          saveWeeklyMap(weeklyMap);
          renderAll();
          if (window.successToast) window.successToast('Đã lưu', `Đổi tên thành "${newName}"`);
        } else {
          if (window.successToast) window.successToast('Đã lưu', 'Cài đặt được cập nhật');
        }
        modal.close();
      },
    });

    // Logic delegated delete + toggle status
    setTimeout(() => {
      const listEl = document.getElementById('smh-modal-week-list');
      if (!listEl) return;

      listEl.addEventListener('click', async (e) => {
        const delBtn = e.target.closest('[data-week-del]');
        if (delBtn) {
          const weekIdx = Number(delBtn.dataset.weekDel);
          if (!weeklyMap[subjectName]) return;
          const weekName = weeklyMap[subjectName][weekIdx].name;
          const ok = await window.confirmDanger(
            'Xóa tuần học?',
            `Xóa "${weekName}" khỏi môn "${subjectName}"?`,
            { confirmLabel: 'Xóa' }
          );
          if (!ok) return;
          weeklyMap[subjectName].splice(weekIdx, 1);
          saveWeeklyMap(weeklyMap);
          listEl.innerHTML = renderWeekList(weeklyMap[subjectName]);
          renderAll();
          if (window.successToast) window.successToast('Đã xóa', 'Tuần học');
        }

        const toggleBtn = e.target.closest('[data-week-toggle]');
        if (toggleBtn) {
          const weekIdx = Number(toggleBtn.dataset.weekToggle);
          if (!weeklyMap[subjectName] || !weeklyMap[subjectName][weekIdx]) return;
          const week = weeklyMap[subjectName][weekIdx];
          // Mặc định active = true; thiếu = inactive
          week.active = !week.active;
          saveWeeklyMap(weeklyMap);
          listEl.innerHTML = renderWeekList(weeklyMap[subjectName]);
          renderAll();
          if (window.successToast) {
            window.successToast(
              week.active ? 'Đã kích hoạt' : 'Đã tạm dừng',
              week.active ? `${week.name} đang hoạt động` : `${week.name} đã tạm ngưng`
            );
          }
        }
      });
    }, 0);
  }

  /**
   * Lấy mô tả từ week object — hỗ trợ cả data cũ (topics[0])
   * và data mới (description trực tiếp).
   */
  function getWeekDescription(w) {
    if (!w) return '';
    if (typeof w.description === 'string' && w.description.trim()) return w.description.trim();
    if (Array.isArray(w.topics) && w.topics.length) {
      const t = w.topics.find((x) => typeof x === 'string' && x.trim());
      if (t) return t.trim();
    }
    return '';
  }

  function renderWeekList(weeks) {
    if (!weeks.length) {
      return '<li class="smh-modal-week-empty">Chưa có tuần học nào</li>';
    }
    return weeks.map((w, i) => {
      const active = w.active !== false; // mặc định active
      const desc = getWeekDescription(w);
      const descHtml = desc
        ? `<p class="smh-modal-week-desc" title="${escapeHtml(desc)}">${escapeHtml(desc)}</p>`
        : `<p class="smh-modal-week-desc smh-modal-week-desc--empty">Chưa có mô tả nội dung</p>`;
      return `
        <li class="smh-modal-week-item ${active ? 'is-active' : 'is-inactive'}">
          <div class="smh-modal-week-row">
            <span class="smh-modal-week-num">${i + 1}</span>
            <span class="smh-modal-week-name">${escapeHtml(w.name)}</span>
            <span class="smh-modal-week-status">${active ? 'Hoạt động' : 'Tạm ngưng'}</span>
            <button
              type="button"
              class="smh-modal-week-toggle"
              data-week-toggle="${i}"
              aria-label="${active ? 'Tạm ngưng' : 'Kích hoạt'} ${escapeHtml(w.name)}"
              title="${active ? 'Tạm ngưng tuần này' : 'Kích hoạt lại tuần này'}"
            >
              <span class="smh-toggle-track">
                <span class="smh-toggle-thumb"></span>
              </span>
            </button>
            <button
              type="button"
              class="smh-modal-week-del"
              data-week-del="${i}"
              aria-label="Xóa ${escapeHtml(w.name)}"
              title="Xóa"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6M14 11v6"/>
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
              </svg>
            </button>
          </div>
          ${descHtml}
        </li>
      `;
    }).join('');
  }

  // ╔══════════════════════════════════════════════════════════════╗
  // ║  MODAL: Thêm tuần học                                         ║
  // ╚══════════════════════════════════════════════════════════════╝
  function openAddWeekModal(subjectName) {
    const weeks = weeklyMap[subjectName] || [];
    const nextNumber = weeks.length + 1;

    const modal = buildModal({
      title: `Thêm tuần cho "${escapeHtml(subjectName)}"`,
      bodyHTML: `
        <div class="smh-modal-section">
          <label class="smh-modal-label" for="smh-week-name-input">Tên tuần học</label>
          <input
            type="text"
            id="smh-week-name-input"
            class="smh-modal-input"
            placeholder="Tuần ${nextNumber}"
            value="Tuần ${nextNumber}"
            maxlength="80"
          />
        </div>
        <div class="smh-modal-section">
          <span class="smh-modal-label">Mô tả nội dung (Có thể không cần thiết)</span>
          <textarea
            id="smh-week-desc"
            class="smh-modal-input smh-modal-textarea"
            placeholder="Nhập nội dung..."
            maxlength="500"
          ></textarea>
        </div>
        <div class="smh-modal-tip">
          Mẹo: Vào "Cài đặt" để quản lý tất cả tuần học nhé!
        </div>
      `,
      primaryLabel: 'Thêm tuần',
      onPrimary: () => {
        const nameInput = document.getElementById('smh-week-name-input');
        const descInput = document.getElementById('smh-week-desc');
        const name = (nameInput.value.trim() || `Tuần ${nextNumber}`);
        const desc = descInput.value.trim();
        if (!weeklyMap[subjectName]) weeklyMap[subjectName] = [];
        const newWeek = { name, topics: [], active: true };
        if (desc) newWeek.description = desc;
        weeklyMap[subjectName].push(newWeek);
        saveWeeklyMap(weeklyMap);
        renderAll();
        if (window.successToast) window.successToast('Đã thêm', name);
        modal.close();
      },
    });

    setTimeout(() => {
      const ni = document.getElementById('smh-week-name-input');
      if (ni) {
        ni.focus();
        ni.select();
      }
    }, 0);
  }

  // ╔══════════════════════════════════════════════════════════════╗
  // ║  Generic Modal Builder                                        ║
  // ╚══════════════════════════════════════════════════════════════╝
  function buildModal({ title, bodyHTML, primaryLabel, onPrimary, modalClass = '' }) {
    const overlay = document.createElement('div');
    overlay.className = 'smh-modal-overlay';
    const dialogClass = 'smh-modal' + (modalClass ? ' ' + modalClass : '');
    overlay.innerHTML = `
      <div class="${dialogClass}" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
        <div class="smh-modal-header">
          <h3 class="smh-modal-title">${title}</h3>
          <button type="button" class="smh-modal-close" aria-label="Đóng">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="smh-modal-body">${bodyHTML}</div>
        <div class="smh-modal-footer">
          <button type="button" class="smh-modal-btn smh-modal-btn--cancel">Hủy</button>
          <button type="button" class="smh-modal-btn smh-modal-btn--primary">${primaryLabel}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    requestAnimationFrame(() => overlay.classList.add('is-visible'));

    function close() {
      overlay.classList.remove('is-visible');
      setTimeout(() => overlay.remove(), 220);
      document.removeEventListener('keydown', onKey);
    }

    function onKey(e) {
      if (e.key === 'Escape') close();
      if (e.key === 'Enter' && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
        if (e.target.tagName === 'INPUT' && e.target.type === 'text') {
          e.preventDefault();
          primaryBtn.click();
        }
      }
    }

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
    const closeBtn = overlay.querySelector('.smh-modal-close');
    const cancelBtn = overlay.querySelector('.smh-modal-btn--cancel');
    const primaryBtn = overlay.querySelector('.smh-modal-btn--primary');
    closeBtn.addEventListener('click', close);
    cancelBtn.addEventListener('click', close);
    primaryBtn.addEventListener('click', () => {
      const result = onPrimary();
      if (result === false) return; // cho phép chặn đóng
    });
    document.addEventListener('keydown', onKey);

    return { close };
  }

  // ── Shake animation ──
  function shake(el) {
    el.classList.remove('shake');
    void el.offsetWidth;
    el.classList.add('shake');
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ── Storage helpers ──
  function loadSubjects() {
    try {
      const raw = localStorage.getItem(storageKey);
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveSubjects(items) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(items));
    } catch {
      // Ignore
    }
  }

  function loadWeeklyMap() {
    try {
      const raw = localStorage.getItem(storageWeeklyKey);
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  function saveWeeklyMap(map) {
    try {
      localStorage.setItem(storageWeeklyKey, JSON.stringify(map));
    } catch {
      // Ignore
    }
  }
});

// ── Shake animation injected ──
const _shakeStyle = document.createElement('style');
_shakeStyle.textContent = `
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    20% { transform: translateX(-5px); }
    40% { transform: translateX(5px); }
    60% { transform: translateX(-4px); }
    80% { transform: translateX(4px); }
  }
  .shake { animation: shake 0.35s ease; }
  .smh-modal-input.shake { animation: shake 0.35s ease; }
`;
document.head.appendChild(_shakeStyle);
