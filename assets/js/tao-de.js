document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  const storageSubjectsKey = 'qhun22_subjects';
  const storageWeeksKey = 'qhun22_subjects_weeks';
  const csrfToken = document
    .querySelector('meta[name="csrf-token"]')
    ?.getAttribute('content') || '';

  const $ = (id) => document.getElementById(id);

  const subjectSelect = $('tq-subject-select');
  const weekSelect = $('tq-week-select');
  const weekHint = $('tq-week-hint');
  const dropzone = $('tq-dropzone');
  const fileInput = $('tq-file-input');
  const fileInfo = $('tq-file-info');
  const fileNameEl = $('tq-file-name');
  const fileRemove = $('tq-file-remove');
  const btnParse = $('tq-btn-parse');
  const btnClear = $('tq-btn-clear');
  const listEl = $('tq-list');
  const emptyState = $('tq-empty');
  const countNum = $('tq-count-num');
  const toolbarStat = $('tq-toolbar-stat');
  const statOk = $('tq-stat-ok');
  const statWarnWrap = $('tq-stat-warn-wrap');
  const statWarn = $('tq-stat-warn');
  const warningsPanel = $('tq-warnings');
  const statSingle = $('tq-stat-single');
  const statMultiple = $('tq-stat-multiple');
  const statUnknown = $('tq-stat-unknown');
  const statDuplicate = $('tq-stat-duplicate');
  const statDuplicateWrap = $('tq-stat-duplicate-wrap');

  if (!subjectSelect || !weekSelect || !dropzone) return;

  // ── Cập nhật các badge loại câu hỏi trong header ──
  function updateTypeCounters(singleCount, multipleCount, unknownCount, duplicateCount) {
    if (statSingle) statSingle.textContent = singleCount;
    if (statMultiple) statMultiple.textContent = multipleCount;
    if (statUnknown) statUnknown.textContent = unknownCount;
    if (statDuplicate) statDuplicate.textContent = duplicateCount;
    if (statDuplicateWrap) statDuplicateWrap.hidden = !duplicateCount;
  }

  let currentFile = null;
  let questions = [];

  // ── Storage helpers (đồng bộ với tao-mon-hoc.js) ──
  function loadSubjects() {
    try {
      const raw = localStorage.getItem(storageSubjectsKey);
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function loadWeeklyMap() {
    try {
      const raw = localStorage.getItem(storageWeeksKey);
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  // ── Render subject select ──
  function populateSubjects() {
    const subjects = loadSubjects();
    const weeklyMap = loadWeeklyMap();

    const previous = subjectSelect.value;
    subjectSelect.innerHTML = '<option value="">-- Chọn môn học --</option>';
    if (!subjects.length) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = '(Chưa có môn học nào)';
      opt.disabled = true;
      subjectSelect.appendChild(opt);
      weekSelect.disabled = true;
      weekSelect.innerHTML = '<option value="">-- Chọn tuần học --</option>';
      weekHint.hidden = false;
      return;
    }

    subjects.forEach((s) => {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s;
      subjectSelect.appendChild(opt);
    });

    if (previous && subjects.includes(previous)) {
      subjectSelect.value = previous;
    }
    updateWeeks();
  }

  function updateWeeks() {
    const subject = subjectSelect.value;
    const weeklyMap = loadWeeklyMap();
    const weeks = subject ? weeklyMap[subject] || [] : [];

    weekSelect.innerHTML = '<option value="">-- Chọn tuần học --</option>';
    if (!subject) {
      weekSelect.disabled = true;
      weekHint.hidden = false;
      weekHint.textContent = 'Chọn môn học trước.';
      return;
    }

    if (!weeks.length) {
      weekSelect.disabled = true;
      weekHint.hidden = false;
      weekHint.innerHTML = `Môn "${subject}" chưa có tuần học. Vào <a href="/tao-mon-hoc/">Tạo môn học</a> để thêm.`;
      return;
    }

    weekSelect.disabled = false;
    weekHint.hidden = true;
    weeks.forEach((w, i) => {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = `${i + 1}. ${w.name}`;
      weekSelect.appendChild(opt);
    });
    weekSelect.value = '0'; // mặc định chọn tuần đầu
  }

  // ── File handling ──
  function setFile(file) {
    if (!file) {
      currentFile = null;
      fileInfo.hidden = true;
      btnParse.disabled = true;
      return;
    }

    const name = (file.name || '').toLowerCase();
    if (!name.endsWith('.docx')) {
      if (window.errorToast) {
        window.errorToast('Sai định dạng', 'Chỉ chấp nhận file .docx');
      }
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      if (window.errorToast) {
        window.errorToast('File quá lớn', 'Tối đa 20MB');
      }
      return;
    }

    currentFile = file;
    fileNameEl.textContent = file.name;
    fileInfo.hidden = false;
    btnParse.disabled = !subjectSelect.value || weekSelect.disabled;
  }

  function clearFile() {
    currentFile = null;
    fileInput.value = '';
    fileInfo.hidden = true;
    btnParse.disabled = true;
  }

  // ── Drag & drop ──
  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput.click();
    }
  });
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('is-dragover');
  });
  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('is-dragover');
  });
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('is-dragover');
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) setFile(file);
  });
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) setFile(file);
  });
  fileRemove.addEventListener('click', (e) => {
    e.stopPropagation();
    clearFile();
  });

  // ── Selects ──
  subjectSelect.addEventListener('change', () => {
    updateWeeks();
    btnParse.disabled = !currentFile || !subjectSelect.value || weekSelect.disabled;
  });
  weekSelect.addEventListener('change', () => {
    btnParse.disabled = !currentFile || !subjectSelect.value || weekSelect.disabled;
  });

  // ── Parse ──
  btnParse.addEventListener('click', async () => {
    if (!currentFile) {
      if (window.warningToast) window.warningToast('Chưa có file', 'Vui lòng chọn file Word');
      return;
    }
    if (!subjectSelect.value) {
      if (window.warningToast) window.warningToast('Chưa chọn môn', 'Vui lòng chọn môn học');
      return;
    }

    dropzone.classList.add('is-loading');
    btnParse.disabled = true;
    btnClear.disabled = false;

    const formData = new FormData();
    formData.append('file', currentFile);
    formData.append('subject', subjectSelect.value);
    formData.append('week_index', weekSelect.value || '');

    try {
      const res = await fetch('/api/parse-word/', {
        method: 'POST',
        headers: {
          'X-CSRFToken': csrfToken,
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: formData,
        credentials: 'same-origin',
      });
      const data = await res.json();

      if (!res.ok || data.success === false) {
        const msg = data.error || 'Không thể parse file Word.';
        if (window.errorToast) window.errorToast('Lỗi parse', msg);
        renderQuestions([], []);
        return;
      }

      questions = Array.isArray(data.questions) ? data.questions : [];
      // Gán id tạm để popover tham chiếu
      questions.forEach((q, i) => {
        if (!q.id) q.id = `q-${Date.now()}-${i}`;
      });
      // Phát hiện câu trùng
      detectDuplicates();
      renderQuestions(questions, data.warnings || []);
      if (window.successToast) {
        window.successToast(
          'Đã parse',
          `${questions.length} câu hỏi từ "${currentFile.name}"`,
        );
      }
    } catch (err) {
      if (window.errorToast) {
        window.errorToast('Lỗi mạng', String(err && err.message ? err.message : err));
      }
      renderQuestions([], []);
    } finally {
      dropzone.classList.remove('is-loading');
      btnParse.disabled = !currentFile;
    }
  });

  btnClear.addEventListener('click', () => {
    clearFile();
    renderQuestions([], []);
    if (window.infoToast) window.infoToast('Đã xóa', 'Danh sách câu hỏi đã được làm mới');
  });

  // ── Render ──
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
  }

  function renderQuestions(items, warnings) {
    questions = items;

    // Stats
    const validCount = items.filter(
      (q) => q.options && q.options.length >= 2 && q.answer,
    ).length;
    const warnCount = items.length - validCount;

    // Đếm theo loại câu hỏi
    const singleCount = items.filter((q) => q.type === 'single_choice').length;
    const multipleCount = items.filter((q) => q.type === 'multiple_response').length;
    const unknownCount = items.filter((q) => q.type === 'unknown').length;
    const duplicateCount = items.filter((q) => q.isDuplicate).length;

    countNum.textContent = items.length;
    toolbarStat.hidden = items.length === 0;
    statOk.textContent = validCount;
    statWarn.textContent = warnCount;
    statWarnWrap.hidden = warnCount === 0;

    // Cập nhật các badge thống kê loại câu hỏi (nếu có trong DOM)
    updateTypeCounters(singleCount, multipleCount, unknownCount, duplicateCount);

    // Warnings panel
    warningsPanel.hidden = !warnings || warnings.length === 0;
    if (warnings && warnings.length) {
      warningsPanel.innerHTML = `
        <p class="tq-warnings-title">
          <i data-lucide="alert-triangle" class="tq-icon"></i>
          ${warnings.length} cảnh báo từ parser
        </p>
        <ul class="tq-warnings-list">
          ${warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join('')}
        </ul>
      `;
    }

    // List
    if (!items.length) {
      listEl.innerHTML = '';
      emptyState.hidden = false;
      btnClear.disabled = true;
      return;
    }
    emptyState.hidden = true;
    btnClear.disabled = false;

    listEl.innerHTML = items.map((q, idx) => {
      const opts = (q.options || []).map((o) => `
        <li class="tq-option ${o.correct ? 'is-correct' : ''}">
          <span class="tq-option-label">${escapeHtml(o.label)}</span>
          <span class="tq-option-text">${escapeHtml(o.text)}</span>
          ${o.correct ? `<span class="tq-option-correct-badge" aria-label="Đáp án đúng"><i data-lucide="check" class="tq-icon tq-icon--sm"></i><span>Đúng</span></span>` : ''}
        </li>
      `).join('');

      // ── Loại câu hỏi + đáp án đúng ──
      const typeClass = `tq-type--${q.type || 'unknown'}`;
      const typeLabel = q.type_label || 'Chưa xác định';
      const correctLabels = (q.correct_options || []).map((o) => o.label).join(', ');

      // STT hiển thị = thứ tự thật trong danh sách (liên tục 1, 2, 3...)
      const displayNum = idx + 1;
      const showOriginal =
        q.number != null && q.number !== displayNum;

      return `
        <li class="tq-question ${q.isDuplicate ? 'is-duplicate' : ''}" data-qid="${q.id}">
          <div class="tq-question-header">
            <span class="tq-question-num">${displayNum}</span>
            <p class="tq-question-text">${escapeHtml(q.text || '(Không có nội dung)')}</p>
            <div class="tq-question-actions">
              <button
                type="button"
                class="tq-question-settings"
                data-qid="${q.id}"
                title="Cài đặt câu hỏi"
                aria-label="Mở cài đặt câu hỏi"
              >
                <i data-lucide="settings-2" class="tq-icon"></i>
              </button>
              <button
                type="button"
                class="tq-question-delete"
                data-qid="${q.id}"
                title="Xóa câu hỏi"
                aria-label="Xóa câu hỏi"
              >
                <i data-lucide="trash-2" class="tq-icon"></i>
              </button>
            </div>
          </div>
          ${q.isDuplicate ? `
            <div class="tq-question-warning">
              <i data-lucide="copy-x" class="tq-icon"></i>
              <span>Câu hỏi trùng với ${escapeHtml(q.duplicateWith || 'câu khác')}</span>
            </div>
          ` : ''}
          <div class="tq-question-meta">
            <span class="tq-type ${typeClass}">
              ${escapeHtml(typeLabel)}
            </span>
            ${showOriginal
              ? `<span class="tq-original-num" title="STT gốc trong file Word">#${q.number}</span>`
              : ''}
            ${correctLabels
              ? `<span class="tq-answer">Đáp án đúng: <strong>${escapeHtml(correctLabels)}</strong></span>`
              : `<span class="tq-answer tq-answer--missing">Chưa xác định đáp án đúng</span>`
            }
          </div>
          <ul class="tq-options">${opts}</ul>
        </li>
      `;
    }).join('');

    // Gắn handler cho nút bánh răng
    listEl.querySelectorAll('.tq-question-settings').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const qid = btn.getAttribute('data-qid');
        openQuestionSettings(qid);
      });
    });

    // Gắn handler cho nút thùng rác
    listEl.querySelectorAll('.tq-question-delete').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const qid = btn.getAttribute('data-qid');
        deleteQuestion(qid);
      });
    });

    // Khởi tạo Lucide icons trong DOM vừa render
    if (window.lucide && window.lucide.createIcons) {
      window.lucide.createIcons();
    }
  }

  // ╔══════════════════════════════════════════════════════════════╗
  // ║  POPOVER CÀI ĐẶT CÂU HỎI                                  ║
  // ║  Mở box nổi giữa màn hình cho phép:                        ║
  // ║  - Đổi loại câu hỏi (single ↔ multiple)                    ║
  // ║  - Sửa text câu hỏi                                         ║
  // ║  - Sửa nội dung + đánh dấu đáp án đúng cho từng option     ║
  // ╚══════════════════════════════════════════════════════════════╝

  function ensurePopover() {
    let overlay = document.getElementById('tq-settings-overlay');
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'tq-settings-overlay';
    overlay.className = 'tq-settings-overlay';
    overlay.hidden = true;
    overlay.innerHTML = `
      <div class="tq-settings-popover" role="dialog" aria-modal="true" aria-labelledby="tq-settings-title">
        <div class="tq-settings-header">
          <h3 class="tq-settings-title" id="tq-settings-title">
            <i data-lucide="settings-2" class="tq-icon"></i>
            <span>Cài đặt câu hỏi</span>
          </h3>
          <button type="button" class="tq-settings-close" aria-label="Đóng" data-action="close">
            <i data-lucide="x" class="tq-icon"></i>
          </button>
        </div>
        <div class="tq-settings-body" id="tq-settings-body"></div>
        <div class="tq-settings-footer">
          <button type="button" class="smh-btn smh-btn--ghost" data-action="close">Hủy</button>
          <button type="button" class="smh-btn smh-btn--primary" data-action="save">
            <i data-lucide="check" class="tq-icon"></i>
            <span>Lưu thay đổi</span>
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    // Click overlay ngoài popover → đóng
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeQuestionSettings();
    });
    // Nút close / hủy
    overlay.querySelectorAll('[data-action="close"]').forEach((el) => {
      el.addEventListener('click', closeQuestionSettings);
    });
    // Nút lưu
    overlay.querySelector('[data-action="save"]').addEventListener(
      'click',
      saveQuestionSettings,
    );
    // ESC để đóng
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !overlay.hidden) closeQuestionSettings();
    });

    return overlay;
  }

  let currentEditingQid = null;

  function openQuestionSettings(qid) {
    const overlay = ensurePopover();
    const q = questions.find((x) => x.id === qid);
    if (!q) return;

    currentEditingQid = qid;
    const body = overlay.querySelector('#tq-settings-body');

    // STT hiển thị = index + 1
    const idx = questions.findIndex((x) => x.id === qid);
    const displayNum = idx >= 0 ? idx + 1 : q.number;

    const optionsHtml = (q.options || [])
      .map(
        (o, i) => `
        <li class="tq-edit-option" data-idx="${i}">
          <span class="tq-edit-option-label">${escapeHtml(o.label)}</span>
          <input
            type="text"
            class="tq-edit-option-input"
            value="${escapeHtml(o.text)}"
            placeholder="Nội dung đáp án ${escapeHtml(o.label)}"
          />
          <label class="tq-edit-correct" title="Đánh dấu đáp án đúng">
            <input
              type="checkbox"
              class="tq-edit-correct-cb"
              ${o.correct ? 'checked' : ''}
            />
            <span><i data-lucide="check" class="tq-icon tq-icon--sm"></i></span>
          </label>
        </li>
      `,
      )
      .join('');

    body.innerHTML = `
      <div class="tq-edit-row">
        <span class="tq-edit-label">Câu số</span>
        <span class="tq-edit-stt">${displayNum}</span>
        ${q.number != null && q.number !== displayNum
          ? `<span class="tq-edit-original">(gốc: #${q.number})</span>`
          : ''}
      </div>

      <div class="tq-edit-row">
        <span class="tq-edit-label">Loại câu hỏi</span>
        <div class="tq-edit-type" role="radiogroup">
          <button
            type="button"
            class="tq-edit-type-btn ${q.type === 'single_choice' ? 'is-active' : ''}"
            data-type="single_choice"
            role="radio"
            aria-checked="${q.type === 'single_choice'}"
          >
            <i data-lucide="circle-dot" class="tq-icon tq-icon--sm"></i>
            1 đáp án đúng
          </button>
          <button
            type="button"
            class="tq-edit-type-btn ${q.type === 'multiple_response' ? 'is-active' : ''}"
            data-type="multiple_response"
            role="radio"
            aria-checked="${q.type === 'multiple_response'}"
          >
            <i data-lucide="check-square" class="tq-icon tq-icon--sm"></i>
            Nhiều đáp án đúng
          </button>
        </div>
      </div>

      <div class="tq-edit-row">
        <label class="tq-edit-label" for="tq-edit-text">Nội dung câu hỏi</label>
        <textarea
          id="tq-edit-text"
          class="tq-edit-textarea"
          rows="3"
          placeholder="Nhập nội dung câu hỏi..."
        >${escapeHtml(q.text || '')}</textarea>
      </div>

      <div class="tq-edit-row">
        <span class="tq-edit-label">Các đáp án</span>
        <ul class="tq-edit-options">${optionsHtml}</ul>
      </div>
    `;

    // Toggle type buttons
    body.querySelectorAll('.tq-edit-type-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        body.querySelectorAll('.tq-edit-type-btn').forEach((b) => {
          b.classList.remove('is-active');
          b.setAttribute('aria-checked', 'false');
        });
        btn.classList.add('is-active');
        btn.setAttribute('aria-checked', 'true');
      });
    });

    // Toggle single-choice: nếu user chọn single_choice mà có >1 đáp án đúng
    // → giữ nguyên và cảnh báo trong footer? Ở đây để user tự bỏ tick.
    // (UX an toàn: không tự động bỏ đáp án đúng.)

    overlay.hidden = false;
    document.body.classList.add('tq-popover-open');

    // Khởi tạo Lucide icons trong popover
    if (window.lucide && window.lucide.createIcons) {
      window.lucide.createIcons();
    }

    // focus vào textarea
    setTimeout(() => {
      const ta = body.querySelector('#tq-edit-text');
      if (ta) ta.focus();
    }, 50);
  }

  function deleteQuestion(qid) {
    const q = questions.find((x) => x.id === qid);
    if (!q) return;
    const idx = questions.findIndex((x) => x.id === qid);
    const displayNum = idx >= 0 ? idx + 1 : q.number;

    // Xác nhận bằng confirm.js (dùng confirmDanger cho style đỏ)
    if (window.confirmDanger) {
      window.confirmDanger(
        'Xóa câu hỏi?',
        `Câu ${displayNum} sẽ bị xóa khỏi danh sách. Bạn có chắc chắn?`,
      ).then((ok) => {
        if (ok) performDelete(qid);
      });
    } else if (window.showConfirm) {
      window
        .showConfirm({
          title: 'Xóa câu hỏi?',
          message: `Câu ${displayNum} sẽ bị xóa khỏi danh sách. Bạn có chắc chắn?`,
          confirmLabel: 'Xóa',
          cancelLabel: 'Hủy',
          type: 'danger',
        })
        .then((ok) => {
          if (ok) performDelete(qid);
        });
    } else if (window.confirm(`Xóa câu ${displayNum}?`)) {
      performDelete(qid);
    }
  }

  function performDelete(qid) {
    const before = questions.length;
    questions = questions.filter((x) => x.id !== qid);
    if (questions.length === before) return;

    // Tính lại duplicate sau khi xóa
    detectDuplicates();

    renderQuestions(questions, []);
    if (window.successToast) {
      window.successToast('Đã xóa', `Còn lại ${questions.length} câu hỏi`);
    }
  }

  // ╔══════════════════════════════════════════════════════════════╗
  // ║  PHÁT HIỆN CÂU HỎI TRÙNG                                  ║
  // ║  So sánh theo: (text chuẩn hóa) + (đáp án đúng sắp xếp)    ║
  // ╚══════════════════════════════════════════════════════════════╝
  function normalizeText(s) {
    if (!s) return '';
    return s
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\sàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỷỹđ]/g, '')
      .trim();
  }

  function detectDuplicates() {
    // Reset
    questions.forEach((q) => {
      q.isDuplicate = false;
      q.duplicateWith = null;
    });

    const seen = new Map(); // key → first index
    questions.forEach((q, idx) => {
      const correctLabels = (q.correct_options || [])
        .map((o) => o.label)
        .sort()
        .join(',');
      const key = `${normalizeText(q.text)}::${correctLabels}`;

      if (seen.has(key)) {
        const firstIdx = seen.get(key);
        const firstNum = firstIdx + 1;
        q.isDuplicate = true;
        q.duplicateWith = `câu ${firstNum}`;
        // Đánh dấu luôn câu đầu tiên
        if (!questions[firstIdx].isDuplicate) {
          questions[firstIdx].isDuplicate = true;
          questions[firstIdx].duplicateWith = `câu ${idx + 1}`;
        }
      } else {
        seen.set(key, idx);
      }
    });
  }

  function closeQuestionSettings() {
    const overlay = document.getElementById('tq-settings-overlay');
    if (overlay) overlay.hidden = true;
    document.body.classList.remove('tq-popover-open');
    currentEditingQid = null;
  }

  function saveQuestionSettings() {
    if (!currentEditingQid) return;
    const overlay = document.getElementById('tq-settings-overlay');
    const body = overlay.querySelector('#tq-settings-body');

    const q = questions.find((x) => x.id === currentEditingQid);
    if (!q) return closeQuestionSettings();

    // 1. Lấy text câu hỏi
    const text = body.querySelector('#tq-edit-text').value.trim();
    // 2. Lấy loại
    const activeTypeBtn = body.querySelector('.tq-edit-type-btn.is-active');
    const newType = activeTypeBtn ? activeTypeBtn.dataset.type : q.type;
    // 3. Lấy options
    const newOptions = [];
    body.querySelectorAll('.tq-edit-option').forEach((li) => {
      const idx = parseInt(li.dataset.idx, 10);
      const orig = q.options[idx];
      const input = li.querySelector('.tq-edit-option-input');
      const cb = li.querySelector('.tq-edit-correct-cb');
      newOptions.push({
        label: orig.label,
        text: input.value.trim(),
        correct: cb.checked,
      });
    });

    // Áp dụng
    q.text = text;
    q.options = newOptions;
    q.correct_options = newOptions.filter((o) => o.correct);

    // Đảm bảo consistency giữa type và số correct
    const correctCount = q.correct_options.length;
    if (newType === 'single_choice') {
      q.type = 'single_choice';
      q.type_label = '1 đáp án đúng';
      // Nếu có nhiều đáp án đúng → giữ nguyên (đã gán mác), nhưng chỉ lấy 1 đầu tiên làm answer
      q.answer = correctCount ? q.correct_options[0].label : null;
    } else if (newType === 'multiple_response') {
      q.type = 'multiple_response';
      q.type_label = 'Nhiều đáp án đúng';
      q.answer = q.correct_options.map((o) => o.label).join(', ');
    } else {
      q.type = 'unknown';
      q.type_label = 'Chưa xác định';
      q.answer = null;
    }

    // Re-render (tính lại duplicate vì text/answer có thể đã đổi)
    detectDuplicates();
    renderQuestions(questions, []);
    closeQuestionSettings();

    if (window.successToast) {
      window.successToast('Đã lưu', 'Câu hỏi đã được cập nhật');
    }
  }

  // ── Init ──
  populateSubjects();
  renderQuestions([], []);
});