document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('smh-form');
  const input = document.getElementById('smh-input');
  const list = document.getElementById('smh-list');
  const emptyState = document.getElementById('smh-empty');
  const countNum = document.getElementById('smh-count-num');

  if (!form || !input || !list || !emptyState) return;

  const subjects = [];
  const weeklyMap = {}; // { subjectName: [ {name, topics[], _id}, ... ] }
  const subjectIds = new Map();

  loadDatabaseData().then(() => {
    renderAll();
    syncQuizLinks();
  });

  async function loadDatabaseData() {
    try {
      const response = await fetch('/api/subjects/', { credentials: 'same-origin' });
      if (!response.ok) throw new Error('Không thể tải môn học');
      const data = await response.json();
      for (const subject of data.subjects || []) {
        subjects.push(subject.name);
        subjectIds.set(subject.name, subject.id);
        const weeksResponse = await fetch(`/api/subject/${subject.id}/weeks/`, { credentials: 'same-origin' });
        const weeksData = weeksResponse.ok ? await weeksResponse.json() : { weeks: [] };
        weeklyMap[subject.name] = (weeksData.weeks || []).map((week) => ({
          ...week,
          _id: week.id,
          quizCode: week.quiz_code || null,
          active: week.active !== false,
        }));
      }

    } catch (error) {
      if (window.errorToast) window.errorToast('Lỗi tải dữ liệu', error.message);
    }
  }

  async function syncQuizLinks() {
    try {
      const response = await fetch('/api/quiz-links/', {
        credentials: 'same-origin',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      });
      if (!response.ok) return;
      const data = await response.json();
      (data.links || []).forEach((quiz) => {
        const weeks = weeklyMap[quiz.subject] || [];
        const week = weeks[Number(quiz.week_index)];
        if (week) {
          week.link = quiz.link;
          week.quizCode = quiz.code;
          week.active = quiz.is_active;
        }
      });
      renderAll();
    } catch {
      // Giữ dữ liệu local hiện có nếu API không truy cập được.
    }
  }

  // ── Submit form: thêm môn học mới ──
  form.addEventListener('submit', async (e) => {
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

    try {
      const response = await fetch('/api/subject/create/', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfToken() },
        credentials: 'same-origin', body: JSON.stringify({ name }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Không thể thêm môn học');
      subjects.push(data.subject.name);
      subjectIds.set(data.subject.name, data.subject.id);
      weeklyMap[data.subject.name] = [];
      renderAll();
      input.value = '';
      input.focus();
      if (window.successToast) window.successToast('Thành công', `Đã thêm môn "${name}"`);
    } catch (error) {
      if (window.errorToast) window.errorToast('Lỗi', error.message);
    }
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
      const subjectId = subjectIds.get(name);
      if (subjectId) {
        const response = await fetch(`/api/subject/${subjectId}/`, {
          method: 'POST', headers: { 'X-CSRFToken': getCsrfToken() }, credentials: 'same-origin',
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
          if (window.errorToast) window.errorToast('Lỗi', data.message || 'Không thể xóa môn học');
          return;
        }
      }
      subjects.splice(idx, 1);
      delete weeklyMap[name];
      subjectIds.delete(name);
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
      const subjectWeeks = weeklyMap[name] || [];
      const linkedWeeks = subjectWeeks.filter((week) => week.link).length;
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
            <span class="smh-card-meta">${subjectWeeks.length} tuần học</span>
            <span class="smh-card-link-status ${linkedWeeks ? 'is-linked' : ''}">
              ${linkedWeeks ? `${linkedWeeks}/${subjectWeeks.length} tuần đã có link` : 'Chưa có liên bài làm.'}
            </span>
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
      title: `Cài đặt môn học: ${escapeHtml(subjectName)}`,
      bodyHTML: `
        <div class="smh-modal-section">
          <label class="smh-modal-label">Chạm bên dưới để đổi tên môn học!</label>
          <input
            type="text"
            id="smh-rename-input"
            class="smh-modal-input"
            value="${escapeHtml(subjectName)}"
            maxlength="80"
          />
        </div>

        <div class="smh-modal-section">
          <span class="smh-modal-label">Danh sách (${weeks.length})</span>
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
          const subjectId = subjectIds.get(subjectName);
          if (subjectId) {
            fetch(`/api/subject/${subjectId}/rename/`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfToken() },
              credentials: 'same-origin',
              body: JSON.stringify({ name: newName }),
            }).then(async (response) => {
              const data = await response.json();
              if (!response.ok || !data.success) throw new Error(data.message || 'Không thể đổi tên môn học');
              subjects[idx] = newName;
              subjectIds.delete(subjectName);
              subjectIds.set(newName, subjectId);
              weeklyMap[newName] = weeklyMap[subjectName] || [];
              delete weeklyMap[subjectName];
              renderAll();
              if (window.successToast) window.successToast('Đã lưu', `Đổi tên thành "${newName}"`);
            }).catch((error) => {
              if (window.errorToast) window.errorToast('Lỗi', error.message);
            });
          } else {
            subjects[idx] = newName;
            weeklyMap[newName] = weeklyMap[subjectName] || [];
            delete weeklyMap[subjectName];
            renderAll();
          }
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
          const week = weeklyMap[subjectName][weekIdx];
          if (week._id) {
            const response = await fetch(`/api/week/${week._id}/delete/`, {
              method: 'POST', headers: { 'X-CSRFToken': getCsrfToken() }, credentials: 'same-origin',
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
              if (window.errorToast) window.errorToast('Lỗi', data.message || 'Không thể xóa tuần học');
              return;
            }
          }
          weeklyMap[subjectName].splice(weekIdx, 1);
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
          if (week.quizCode) {
            try {
              const response = await fetch(`/api/quiz/${encodeURIComponent(week.quizCode)}/toggle/`, {
                method: 'POST',
                headers: { 'X-CSRFToken': getCsrfToken() },
                credentials: 'same-origin',
              });
              const result = await response.json();
              if (!response.ok || !result.success) throw new Error(result.message || 'Không thể đổi trạng thái');
              week.active = result.is_active;
            } catch (error) {
              if (window.errorToast) window.errorToast('Lỗi', error.message);
              return;
            }
          } else {
            week.active = !week.active;
          }
          listEl.innerHTML = renderWeekList(weeklyMap[subjectName]);
          renderAll();
          if (window.successToast) window.successToast(
            week.active ? 'Đã kích hoạt' : 'Đã tạm dừng',
            week.active ? `${week.name} đang hoạt động` : `${week.name} đã tạm ngưng`
          );
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
      return '<li class="smh-modal-week-empty">Bạn chưa thêm danh sách nào, mau chóng thêm ngay nhé!</li>';
    }
    return weeks.map((w, i) => {
      const active = w.active !== false; // mặc định active
      const desc = getWeekDescription(w);
      const descHtml = desc
        ? `<p class="smh-modal-week-desc" title="${escapeHtml(desc)}">${escapeHtml(desc)}</p>`
        : `<p class="smh-modal-week-desc smh-modal-week-desc--empty">Chưa có mô tả nội dung</p>`;
      const linkHtml = w.link
        ? `<span class="smh-modal-week-link is-linked">Đã có link</span>`
        : '<span class="smh-modal-week-link">Chưa có liên kết</span>';
      const editHtml = w.quizCode
        ? `<a class="smh-modal-week-edit" href="/tao-de/?quiz=${encodeURIComponent(w.quizCode)}">Chỉnh sửa</a>`
        : '<span class="smh-modal-week-edit is-disabled">Chỉnh sửa</span>';
      return `
        <li class="smh-modal-week-item ${active ? 'is-active' : 'is-inactive'}">
          <div class="smh-modal-week-row">
            <span class="smh-modal-week-num">${i + 1}</span>
            <span class="smh-modal-week-name">${escapeHtml(w.name)}</span>
            ${linkHtml}
            <span class="smh-modal-week-activity">
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
            </span>
            ${editHtml}
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
      title: `Thêm Tuần Học cho "${escapeHtml(subjectName)}"`,
      bodyHTML: `
        <div class="smh-modal-section">
          <label class="smh-modal-label" for="smh-week-name-input">Nhập Tên Tuần Học</label>
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
          <span class="smh-modal-label">Mô tả nội dung</span>
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
        const subjectId = subjectIds.get(subjectName);
        if (!subjectId) {
          if (window.errorToast) window.errorToast('Lỗi', 'Không tìm thấy môn học trong cơ sở dữ liệu');
          return false;
        }
        fetch(`/api/subject/${subjectId}/week/create/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfToken() },
          credentials: 'same-origin',
          body: JSON.stringify({ name, topics: desc ? [desc] : [] }),
        }).then(async (response) => {
          const data = await response.json();
          if (!response.ok || !data.success) throw new Error(data.message || 'Không thể thêm tuần học');
          const newWeek = { ...data.week, _id: data.week.id, active: true };
          if (!weeklyMap[subjectName]) weeklyMap[subjectName] = [];
          weeklyMap[subjectName].push(newWeek);
          renderAll();
          if (window.successToast) window.successToast('Đã thêm', name);
        }).catch((error) => {
          if (window.errorToast) window.errorToast('Lỗi', error.message);
        });
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

  function getCsrfToken() {
    return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ||
      document.cookie.split('; ').find((row) => row.startsWith('csrftoken='))?.split('=')[1] || '';
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
