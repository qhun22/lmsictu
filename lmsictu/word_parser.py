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
import unicodedata

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
# ║  Regex cho 3 dạng câu hỏi đặc biệt                            ║
# ╚══════════════════════════════════════════════════════════════╝

# true_false: "đúng hay sai", "đúng hoặc sai", "đúng không?", "true or false"
RE_TRUE_FALSE = re.compile(
    r'(đúng\s*(?:hay|hoặc|hay\s+là)?\s*sai|true\s*or\s*false|'
    r'đúng\s+không\s*\?|đúng\s+hay\s+sai|true\s+or\s+false|'
    r'đúng\s*\?|sai\s*\?)',
    re.IGNORECASE,
)

# ordering (sắp xếp): "sắp xếp", "sắp xếp lại câu", "rearrange", "reorder"
RE_ORDERING = re.compile(
    r'(sắp\s*xếp\s*(?:lại\s*)?(?:câu|các\s*từ|các\s*đáp\s*án|cho\s*đúng)(?:\s+sau)?(?:'
    r'\s+sao\s*cho\s*đúng(?:\s+cấu\s*trúc)?|'
    r'\s+theo\s*đúng\s*thứ\s*tự|'
    r'\s+cho\s*đúng|'
    r'\s+cấu\s*trúc'
    r')?|rearrange(?:\s+the\s*sentence)?|reorder(?:\s+the\s*words?)|sắp\s*xếp\s*theo)',
    re.IGNORECASE,
)

# fill_in_blank (điền từ): "điền từ", "điền vào chỗ trống", "fill in", "fill in the blank"
RE_FILL_BLANK = re.compile(
    r'(điền\s*từ\s*(?:thích\s*hợp\s*)?(?:vào\s*)?(?:chỗ\s*trống|chỗ\s*trống\s*sau|'
    r'vào\s*chỗ|khoảng\s*trống)(?:\s+sau)?|fill\s*in(?:\s*the\s*blank)?|'
    r'điền\s*vào\s*chỗ\s*trống)',
    re.IGNORECASE,
)

# drag_into_text (kéo thả): "kéo thả", "kéo-thả", "kéo các đáp án", "điền khớp", "drag and drop"
# Dùng re.IGNORECASE nên không cần kẹp k hoa. Pattern chỉ cần từ "éo" vì "K" hoa match tự động.
RE_DRAG_INTO_TEXT = re.compile(
    r'(kéo|éo\s*thả|thả|'
    r'drag\s*and\s*drop|'
    r'điền\s+(?:các\s+)?đáp\s*án\s+(?:vào|khớp)|'
    r'nối\s+(?:các\s+)?đáp\s*án)',
    re.IGNORECASE,
)

# Marker EXACT (extract ra khối text để hiển thị riêng)
# Strategy: tìm cụm RE_FILL_BLANK/RE_ORDERING, lấy phần đầu câu (từ start đến hết dấu "."
# đầu tiên hoặc ":"). Phần còn lại là body.
def _split_marker(text: str, marker_pattern) -> tuple:
    """
    Tìm marker (đoạn khớp marker_pattern) trong text, trả về:
      (marker_text, body_text)
    marker_text lấy phần đầu CÂU (đến dấu "." hoặc ":" đầu tiên).
    Nếu không khớp → trả ('', text).

    NOTE: Không ưu tiên ___ nữa — để commit_current tách câu có ___.
    """
    m = marker_pattern.search(text)
    if not m:
        return '', text
    marker_end = m.span()[1]
    suffix = text[marker_end:]
    punct_pos = None
    for i, ch in enumerate(suffix):
        if ch in '.!?':
            punct_pos = marker_end + i + 1
            break
    if punct_pos is not None:
        return text[:punct_pos].strip(), text[punct_pos:].strip()
    return text[:marker_end].strip(), text[marker_end:].strip()


def _split_marker_drag(text: str, marker_pattern) -> tuple:
    """
    Phiên bản đặc biệt cho drag_into_text.
    Tìm phrase marker, cắt tại dấu kết thúc câu (.!?:) SAU phrase.
    Phần body có thể chứa câu có ___ — caller sẽ tách.
    """
    m = marker_pattern.search(text)
    if not m:
        return '', text
    marker_end = m.span()[1]
    # Tìm dấu kết thúc câu (.!?:) đầu tiên SAU marker_end
    for i in range(marker_end, len(text)):
        if text[i] in '.!?;:':
            return text[:i+1].strip(), text[i+1:].strip()
    return text.strip(), ''


RE_FILL_BLANK_MARKER = RE_FILL_BLANK
RE_ORDERING_MARKER = RE_ORDERING
RE_DRAG_MARKER = RE_DRAG_INTO_TEXT

# Chỗ trống trong text: "___", "[ ]", "()", "…", "______"
RE_BLANK_PLACEHOLDER = re.compile(r'_{3,}|\[\s*\]|\(\s*\)|…+|\.\.\.+')

# Dòng đáp án ordering: tiền tố `**` = đáp án đúng, `*` = từ lẻ
# (chấp nhận cả các bullet ký tự hay gặp trong Word: *, •, ·, ›, –)
RE_ORDERING_ANSWER = re.compile(r'^\s*\*\*(.+)$')
RE_ORDERING_WORDS = re.compile(r'^\s*(?!\*\*)[*•·›–\-]\s*(.+)$')

# Dòng đáp án fill (1 bullet đầu dòng + nội dung ngắn — KHÔNG phải A./B./C./...)
RE_FILL_ANSWER = re.compile(r'^\s*[*•·›–\-]\s*(?![A-Ha-h][\.\)])(.+?)\s*$')


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
    # Sanitize Unicode: NFC normalize + strip zero-width chars
    full_text = unicodedata.normalize('NFC', paragraph.text)
    full_text = re.sub(r'[\u200B-\u200D\u2060\uFEFF]', '', full_text)
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
    'true_false': 'Đúng / Sai',
    'fill_in_blank': 'Điền từ vào chỗ trống',
    'ordering': 'Sắp xếp từ',
    'drag_into_text': 'Kéo thả đáp án',
    'drag_into_groups': 'Kéo thả theo nhóm',
    'unknown': 'Chưa xác định',
}

DEFAULT_ORDERING_PROMPT = 'Sắp xếp lại câu sau sao cho đúng cấu trúc.'
DEFAULT_GROUPING_PROMPT = 'Phân chia đáp án vào nhóm phù hợp.'
DEFAULT_DRAG_PROMPT = 'Kéo thả các từ vào vị trí thích hợp.'


def _ensure_special_flags(current: dict) -> None:
    """
    Re-scan cờ đặc biệt (is_ordering, is_fill_in_blank, is_true_false) dựa
    trên text HIỆN TẠI của current. Gọi mỗi khi text được ghép/đổi.

    Lý do: trong Word, tiêu đề dạng đặc biệt có thể tách thành nhiều
    paragraph (Câu 55: / Điền từ thích hợp vào chỗ trống sau: / Bác Hồ là
    người ___.). Lúc q_match parse 'Câu 55:' thì text='' nên không detect
    được marker. Phải quét lại sau khi text đã được ghép.
    """
    if current is None or not current.get('text'):
        return
    text = current['text']

    # ── Tách marker (1 lần, ưu tiên fill > order) ──
    # Kiểm tra cờ trên FULL text TRƯỚC khi tách
    if not current.get('is_ordering') and RE_ORDERING.search(text):
        current['is_ordering'] = True
    if not current.get('is_fill_in_blank') and RE_FILL_BLANK.search(text):
        current['is_fill_in_blank'] = True
    if not current.get('is_drag_into_text') and RE_DRAG_INTO_TEXT.search(text):
        current['is_drag_into_text'] = True
    if not current.get('is_true_false') and RE_TRUE_FALSE.search(text):
        current['is_true_false'] = True

    if not current.get('marker'):
        # Fill
        marker, body = _split_marker(text, RE_FILL_BLANK_MARKER)
        if marker:
            current['marker'] = marker
            current['text'] = body
            text = body
        else:
            # Ordering
            marker, body = _split_marker(text, RE_ORDERING_MARKER)
            if marker:
                current['marker'] = marker
                current['text'] = body
                text = body
            else:
                # Drag: marker đã được xử lý trong commit_current (nếu đã có marker)
                # Hoặc chưa có marker → text vẫn nguyên → commit_current sẽ xử lý
                pass


def _classify_question(current: dict) -> tuple:
    """
    Phân loại dạng câu hỏi dựa trên:
      1. Marker trong text (câu hỏi)
      2. Cấu trúc options + extra fields
      3. Fallback: đếm số đáp án đúng

    Returns: (type, label, correct_options_list)
    Extra fields nếu có (current.get):
      - 'is_true_false': bool
      - 'is_ordering': bool
      - 'is_fill_in_blank': bool
      - 'ordering_words': list[str]    (các từ lẻ)
      - 'ordering_sequence': list[str] (thứ tự đúng)
      - 'fill_blank_text': str         (text chỗ trống)
      - 'fill_blank_answer': str       (đáp án điền vào)
    """
    text = current.get('text', '') or ''
    options = current.get('options', [])

    # ── ƯU TIÊN 1: nếu parser đã set cờ đặc biệt → dùng luôn ──
    if current.get('is_true_false'):
        return 'true_false', QUESTION_TYPES['true_false'], [
            o for o in options if o.get('correct')
        ]
    if current.get('is_ordering'):
        # ordering thường có 2 dòng * / **, không phải options A/B/C
        # Nhưng vẫn trả correct_options = rỗng
        return 'ordering', QUESTION_TYPES['ordering'], []

    if current.get('is_fill_in_blank'):
        return 'fill_in_blank', QUESTION_TYPES['fill_in_blank'], []

    if current.get('is_drag_into_text'):
        return 'drag_into_text', QUESTION_TYPES['drag_into_text'], []

    # ── ƯU TIÊN 2: detect từ TEXT câu hỏi ──
    if RE_TRUE_FALSE.search(text):
        return 'true_false', QUESTION_TYPES['true_false'], [
            o for o in options if o.get('correct')
        ]
    if RE_ORDERING.search(text):
        return 'ordering', QUESTION_TYPES['ordering'], []
    if RE_FILL_BLANK.search(text):
        return 'fill_in_blank', QUESTION_TYPES['fill_in_blank'], []
    if RE_DRAG_INTO_TEXT.search(text):
        return 'drag_into_text', QUESTION_TYPES['drag_into_text'], []

    # ── ƯU TIÊN 3: detect từ CẤU TRÚC ──
    # true_false: có đúng 2 option mà 1 trong 2 chứa "đúng" hoặc "sai"
    if len(options) == 2:
        opts_text = ' '.join(o.get('text', '').lower() for o in options)
        if (
            ('đúng' in opts_text and 'sai' in opts_text)
            or ('true' in opts_text and 'false' in opts_text)
        ):
            return 'true_false', QUESTION_TYPES['true_false'], [
                o for o in options if o.get('correct')
            ]

    # fill_in_blank: có `[ ]`, `___`, `…` trong text
    if RE_BLANK_PLACEHOLDER.search(text):
        return 'fill_in_blank', QUESTION_TYPES['fill_in_blank'], []

    # ── FALLBACK: single/multiple dựa vào số đáp án đúng ──
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
              'type': 'single_choice' | 'multiple_response' | 'true_false'
                     | 'fill_in_blank' | 'ordering' | 'unknown',
              'type_label': '1 đáp án đúng' | 'Nhiều đáp án đúng' | 'Đúng / Sai'
                          | 'Điền từ vào chỗ trống' | 'Sắp xếp từ' | 'Chưa xác định',
              'correct_options': [...],
              # Extra fields cho 3 dạng đặc biệt
              'is_true_false': bool,
              'is_ordering': bool,
              'is_fill_in_blank': bool,
              'ordering_words': ['Huy', 'name', ...] | None,
              'ordering_sequence': ['My', 'name', ...] | None,
              'fill_blank_answer': 'việt nam' | None,
            },
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
    # Lưu ý: 1 paragraph có \n (line break) → split thành nhiều entry
    paragraphs_data = []
    for p in doc.paragraphs:
        full_text = p.text
        # Nếu có \n (Shift+Enter trong Word) → split thành các dòng
        if '\n' in full_text:
            lines = full_text.split('\n')
            for line in lines:
                if not line.strip():
                    continue
                # Tạo 1 dict analysis "đơn giản" cho từng dòng
                # (giữ red/first_red_label từ paragraph gốc nếu match)
                base = _analyze_paragraph(p)
                line_analysis = {
                    'text': line,
                    'red': base['red'],
                    'red_text': base['red_text'],
                    'first_red_label': base['first_red_label'],
                }
                paragraphs_data.append(line_analysis)
        else:
            analysis = _analyze_paragraph(p)
            if not analysis['text'].strip():
                continue
            paragraphs_data.append(analysis)

    questions = []
    current = None
    pending_label: Optional[str] = None  # dòng "Đáp án: B" xuất hiện trước options

    def is_true_false_pair(options: list) -> bool:
        labels = [str(option.get('label', '')).upper() for option in options]
        texts = ' '.join(str(option.get('text', '')).lower() for option in options)
        return len(options) == 2 and labels == ['A', 'B'] and (
            ('đúng' in texts and 'sai' in texts)
            or ('true' in texts and 'false' in texts)
        )

    def save_true_false_statement() -> bool:
        if current is None or not current.get('text') or not is_true_false_pair(current.get('options', [])):
            return False
        correct = next((option for option in current['options'] if option.get('correct')), None)
        current.setdefault('statements', []).append({
            'text': current['text'].strip(),
            'answer': 'true' if correct and correct.get('label') == 'A' else 'false' if correct else None,
        })
        current['text'] = ''
        current['options'] = []
        current['answer'] = None
        return True

    def save_ordering_statement() -> bool:
        if current is None or not current.get('ordering_words') or not current.get('ordering_sequence'):
            return False
        current.setdefault('statements', []).append({
            'ordering_words': list(current['ordering_words']),
            'ordering_sequence': list(current['ordering_sequence']),
        })
        current['ordering_words'] = None
        current['ordering_sequence'] = None
        return True

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

        if current.get('statements') and current.get('text') and current.get('options'):
            save_true_false_statement()
            current['text'] = current['statements'][0]['text']

        if current.get('is_ordering') and current.get('ordering_words') and current.get('ordering_sequence'):
            save_ordering_statement()

        # ── Tách các dòng * / ** bị lẫn trong body (cho ordering) ──
        # Nếu body có chứa dòng *word|... và **word|..., tách chúng ra.
        if current.get('text'):
            text_body = current['text']

            # Tìm **word|word|word (priority 1 — match chính xác đầu dòng)
            # Trong body có thể có ** ở GIỮA — tìm substring bắt đầu bằng **
            # Cú pháp an toàn: tìm ` **text ` với khoảng trắng trước, hoặc đầu chuỗi
            seq_matches = list(re.finditer(r'(?:^|\s)\*\*(\S+)', text_body))
            if seq_matches:
                last = seq_matches[-1]
                seq_raw = last.group(1)
                current.setdefault('ordering_sequence', [w.strip() for w in seq_raw.split('|') if w.strip()])
                text_body = (text_body[:last.start()] + text_body[last.end():]).strip()

            # Tìm *word|word|word (priority 2 — phải là ` *text` không có ** theo sau)
            # Cần multi-word (VD: *Huy|is|name) — [^|*]+ cho mỗi nhóm
            words_matches = list(re.finditer(
                r'(?:^|\s)\*(?!\*)(\S+(?:\s+\S+)*)',
                text_body,
            ))
            if words_matches:
                last = words_matches[-1]
                words_raw = last.group(1)
                # Chỉ lấy nếu là ordering pattern (chứa | hoặc nhiều từ)
                if '|' in words_raw or ' ' in words_raw:
                    current.setdefault('ordering_words', [w.strip() for w in words_raw.split('|') if w.strip()])
                    text_body = (text_body[:last.start()] + text_body[last.end():]).strip()

            # Tìm *Việt Nam (fill_in_blank answer) — cho phép nhiều từ
            fill_matches = list(re.finditer(
                r'(?:^|\s)\*(?!\*)(?![A-Ha-h][\.\)])([^|*]+(?:\s+[^|*]+)*)',
                text_body,
            ))
            if fill_matches and not current.get('fill_blank_answer'):
                last = fill_matches[-1]
                ans = last.group(1).strip()
                # Skip nếu ans trùng với ordering_words (đã match rồi)
                if not current.get('ordering_words') or ans.split('|')[0].strip() not in current['ordering_words']:
                    current['fill_blank_answer'] = ans
                    text_body = (text_body[:last.start()] + text_body[last.end():]).strip()

            # Strip leading colon ":" nếu còn sót
            text_body = re.sub(r'^[\:\.\s]+', '', text_body).strip()
            current['text'] = text_body

        # ── DRAG_INTO_TEXT: extract marker + collect sentences/answers ──
        if current.get('is_drag_into_text'):
            # Ghép text + marker để xử lý
            combined = (current.get('text') or '') + '\n' + (current.get('marker') or '')
            if combined.strip():
                # Tìm marker đúng (câu đầu tiên, không chứa ___)
                marker_fixed, body_fixed = _split_marker_drag(combined.strip(), RE_DRAG_MARKER)
                # Tách lines để phân loại
                lines_all = (body_fixed or '').split('\n')
                intro_parts = []
                for bline in lines_all:
                    bline = bline.strip()
                    if not bline:
                        continue
                    # Dòng bắt đầu bằng * = answer
                    if bline.startswith('*') or re.match(r'^\s*[*•·›–\-]\s*(.+)', bline):
                        ans_text = re.sub(r'^\s*[*•·›–\-]\s*', '', bline).strip()
                        if current.get('drag_answers') is None:
                            current['drag_answers'] = []
                        if ans_text not in current['drag_answers']:
                            current['drag_answers'].append(ans_text)
                        continue
                    # Dòng chứa ___ = sentence
                    if '___' in bline:
                        if current.get('drag_sentences') is None:
                            current['drag_sentences'] = []
                        current['drag_sentences'].append({'text': bline})
                        continue
                    # Dòng khác = intro
                    intro_parts.append(bline)
                current['marker'] = marker_fixed
                current['text'] = '\n'.join(intro_parts).strip()

        # ── Match answers to drag_sentences (theo thứ tự xuất hiện trong file) ──
        # Cấu trúc file: câu1 có ___ → câu1 answer (last)
        #                 câu2 có ___ → câu2 answer → ... → câuN có ___ → câuN answer (first)
        # => Gán reversed: sentences[i] → answers[-(i+1)]
        if current.get('is_drag_into_text'):
            answers = current.get('drag_answers') or []
            sentences = current.get('drag_sentences') or []
            n_sent = len(sentences)
            n_ans = len(answers)
            if n_sent > 0 and n_ans > 0:
                for i, sent in enumerate(sentences):
                    ans_idx = n_ans - 1 - i  # reversed index
                    if 0 <= ans_idx < n_ans:
                        sent['answer'] = answers[ans_idx]
                    else:
                        sent['answer'] = None
                # Các đáp án reversed (để shuffle = shuffle thứ tự đúng)
                current['drag_answers'] = list(reversed(answers))
                # Ghép các câu đã match vào marker/intro (marker chỉ là intro)
                # Sentences được hiển thị riêng qua drag_sentences
                # marker vẫn giữ nguyên intro (đã được tách ở _split_marker)
                current['text'] = ''  # body đã chuyển vào drag_sentences

        # ── Phân loại dạng câu hỏi (text + cấu trúc) ──
        qtype, qlabel, qcorrect = _classify_question(current)
        if qtype == 'drag_into_text' and current.get('drag_groups'):
            qtype = 'drag_into_groups'
            qlabel = 'Kéo thả theo nhóm'
            if not current.get('text'):
                current['text'] = DEFAULT_GROUPING_PROMPT
        elif qtype == 'drag_into_text' and not current.get('text'):
            current['text'] = DEFAULT_DRAG_PROMPT
        current['type'] = qtype
        current['type_label'] = qlabel
        current['correct_options'] = qcorrect
        if qtype == 'ordering' and not current.get('text'):
            current['text'] = DEFAULT_ORDERING_PROMPT
        if qtype == 'true_false' and current.get('statements'):
            current['text'] = 'Chọn đáp án Đúng Sai phù hợp.'

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
            qtext = q_match.group(2).strip()
            # Pre-scan: nếu marker đặc biệt có ngay trong text → set cờ luôn
            is_ord = bool(RE_ORDERING.search(qtext))
            is_fib = bool(RE_FILL_BLANK.search(qtext))
            is_tf = bool(RE_TRUE_FALSE.search(qtext))
            current = {
                'number': int(q_match.group(1)),
                'text': qtext,
                'marker': None,
                'options': [],
                'answer': None,
                'type': 'unknown',
                'type_label': QUESTION_TYPES['unknown'],
                'correct_options': [],
                'is_true_false': is_tf,
                'is_ordering': is_ord,
                'is_fill_in_blank': is_fib,
                'ordering_words': None,
                'ordering_sequence': None,
                'fill_blank_answer': None,
                'is_drag_into_text': False,
                'drag_answers': None,      # list[str] — các đáp án kéo thả
                'drag_groups': [],
                'drag_sentences': None,   # list[dict] — mỗi dict có text (có ___) và answer
                'statements': [],
            }
            # Nếu là ordering → next iteration có thể là dòng * / **
            continue

        # ╔══════════════════════════════════════════════════════════════╗
        # ║  PARSE CHO 3 DẠNG ĐẶC BIỆT                                 ║
        # ║  (Bắt buộc CHECK trước cả option parser)                    ║
        # ╚══════════════════════════════════════════════════════════════╝

        # ── Nếu gặp câu hỏi mới trong khi đang parse đặc biệt → commit + khởi tạo ──
        if current is not None and (
            current.get('is_ordering') or current.get('is_fill_in_blank')
        ) and RE_QUESTION_START.match(line):
            commit_current()
            qm = RE_QUESTION_START.match(line)
            current = {
                'number': int(qm.group(1)),
                'text': qm.group(2).strip(),
                'marker': None,
                'options': [],
                'answer': None,
                'type': 'unknown',
                'type_label': QUESTION_TYPES['unknown'],
                'correct_options': [],
                'is_true_false': False,
                'is_ordering': False,
                'is_fill_in_blank': False,
                'ordering_words': None,
                'ordering_sequence': None,
                'fill_blank_answer': None,
                'is_drag_into_text': False,
                'drag_answers': None,      # list[str] — các đáp án kéo thả
                'drag_groups': [],
                'drag_sentences': None,   # list[dict] — mỗi dict có text (có ___) và answer
                'statements': [],
            }
            continue

        # ── ORDERING: dòng ** = đáp án đúng, dòng * (không **) = từ lộn xộn ──
        if current is not None and current.get('is_ordering'):
            ord_ans = RE_ORDERING_ANSWER.match(line)
            ord_words = RE_ORDERING_WORDS.match(line)
            if ord_ans:
                seq = [w.strip() for w in ord_ans.group(1).split('|') if w.strip()]
                current['ordering_sequence'] = seq
                continue
            if ord_words:
                if current.get('ordering_words') and current.get('ordering_sequence'):
                    save_ordering_statement()
                words = [w.strip() for w in ord_words.group(1).split('|') if w.strip()]
                current['ordering_words'] = words
                continue
            # Nếu là text wrap → ghép vào text câu hỏi
            if current['text'] and not current.get('ordering_words') and not current.get('ordering_sequence'):
                current['text'] += ' ' + line
            continue

        # ── FILL_IN_BLANK: sau câu hỏi có dòng * + đáp án ──
        if current is not None and current.get('is_fill_in_blank'):
            fill_match = RE_FILL_ANSWER.match(line)
            if fill_match:
                current['fill_blank_answer'] = fill_match.group(1).strip()
                continue
            # Mọi dòng khác: ghép vào text câu hỏi (text wrap)
            if current['text']:
                current['text'] += ' ' + line
            else:
                current['text'] = line
            continue

        # ── DRAG_INTO_TEXT: parse đáp án * + câu có ___ ──
        if current is not None and current.get('is_drag_into_text'):
            group_header = RE_ORDERING_ANSWER.match(line)
            if group_header:
                if current.get('drag_groups') is None:
                    current['drag_groups'] = []
                group = {'label': group_header.group(1).strip(), 'answers': []}
                current['drag_groups'].append(group)
                continue
            # Dòng *answer (không phải **)
            drag_opt = RE_ORDERING_WORDS.match(line)
            if drag_opt:
                if current.get('drag_answers') is None:
                    current['drag_answers'] = []
                ans_text = drag_opt.group(1).strip()
                if ans_text not in current['drag_answers']:
                    current['drag_answers'].append(ans_text)
                if current.get('drag_groups'):
                    current['drag_groups'][-1]['answers'].append(ans_text)
                continue
            # Dòng có ___ (câu cần điền)
            if '___' in line:
                if current.get('drag_sentences') is None:
                    current['drag_sentences'] = []
                current['drag_sentences'].append({'text': line})
                continue
            # Các dòng khác: ghép vào marker/intro text
            if current['text']:
                current['text'] += ' ' + line
            else:
                current['text'] = line
            continue

        # ── True/False: có dòng mới với 2 option Đúng/Sai → set cờ đã có option rồi thì OK ──
        # (true_false không cần parse riêng; classifier sẽ nhận diện sau)

        # Một câu Đúng/Sai có thể chứa nhiều mệnh đề liên tiếp, mỗi mệnh đề
        # có riêng một cặp A/B. Gặp dòng chữ mới sau cặp A/B thì tách mệnh đề.
        if current is not None and current.get('is_true_false') and is_true_false_pair(current.get('options', [])):
            if not _parse_option_line(analysis):
                save_true_false_statement()
                current['text'] = line.strip()
                continue

        # 3. Đang trong câu hỏi mà chưa có options → ghép text hoặc bắt đầu option
        if current is not None and not current['options'] and not current.get('is_ordering') and not current.get('is_fill_in_blank') and not current.get('is_drag_into_text'):
            opt = _parse_option_line(analysis)
            if opt:
                current['options'].append(opt)
            else:
                if current['text']:
                    current['text'] += ' ' + line
                else:
                    current['text'] = line
                # Re-scan cờ đặc biệt SAU khi text đổi (Word có thể tách text + marker ở dòng riêng)
                _ensure_special_flags(current)
            continue

        # 4. Đang có câu hỏi + đã có options → tiếp tục nạp options
        if current is not None and not current.get('is_ordering') and not current.get('is_fill_in_blank'):
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
        qtype = q.get('type')
        if qtype == 'true_false' and q.get('statements'):
            if any(statement.get('answer') not in ('true', 'false') for statement in q['statements']):
                warnings.append(f"Câu {q['number']}: có mệnh đề Đúng/Sai chưa xác định đáp án")
            continue
        # 3 dạng đặc biệt không bắt buộc ≥2 options
        if qtype in ('ordering', 'fill_in_blank'):
            if q.get('is_ordering'):
                if q.get('statements'):
                    for statement_index, statement in enumerate(q['statements'], start=1):
                        if not statement.get('ordering_words') and not statement.get('ordering_sequence'):
                            warnings.append(f"Câu {q['number']}, mệnh đề {statement_index}: thiếu từ lộn xộn và thứ tự đúng")
                        elif not statement.get('ordering_words'):
                            warnings.append(f"Câu {q['number']}, mệnh đề {statement_index}: thiếu dãy từ lộn xộn (*)")
                        elif not statement.get('ordering_sequence'):
                            warnings.append(f"Câu {q['number']}, mệnh đề {statement_index}: thiếu đáp án thứ tự (**)")
                    continue
                if not q.get('ordering_words') and not q.get('ordering_sequence'):
                    warnings.append(
                        f"Câu {q['number']}: thiếu cả dãy từ lộn xộn (*) lẫn đáp án (**). "
                        f"Đáp án nên có 2 dòng: dòng '*word1|word2|...' và dòng '**word1|word2|...'"
                    )
                elif not q.get('ordering_words'):
                    warnings.append(
                        f"Câu {q['number']}: thiếu dãy từ lộn xộn (*) — chỉ có dòng đáp án. "
                        f"Thêm dòng '*word1|word2|...' để hiển thị các từ cần sắp xếp."
                    )
                elif not q.get('ordering_sequence'):
                    warnings.append(f"Câu {q['number']}: thiếu đáp án (**) trong ordering")
            elif q.get('is_fill_in_blank'):
                if not q.get('fill_blank_answer'):
                    warnings.append(
                        f"Câu {q['number']}: chưa xác định đáp án điền vào chỗ trống. "
                        f"Đáp án cần đứng trên 1 dòng riêng ở đầu có dấu * (vd: *Việt Nam), "
                        f"• hoặc - để parser nhận diện."
                    )
            continue
        if qtype in ('drag_into_text', 'drag_into_groups'):
            if q.get('drag_groups'):
                if any(not group.get('label') or not group.get('answers') for group in q['drag_groups']):
                    warnings.append(f"Câu {q['number']}: có nhóm kéo thả chưa có tên hoặc đáp án")
                continue
            sentences = q.get('drag_sentences') or []
            answers = q.get('drag_answers') or []
            if not sentences and not answers:
                warnings.append(
                    f"Câu {q['number']}: thiếu cả câu có ___ lẫn đáp án (*) cho dạng kéo thả."
                )
            elif not sentences:
                warnings.append(
                    f"Câu {q['number']}: thiếu câu có ___ (ký hiệu chỗ trống) cho dạng kéo thả."
                )
            elif not answers:
                warnings.append(
                    f"Câu {q['number']}: thiếu đáp án (*) cho dạng kéo thả."
                )
            elif len(sentences) != len(answers):
                warnings.append(
                    f"Câu {q['number']}: số câu ({len(sentences)}) không khớp số đáp án ({len(answers)})."
                )
            continue
        if len(q['options']) < 2:
            warnings.append(f"Câu {q['number']}: chỉ có {len(q['options'])} đáp án")
        if not q.get('answer'):
            warnings.append(f"Câu {q['number']}: chưa xác định được đáp án đúng")

    return {
        'success': True,
        'questions': questions,
        'warnings': warnings,
    }