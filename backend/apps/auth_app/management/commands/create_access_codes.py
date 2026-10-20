"""
Management command: create_access_codes
Equivalent of scripts/create-access-codes.js from the original Node.js project.

Usage:
  python manage.py create_access_codes \
    --name "Alice Mwangi" --email alice@example.org --role "Project User"

  # Batch from CSV (name,email,role):
  python manage.py create_access_codes --csv participants.csv

Output: prints the plaintext access code exactly once.
The code is NOT stored — only its HMAC digest is saved.
"""
import csv
import sys

from django.core.management.base import BaseCommand, CommandError

from apps.auth_app.utils import create_access_code

VALID_ROLES = {"Project User", "M&E Reviewer", "Administrator"}


class Command(BaseCommand):
    help = "Create one or more participant access codes."

    def add_arguments(self, parser):
        parser.add_argument("--name", help="Participant full name")
        parser.add_argument("--email", help="Email address (optional)")
        parser.add_argument(
            "--role",
            choices=list(VALID_ROLES),
            default="Project User",
            help="Role (default: Project User)",
        )
        parser.add_argument(
            "--csv",
            dest="csv_file",
            help="Path to a CSV file with columns: name,email,role",
        )

    def handle(self, *args, **options):
        if options["csv_file"]:
            self._from_csv(options["csv_file"])
        elif options["name"]:
            self._create_one(
                options["name"], options.get("email"), options["role"]
            )
        else:
            raise CommandError(
                "Provide --name (single) or --csv <file> (batch)."
            )

    def _create_one(self, name, email, role):
        result = create_access_code(name=name, email=email, role=role)
        self.stdout.write(self.style.SUCCESS(
            f"\nAccess code created for: {result['name']} ({result['role']})"
        ))
        self.stdout.write(self.style.WARNING(
            f"  Code (copy now — will not be shown again): {result['code']}\n"
        ))

    def _from_csv(self, csv_path):
        try:
            with open(csv_path, newline="", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                count = 0
                for row in reader:
                    name = (row.get("name") or "").strip()
                    email = (row.get("email") or "").strip() or None
                    role = (row.get("role") or "Project User").strip()
                    if not name:
                        self.stderr.write(f"Skipping row with no name: {row}")
                        continue
                    if role not in VALID_ROLES:
                        self.stderr.write(f"Invalid role '{role}' for {name}, skipping.")
                        continue
                    result = create_access_code(name=name, email=email, role=role)
                    self.stdout.write(
                        f"{result['name']} ({result['role']}): {result['code']}"
                    )
                    count += 1
                self.stdout.write(self.style.SUCCESS(f"\nCreated {count} access code(s)."))
        except FileNotFoundError:
            raise CommandError(f"File not found: {csv_path}")
