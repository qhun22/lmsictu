from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('lmsictu', '0008_attempt_results'),
    ]

    operations = [
        migrations.AddField(
            model_name='quiz',
            name='duration_seconds',
            field=models.PositiveIntegerField(default=1800),
        ),
    ]