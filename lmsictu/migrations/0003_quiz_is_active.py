from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('lmsictu', '0002_quiz_week_index'),
    ]

    operations = [
        migrations.AddField(
            model_name='quiz',
            name='is_active',
            field=models.BooleanField(default=True),
        ),
    ]
