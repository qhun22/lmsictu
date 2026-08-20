import json
from django.contrib import messages
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.http import JsonResponse
from django.shortcuts import redirect, render
from django.utils.html import escape
from django.utils import timezone
from django.urls import NoReverseMatch, reverse
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_POST


@login_required
def home(request):
    return render(request, 'home.html')


@login_required
def tao_mon_hoc(request):
    return render(request, 'tao-mon-hoc.html')


@login_required
def tao_de(request):
    """Trang tạo đề trắc nghiệm — upload Word."""
    subjects = Subject.objects.filter(creator=request.user).prefetch_related('weeks')
    initial_subjects = []
    for subject in subjects:
        initial_subjects.append({
            'id': subject.id,
            'name': subject.name,
            'weeks': list(subject.weeks.values('id', 'name', 'topics', 'link', 'quiz_code', 'active')),
        })
    initial_subject_options = ''.join(
        f'<option value="{escape(subject["name"])}">{escape(subject["name"])}</option>'
        for subject in initial_subjects
    )
    initial_week_options = ''
    if len(initial_subjects) == 1:
        initial_week_options = ''.join(
            f'<option value="{index}">{index + 1}. {escape(week["name"])}</option>'
            for index, week in enumerate(initial_subjects[0]['weeks'])
        )
    return render(request, 'tao-de.html', {
        'page_title': 'Tạo đề trắc nghiệm',
        'initial_subjects': initial_subjects,
        'initial_subject_options': initial_subject_options,
        'initial_week_options': initial_week_options,
        'initial_subjects_json': json.dumps(initial_subjects),
    })


@login_required
@require_POST
@csrf_protect
def api_parse_word(request):
    """
    Nhận file Word (.docx) qua multipart POST,
    parse trắc nghiệm và trả về JSON.
    """
    if 'file' not in request.FILES:
        return JsonResponse(
            {'success': False, 'error': 'Không có file'},
            status=400,
        )

    f = request.FILES['file']
    name = (f.name or '').lower()

    if not name.endswith('.docx'):
        return JsonResponse(
            {
                'success': False,
                'error': 'Chỉ hỗ trợ file .docx (Word định dạng mới).',
            },
            status=400,
        )

    if f.size > 20 * 1024 * 1024:
        return JsonResponse(
            {'success': False, 'error': 'File quá lớn (tối đa 20MB).'},
            status=400,
        )

    # Lazy import để tránh overhead khi app khởi động
    from .word_parser import parse_docx_questions

    try:
        result = parse_docx_questions(f)
    except Exception as e:
        return JsonResponse(
            {'success': False, 'error': f'Lỗi parse: {e}'},
            status=500,
        )

    return JsonResponse(result)


def index_view(request):
    if request.user.is_authenticated:
        return redirect('home')
    return render(request, 'index.html')


def _is_ajax(request):
    return request.headers.get('x-requested-with') == 'XMLHttpRequest'


def _resolve_redirect_target(next_url):
    if not next_url:
        return '/'
    if next_url.startswith('/'):
        return next_url
    try:
        return reverse(next_url)
    except NoReverseMatch:
        return '/' + str(next_url).lstrip('/')


def login_view(request):
    if request.user.is_authenticated:
        return redirect('home')

    if request.method == 'POST':
        username = request.POST.get('username', '').strip().lower()
        password = request.POST.get('password', '')

        if not username:
            message = 'Vui lòng nhập tên đăng nhập hoặc email.'
            if _is_ajax(request):
                return JsonResponse({'success': False, 'message': message}, status=400)
            return render(request, 'account/login.html', {'page_title': 'Đăng nhập'})

        if not password:
            message = 'Vui lòng nhập mật khẩu.'
            if _is_ajax(request):
                return JsonResponse({'success': False, 'message': message}, status=400)
            return render(request, 'account/login.html', {'page_title': 'Đăng nhập'})

        user = None
        if username:
            user = authenticate(request, username=username, password=password)
            if user is None and '@' in username:
                candidate = User.objects.filter(email__iexact=username).first()
                if candidate:
                    user = authenticate(request, username=candidate.username, password=password)

        if user is not None:
            login(request, user)
            messages.success(request, 'Đăng nhập thành công.')
            request.session['just_logged_in'] = True  # đánh dấu vừa đăng nhập
            next_url = request.POST.get('next') or request.GET.get('next') or 'home'
            target = _resolve_redirect_target(next_url)
            if _is_ajax(request):
                return JsonResponse({
                    'success': True,
                    'message': 'Đăng nhập thành công.',
                    'redirect': target
                })
            return redirect(target)

        message = 'Tên đăng nhập hoặc mật khẩu không đúng.'
        if _is_ajax(request):
            return JsonResponse({'success': False, 'message': message}, status=400)

    return render(request, 'account/login.html', {'page_title': 'Đăng nhập'})


def register_view(request):
    if request.method == 'POST':
        username = request.POST.get('username', '').strip().lower()
        email = request.POST.get('email', '').strip().lower()
        password = request.POST.get('password', '')
        password_confirm = request.POST.get('password_confirm', '')

        if not username:
            message = 'Vui lòng nhập tên đăng nhập.'
            if _is_ajax(request):
                return JsonResponse({'success': False, 'message': message}, status=400)
            return render(request, 'account/register.html', {'page_title': 'Đăng ký'})

        if len(username) < 3:
            message = 'Tên đăng nhập phải có ít nhất 3 ký tự.'
            if _is_ajax(request):
                return JsonResponse({'success': False, 'message': message}, status=400)
            return render(request, 'account/register.html', {'page_title': 'Đăng ký'})

        if not email:
            message = 'Vui lòng nhập email.'
            if _is_ajax(request):
                return JsonResponse({'success': False, 'message': message}, status=400)
            return render(request, 'account/register.html', {'page_title': 'Đăng ký'})

        if '@' not in email or '.' not in email.split('@')[-1]:
            message = 'Email không hợp lệ.'
            if _is_ajax(request):
                return JsonResponse({'success': False, 'message': message}, status=400)
            return render(request, 'account/register.html', {'page_title': 'Đăng ký'})

        if User.objects.filter(email__iexact=email).exists():
            message = 'Email này đã được sử dụng.'
            if _is_ajax(request):
                return JsonResponse({'success': False, 'message': message}, status=400)
            return render(request, 'account/register.html', {'page_title': 'Đăng ký'})

        if User.objects.filter(username__iexact=username).exists():
            message = 'Tên đăng nhập này đã tồn tại.'
            if _is_ajax(request):
                return JsonResponse({'success': False, 'message': message}, status=400)
            return render(request, 'account/register.html', {'page_title': 'Đăng ký'})

        if not password:
            message = 'Vui lòng nhập mật khẩu.'
            if _is_ajax(request):
                return JsonResponse({'success': False, 'message': message}, status=400)
            return render(request, 'account/register.html', {'page_title': 'Đăng ký'})

        if len(password) < 8:
            message = 'Mật khẩu phải có ít nhất 8 ký tự.'
            if _is_ajax(request):
                return JsonResponse({'success': False, 'message': message}, status=400)
            return render(request, 'account/register.html', {'page_title': 'Đăng ký'})

        if not password_confirm:
            message = 'Vui lòng nhập lại mật khẩu.'
            if _is_ajax(request):
                return JsonResponse({'success': False, 'message': message}, status=400)
            return render(request, 'account/register.html', {'page_title': 'Đăng ký'})

        if password != password_confirm:
            message = 'Mật khẩu nhập lại không khớp.'
            if _is_ajax(request):
                return JsonResponse({'success': False, 'message': message}, status=400)
            return render(request, 'account/register.html', {'page_title': 'Đăng ký'})

        user = User.objects.create_user(username=username, email=email, password=password)
        message = 'Tài khoản đã được tạo thành công. Vui lòng đăng nhập.'
        if _is_ajax(request):
            return JsonResponse({'success': True, 'message': message})
        return redirect('register')

    return render(request, 'account/register.html', {'page_title': 'Đăng ký'})


def forgot_password_view(request):
    if request.method == 'POST':
        identifier = request.POST.get('identifier', '').strip().lower()
        if not identifier:
            message = 'Vui lòng nhập email hoặc tên đăng nhập.'
            if _is_ajax(request):
                return JsonResponse({'success': False, 'message': message}, status=400)
        else:
            user = User.objects.filter(username__iexact=identifier).first() or User.objects.filter(email__iexact=identifier).first()
            message = 'Nếu tài khoản tồn tại, hướng dẫn đặt lại mật khẩu đã được gửi.'
            if _is_ajax(request):
                return JsonResponse({'success': True, 'message': message})

    return render(request, 'account/forgot-password.html', {'page_title': 'Quên mật khẩu'})


@login_required
def account_view(request):
    return render(request, 'account/account.html', {'page_title': 'Tài khoản'})


def logout_view(request):
    logout(request)
    messages.success(request, 'Đăng xuất thành công.')
    return redirect('index')


# ────────────────────────────────────────────────────────────────
#  EXAM VIEWS
# ────────────────────────────────────────────────────────────────

import secrets
from .models import Quiz, Attempt, Subject, Week


@login_required
@require_POST
@csrf_protect
def api_save_quiz(request):
    """Lưu quiz vào DB, trả về link làm bài."""
    try:
        data = json.loads(request.body)
        questions = data.get('questions', [])
        subject = data.get('subject', '').strip()
        title = data.get('title', '').strip()
        duration_seconds = int(data.get('duration_seconds', 1800))
        if not 60 <= duration_seconds <= 86400:
            raise ValueError('Thời gian làm bài phải từ 01:00 đến 24:00:00.')
        week_index_raw = data.get('week_index', '')
        week_index = int(week_index_raw) if str(week_index_raw).strip() != '' else None

        if not questions:
            return JsonResponse({'success': False, 'message': 'Không có câu hỏi nào.'}, status=400)

        if subject and week_index is not None:
            existing = Quiz.objects.filter(
                creator=request.user,
                subject=subject,
                week_index=week_index,
            ).first()
            if existing:
                return JsonResponse({
                    'success': False,
                    'message': 'Tuần học này đã có đề. Hãy chọn chỉnh sửa đề hiện tại.',
                    'code': existing.code,
                }, status=409)

        # Tạo code ngẫu nhiên 8 ký tự
        code = secrets.token_hex(4)  # 8 ký tự hex

        quiz = Quiz.objects.create(
            code=code,
            title=title or f'Đề {subject or ""}',
            subject=subject,
            week_index=week_index,
            is_active=True,
            creator=request.user if request.user.is_authenticated else None,
            questions=questions,
            duration_seconds=duration_seconds,
        )

        if subject and week_index is not None:
            week = Week.objects.filter(
                subject__name=subject,
                subject__creator=request.user,
            ).order_by('id')[week_index:week_index + 1]
            if week:
                week[0].link = request.build_absolute_uri(f'/e/{code}/')
                week[0].quiz_code = code
                week[0].save(update_fields=['link', 'quiz_code'])

        # Link đầy đủ
        link = request.build_absolute_uri(f'/e/{code}/')
        return JsonResponse({
            'success': True,
            'code': code,
            'link': link,
            'quiz_id': quiz.id,
        })
    except (json.JSONDecodeError, TypeError, ValueError):
        return JsonResponse({'success': False, 'message': 'Dữ liệu không hợp lệ.'}, status=400)
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)}, status=500)


@login_required
def api_quiz_links(request):
    """Trả về các link đề đã gắn với môn và tuần học."""
    quizzes = Quiz.objects.filter(creator=request.user).exclude(week_index__isnull=True).values(
        'subject', 'week_index', 'code', 'title', 'is_active',
    )
    return JsonResponse({
        'links': [
            {
                'subject': quiz['subject'],
                'week_index': quiz['week_index'],
                'code': quiz['code'],
                'title': quiz['title'],
                'is_active': quiz['is_active'],
                'link': request.build_absolute_uri(f"/e/{quiz['code']}/"),
            }
            for quiz in quizzes
        ],
    })


@login_required
@require_POST
@csrf_protect
def api_update_quiz(request, code):
    """Cập nhật câu hỏi và trạng thái đề từ trang quản lý."""
    try:
        quiz = Quiz.objects.get(code=code, creator=request.user)
    except Quiz.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'Không tìm thấy đề.'}, status=404)
    try:
        data = json.loads(request.body)
        update_fields = []
        if 'questions' in data:
            quiz.questions = data['questions']
            update_fields.append('questions')
        if 'is_active' in data:
            quiz.is_active = bool(data['is_active'])
            update_fields.append('is_active')
        if 'subject' in data:
            quiz.subject = str(data['subject']).strip()
            update_fields.append('subject')
        if 'week_index' in data:
            quiz.week_index = int(data['week_index']) if str(data['week_index']).strip() != '' else None
            update_fields.append('week_index')
        if 'title' in data:
            quiz.title = str(data['title']).strip()
            update_fields.append('title')
        if 'duration_seconds' in data:
            duration_seconds = int(data['duration_seconds'])
            if not 60 <= duration_seconds <= 86400:
                raise ValueError('Thời gian làm bài phải từ 01:00 đến 24:00:00.')
            quiz.duration_seconds = duration_seconds
            update_fields.append('duration_seconds')
        if update_fields:
            quiz.save(update_fields=update_fields)
        if quiz.subject and quiz.week_index is not None:
            week = Week.objects.filter(
                subject__name=quiz.subject,
                subject__creator=request.user,
            ).order_by('id')[quiz.week_index:quiz.week_index + 1]
            if week:
                week[0].link = request.build_absolute_uri(f'/e/{quiz.code}/')
                week[0].quiz_code = quiz.code
                week[0].save(update_fields=['link', 'quiz_code'])
        return JsonResponse({'success': True})
    except (json.JSONDecodeError, TypeError, ValueError):
        return JsonResponse({'success': False, 'message': 'Dữ liệu không hợp lệ.'}, status=400)


@login_required
def api_quiz_detail(request, code):
    try:
        quiz = Quiz.objects.get(code=code, creator=request.user)
    except Quiz.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'Không tìm thấy đề.'}, status=404)
    return JsonResponse({
        'success': True,
        'code': quiz.code,
        'title': quiz.title,
        'subject': quiz.subject,
        'week_index': quiz.week_index,
        'is_active': quiz.is_active,
        'duration_seconds': quiz.duration_seconds,
        'questions': quiz.questions or [],
    })


@login_required
@require_POST
@csrf_protect
def api_toggle_quiz(request, code):
    try:
        quiz = Quiz.objects.get(code=code, creator=request.user)
    except Quiz.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'Không tìm thấy đề.'}, status=404)
    quiz.is_active = not quiz.is_active
    quiz.save(update_fields=['is_active'])
    return JsonResponse({'success': True, 'is_active': quiz.is_active})


def exam_page(request, code):
    """Trang làm bài exam — ai cũng vào được."""
    try:
        quiz = Quiz.objects.get(code=code)
    except Quiz.DoesNotExist:
        return render(request, 'exam/error.html', {
            'message': 'Đề thi không tồn tại hoặc đã bị xóa.',
        }, status=404)

    if not quiz.is_active:
        return render(request, 'exam/error.html', {
            'message': 'Bài thi đang tạm ngưng để bảo trì. Vui lòng quay lại sau.',
        }, status=503)

    import json
    return render(request, 'exam/exam.html', {
        'quiz': quiz,
        'quiz_json': json.dumps(quiz.questions or []),
        'quiz_duration_seconds': quiz.duration_seconds,
        'result_json': 'null',
        'page_title': quiz.title or f'Đề {quiz.code}',
    })


def exam_result_page(request, code, attempt_id):
    """Render a submitted attempt so refresh keeps the user on the result page."""
    try:
        attempt = Attempt.objects.select_related('quiz', 'user').get(
            id=attempt_id,
            quiz__code=code,
        )
    except Attempt.DoesNotExist:
        return render(request, 'exam/error.html', {
            'message': 'Không tìm thấy kết quả bài làm.',
        }, status=404)

    same_user = attempt.user_id and request.user.is_authenticated and attempt.user_id == request.user.id
    same_session = attempt.session_key and attempt.session_key == request.session.session_key
    if not (same_user or same_session):
        return render(request, 'exam/error.html', {
            'message': 'Bạn không có quyền xem kết quả bài làm này.',
        }, status=403)

    return render(request, 'exam/exam.html', {
        'quiz': attempt.quiz,
        'quiz_json': json.dumps(attempt.quiz.questions or []),
        'quiz_duration_seconds': attempt.quiz.duration_seconds,
        'result_json': json.dumps({
            'success': True,
            'score': attempt.score,
            'correct': sum(1 for result in attempt.results if result.get('correct')),
            'total': attempt.total,
            'results': attempt.results,
        }),
        'page_title': f'Kết quả - {attempt.quiz.title or attempt.quiz.code}',
    })


@require_POST
@csrf_protect
def api_submit_exam(request, code):
    """Nhận đáp án, tính điểm, trả kết quả."""
    try:
        quiz = Quiz.objects.get(code=code)
    except Quiz.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'Đề thi không tồn tại.'}, status=404)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'message': 'Dữ liệu không hợp lệ.'}, status=400)

    answers = data.get('answers', {})  # {idx: label}
    questions = quiz.questions or []

    # Tính điểm
    total = len(questions)
    correct = 0
    results = []

    for i, q in enumerate(questions):
        qtype = q.get('type', 'unknown')
        user_ans_raw = answers.get(str(i), '')
        correct_ans = ''
        is_correct = False

        if qtype == 'true_false':
            statements = q.get('statements') or []
            if statements:
                user_answers = user_ans_raw if isinstance(user_ans_raw, dict) else {}
                statement_results = []
                for statement_index, statement in enumerate(statements):
                    expected = statement.get('answer')
                    actual = str(user_answers.get(str(statement_index), '')).lower()
                    statement_results.append(actual == expected)
                is_correct = bool(statement_results) and all(statement_results)
                correct_ans = ','.join(statement.get('answer') or '' for statement in statements)
            else:
                correct_options = q.get('correct_options') or []
                if correct_options:
                    correct_option = correct_options[0]
                    correct_text = str(correct_option.get('text', '')).lower()
                    correct_label = str(correct_option.get('label', '')).upper()
                    correct_ans = 'true' if correct_label == 'A' or 'đúng' in correct_text else 'false'
                else:
                    correct_ans = str(q.get('answer', '') or '').lower()
                user_clean = str(user_ans_raw).lower()
                is_correct = user_clean == correct_ans

        elif qtype in ('single_choice', 'multiple_response'):
            correct_opts = [o.get('label', '') for o in q.get('correct_options', [])]
            correct_ans = ','.join(correct_opts)
            if qtype == 'multiple_response':
                selected_opts = user_ans_raw if isinstance(user_ans_raw, list) else [user_ans_raw]
                is_correct = {str(label).upper() for label in selected_opts} == {
                    str(label).upper() for label in correct_opts
                }
            else:
                selected_opt = user_ans_raw[0] if isinstance(user_ans_raw, list) and user_ans_raw else user_ans_raw
                is_correct = str(selected_opt).upper() in [str(o).upper() for o in correct_opts]

        elif qtype == 'ordering':
            statements = q.get('statements') or []
            if statements:
                user_answers = user_ans_raw if isinstance(user_ans_raw, dict) else {}
                statement_results = []
                for statement_index, statement in enumerate(statements):
                    expected = '|'.join(statement.get('ordering_sequence') or []).upper()
                    actual = str(user_answers.get(str(statement_index), '')).upper()
                    statement_results.append(actual == expected)
                is_correct = bool(statement_results) and all(statement_results)
                correct_ans = ';'.join('|'.join(statement.get('ordering_sequence') or []) for statement in statements)
            else:
                seq = q.get('ordering_sequence', [])
                correct_ans = ','.join(seq)
                is_correct = str(user_ans_raw).upper() == correct_ans.upper()

        elif qtype == 'fill_in_blank':
            blank_ans = (q.get('fill_blank_answer') or '').strip().lower()
            user_clean = str(user_ans_raw).strip().lower()
            is_correct = user_clean == blank_ans
            correct_ans = blank_ans

        elif qtype in ('drag_into_text', 'drag_into_groups'):
            groups = q.get('drag_groups') or []
            if groups:
                user_groups = user_ans_raw if isinstance(user_ans_raw, dict) else {}
                is_correct = all(
                    sorted(user_groups.get(str(group_index), [])) == sorted(group.get('answers') or [])
                    for group_index, group in enumerate(groups)
                )
                correct_ans = ';'.join('|'.join(group.get('answers') or []) for group in groups)
                if is_correct:
                    correct += 1
                results.append({'index': i, 'type': qtype, 'correct': is_correct, 'user_answer': user_ans_raw, 'correct_answer': correct_ans})
                continue
            sentences = q.get('drag_sentences') or []
            if len(sentences) > 1:
                user_sentences = user_ans_raw if isinstance(user_ans_raw, dict) else {}
                is_correct = bool(sentences) and all(
                    str(user_sentences.get(str(sentence_index), '')).strip().lower()
                    == str(sentence.get('answer') or '').strip().lower()
                    for sentence_index, sentence in enumerate(sentences)
                )
                correct_ans = ';'.join(str(sentence.get('answer') or '') for sentence in sentences)
            else:
                correct_ans = sentences[0].get('answer', '') if sentences else ''
                user_clean = str(user_ans_raw).strip().lower()
                is_correct = user_clean == correct_ans.lower()

        if is_correct:
            correct += 1

        results.append({
            'index': i,
            'type': qtype,
            'correct': is_correct,
            'user_answer': user_ans_raw,
            'correct_answer': correct_ans,
        })

    score = round(correct / total * 10, 1) if total > 0 else 0

    if not request.session.session_key:
        request.session.create()

    # Lưu attempt
    attempt = Attempt.objects.create(
        quiz=quiz,
        session_key=request.session.session_key,
        user=request.user if request.user.is_authenticated else None,
        answers=answers,
        results=results,
        score=score,
        total=total,
        submitted_at=timezone.now(),
    )

    return JsonResponse({
        'success': True,
        'score': score,
        'correct': correct,
        'total': total,
        'results': results,
        'result_url': request.build_absolute_uri(f'/result/{quiz.code}/{attempt.id}/'),
    })


# ────────────────────────────────────────────────────────────────
#  SUBJECT & WEEK VIEWS (Database-backed)
# ────────────────────────────────────────────────────────────────

@login_required
def api_subjects(request):
    """Lấy danh sách môn học của user hiện tại."""
    subjects = Subject.objects.filter(creator=request.user).values('id', 'name', 'created_at')
    return JsonResponse({'subjects': list(subjects)})


@login_required
@require_POST
@csrf_protect
def api_subject_create(request):
    """Tạo Môn Học Mới."""
    try:
        data = json.loads(request.body)
        name = data.get('name', '').strip()

        if not name:
            return JsonResponse({'success': False, 'message': 'Tên môn học không được trống.'}, status=400)

        if Subject.objects.filter(name__iexact=name, creator=request.user).exists():
            return JsonResponse({'success': False, 'message': 'Môn học đã tồn tại.'}, status=400)

        subject = Subject.objects.create(name=name, creator=request.user)
        return JsonResponse({'success': True, 'subject': {'id': subject.id, 'name': subject.name}})
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'message': 'Dữ liệu không hợp lệ.'}, status=400)


@login_required
@require_POST
@csrf_protect
def api_subject_delete(request, subject_id):
    """Xóa môn học."""
    try:
        subject = Subject.objects.get(id=subject_id, creator=request.user)
        subject.delete()
        return JsonResponse({'success': True})
    except Subject.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'Không tìm thấy môn học.'}, status=404)


@login_required
@require_POST
@csrf_protect
def api_subject_rename(request, subject_id):
    """Đổi tên môn học."""
    try:
        subject = Subject.objects.get(id=subject_id, creator=request.user)
        data = json.loads(request.body)
        new_name = data.get('name', '').strip()

        if not new_name:
            return JsonResponse({'success': False, 'message': 'Tên môn học không được trống.'}, status=400)

        if Subject.objects.filter(name__iexact=new_name, creator=request.user).exclude(id=subject_id).exists():
            return JsonResponse({'success': False, 'message': 'Tên môn học đã tồn tại.'}, status=400)

        subject.name = new_name
        subject.save()
        return JsonResponse({'success': True, 'name': subject.name})
    except Subject.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'Không tìm thấy môn học.'}, status=404)


@login_required
def api_weeks(request, subject_id):
    """Lấy danh sách tuần của một môn học."""
    try:
        subject = Subject.objects.get(id=subject_id, creator=request.user)
        weeks = subject.weeks.values('id', 'name', 'topics', 'link', 'quiz_code', 'active')
        return JsonResponse({'weeks': list(weeks)})
    except Subject.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'Không tìm thấy môn học.'}, status=404)


@login_required
@require_POST
@csrf_protect
def api_week_create(request, subject_id):
    """Tạo tuần học mới."""
    try:
        subject = Subject.objects.get(id=subject_id, creator=request.user)
        data = json.loads(request.body)
        name = data.get('name', '').strip()
        topics = data.get('topics', [])
        link = data.get('link', '').strip()

        if not name:
            return JsonResponse({'success': False, 'message': 'Tên tuần không được trống.'}, status=400)

        week = Week.objects.create(subject=subject, name=name, topics=topics, link=link)
        return JsonResponse({'success': True, 'week': {
            'id': week.id,
            'name': week.name,
            'topics': week.topics,
            'link': week.link,
            'quiz_code': week.quiz_code,
            'active': week.active,
        }})
    except Subject.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'Không tìm thấy môn học.'}, status=404)


@login_required
@require_POST
@csrf_protect
def api_week_update(request, week_id):
    """Cập nhật tuần học."""
    try:
        week = Week.objects.get(id=week_id, subject__creator=request.user)
        data = json.loads(request.body)

        if 'name' in data:
            week.name = data['name'].strip()
        if 'topics' in data:
            week.topics = data['topics']
        if 'link' in data:
            week.link = data['link'].strip()

        week.save()
        return JsonResponse({'success': True})
    except Week.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'Không tìm thấy tuần học.'}, status=404)


@login_required
@require_POST
@csrf_protect
def api_week_delete(request, week_id):
    """Xóa tuần học."""
    try:
        week = Week.objects.get(id=week_id, subject__creator=request.user)
        week.delete()
        return JsonResponse({'success': True})
    except Week.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'Không tìm thấy tuần học.'}, status=404)
