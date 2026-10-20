"""
Initial migration: access_codes and sessions tables.
"""
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="AccessCode",
            fields=[
                ("id", models.CharField(max_length=32, primary_key=True, serialize=False)),
                ("name", models.CharField(max_length=255)),
                ("email", models.EmailField(blank=True, max_length=254, null=True)),
                (
                    "role",
                    models.CharField(
                        choices=[
                            ("Project User", "Project User"),
                            ("M&E Reviewer", "M&E Reviewer"),
                            ("Administrator", "Administrator"),
                        ],
                        max_length=32,
                    ),
                ),
                ("code_hash", models.CharField(max_length=64, unique=True)),
                ("revoked", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField()),
            ],
            options={
                "db_table": "access_codes",
                "ordering": ["-created_at"],
            },
        ),
        migrations.CreateModel(
            name="Session",
            fields=[
                ("token", models.CharField(max_length=64, primary_key=True, serialize=False)),
                (
                    "access_code",
                    models.ForeignKey(
                        db_column="access_code_id",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="sessions",
                        to="auth_app.accesscode",
                    ),
                ),
                ("created_at", models.DateTimeField()),
                ("expires_at", models.DateTimeField()),
            ],
            options={
                "db_table": "sessions",
            },
        ),
    ]
