from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('lmsictu', '0007_alter_subject_name_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='attempt',
            name='results',
            field=models.JSONField(default=list),
        ),
    ]