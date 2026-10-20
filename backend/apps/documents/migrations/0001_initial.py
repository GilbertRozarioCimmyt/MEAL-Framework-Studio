"""
Initial migration: documents table.
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Document",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                # 64 × 4 bytes (utf8mb4) = 256 bytes index space
                ("collection", models.CharField(max_length=64)),
                # 186 × 4 bytes = 744 bytes → combined 256+744 = 1000 bytes (MySQL key limit)
                ("doc_id", models.CharField(max_length=186)),
                ("data", models.TextField()),
                ("owner_access_code_id", models.CharField(blank=True, max_length=32, null=True)),
                ("updated_at", models.DateTimeField()),
            ],
            options={
                "db_table": "documents",
                "unique_together": {("collection", "doc_id")},
            },
        ),
    ]
