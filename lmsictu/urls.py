from django.contrib import admin
from django.urls import path
from . import views

urlpatterns = [
    path('', views.index_view, name='index'),
    path('home/', views.home, name='home'),
    path('tao-mon-hoc/', views.tao_mon_hoc, name='tao_mon_hoc'),
    path('tao-de/', views.tao_de, name='tao_de'),
    path('api/parse-word/', views.api_parse_word, name='api_parse_word'),
    path('login/', views.login_view, name='login'),
    path('register/', views.register_view, name='register'),
    path('forgot-password/', views.forgot_password_view, name='forgot'),
    path('logout/', views.logout_view, name='logout'),
    path('account/', views.account_view, name='account'),
    path('admin/', admin.site.urls),
]
