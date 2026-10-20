"""
Initial migration: ai_usage_log table.
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="AIUsageLog",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("ts", models.DateTimeField()),
                ("access_code_id", models.CharField(blank=True, max_length=32, null=True)),
                ("route", models.CharField(blank=True, max_length=32, null=True)),
                ("feature", models.CharField(blank=True, max_length=64, null=True)),
                ("model", models.CharField(blank=True, max_length=128, null=True)),
                ("input_tokens", models.IntegerField(blank=True, null=True)),
                ("output_tokens", models.IntegerField(blank=True, null=True)),
                ("ok", models.BooleanField(default=False)),
                ("error_code", models.CharField(blank=True, max_length=64, null=True)),
                ("error_message", models.CharField(blank=True, max_length=512, null=True)),
                ("duration_ms", models.IntegerField(blank=True, null=True)),
            ],
            options={
                "db_table": "ai_usage_log",
                "ordering": ["-ts"],
            },
        ),
    ]
