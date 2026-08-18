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
