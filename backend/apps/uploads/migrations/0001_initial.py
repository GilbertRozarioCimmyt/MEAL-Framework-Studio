"""
Initial migration: uploads table.
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Upload",
            fields=[
                ("id", models.CharField(max_length=32, primary_key=True, serialize=False)),
                ("stored_filename", models.CharField(max_length=255)),
                ("original_filename", models.CharField(blank=True, max_length=255, null=True)),
                ("content_type", models.CharField(blank=True, max_length=128, null=True)),
                ("size_bytes", models.BigIntegerField(blank=True, null=True)),
                ("owner_access_code_id", models.CharField(max_length=32)),
                ("created_at", models.DateTimeField()),
            ],
            options={
                "db_table": "uploads",
                "ordering": ["-created_at"],
            },
        ),
    ]
