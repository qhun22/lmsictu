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
  const statTf = $('tq-stat-tf');
  const statFill = $('tq-stat-fill');
  const statOrder = $('tq-stat-order');
  const statSingleWrap = $('tq-stat-single-wrap');
  const statMultipleWrap = $('tq-stat-multiple-wrap');
  const statTfWrap = $('tq-stat-tf-wrap');
  const statFillWrap = $('tq-stat-fill-wrap');
  const statOrderWrap = $('tq-stat-order-wrap');

  if (!subjectSelect || !weekSelect || !dropzone) return;

  // ── Cập nhật các badge loại câu hỏi trong header ──
  function updateTypeCounters(s) {
    // s là object { single, multiple, tf, fill, order, unknown, duplicate }
    if (statSingle) statSingle.textContent = s.single || 0;
    if (statMultiple) statMultiple.textContent = s.multiple || 0;
    if (statTf) statTf.textContent = s.tf || 0;
    if (statFill) statFill.textContent = s.fill || 0;
    if (statOrder) statOrder.textContent = s.order || 0;
    if (statUnknown) statUnknown.textContent = s.unknown || 0;
    if (statDuplicate) statDuplicate.textContent = s.duplicate || 0;
    if (statSingleWrap) statSingleWrap.hidden = !(s.single);
    if (statMultipleWrap) statMultipleWrap.hidden = !(s.multiple);
    if (statTfWrap) statTfWrap.hidden = !(s.tf);
    if (statFillWrap) statFillWrap.hidden = !(s.fill);
    if (statOrderWrap) statOrderWrap.hidden = !(s.order);
    if (statDuplicateWrap) statDuplicateWrap.hidden = !(s.duplicate);
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
  // ╔══════════════════════════════════════════════════════════════╗
  // ║  Render phần chỉnh sửa cho 3 dạng đặc biệt                    ║
  // ╚══════════════════════════════════════════════════════════════╝
  function renderEditSpecial(q) {
    if (q.type === 'true_false') {
      const correct = (q.correct_options || [])[0];
      const tf = correct
        ? /sai|false/.test(correct.text.toLowerCase())
          ? 'false'
          : 'true'
        : '';
      return `
        <div class="tq-edit-row">
          <span class="tq-edit-label">Chọn đáp án đúng</span>
          <div class="tq-edit-tf">
            <label class="tq-edit-tf-item ${tf === 'true' ? 'is-active' : ''}">
              <input type="radio" name="tq-edit-tf" value="true" ${tf === 'true' ? 'checked' : ''} />
              <i data-lucide="check" class="tq-icon"></i> Đúng
            </label>
            <label class="tq-edit-tf-item ${tf === 'false' ? 'is-active' : ''}">
              <input type="radio" name="tq-edit-tf" value="false" ${tf === 'false' ? 'checked' : ''} />
              <i data-lucide="x" class="tq-icon"></i> Sai
            </label>
          </div>
        </div>
      `;
    }
    if (q.type === 'fill_in_blank') {
      return `
        <div class="tq-edit-row">
          <label class="tq-edit-label" for="tq-edit-fill-answer">Đáp án điền vào chỗ trống</label>
          <input
            type="text"
            id="tq-edit-fill-answer"
            class="tq-edit-input"
            value="${escapeHtml(q.fill_blank_answer || '')}"
            placeholder="VD: Việt Nam"
          />
          <p class="tq-edit-hint">
            <i data-lucide="info" class="tq-icon tq-icon--sm"></i>
            Trong nội dung câu hỏi, dùng <code>___</code>, <code>[ ]</code>, hoặc <code>( )</code> để đánh dấu chỗ trống.
          </p>
        </div>
      `;
    }
    if (q.type === 'ordering') {
      const words = (q.ordering_words || []).join('|');
      const seq = (q.ordering_sequence || []).join('|');
      return `
        <div class="tq-edit-row">
          <label class="tq-edit-label" for="tq-edit-order-words">Từ lộn xộn (các từ, phân cách bằng <code>|</code>)</label>
          <input
            type="text"
            id="tq-edit-order-words"
            class="tq-edit-input"
            value="${escapeHtml(words)}"
            placeholder="VD: Huy|name|is|My"
          />
        </div>
        <div class="tq-edit-row">
          <label class="tq-edit-label" for="tq-edit-order-seq">Thứ tự đúng (các từ, phân cách bằng <code>|</code>)</label>
          <input
            type="text"
            id="tq-edit-order-seq"
            class="tq-edit-input"
            value="${escapeHtml(seq)}"
            placeholder="VD: My|name|is|Huy"
          />
          <p class="tq-edit-hint">
            <i data-lucide="info" class="tq-icon tq-icon--sm"></i>
            Có thể kéo-thả các thẻ từ để thay đổi thứ tự sau khi lưu.
          </p>
        </div>
      `;
    }
    // single_choice / multiple_response / unknown → render options A/B/C/D
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
    return `
      <div class="tq-edit-row">
        <span class="tq-edit-label">Các đáp án</span>
        <ul class="tq-edit-options">${optionsHtml}</ul>
      </div>
    `;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
  }

  // ╔══════════════════════════════════════════════════════════════╗
  // ║  Render đặc biệt cho true_false / ordering / fill_in_blank    ║
  // ╚══════════════════════════════════════════════════════════════╝
  function renderSpecial(q) {
    if (q.type === 'true_false') {
      const correct = (q.correct_options || [])[0];
      const ver = correct ? correct.text.replace(/[.。]/g, '').toLowerCase() : '';
      const isTrue = /đúng|true/.test(ver);
      return `
        <div class="tq-special tq-special--tf">
          <span class="tq-tf-option ${isTrue ? 'is-correct' : ''}">
            <i data-lucide="check" class="tq-icon tq-icon--sm"></i> Đúng
          </span>
          <span class="tq-tf-option ${!isTrue && correct ? 'is-correct' : ''}">
            <i data-lucide="x" class="tq-icon tq-icon--sm"></i> Sai
          </span>
        </div>
      `;
    }
    if (q.type === 'fill_in_blank') {
      const ans = q.fill_blank_answer;
      // Highlight chỗ trống ___ hoặc [ ] trong body
      const body = q.text || '';
      let htmlBody = escapeHtml(body);
      htmlBody = htmlBody.replace(
        /(_{3,}|\[\s*\]|\(\s*\)|…+|\.\.\.+)/g,
        '<span class="tq-fill-blank">______</span>',
      );
      const markerBlock = q.marker
        ? `<p class="tq-fill-marker"><i data-lucide="edit-3" class="tq-icon tq-icon--sm"></i>${escapeHtml(q.marker)}</p>`
        : '';
      const answerBlock = ans
        ? `<p class="tq-fill-answer">
            <i data-lucide="edit-3" class="tq-icon tq-icon--sm"></i>
            Đáp án điền: <strong>${escapeHtml(ans)}</strong>
          </p>`
        : `<p class="tq-fill-answer tq-fill-answer--missing">
            <i data-lucide="alert-triangle" class="tq-icon tq-icon--sm"></i>
            <span>Chưa xác định được đáp án điền</span>
            <em class="tq-fill-hint">
              Trong Word, đáp án cần nằm trên một dòng riêng có dấu
              <code>*</code>, <code>•</code>, hoặc <code>-</code>
              ở đầu (VD: <code>*Việt Nam</code>).
            </em>
          </p>`;
      return `
        <div class="tq-special tq-special--fill">
          ${markerBlock}
          <p class="tq-fill-sentence">${htmlBody}</p>
          ${answerBlock}
        </div>
      `;
    }
    if (q.type === 'ordering') {
      const words = q.ordering_words || [];
      const seq = q.ordering_sequence || [];
      const markerBlock = q.marker
        ? `<p class="tq-fill-marker"><i data-lucide="align-vertical-justify-center" class="tq-icon tq-icon--sm"></i>${escapeHtml(q.marker)}</p>`
        : '';
      const missingHint = (words.length === 0 || seq.length === 0)
        ? `<p class="tq-fill-answer tq-fill-answer--missing">
            <i data-lucide="alert-triangle" class="tq-icon tq-icon--sm"></i>
            <span>${words.length === 0 && seq.length === 0
              ? 'Thiếu cả dãy từ lộn xộn (*) lẫn đáp án (**)'
              : words.length === 0
                ? 'Thiếu dãy từ lộn xộn (*)'
                : 'Thiếu đáp án thứ tự (**)'}</span>
            <em class="tq-fill-hint">
              Cần 2 dòng: <code>*word1|word2|...</code> (từ lộn xộn)
              và <code>**word1|word2|...</code> (thứ tự đúng).
            </em>
          </p>`
        : '';
      return `
        <div class="tq-special tq-special--order">
          ${markerBlock}
          <div class="tq-order-row">
            <span class="tq-order-label">T� lộn xộn</span>
            <div class="tq-order-tiles">
              ${words.length
                ? words.map((w) => `<span class="tq-order-tile">${escapeHtml(w)}</span>`).join('')
                : '<span class="tq-order-tile tq-order-tile--muted">(chưa có)</span>'
              }
            </div>
          </div>
          <div class="tq-order-row">
            <span class="tq-order-label">Thứ tự đúng</span>
            <div class="tq-order-tiles">
              ${seq.length
                ? seq.map((w) => `<span class="tq-order-tile tq-order-tile--correct">${escapeHtml(w)}</span>`).join('')
                : '<span class="tq-order-tile tq-order-tile--muted">(chưa có)</span>'
              }
            </div>
          </div>
          ${missingHint}
        </div>
      `;
    }
    return '';
  }

  function renderQuestions(items, warnings) {
    questions = items;

    // Stats
    const validCount = items.filter(
      (q) => q.options && q.options.length >= 2 && q.answer,
    ).length;
    const warnCount = items.length - validCount;

    // Đếm theo loại câu hỏi
    const counts = {
      single: items.filter((q) => q.type === 'single_choice').length,
      multiple: items.filter((q) => q.type === 'multiple_response').length,
      tf: items.filter((q) => q.type === 'true_false').length,
      fill: items.filter((q) => q.type === 'fill_in_blank').length,
      order: items.filter((q) => q.type === 'ordering').length,
      unknown: items.filter((q) => q.type === 'unknown').length,
      duplicate: items.filter((q) => q.isDuplicate).length,
    };

    countNum.textContent = items.length;
    toolbarStat.hidden = items.length === 0;
    statOk.textContent = validCount;
    statWarn.textContent = warnCount;
    statWarnWrap.hidden = warnCount === 0;

    // Cập nhật các badge thống kê loại câu hỏi (nếu có trong DOM)
    updateTypeCounters(counts);

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

          ${renderSpecial(q)}

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
        <div class="tq-edit-type tq-edit-type--five" role="radiogroup">
          <button
            type="button"
            class="tq-edit-type-btn ${q.type === 'single_choice' ? 'is-active' : ''}"
            data-type="single_choice"
            role="radio"
            aria-checked="${q.type === 'single_choice'}"
            title="1 đáp án đúng"
          >
            <i data-lucide="circle-dot" class="tq-icon tq-icon--sm"></i>
            <span>1 đáp án</span>
          </button>
          <button
            type="button"
            class="tq-edit-type-btn ${q.type === 'multiple_response' ? 'is-active' : ''}"
            data-type="multiple_response"
            role="radio"
            aria-checked="${q.type === 'multiple_response'}"
            title="Nhiều đáp án đúng"
          >
            <i data-lucide="check-square" class="tq-icon tq-icon--sm"></i>
            <span>Nhiều</span>
          </button>
          <button
            type="button"
            class="tq-edit-type-btn ${q.type === 'true_false' ? 'is-active' : ''}"
            data-type="true_false"
            role="radio"
            aria-checked="${q.type === 'true_false'}"
            title="Đúng / Sai"
          >
            <i data-lucide="toggle-left" class="tq-icon tq-icon--sm"></i>
            <span>Đúng/Sai</span>
          </button>
          <button
            type="button"
            class="tq-edit-type-btn ${q.type === 'fill_in_blank' ? 'is-active' : ''}"
            data-type="fill_in_blank"
            role="radio"
            aria-checked="${q.type === 'fill_in_blank'}"
            title="Điền vào chỗ trống"
          >
            <i data-lucide="edit-3" class="tq-icon tq-icon--sm"></i>
            <span>Điền</span>
          </button>
          <button
            type="button"
            class="tq-edit-type-btn ${q.type === 'ordering' ? 'is-active' : ''}"
            data-type="ordering"
            role="radio"
            aria-checked="${q.type === 'ordering'}"
            title="Sắp xếp từ"
          >
            <i data-lucide="align-vertical-justify-center" class="tq-icon tq-icon--sm"></i>
            <span>Sắp xếp</span>
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

      ${renderEditSpecial(q)}
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
      // ── So sánh theo nhiều tiêu chí để bắt trùng chính xác ──
      const correctLabels = (q.correct_options || [])
        .map((o) => o.label)
        .sort()
        .join(',');

      // Với câu đặc biệt, dùng extra fields để phân biệt
      let specialKey = '';
      if (q.type === 'fill_in_blank') {
        specialKey = `fill::${normalizeText(q.fill_blank_answer || '')}`;
      } else if (q.type === 'ordering') {
        const w = (q.ordering_words || []).join('|');
        const s = (q.ordering_sequence || []).join('|');
        specialKey = `ord::${w}::${s}`;
      } else if (q.type === 'true_false') {
        specialKey = `tf::${correctLabels}`;
      }

      // KEY = text (đã bỏ marker đặc biệt) + correct_labels + special
      const textKey = normalizeText(q.text || '');
      const key = `${textKey}::${correctLabels}::${specialKey}`;

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

    q.text = text;
    q.type = newType;

    // 3. Lưu theo từng loại
    if (newType === 'true_false') {
      const tfRadio = body.querySelector('input[name="tq-edit-tf"]:checked');
      const tfValue = tfRadio ? tfRadio.value : 'true';
      q.options = [
        { label: 'A', text: 'Đúng', correct: tfValue === 'true' },
        { label: 'B', text: 'Sai', correct: tfValue === 'false' },
      ];
      q.correct_options = q.options.filter((o) => o.correct);
      q.is_true_false = true;
      q.is_ordering = false;
      q.is_fill_in_blank = false;
      q.type_label = 'Đúng / Sai';
      q.answer = tfValue === 'true' ? 'A' : 'B';
    } else if (newType === 'fill_in_blank') {
      const ansInput = body.querySelector('#tq-edit-fill-answer');
      const ans = ansInput ? ansInput.value.trim() : '';
      q.fill_blank_answer = ans;
      q.options = [];
      q.correct_options = [];
      q.is_fill_in_blank = true;
      q.is_true_false = false;
      q.is_ordering = false;
      q.type_label = 'Điền từ vào chỗ trống';
      q.answer = ans;
    } else if (newType === 'ordering') {
      const wordsInput = body.querySelector('#tq-edit-order-words');
      const seqInput = body.querySelector('#tq-edit-order-seq');
      const words = (wordsInput ? wordsInput.value : '').split('|').map((s) => s.trim()).filter(Boolean);
      const seq = (seqInput ? seqInput.value : '').split('|').map((s) => s.trim()).filter(Boolean);
      q.ordering_words = words;
      q.ordering_sequence = seq;
      q.options = [];
      q.correct_options = [];
      q.is_ordering = true;
      q.is_true_false = false;
      q.is_fill_in_blank = false;
      q.type_label = 'Sắp xếp từ';
      q.answer = seq.join('|');
    } else {
      // single_choice / multiple_response / unknown
      const newOptions = [];
      body.querySelectorAll('.tq-edit-option').forEach((li) => {
        const idx = parseInt(li.dataset.idx, 10);
        const orig = q.options[idx] || { label: 'A' };
        const input = li.querySelector('.tq-edit-option-input');
        const cb = li.querySelector('.tq-edit-correct-cb');
        newOptions.push({
          label: orig.label,
          text: input ? input.value.trim() : '',
          correct: cb ? cb.checked : false,
        });
      });
      q.options = newOptions;
      q.correct_options = newOptions.filter((o) => o.correct);
      q.is_true_false = false;
      q.is_ordering = false;
      q.is_fill_in_blank = false;

      const correctCount = q.correct_options.length;
      if (newType === 'single_choice') {
        q.type_label = '1 đáp án đúng';
        q.answer = correctCount ? q.correct_options[0].label : null;
      } else if (newType === 'multiple_response') {
        q.type_label = 'Nhiều đáp án đúng';
        q.answer = q.correct_options.map((o) => o.label).join(', ');
      } else {
        q.type_label = 'Chưa xác định';
        q.answer = null;
      }
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