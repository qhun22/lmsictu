from django.db import models
from django.contrib.auth.models import User


class Quiz(models.Model):
    """Đề thi được tạo từ trang tạo đề."""

    code = models.CharField(max_length=32, unique=True, db_index=True)
    title = models.CharField(max_length=255, blank=True, default='')
    subject = models.CharField(max_length=100, blank=True, default='')
    week_index = models.PositiveIntegerField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    creator = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)
    questions = models.JSONField(default=list)  # list of question dicts
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.code} - {self.title or "Untitled"}'


class Attempt(models.Model):
    """Lượt làm bài của 1 user/phiên."""

    quiz = models.ForeignKey(Quiz, on_delete=models.CASCADE)
    session_key = models.CharField(max_length=64, blank=True, default='')
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)
    answers = models.JSONField(default=dict)  # {question_idx: selected_label}
    score = models.FloatField(null=True, blank=True)
    total = models.IntegerField(default=0)
    started_at = models.DateTimeField(auto_now_add=True)
    submitted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-started_at']

    def __str__(self):
        return f'{self.quiz.code} - {self.session_key or self.user}'
