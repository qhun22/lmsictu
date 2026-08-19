from django.contrib import admin
from django.urls import path
from . import views

urlpatterns = [
    path('', views.index_view, name='index'),
    path('home/', views.home, name='home'),
    path('tao-mon-hoc/', views.tao_mon_hoc, name='tao_mon_hoc'),
    path('tao-de/', views.tao_de, name='tao_de'),
    path('api/parse-word/', views.api_parse_word, name='api_parse_word'),
    path('api/save-quiz/', views.api_save_quiz, name='api_save_quiz'),
    path('api/quiz-links/', views.api_quiz_links, name='api_quiz_links'),
    path('api/quiz/<str:code>/update/', views.api_update_quiz, name='api_update_quiz'),
    path('api/quiz/<str:code>/', views.api_quiz_detail, name='api_quiz_detail'),
    path('api/quiz/<str:code>/toggle/', views.api_toggle_quiz, name='api_toggle_quiz'),
    path('e/<str:code>/', views.exam_page, name='exam_page'),
    path('api/submit-exam/<str:code>/', views.api_submit_exam, name='api_submit_exam'),
    path('login/', views.login_view, name='login'),
    path('register/', views.register_view, name='register'),
    path('forgot-password/', views.forgot_password_view, name='forgot'),
    path('logout/', views.logout_view, name='logout'),
    path('account/', views.account_view, name='account'),
    path('admin/', admin.site.urls),
]
