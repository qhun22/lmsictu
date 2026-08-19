import json
from django.contrib import messages
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.http import JsonResponse
from django.shortcuts import redirect, render
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
    return render(request, 'tao-de.html', {'page_title': 'Tạo đề trắc nghiệm'})


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
from .models import Quiz, Attempt


@require_POST
@csrf_protect
def api_save_quiz(request):
    """Lưu quiz vào DB, trả về link làm bài."""
    try:
        data = json.loads(request.body)
        questions = data.get('questions', [])
        subject = data.get('subject', '').strip()
        title = data.get('title', '').strip()
        week_index_raw = data.get('week_index', '')
        week_index = int(week_index_raw) if str(week_index_raw).strip() != '' else None

        if not questions:
            return JsonResponse({'success': False, 'message': 'Không có câu hỏi nào.'}, status=400)

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
        )

        # Link đầy đủ
        link = request.build_absolute_uri(f'/e/{code}/')
        return JsonResponse({
            'success': True,
            'code': code,
            'link': link,
            'quiz_id': quiz.id,
        })
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'message': 'Dữ liệu không hợp lệ.'}, status=400)
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)}, status=500)


@login_required
def api_quiz_links(request):
    """Trả về các link đề đã gắn với môn và tuần học."""
    quizzes = Quiz.objects.exclude(week_index__isnull=True).values(
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
        quiz = Quiz.objects.get(code=code)
    except Quiz.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'Không tìm thấy đề.'}, status=404)
    if quiz.creator_id and quiz.creator_id != request.user.id:
        return JsonResponse({'success': False, 'message': 'Bạn không có quyền sửa đề này.'}, status=403)
    try:
        data = json.loads(request.body)
        if 'questions' in data:
            quiz.questions = data['questions']
        if 'is_active' in data:
            quiz.is_active = bool(data['is_active'])
        quiz.save(update_fields=['questions', 'is_active'])
        return JsonResponse({'success': True})
    except (json.JSONDecodeError, TypeError):
        return JsonResponse({'success': False, 'message': 'Dữ liệu không hợp lệ.'}, status=400)


@login_required
def api_quiz_detail(request, code):
    try:
        quiz = Quiz.objects.get(code=code)
    except Quiz.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'Không tìm thấy đề.'}, status=404)
    if quiz.creator_id and quiz.creator_id != request.user.id:
        return JsonResponse({'success': False, 'message': 'Bạn không có quyền xem đề này.'}, status=403)
    return JsonResponse({
        'success': True,
        'code': quiz.code,
        'title': quiz.title,
        'subject': quiz.subject,
        'week_index': quiz.week_index,
        'is_active': quiz.is_active,
        'questions': quiz.questions or [],
    })


@login_required
@require_POST
@csrf_protect
def api_toggle_quiz(request, code):
    try:
        quiz = Quiz.objects.get(code=code)
    except Quiz.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'Không tìm thấy đề.'}, status=404)
    if quiz.creator_id and quiz.creator_id != request.user.id:
        return JsonResponse({'success': False, 'message': 'Bạn không có quyền đổi trạng thái đề này.'}, status=403)
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
        'page_title': quiz.title or f'Đề {quiz.code}',
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
                correct_ans = str(q.get('answer', '') or '').lower()
                user_clean = str(user_ans_raw).lower()
                is_correct = user_clean == correct_ans

        elif qtype in ('single_choice', 'multiple_response'):
            correct_opts = [o.get('label', '') for o in q.get('correct_options', [])]
            correct_ans = ','.join(correct_opts)
            is_correct = user_ans_raw.upper() in [o.upper() for o in correct_opts]

        elif qtype == 'ordering':
            statements = q.get('statements') or []
            if statements:
                user_answers = user_ans_raw if isinstance(user_ans_raw, dict) else {}
                results = []
                for statement_index, statement in enumerate(statements):
                    expected = '|'.join(statement.get('ordering_sequence') or []).upper()
                    actual = str(user_answers.get(str(statement_index), '')).upper()
                    results.append(actual == expected)
                is_correct = bool(results) and all(results)
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
            correct_ans = q.get('drag_sentences', [{}])[0].get('answer', '') if q.get('drag_sentences') else ''
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

    # Lưu attempt
    Attempt.objects.create(
        quiz=quiz,
        session_key=request.session.session_key or '',
        user=request.user if request.user.is_authenticated else None,
        answers=answers,
        score=score,
        total=total,
    )

    return JsonResponse({
        'success': True,
        'score': score,
        'correct': correct,
        'total': total,
        'results': results,
    })
