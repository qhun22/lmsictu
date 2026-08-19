from django.db import models
from django.contrib.auth.models import User


class Subject(models.Model):
    """Môn học - lưu vào database thay vì localStorage."""

    name = models.CharField(max_length=100)
    creator = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        constraints = [
            models.UniqueConstraint(fields=['creator', 'name'], name='unique_subject_name_per_creator'),
        ]
        verbose_name = 'Môn học'
        verbose_name_plural = 'Môn học'

    def __str__(self):
        return self.name


class Week(models.Model):
    """Tuần học thuộc một môn học."""

    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name='weeks')
    name = models.CharField(max_length=100)
    topics = models.JSONField(default=list)
    link = models.CharField(max_length=255, blank=True, default='')
    quiz_code = models.CharField(max_length=32, blank=True, default='')
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['id']
        verbose_name = 'Tuần học'
        verbose_name_plural = 'Tuần học'

    def __str__(self):
        return f'{self.subject.name} - {self.name}'


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
