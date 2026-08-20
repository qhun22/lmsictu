/* exam.js - Basic Exam Logic */

document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  const $ = id => document.getElementById(id);

  const questions = window.__QUIZ_DATA__ || [];
  const quizCode = window.__QUIZ_CODE__ || '';

  if (!questions.length) {
    $('question-card').innerHTML = '<p style="text-align:center;color:#888;padding:40px;">Không có câu hỏi nào.</p>';
    return;
  }

  // State
  let currentIdx = 0;
  let answers = {};
  let submitted = false;
  let elapsedSeconds = 0;

  const timer = setInterval(() => {
    if (submitted) return;
    elapsedSeconds += 1;
    const minutes = String(Math.floor(elapsedSeconds / 60)).padStart(2, '0');
    const seconds = String(elapsedSeconds % 60).padStart(2, '0');
    $('exam-timer').textContent = `${minutes}:${seconds}`;
  }, 1000);

  // Helpers
  function esc(str) {
    return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c]));
  }

  // Render question
  function renderQuestion(q, idx) {
    const num = idx + 1;
    const type = q.type || 'single_choice';
    const typeLabel = q.type_label || '1 đáp án đúng';

    $('question-num').textContent = `Câu ${num}`;
    $('question-type').textContent = typeLabel;
    const currentNum = $('current-num');
    if (currentNum) currentNum.textContent = num;

    // Question text
    let text = q.text || '';
    if (type === 'ordering') text = q.text || 'Sắp xếp các từ theo đúng thứ tự.';
    if (type === 'true_false' && q.statements?.length) text = 'Chọn Đúng hoặc Sai cho mỗi mệnh đề.';
    if (type === 'drag_into_text') text = q.text || 'Kéo đáp án vào chỗ trống.';
    $('question-text').textContent = text;

    const list = $('answer-list');
    list.innerHTML = '';

    if (type === 'single_choice' || type === 'multiple_response') {
      renderChoice(q, idx, list);
    } else if (type === 'true_false') {
      renderTF(q, idx, list);
    } else if (type === 'fill_in_blank') {
      renderFill(q, idx, list);
    } else if (type === 'ordering') {
      renderOrder(q, idx, list);
    } else if (type === 'drag_into_text') {
      renderDragIntoText(q, idx, list);
    } else if (type === 'drag_into_groups') {
      renderDrag(q, idx, list);
    } else {
      list.innerHTML = '<p style="color:#888;">Dạng câu hỏi này chưa được hỗ trợ.</p>';
    }

    updateNav();
  }

  // Single/Multiple choice
  function renderChoice(q, idx, container) {
    const opts = q.options || [];
    const selected = answers[idx] || [];

    opts.forEach(opt => {
      const div = document.createElement('div');
      div.className = 'answer-item' + (selected.includes(opt.label) ? ' selected' : '');
      div.innerHTML = `<span class="answer-label">${opt.label}</span><span class="answer-text">${esc(opt.text)}</span>`;
      div.addEventListener('click', () => {
        if (submitted) return;
        if (q.type === 'multiple_response') {
          const cur = answers[idx] || [];
          const i = cur.indexOf(opt.label);
          if (i >= 0) cur.splice(i, 1);
          else cur.push(opt.label);
          answers[idx] = cur;
          div.classList.toggle('selected');
        } else {
          answers[idx] = [opt.label];
          container.querySelectorAll('.answer-item').forEach(el => el.classList.remove('selected'));
          div.classList.add('selected');
        }
        updateNav();
      });
      container.appendChild(div);
    });
  }

  // True/False
  function renderTF(q, idx, container) {
    const statements = q.statements || [];
    container.classList.add('tf-statements');
    container.classList.toggle('is-grid', statements.length >= 4);
    container.classList.toggle('is-stack', statements.length < 4);

    if (statements.length) {
      statements.forEach((stmt, si) => {
        const div = document.createElement('div');
        div.className = 'tf-statement';
        div.innerHTML = `<p style="margin-bottom:8px;font-weight:500;">${si + 1}. ${esc(stmt.text)}</p>`;
        const btnGroup = document.createElement('div');
        btnGroup.className = 'tf-buttons';
        const selected = (answers[idx] || {})[si];

        ['Đúng', 'Sai'].forEach((label, i) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'tf-btn' + (selected === (i === 0 ? 'true' : 'false') ? ' selected' : '');
          btn.textContent = label;
          btn.addEventListener('click', () => {
            if (submitted) return;
            if (!answers[idx]) answers[idx] = {};
            answers[idx][si] = i === 0 ? 'true' : 'false';
            btnGroup.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            updateNav();
          });
          btnGroup.appendChild(btn);
        });
        div.appendChild(btnGroup);
        container.appendChild(div);
      });
    } else {
      const btnGroup = document.createElement('div');
      btnGroup.className = 'tf-buttons';
      const selected = answers[idx];
      ['Đúng', 'Sai'].forEach((label, i) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'tf-btn' + (selected === (i === 0 ? 'true' : 'false') ? ' selected' : '');
        btn.textContent = label;
        btn.addEventListener('click', () => {
          if (submitted) return;
          answers[idx] = i === 0 ? 'true' : 'false';
          btnGroup.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
          updateNav();
        });
        btnGroup.appendChild(btn);
      });
      container.appendChild(btnGroup);
    }
  }

  // Fill in blank
  function renderFill(q, idx, container) {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'fill-input';
    input.placeholder = 'Nhập đáp án...';
    input.value = answers[idx] || '';
    input.addEventListener('input', () => {
      if (submitted) return;
      answers[idx] = input.value.trim();
      updateNav();
    });
    container.appendChild(input);
  }

  // Ordering
  function renderOrder(q, idx, container) {
    const statements = q.statements?.length
      ? q.statements
      : [{ ordering_words: q.ordering_words || [] }];
    if (!statements.some(statement => statement.ordering_words?.length)) {
      container.innerHTML = '<p style="color:#888;">Chưa có dữ liệu sắp xếp.</p>';
      return;
    }
    const saved = answers[idx] && typeof answers[idx] === 'object' ? answers[idx] : {};
    answers[idx] = saved;
    container.classList.add('ordering-statements');
    container.classList.toggle('is-grid', statements.length >= 4);

    statements.forEach((statement, statementIndex) => {
      const words = [...(statement.ordering_words || [])];
      if (!words.length) return;
      const savedOrder = saved[String(statementIndex)]?.split('|').filter(Boolean);
      const ordered = savedOrder?.length ? savedOrder : [];
      const available = words.filter(word => !ordered.includes(word));
      const block = document.createElement('section');
      block.className = 'ordering-statement';
      block.innerHTML = statements.length > 1
        ? `<div class="ordering-statement-title">${statementIndex + 1}.</div>`
        : '';

      const pool = document.createElement('div');
      pool.className = 'ordering-pool';
      const orderZone = document.createElement('div');
      orderZone.className = 'ordering-zone';
      orderZone.innerHTML = '<span class="ordering-placeholder">_ _ _ _</span>';

      const refresh = () => {
        pool.innerHTML = '';
        orderZone.innerHTML = '';
        ordered.forEach((word, position) => orderZone.appendChild(createOrderingChip(word, position, true)));
        available.forEach((word, position) => pool.appendChild(createOrderingChip(word, position, false)));
        if (!ordered.length) orderZone.innerHTML = '<span class="ordering-placeholder">_ _ _ _</span>';
        saved[String(statementIndex)] = ordered.join('|');
        updateNav();
      };
      const createOrderingChip = (word, position, inOrder) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = `ordering-chip${inOrder ? ' is-placed' : ''}`;
        chip.textContent = word;
        chip.draggable = true;
        chip.addEventListener('click', () => {
          if (inOrder) {
            available.push(word);
            ordered.splice(position, 1);
          } else {
            ordered.push(word);
            available.splice(position, 1);
          }
          refresh();
        });
        chip.addEventListener('dragstart', event => {
          event.dataTransfer.setData('text/plain', JSON.stringify({ word, inOrder, position }));
        });
        return chip;
      };
      orderZone.addEventListener('dragover', event => event.preventDefault());
      orderZone.addEventListener('drop', event => {
        event.preventDefault();
        const data = JSON.parse(event.dataTransfer.getData('text/plain'));
        if (data.inOrder) ordered.splice(data.position, 1);
        else available.splice(data.position, 1);
        ordered.push(data.word);
        refresh();
      });
      pool.addEventListener('dragover', event => event.preventDefault());
      pool.addEventListener('drop', event => {
        event.preventDefault();
        const data = JSON.parse(event.dataTransfer.getData('text/plain'));
        if (data.inOrder) {
          ordered.splice(data.position, 1);
          available.push(data.word);
          refresh();
        }
      });
      block.append(pool, orderZone);
      container.appendChild(block);
      refresh();
    });
  }

  // Drag into text
  function renderDragIntoText(q, idx, container) {
    const sentences = q.drag_sentences || [];
    const allAnswers = q.drag_answers || [];
    if (!sentences.length || !allAnswers.length) {
      container.innerHTML = '<p style="color:#888;">Chưa có dữ liệu kéo thả.</p>';
      return;
    }
    const sentenceAnswers = answers[idx] && typeof answers[idx] === 'object' ? answers[idx] : {};
    answers[idx] = sentenceAnswers;
    const pool = document.createElement('div');
    pool.className = 'text-drag-pool';
    const poolTitle = document.createElement('strong');
    poolTitle.textContent = 'Đáp án';
    pool.appendChild(poolTitle);
    const sentenceList = document.createElement('div');
    sentenceList.className = 'text-drag-sentences';

    const render = () => {
      pool.querySelectorAll('.text-drag-chip').forEach(chip => chip.remove());
      const used = new Set(Object.values(sentenceAnswers).filter(Boolean));
      allAnswers.filter(answer => !used.has(answer)).forEach(answer => pool.appendChild(createTextChip(answer)));
      sentenceList.innerHTML = '';
      sentences.forEach((sentence, sentenceIndex) => {
        const row = document.createElement('div');
        row.className = 'text-drag-sentence';
        const parts = String(sentence.text || '').split('___');
        row.appendChild(document.createTextNode(`${sentenceIndex + 1}. ${parts[0] || ''}`));
        const slot = document.createElement('button');
        slot.type = 'button';
        slot.className = `text-drag-slot${sentenceAnswers[String(sentenceIndex)] ? ' is-filled' : ''}`;
        slot.textContent = sentenceAnswers[String(sentenceIndex)] || '';
        slot.setAttribute('aria-label', 'Vị trí thả đáp án');
        slot.addEventListener('click', () => {
          delete sentenceAnswers[String(sentenceIndex)];
          render();
          updateNav();
        });
        slot.addEventListener('dragover', event => event.preventDefault());
        slot.addEventListener('drop', event => {
          event.preventDefault();
          const answer = event.dataTransfer.getData('text/plain');
          if (!answer) return;
          Object.keys(sentenceAnswers).forEach(key => {
            if (sentenceAnswers[key] === answer) delete sentenceAnswers[key];
          });
          sentenceAnswers[String(sentenceIndex)] = answer;
          render();
          updateNav();
        });
        row.appendChild(slot);
        row.appendChild(document.createTextNode(parts[1] || ''));
        sentenceList.appendChild(row);
      });
    };
    const createTextChip = answer => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'text-drag-chip';
      chip.textContent = answer;
      chip.draggable = true;
      chip.addEventListener('dragstart', event => event.dataTransfer.setData('text/plain', answer));
      return chip;
    };
    pool.addEventListener('dragover', event => event.preventDefault());
    container.append(pool, sentenceList);
    render();
  }

  function renderDrag(q, idx, container) {
    const groups = q.drag_groups || [];
    const answers_list = q.drag_answers || groups.flatMap(group => group.answers || []);
    if (!answers_list.length || !groups.length) {
      container.innerHTML = '<p style="color:#888;">Chưa có đáp án kéo thả.</p>';
      return;
    }
    const grouped = answers[idx] && typeof answers[idx] === 'object' ? answers[idx] : {};
    answers[idx] = grouped;
    const placed = new Set(Object.values(grouped).flat());
    const pool = document.createElement('div');
    pool.className = 'grouping-pool';
    const groupsWrap = document.createElement('div');
    groupsWrap.className = 'grouping-groups';
    const render = () => {
      pool.innerHTML = '<span class="grouping-pool-title">Đáp án</span>';
      answers_list.filter(answer => !placed.has(answer)).forEach(answer => pool.appendChild(createGroupChip(answer)));
      groupsWrap.innerHTML = '';
      groups.forEach((group, groupIndex) => {
        const zone = document.createElement('div');
        zone.className = 'grouping-zone';
        zone.innerHTML = `<h3>${esc(group.label || `Nhóm ${groupIndex + 1}`)}</h3>`;
        (grouped[String(groupIndex)] || []).forEach(answer => zone.appendChild(createGroupChip(answer, groupIndex)));
        zone.addEventListener('dragover', event => event.preventDefault());
        zone.addEventListener('drop', event => {
          event.preventDefault();
          const answer = event.dataTransfer.getData('text/plain');
          if (!answer) return;
          Object.values(grouped).forEach(items => { const at = items.indexOf(answer); if (at >= 0) items.splice(at, 1); });
          grouped[String(groupIndex)] = grouped[String(groupIndex)] || [];
          grouped[String(groupIndex)].push(answer);
          placed.add(answer);
          render();
          updateNav();
        });
        groupsWrap.appendChild(zone);
      });
    };
    const createGroupChip = (answer, groupIndex) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'grouping-chip';
      chip.textContent = answer;
      chip.draggable = true;
      chip.addEventListener('dragstart', event => event.dataTransfer.setData('text/plain', answer));
      chip.addEventListener('click', () => {
        if (groupIndex === undefined) return;
        grouped[String(groupIndex)] = (grouped[String(groupIndex)] || []).filter(item => item !== answer);
        placed.delete(answer);
        render();
        updateNav();
      });
      return chip;
    };
    pool.addEventListener('dragover', event => event.preventDefault());
    pool.addEventListener('drop', event => {
      event.preventDefault();
      const answer = event.dataTransfer.getData('text/plain');
      Object.values(grouped).forEach(items => { const at = items.indexOf(answer); if (at >= 0) items.splice(at, 1); });
      placed.delete(answer);
      render();
      updateNav();
    });
    container.append(pool, groupsWrap);
    render();
  }

  // Update nav buttons & dots
  function updateNav() {
    const total = questions.length;
    const totalNum = $('total-num');
    if (totalNum) totalNum.textContent = total;
    $('btn-prev').disabled = false;
    $('btn-next').disabled = currentIdx === total - 1;

    const dots = $('nav-dots');
    dots.innerHTML = '';
    let currentDot = null;
    const firstVisible = total > 3
      ? Math.min(Math.max(currentIdx - 1, 0), total - 3)
      : 0;
    const lastVisible = Math.min(firstVisible + 3, total);
    for (let i = firstVisible; i < lastVisible; i++) {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'nav-dot';
      dot.dataset.question = i + 1;
      dot.setAttribute('aria-label', `Đi tới câu ${i + 1}`);
      if (i === currentIdx) dot.classList.add('current');
      if (answers[i] !== undefined) dot.classList.add('answered');
      dot.addEventListener('click', () => goTo(i));
      dots.appendChild(dot);
      if (i === currentIdx) currentDot = dot;
    }
    currentDot?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });

    const drawerList = $('question-drawer-list');
    if (drawerList) {
      drawerList.innerHTML = '';
      for (let i = 0; i < total; i++) {
        const drawerQuestion = document.createElement('button');
        drawerQuestion.type = 'button';
        drawerQuestion.className = 'drawer-question';
        drawerQuestion.textContent = `Câu ${i + 1}`;
        if (i === currentIdx) drawerQuestion.classList.add('is-current');
        if (answers[i] !== undefined) drawerQuestion.classList.add('is-answered');
        drawerQuestion.addEventListener('click', () => {
          goTo(i);
          closeQuestionDrawer();
        });
        drawerList.appendChild(drawerQuestion);
      }
    }
  }

  function goTo(idx) {
    if (idx < 0 || idx >= questions.length) return;
    currentIdx = idx;
    renderQuestion(questions[idx], idx);
  }

  // Event listeners
  $('btn-prev').addEventListener('click', () => {
    toggleQuestionDrawer();
  });
  $('btn-next').addEventListener('click', () => goTo(currentIdx + 1));
  $('btn-submit').addEventListener('click', () => {
    $('modal-answered').textContent = Object.keys(answers).length;
    $('modal-submit').hidden = false;
  });
  $('modal-cancel').addEventListener('click', () => $('modal-submit').hidden = true);
  $('modal-submit').addEventListener('click', e => {
    if (e.target === $('modal-submit')) $('modal-submit').hidden = true;
  });
  $('modal-confirm').addEventListener('click', submitExam);
  $('btn-close-result').addEventListener('click', () => $('modal-result').hidden = true);

  $('question-drawer-close').addEventListener('click', closeQuestionDrawer);
  $('question-drawer-backdrop').addEventListener('click', closeQuestionDrawer);

  function toggleQuestionDrawer() {
    const drawer = $('question-drawer');
    const backdrop = $('question-drawer-backdrop');
    const isOpen = drawer.classList.toggle('is-open');
    backdrop.classList.toggle('is-open', isOpen);
    drawer.setAttribute('aria-hidden', String(!isOpen));
  }

  function closeQuestionDrawer() {
    const drawer = $('question-drawer');
    const backdrop = $('question-drawer-backdrop');
    drawer.classList.remove('is-open');
    backdrop.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
  }

  // Keyboard nav
  document.addEventListener('keydown', e => {
    if (submitted || $('modal-submit').hidden === false) return;
    if (e.key === 'Escape') {
      closeQuestionDrawer();
      return;
    }
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goTo(currentIdx + 1);
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') goTo(currentIdx - 1);
  });

  // Submit
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
    } catch {
      alert('Lỗi kết nối. Vui lòng thử lại.');
      $('btn-submit').disabled = false;
    }
  }

  // Show results
  function showResults(data) {
    const { score, correct, total } = data;

    $('result-score').textContent = score;
    $('result-detail').textContent = `Đúng ${correct} / ${total} câu`;

    if (score >= 8) {
      $('result-icon').textContent = '🏆';
      $('result-title').textContent = 'Xuất sắc!';
    } else if (score >= 6) {
      $('result-icon').textContent = '👏';
      $('result-title').textContent = 'Tốt lắm!';
    } else if (score >= 4) {
      $('result-icon').textContent = '💪';
      $('result-title').textContent = 'Cố gắng hơn!';
    } else {
      $('result-icon').textContent = '📚';
      $('result-title').textContent = 'Cần ôn tập thêm';
    }

    $('modal-result').hidden = false;
  }

  function getCSRF() {
    return document.querySelector('[name=csrfmiddlewaretoken]')?.value
      || document.cookie.match(/csrftoken=([^;]+)/)?.[1] || '';
  }

  // Init
  renderQuestion(questions[0], 0);
});
