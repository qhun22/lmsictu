"""
Parser file Word (.docx) trắc nghiệm → danh sách câu hỏi JSON.

Mỗi paragraph được phân tích run-level để phát hiện đáp án đúng
theo **màu chữ đỏ** trong Word (font.color.rgb).

Hỗ trợ các định dạng phổ biến:
- Đánh số câu: "Câu 1:", "1.", "1)", "Câu 1 -", ...
- Đáp án A/B/C/D: "A.", "A)", "A-", "A:" (kèm nội dung)
- Đáp án đúng được đánh dấu:
  • **Màu chữ đỏ** (font.color.rgb == FF0000 hoặc tương đương) — ưu tiên cao nhất
  • Tiền tố "*", "✓", "✔"
  • Dòng riêng "Đáp án: B", "Answer: A", "ĐA: C"
"""

import re
from typing import Optional

from docx import Document
from docx.shared import RGBColor


# ╔══════════════════════════════════════════════════════════════╗
# ║  Regex patterns                                               ║
# ╚══════════════════════════════════════════════════════════════╝

# Câu hỏi: "Câu 1", "Câu 1:", "1.", "1)", "1-", "Question 1"
RE_QUESTION_START = re.compile(
    r'^\s*(?:câu|question|cau|q)\s*[\:\.]?\s*(\d+)\s*[\:\.\-\)]?\s*(.*)$',
    re.IGNORECASE,
)

# Đáp án: "A.", "A)", "A-", "A:", "A " + nội dung
RE_OPTION = re.compile(
    r'^\s*([A-Ha-h])[\.\)\-\:\s]\s*(.+?)\s*$'
)

# Đáp án đúng: dòng riêng "Đáp án: B", "Answer: A", "ĐA: C"
RE_ANSWER_LINE = re.compile(
    r'^\s*(?:đáp án|đa|answer|đáp án đúng|the correct answer)\s*[\:\.]?\s*([A-Ha-h])\b',
    re.IGNORECASE,
)

# Ký hiệu đáp án đúng inline ở đầu dòng: "*A. nội dung", "✓A.", "✔B)"
RE_CORRECT_PREFIX = re.compile(
    r'^\s*[\*✓✔\u2713\u2714]\s*([A-Ha-h])[\.\)\-\:\s]\s*(.+?)\s*$'
)


# ╔══════════════════════════════════════════════════════════════╗
# ║  Màu sắc — phân loại "đỏ"                                      ║
# ╚══════════════════════════════════════════════════════════════╝

def _parse_rgb(color_obj) -> Optional[RGBColor]:
    """Lấy RGBColor từ run.font.color (có thể là theme/indexed, cố gắng ép về RGB)."""
    if color_obj is None:
        return None
    try:
        return color_obj.rgb  # type: ignore[attr-defined]
    except Exception:
        return None


def _is_red(color_obj) -> bool:
    """
    Đánh giá 1 font color có phải RED không.
    Đỏ = kênh R lớn, G & B nhỏ. Linh hoạt vì Word có thể lưu FF0000,
    C00000, B22222, v.v.
    """
    rgb = _parse_rgb(color_obj)
    if rgb is None:
        return False
    try:
        r, g, b = int(rgb[0]), int(rgb[1]), int(rgb[2])
    except (IndexError, ValueError, TypeError):
        return False
    # R >= 180 và G <= 90 và B <= 90 → coi là đỏ
    return r >= 180 and g <= 100 and b <= 100


def _has_red_run(paragraph) -> bool:
    """True nếu có ít nhất 1 run trong paragraph có màu đỏ."""
    for run in paragraph.runs:
        if _is_red(run.font.color):
            return True
    return False


# ╔══════════════════════════════════════════════════════════════╗
# ║  Phân tích run-level                                            ║
# ╚══════════════════════════════════════════════════════════════╝

def _analyze_paragraph(paragraph) -> dict:
    """
    Phân tích 1 paragraph Word thành:
      {
        'text': str,           # toàn bộ text (plain)
        'red': bool,           # có run màu đỏ không
        'red_text': str,       # text ghép từ các run đỏ (lowercased để so)
        'first_red_label': Optional[str],  # nếu dòng là đáp án (A./B./...) và phần label thuộc run đỏ
      }
    """
    full_text = paragraph.text
    has_red = False
    red_parts = []
    first_red_label = None

    # Chỉ xét dòng bắt đầu bằng "A. text" / "A) text" — nếu run đầu chứa label có màu đỏ thì đó là đáp án đúng
    option_match = RE_OPTION.match(full_text.strip())
    if option_match:
        label_char = option_match.group(1).upper()
        # Duyệt run để xem run nào chứa label
        consumed = 0
        label_end_pos = len(option_match.group(1))  # vị trí kết thúc label trong text
        for run in paragraph.runs:
            if not run.text:
                continue
            run_start = consumed
            run_end = consumed + len(run.text)
            # Nếu phần overlap với [0, label_end_pos] có màu đỏ → đáp án đúng
            if run_end > 0 and run_start < label_end_pos and _is_red(run.font.color):
                first_red_label = label_char
                break
            consumed = run_end

    for run in paragraph.runs:
        if _is_red(run.font.color):
            has_red = True
            if run.text:
                red_parts.append(run.text)

    return {
        'text': full_text,
        'red': has_red,
        'red_text': ''.join(red_parts).strip(),
        'first_red_label': first_red_label,
    }


def _parse_option_line(analysis: dict) -> Optional[dict]:
    """
    Phân tích 1 dòng thành option dict {label, text, correct}.
    Trả về None nếu không phải dòng đáp án.
    Ưu tiên:
      1) Run chứa label (A/B/C/D) có màu đỏ
      2) Prefix *, ✓, ✔
      3) Option thường (mặc định correct=False)
    """
    text = analysis['text'].strip()
    if not text:
        return None

    # 1) Đỏ ở label → đúng
    if analysis.get('first_red_label'):
        m = RE_OPTION.match(text)
        if m:
            return {
                'label': analysis['first_red_label'],
                'text': m.group(2).strip(),
                'correct': True,
            }

    # 2) Prefix *, ✓, ✔
    m = RE_CORRECT_PREFIX.match(text)
    if m:
        return {
            'label': m.group(1).upper(),
            'text': m.group(2).strip(),
            'correct': True,
        }

    # 3) Option thường
    m = RE_OPTION.match(text)
    if m:
        return {
            'label': m.group(1).upper(),
            'text': m.group(2).strip(),
            'correct': False,
        }

    return None


QUESTION_TYPES = {
    'single_choice': '1 đáp án đúng',
    'multiple_response': 'Nhiều đáp án đúng',
    'unknown': 'Chưa xác định',
}


def _classify_question(options: list) -> tuple:
    """
    Phân loại dạng câu hỏi dựa trên số đáp án đúng trong options.
    Returns: (type, label, correct_options_list)
      - 1 đáp án đúng → 'single_choice', '1 đáp án đúng'
      - ≥2 đáp án đúng → 'multiple_response', 'Nhiều đáp án đúng'
      - 0 đáp án đúng  → 'unknown', 'Chưa xác định'

    Lưu ý: chỉ phân biệt single/multiple dựa trên số lượng correct,
    CÁC DẠNG KHÁC (true_false, fill_in_blank, drag_drop, ordering)
    sẽ được hỗ trợ ở bước tiếp theo.
    """
    correct_opts = [o for o in options if o.get('correct')]
    n = len(correct_opts)
    if n == 1:
        return 'single_choice', QUESTION_TYPES['single_choice'], correct_opts
    if n >= 2:
        return 'multiple_response', QUESTION_TYPES['multiple_response'], correct_opts
    return 'unknown', QUESTION_TYPES['unknown'], correct_opts


def parse_docx_questions(file) -> dict:
    """
    Đọc file .docx và trích câu hỏi trắc nghiệm.
    Trả về:
        {
          'success': True,
          'questions': [
            {
              'number': 1,
              'text': '...',
              'options': [{'label': 'A', 'text': '...', 'correct': False}, ...],
              'answer': 'B' (optional),
              'type': 'single_choice' | 'multiple_response' | 'unknown',
              'type_label': '1 đáp án đúng' | 'Nhiều đáp án đúng' | 'Chưa xác định',
              'correct_options': [...]
            },
            ...
          ],
          'warnings': [...]
        }
    """
    warnings = []
    try:
        doc = Document(file)
    except Exception as e:
        return {
            'success': False,
            'error': f'Không đọc được file Word: {e}',
            'questions': [],
            'warnings': [],
        }

    # Phân tích run-level cho tất cả paragraph (kèm cả paragraph rỗng bỏ qua)
    paragraphs_data = []
    for p in doc.paragraphs:
        analysis = _analyze_paragraph(p)
        if not analysis['text'].strip():
            continue
        paragraphs_data.append(analysis)

    questions = []
    current = None
    pending_label: Optional[str] = None  # dòng "Đáp án: B" xuất hiện trước options

    def commit_current():
        nonlocal current
        if current is None:
            return
        if pending_label and current['options']:
            for opt in current['options']:
                if opt['label'] == pending_label:
                    opt['correct'] = True
                    break
            current['answer'] = pending_label
        elif any(o['correct'] for o in current['options']):
            current['answer'] = next(
                (o['label'] for o in current['options'] if o['correct']),
                None,
            )

        # ── Phân loại dạng câu hỏi dựa trên số đáp án đúng ──
        current['type'], current['type_label'], current['correct_options'] = _classify_question(
            current['options'],
        )

        questions.append(current)
        current = None

    for analysis in paragraphs_data:
        line = analysis['text']

        # 1. Có phải dòng "Đáp án: B" không?
        ans_match = RE_ANSWER_LINE.match(line)
        if ans_match:
            label = ans_match.group(1).upper()
            if current is not None and current['options']:
                for opt in current['options']:
                    if opt['label'] == label:
                        opt['correct'] = True
                        break
                current['answer'] = label
                commit_current()
                pending_label = None
                continue
            else:
                pending_label = label
                continue

        # 2. Có phải dòng bắt đầu câu hỏi không?
        q_match = RE_QUESTION_START.match(line)
        if q_match:
            commit_current()
            current = {
                'number': int(q_match.group(1)),
                'text': q_match.group(2).strip(),
                'options': [],
                'answer': None,
                'type': 'unknown',
                'type_label': QUESTION_TYPES['unknown'],
                'correct_options': [],
            }
            continue

        # 3. Đang trong câu hỏi mà chưa có options → ghép text hoặc bắt đầu option
        if current is not None and not current['options']:
            opt = _parse_option_line(analysis)
            if opt:
                current['options'].append(opt)
            else:
                if current['text']:
                    current['text'] += ' ' + line
                else:
                    current['text'] = line
            continue

        # 4. Đang có câu hỏi + đã có options → tiếp tục nạp options
        if current is not None:
            opt = _parse_option_line(analysis)
            if opt:
                current['options'].append(opt)
            else:
                # Có thể là dòng tiếp nối option trước (wrap text) — kể cả màu đỏ
                if current['options']:
                    last = current['options'][-1]
                    last['text'] += ' ' + line
                    # Nếu dòng nối có màu đỏ → vẫn là đáp án đúng
                    if analysis['red']:
                        last['correct'] = True

    # Commit câu cuối
    commit_current()

    # Báo warning nếu câu không có option / không có đáp án
    for q in questions:
        if len(q['options']) < 2:
            warnings.append(f"Câu {q['number']}: chỉ có {len(q['options'])} đáp án")
        if not q['answer']:
            warnings.append(f"Câu {q['number']}: chưa xác định được đáp án đúng")

    return {
        'success': True,
        'questions': questions,
        'warnings': warnings,
    }