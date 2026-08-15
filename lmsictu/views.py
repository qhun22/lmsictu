from django.contrib import messages
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.shortcuts import redirect, render


def home(request):
    return render(request, 'index.html')


def login_view(request):
    if request.method == 'POST':
        username = request.POST.get('username', '').strip()
        password = request.POST.get('password', '')
        user = authenticate(request, username=username, password=password)

        if user is not None:
            login(request, user)
            next_url = request.POST.get('next') or request.GET.get('next')
            if next_url and next_url.startswith('/'):
                return redirect(next_url)
            return redirect(next_url or 'home')

        messages.error(request, 'Tên đăng nhập hoặc mật khẩu không đúng.')

    return render(request, 'account/login.html', {'page_title': 'Đăng nhập'})


def register_view(request):
    if request.method == 'POST':
        username = request.POST.get('username', '').strip()
        email = request.POST.get('email', '').strip()
        password = request.POST.get('password', '')
        password_confirm = request.POST.get('password_confirm', '')

        if not username or len(username) < 3:
            messages.error(request, 'Tên đăng nhập phải có ít nhất 3 ký tự.')
            return render(request, 'account/register.html', {'page_title': 'Đăng ký'})

        if email and User.objects.filter(email__iexact=email).exists():
            messages.error(request, 'Email này đã được sử dụng.')
            return render(request, 'account/register.html', {'page_title': 'Đăng ký'})

        if User.objects.filter(username__iexact=username).exists():
            messages.error(request, 'Tên đăng nhập này đã tồn tại.')
            return render(request, 'account/register.html', {'page_title': 'Đăng ký'})

        if len(password) < 8:
            messages.error(request, 'Mật khẩu phải có ít nhất 8 ký tự.')
            return render(request, 'account/register.html', {'page_title': 'Đăng ký'})

        if password != password_confirm:
            messages.error(request, 'Mật khẩu nhập lại không khớp.')
            return render(request, 'account/register.html', {'page_title': 'Đăng ký'})

        user = User.objects.create_user(username=username, email=email, password=password)
        login(request, user)
        messages.success(request, 'Tài khoản đã được tạo thành công.')
        return redirect('home')

    return render(request, 'account/register.html', {'page_title': 'Đăng ký'})


def forgot_password_view(request):
    if request.method == 'POST':
        identifier = request.POST.get('identifier', '').strip()
        if not identifier:
            messages.error(request, 'Vui lòng nhập email hoặc tên đăng nhập.')
        else:
            user = User.objects.filter(username__iexact=identifier).first() or User.objects.filter(email__iexact=identifier).first()
            if user:
                messages.success(request, 'Nếu tài khoản tồn tại, hướng dẫn đặt lại mật khẩu đã được gửi.')
            else:
                messages.info(request, 'Nếu tài khoản tồn tại, hướng dẫn đặt lại mật khẩu đã được gửi.')

    return render(request, 'account/forgot-password.html', {'page_title': 'Quên mật khẩu'})


@login_required
def account_view(request):
    return render(request, 'account/account.html', {'page_title': 'Tài khoản'})


def logout_view(request):
    logout(request)
    return redirect('home')
