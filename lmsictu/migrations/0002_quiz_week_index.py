from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('lmsictu', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='quiz',
            name='week_index',
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
    ]
