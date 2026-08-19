/* exam.js — Làm bài thi trắc nghiệm */

document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const questions = window.__QUIZ_DATA__ || [];
  const quizCode = window.__QUIZ_CODE__ || '';
  const quizTitle = window.__QUIZ_TITLE__ || '';

  if (!questions.length) {
    $('exam-questions').innerHTML = '<p style="text-align:center;color:var(--ex-text-muted);padding:60px 0;">Không có câu hỏi nào.</p>';
    return;
  }

  // ── State ──
  let currentIdx = 0;
  let answers = {};   // { idx: value }
  let submitted = false;

  // ── Helpers ──
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ── Render single question ──
  function renderQuestion(q, idx) {
    const num = idx + 1;
    const type = q.type || 'unknown';
    const typeLabel = q.type_label || 'Câu hỏi';
    const answered = answers[idx] !== undefined;

    let html = `
      <div class="exam-question" data-idx="${idx}">
        <div class="exam-question__num">${num}</div>
        <span class="exam-question__type">${escapeHtml(typeLabel)}</span>
        <p class="exam-question__text">${escapeHtml(type === 'ordering'
          ? (q.text || 'Sắp xếp lại câu sau sao cho đúng cấu trúc.')
          : type === 'true_false' && q.statements?.length
            ? 'Chọn đáp án Đúng Sai phù hợp.'
            : (q.text || q.marker || ''))}</p>
    `;

    switch (type) {
      case 'single_choice':
      case 'multiple_response':
        html += renderChoiceOptions(q, idx);
        break;
      case 'true_false':
        html += renderTFOptions(q, idx);
        break;
      case 'fill_in_blank':
        html += renderFillOptions(q, idx);
        break;
      case 'ordering':
        html += renderOrderOptions(q, idx);
        break;
      case 'drag_into_text':
      case 'drag_into_groups':
        html += renderDragOptions(q, idx);
        break;
      default:
        html += `<p style="color:var(--ex-text-muted);font-size:0.85rem;">Chưa hỗ trợ dạng câu hỏi này.</p>`;
    }

    html += `</div>`;
    return html;
  }

  // ── Single / Multiple choice ──
  function renderChoiceOptions(q, idx) {
    const opts = (q.options || []).map((o) => ({
      label: o.label,
      text: o.text,
    }));
    const selected = answers[idx] || [];

    return `<div class="exam-options">
      ${opts.map((o) => {
        const isSelected = selected.includes(o.label);
        return `<div class="exam-option${isSelected ? ' is-selected' : ''}" data-label="${o.label}" data-idx="${idx}">
          <span class="exam-option__label">${o.label}</span>
          <span class="exam-option__text">${escapeHtml(o.text)}</span>
        </div>`;
      }).join('')}
    </div>`;
  }

  // ── True/False ──
  function renderTFOptions(q, idx) {
    if (Array.isArray(q.statements) && q.statements.length) {
      const selected = answers[idx] || {};
      return `<div class="exam-tf-grouped">
        ${q.statements.map((statement, statementIdx) => `
          <div class="exam-tf-statement">
            <p class="exam-tf-statement__text">${statementIdx + 1}. ${escapeHtml(statement.text)}</p>
            <div class="exam-tf-row" data-statement-idx="${statementIdx}">
              <button type="button" class="exam-tf-btn${selected[statementIdx] === 'true' ? ' is-selected' : ''}" data-value="true" data-statement-idx="${statementIdx}" data-idx="${idx}">✓ Đúng</button>
              <button type="button" class="exam-tf-btn${selected[statementIdx] === 'false' ? ' is-selected' : ''}" data-value="false" data-statement-idx="${statementIdx}" data-idx="${idx}">✗ Sai</button>
            </div>
          </div>
        `).join('')}
      </div>`;
    }
    const selected = answers[idx] || '';
    return `<div class="exam-tf-row">
      <button type="button" class="exam-tf-btn${selected === 'true' ? ' is-selected' : ''}" data-value="true" data-idx="${idx}">✓ Đúng</button>
      <button type="button" class="exam-tf-btn${selected === 'false' ? ' is-selected' : ''}" data-value="false" data-idx="${idx}">✗ Sai</button>
    </div>`;
  }

  // ── Fill in blank ──
  function renderFillOptions(q, idx) {
    const val = answers[idx] || '';
    return `<div class="exam-fill-row">
      <input type="text" class="exam-fill-input" data-idx="${idx}" value="${escapeHtml(val)}" placeholder="Nhập đáp án..." autocomplete="off" />
    </div>`;
  }

  // ── Ordering ──
  function renderOrderOptions(q, idx) {
    if (Array.isArray(q.statements) && q.statements.length) {
      const selected = answers[idx] || {};
      return `<div class="exam-order-grouped">
        ${q.statements.map((statement, statementIdx) => {
          const ordered = selected[statementIdx] ? selected[statementIdx].split('|') : shuffle(statement.ordering_words);
          return `<div class="exam-order-statement">
            <p class="exam-order-statement__title">${statementIdx + 1}. Sắp xếp các từ:</p>
            <div class="exam-options" data-idx="${idx}" data-statement-idx="${statementIdx}">
              ${ordered.map((word) => `<div class="exam-option is-selected" draggable="true" data-word="${escapeHtml(word)}" data-idx="${idx}" data-statement-idx="${statementIdx}"><span class="exam-option__label">↕</span><span class="exam-option__text">${escapeHtml(word)}</span></div>`).join('')}
            </div>
          </div>`;
        }).join('')}
      </div>`;
    }
    const words = [...(q.ordering_words || [])];
    // Nếu đã trả lời, dùng thứ tự đã chọn; ngược lại shuffle
    const ordered = answers[idx]
      ? answers[idx].split('|')
      : shuffle(words);
    return `<div class="exam-options" data-idx="${idx}">
      ${ordered.map((w) => `
        <div class="exam-option is-selected" draggable="true" data-word="${escapeHtml(w)}">
          <span class="exam-option__label">↕</span>
          <span class="exam-option__text">${escapeHtml(w)}</span>
        </div>`).join('')}
    </div>
    <p style="font-size:0.78rem;color:var(--ex-text-muted);margin-top:8px;">Kéo thả để sắp xếp thứ tự đúng.</p>`;
  }

  // ── Drag into text ──
  function renderDragOptions(q, idx) {
    if (Array.isArray(q.drag_groups) && q.drag_groups.length) {
      const placed = answers[idx] || {};
      const allAnswers = q.drag_groups.flatMap((group) => group.answers || []);
      return `<div class="exam-drag-groups">
        <div class="exam-drag-pool"><span class="exam-drag-pool__label">Kéo đáp án vào nhóm tương ứng:</span>${shuffle(allAnswers).map((answer) => {
          const used = Object.values(placed).some((items) => Array.isArray(items) && items.includes(answer));
          return `<span class="exam-drag-tile${used ? ' is-placed' : ''}" draggable="true" data-answer="${escapeHtml(answer)}" data-qidx="${idx}">${escapeHtml(answer)}</span>`;
        }).join('')}</div>
        ${q.drag_groups.map((group, groupIdx) => `<div class="exam-drag-group" data-groupidx="${groupIdx}" data-qidx="${idx}"><strong>${escapeHtml(group.label)}</strong><div class="exam-drag-group-items">${(placed[groupIdx] || []).map((answer) => `<span class="exam-drag-tile is-placed">${escapeHtml(answer)}</span>`).join('')}</div></div>`).join('')}
      </div>`;
    }
    const sentences = q.drag_sentences || [];
    const ansList = q.drag_answers || [];
    const placed = answers[idx] || {}; // { slot_idx: answer_text }

    // Shuffle answers
    const shuffled = shuffle(ansList);

    // Render slots (câu có ___)
    const sentencesHtml = sentences.length
      ? sentences.map((s, si) => {
          const placedAnswer = placed[si];
          const slotFilled = !!placedAnswer;
          const slotClass = slotFilled ? 'exam-slot is-filled' : 'exam-slot';
          return `<p>${escapeHtml(s.text || '').replace(
            /___+/,
            `<span class="${slotClass}" data-slotidx="${si}" data-qidx="${idx}">${placedAnswer ? escapeHtml(placedAnswer) : '___'}</span>`
          )}</p>`;
        }).join('')
      : '<p style="color:var(--ex-text-muted)">(Chưa có câu)</p>';

    // Render answer tiles
    const tilesHtml = shuffled.map((a) => {
      const isUsed = Object.values(placed).includes(a);
      return `<span class="exam-drag-tile${isUsed ? ' is-placed' : ''}" draggable="true" data-answer="${escapeHtml(a)}" data-qidx="${idx}">${escapeHtml(a)}</span>`;
    }).join('');

    return `<div class="exam-drag-pool">
      <span class="exam-drag-pool__label">Kéo đáp án vào chỗ trống:</span>
      ${tilesHtml}
    </div>
    <div class="exam-sentences">${sentencesHtml}</div>`;
  }

  // ── Render all ──
  function renderAll() {
    const el = $('exam-questions');
    el.innerHTML = renderQuestion(questions[currentIdx], currentIdx);
    updateNav();
    updateProgress();
    attachHandlers();
  }

  // ── Nav ──
  function goTo(idx) {
    if (idx < 0 || idx >= questions.length) return;
    currentIdx = idx;
    renderAll();
  }

  function updateNav() {
    $('btn-prev').disabled = currentIdx === 0;
    $('btn-next').disabled = currentIdx === questions.length - 1;
    updateDots();
  }

  function updateDots() {
    const dots = $('question-dots');
    dots.innerHTML = questions.map((_, i) => {
      const isCurrent = i === currentIdx;
      const isAnswered = answers[i] !== undefined;
      return `<button class="exam-dot${isCurrent ? ' is-current' : ''}${isAnswered ? ' is-answered' : ''}" data-idx="${i}"></button>`;
    }).join('');
  }

  function updateProgress() {
    const answered = Object.keys(answers).length;
    const total = questions.length;
    $('answered-count').textContent = answered;
    $('total-count').textContent = total;
    const pct = total ? (answered / total * 100) : 0;
    $('progress-fill').style.width = pct + '%';
  }

  // ── Attach handlers ──
  function attachHandlers() {
    const q = questions[currentIdx];
    const idx = currentIdx;

    // Options (single/multiple)
    document.querySelectorAll('.exam-option:not(.exam-tf-btn)').forEach((el) => {
      el.addEventListener('click', () => {
        if (submitted) return;
        const label = el.dataset.label;
        const word = el.dataset.word;
        const qidx = parseInt(el.dataset.idx || idx);

        if (word !== undefined) {
          // Ordering — move tile
          handleOrderMove(el);
          return;
        }

        const qtype = questions[qidx].type;
        if (qtype === 'multiple_response') {
          // Toggle multi
          const cur = answers[qidx] || [];
          const i = cur.indexOf(label);
          if (i >= 0) cur.splice(i, 1);
          else cur.push(label);
          answers[qidx] = cur;
          el.classList.toggle('is-selected');
        } else {
          // Single
          answers[qidx] = [label];
          document.querySelectorAll(`.exam-option[data-idx="${qidx}"]`).forEach((e) => e.classList.remove('is-selected'));
          el.classList.add('is-selected');
        }
        updateNav();
        updateProgress();
      });
    });

    // True/False
    document.querySelectorAll('.exam-tf-btn').forEach((el) => {
      el.addEventListener('click', () => {
        if (submitted) return;
        const qidx = parseInt(el.dataset.idx || idx);
        const statementIdx = el.dataset.statementIdx;
        if (statementIdx !== undefined) {
          const groupedAnswer = answers[qidx] || {};
          groupedAnswer[statementIdx] = el.dataset.value;
          answers[qidx] = groupedAnswer;
          document.querySelectorAll(`.exam-tf-btn[data-idx="${qidx}"][data-statement-idx="${statementIdx}"]`).forEach((button) => button.classList.remove('is-selected'));
          el.classList.add('is-selected');
          updateNav();
          updateProgress();
          return;
        }
        answers[qidx] = el.dataset.value;
        document.querySelectorAll(`.exam-tf-btn[data-idx="${qidx}"]`).forEach((e) => e.classList.remove('is-selected'));
        el.classList.add('is-selected');
        updateNav();
        updateProgress();
      });
    });

    // Fill input
    document.querySelectorAll('.exam-fill-input').forEach((el) => {
      el.addEventListener('input', () => {
        if (submitted) return;
        const qidx = parseInt(el.dataset.idx || idx);
        answers[qidx] = el.value.trim();
        updateNav();
        updateProgress();
      });
    });

    // Drag tiles
    attachDragHandlers(idx);

    // Dots
    document.querySelectorAll('.exam-dot').forEach((dot) => {
      dot.addEventListener('click', () => goTo(parseInt(dot.dataset.idx)));
    });
  }

  // ── Drag & Drop ──
  function attachDragHandlers(qidx) {
    let dragged = null;

    document.querySelectorAll('.exam-drag-tile').forEach((tile) => {
      tile.addEventListener('dragstart', (e) => {
        dragged = tile;
        tile.classList.add('is-dragging');
        e.dataTransfer.setData('text/plain', tile.dataset.answer);
      });
      tile.addEventListener('dragend', () => {
        if (dragged) dragged.classList.remove('is-dragging');
        dragged = null;
      });
    });

    document.querySelectorAll('.exam-drag-group').forEach((group) => {
      group.addEventListener('dragover', (event) => event.preventDefault());
      group.addEventListener('drop', (event) => {
        event.preventDefault();
        if (!dragged || submitted) return;
        const answer = dragged.dataset.answer;
        const questionIndex = Number(group.dataset.qidx || qidx);
        const groupIndex = Number(group.dataset.groupidx);
        if (!answers[questionIndex] || typeof answers[questionIndex] !== 'object') answers[questionIndex] = {};
        Object.keys(answers[questionIndex]).forEach((key) => {
          answers[questionIndex][key] = (answers[questionIndex][key] || []).filter((item) => item !== answer);
        });
        answers[questionIndex][groupIndex] = [...(answers[questionIndex][groupIndex] || []), answer];
        group.querySelector('.exam-drag-group-items').insertAdjacentHTML('beforeend', `<span class="exam-drag-tile is-placed">${escapeHtml(answer)}</span>`);
        dragged.remove();
        updateProgress();
      });
    });

    document.querySelectorAll('.exam-slot').forEach((slot) => {
      slot.addEventListener('dragover', (e) => e.preventDefault());
      slot.addEventListener('drop', (e) => {
        e.preventDefault();
        if (!dragged || submitted) return;
        const ans = dragged.dataset.answer;
        const qidx = parseInt(dragged.dataset.qidx || slot.dataset.qidx || qidx);
        const slotIdx = parseInt(slot.dataset.slotidx);
        if (answers[qidx] === undefined) answers[qidx] = {};
        answers[qidx][slotIdx] = ans;
        // Update slot display
        slot.textContent = ans;
        slot.classList.add('is-filled');
        // Mark tile as used
        dragged.classList.add('is-placed');
        updateNav();
        updateProgress();
      });
    });

    // Click tile → pick first empty slot
    document.querySelectorAll('.exam-drag-tile:not(.is-placed)').forEach((tile) => {
      tile.addEventListener('click', () => {
        if (submitted) return;
        const ans = tile.dataset.answer;
        const qidx = parseInt(tile.dataset.qidx || qidx);
        if (answers[qidx] === undefined) answers[qidx] = {};
        const slots = document.querySelectorAll(`.exam-slot[data-qidx="${qidx}"]:not(.is-filled)`);
        if (slots.length === 0) return;
        const slot = slots[0];
        const slotIdx = parseInt(slot.dataset.slotidx);
        answers[qidx][slotIdx] = ans;
        slot.textContent = ans;
        slot.classList.add('is-filled');
        tile.classList.add('is-placed');
        updateNav();
        updateProgress();
      });
    });

    // Click filled slot → return tile
    document.querySelectorAll('.exam-slot.is-filled').forEach((slot) => {
      slot.addEventListener('click', () => {
        if (submitted) return;
        const qidx = parseInt(slot.dataset.qidx || qidx);
        const slotIdx = parseInt(slot.dataset.slotidx);
        const ans = answers[qidx]?.[slotIdx];
        if (!ans) return;
        delete answers[qidx][slotIdx];
        slot.textContent = '___';
        slot.classList.remove('is-filled');
        // Un-mark tile
        document.querySelectorAll(`.exam-drag-tile[data-answer="${CSS.escape(ans)}"]`).forEach((t) => {
          if (parseInt(t.dataset.qidx || qidx) === qidx) t.classList.remove('is-placed');
        });
        updateProgress();
      });
    });
  }

  // ── Ordering drag ──
  function handleOrderMove(el) {
    const opts = el.parentElement;
    const items = [...opts.querySelectorAll('.exam-option')];
    const fromIdx = items.indexOf(el);
    const qidx = parseInt(el.dataset.qidx);
    const statementIdx = el.dataset.statementIdx;

    el.addEventListener('dragover', (e) => e.preventDefault());
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const toIdx = items.indexOf(el);
      if (fromIdx < toIdx) {
        opts.insertBefore(items[fromIdx], items[toIdx + 1] || null);
      } else if (fromIdx > toIdx) {
        opts.insertBefore(items[fromIdx], items[toIdx]);
      }
      items.splice(0);
      [...opts.querySelectorAll('.exam-option')].forEach((item, i) => items.push(item));
      const order = items.map((it) => it.dataset.word);
      if (statementIdx !== undefined) {
        if (!answers[qidx] || typeof answers[qidx] !== 'object') answers[qidx] = {};
        answers[qidx][statementIdx] = order.join('|');
      } else {
        answers[qidx] = order.join('|');
      }
      updateProgress();
    });
  }

  // ── Submit ──
  $('btn-submit').addEventListener('click', () => {
    $('modal-answered').textContent = Object.keys(answers).length;
    $('modal-submit').hidden = false;
  });

  $('modal-cancel').addEventListener('click', () => {
    $('modal-submit').hidden = true;
  });

  $('modal-submit').addEventListener('click', (e) => {
    if (e.target === $('modal-submit')) $('modal-submit').hidden = true;
  });

  $('modal-confirm').addEventListener('click', submitExam);

  // ── Submit API ──
  async function submitExam() {
    $('modal-submit').hidden = true;
    $('btn-submit').disabled = true;

    try {
      const res = await fetch(`/api/submit-exam/${quizCode}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCSRF() },
        body: JSON.stringify({ answers }),
      });
      const data = await res.json();

      if (data.success) {
        submitted = true;
        showResults(data);
      } else {
        alert(data.message || 'Lỗi khi nộp bài.');
        $('btn-submit').disabled = false;
      }
    } catch (err) {
      alert('Lỗi kết nối. Vui lòng thử lại.');
      $('btn-submit').disabled = false;
    }
  }

  // ── Show results ──
  function showResults(data) {
    const { score, correct, total, results } = data;
    $('result-score').textContent = score;
    $('result-detail').textContent = `Đúng ${correct} / ${total} câu`;

    // Icon
    if (score >= 8) {
      $('result-icon').textContent = '🏆';
      $('result-title').textContent = 'Xuất sắc!';
    } else if (score >= 6) {
      $('result-icon').textContent = '👏';
      $('result-title').textContent = 'Tốt lắm!';
    } else if (score >= 4) {
      $('result-icon').textContent = '💪';
      $('result-title').textContent = 'Cố gắng hơn nhé!';
    } else {
      $('result-icon').textContent = '📚';
      $('result-title').textContent = 'Cần ôn tập thêm';
    }

    // Breakdown
    const bd = $('result-breakdown');
    bd.innerHTML = results.map((r) => {
      const icon = r.correct ? '✅' : '❌';
      const cls = r.correct ? 'correct' : 'wrong';
      const ua = escapeHtml(r.user_answer || '(trống)');
      const ca = escapeHtml(r.correct_answer || '');
      const extra = !r.correct ? '<span style="color:var(--ex-success)"> → Đáp án: ' + ca + '</span>' : '';
      return '<div class="result-item">' +
        '<span class="result-item__icon ' + cls + '">' + icon + '</span>' +
        '<span class="result-item__text">Câu ' + (r.index + 1) + ': <strong>' + ua + '</strong>' + extra + '</span>' +
        '</div>';
    }).join('');

    // Highlight correct/wrong on question
    results.forEach((r) => {
      if (r.type === 'single_choice' || r.type === 'multiple_response') {
        document.querySelectorAll(`.exam-option[data-idx="${r.index}"]`).forEach((el) => {
          if (r.correct && el.dataset.label && r.correct_answer.includes(el.dataset.label)) {
            el.classList.add('is-correct');
          }
          if (!r.correct && el.dataset.label && el.classList.contains('is-selected')) {
            el.classList.add('is-wrong');
          }
        });
      }
    });

    $('modal-result').hidden = false;
    $('btn-close-result').addEventListener('click', () => {
      $('modal-result').hidden = true;
    }, { once: true });
  }

  // ── Nav buttons ──
  $('btn-prev').addEventListener('click', () => goTo(currentIdx - 1));
  $('btn-next').addEventListener('click', () => goTo(currentIdx + 1));

  // ── Keyboard nav ──
  document.addEventListener('keydown', (e) => {
    if (submitted) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goTo(currentIdx + 1);
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') goTo(currentIdx - 1);
  });

  // ── Link modal ──
  $('modal-link-close')?.addEventListener('click', () => {
    $('modal-link').hidden = true;
  });

  // ── Init ──
  renderAll();
});

// ── CSRF helper ──
function getCSRF() {
  return document.querySelector('[name=csrfmiddlewaretoken]')?.value
    || document.cookie.match(/csrftoken=([^;]+)/)?.[1] || '';
}
