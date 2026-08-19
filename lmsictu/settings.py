import os
from pathlib import Path
from django.core.exceptions import ImproperlyConfigured

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env')

DEBUG = os.getenv('DEBUG', 'True').lower() in ('1', 'true', 'yes', 'on')
SECRET_KEY = os.getenv('SECRET_KEY', '')
if not SECRET_KEY:
    if DEBUG:
        SECRET_KEY = 'django-insecure-local-development-only'
    else:
        raise ImproperlyConfigured('SECRET_KEY must be set when DEBUG=False')

allowed_hosts_raw = os.getenv('ALLOWED_HOSTS', '')
ALLOWED_HOSTS = [host.strip() for host in allowed_hosts_raw.split(',') if host.strip()]
if not ALLOWED_HOSTS:
    ALLOWED_HOSTS = ['localhost', '127.0.0.1'] if DEBUG else []
if not DEBUG and '*' in ALLOWED_HOSTS:
    raise ImproperlyConfigured('ALLOWED_HOSTS must list real domains when DEBUG=False')

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'lmsictu',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

# WhiteNoise - Static files optimization (tự động bật khi DEBUG=False)
# Cài đặt: pip install whitenoise
# Xóa 3 dòng dưới để tắt nếu gặp lỗi
try:
    import whitenoise
    if not DEBUG:
        MIDDLEWARE = ['whitenoise.middleware.WhiteNoiseMiddleware'] + MIDDLEWARE
        STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'
except ImportError:
    pass

ROOT_URLCONF = 'lmsictu.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'lmsictu.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

AUTH_PASSWORD_VALIDATORS = []
LOGIN_URL = '/login/'

LANGUAGE_CODE = 'vi'
TIME_ZONE = 'Asia/Ho_Chi_Minh'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_DIRS = [
    BASE_DIR,
    BASE_DIR / 'static',
]

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

CSRF_TRUSTED_ORIGINS = [
    origin.strip()
    for origin in os.getenv('CSRF_TRUSTED_ORIGINS', '').split(',')
    if origin.strip()
]

if not DEBUG:
    SECURE_SSL_REDIRECT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_HSTS_SECONDS = int(os.getenv('SECURE_HSTS_SECONDS', '31536000'))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
