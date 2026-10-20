"""
Management command: ai_usage_report
Equivalent of scripts/ai-usage-report.js from the original Node.js project.

Usage:
  python manage.py ai_usage_report
  python manage.py ai_usage_report --since 2026-10-01
  python manage.py ai_usage_report --days 7
  python manage.py ai_usage_report --daily
"""
import json

from django.core.management.base import BaseCommand

from apps.admin_app.usage_report import get_usage_report


def _fmt(n):
    return "—" if n is None else f"{n:,}"


def _fmt_cost(n):
    return "—" if n is None else f"${n:.4f}"


class Command(BaseCommand):
    help = "Print an AI usage report to the terminal."

    def add_arguments(self, parser):
        parser.add_argument(
            "--since",
            help="Start date YYYY-MM-DD (default: start of current month)",
        )
        parser.add_argument(
            "--days",
            type=int,
            help="Last N days (mutually exclusive with --since; --since wins)",
        )
        parser.add_argument(
            "--daily",
            action="store_true",
            help="Include a day-by-day breakdown table",
        )
        parser.add_argument(
            "--json",
            action="store_true",
            dest="as_json",
            help="Dump the full report as JSON instead of the human-readable table",
        )

    def handle(self, *args, **options):
        report = get_usage_report(
            since=options.get("since"),
            days=options.get("days"),
            daily=options.get("daily", False),
        )

        if options.get("as_json"):
            self.stdout.write(json.dumps(report, indent=2, default=str))
            return

        self._print_report(report)

    def _print_report(self, r):
        w = self.stdout.write
        sty = self.style

        w(sty.HTTP_INFO(f"\n=== AI Usage Report — from {r['sinceIso'][:10]} ===\n"))

        t = r["totals"]
        w(f"  Total calls  : {_fmt(t['totalCalls'])}")
        w(f"  Failures     : {_fmt(t['totalFailed'])}")
        w(f"  Input tokens : {_fmt(t['totalInputTokens'])}")
        w(f"  Output tokens: {_fmt(t['totalOutputTokens'])}")
        if r["pricesConfigured"]:
            w(f"  Est. cost    : {_fmt_cost(t['totalCostUsd'])}")
        w("")

        # By feature
        w(sty.SUCCESS("── By activity (feature) ──────────────────────────"))
        w(f"{'Feature':<40} {'ok':>5} {'calls':>7} {'in_tok':>10} {'out_tok':>10}")
        w("-" * 75)
        for row in r["byFeature"]:
            status = "ok" if row["ok"] else "FAIL"
            w(f"{row['feature']:<40} {status:>5} {_fmt(row['calls']):>7} "
              f"{_fmt(row['inputTokens']):>10} {_fmt(row['outputTokens']):>10}")
        w("")

        # By model
        w(sty.SUCCESS("── By model ────────────────────────────────────────"))
        for row in r["byModel"]:
            status = "ok" if row["ok"] else "FAIL"
            cost = f"  est={_fmt_cost(row['estCostUsd'])}" if r["pricesConfigured"] and row["ok"] else ""
            w(f"  {row['model']}  [{status}]  calls={_fmt(row['calls'])}  "
              f"in={_fmt(row['inputTokens'])}  out={_fmt(row['outputTokens'])}"
              f"  avg={_fmt(row['avgDurationMs'])}ms{cost}")
        w("")

        # Errors
        if r["byError"]:
            w(sty.ERROR("── Errors ──────────────────────────────────────────"))
            for row in r["byError"]:
                w(f"  [{row['errorCode']}] x{_fmt(row['calls'])}  "
                  f"last={str(row['lastSeen'])[:16]}  msg: {row['sampleMessage']}")
            w("")

        # Daily
        if r.get("daily"):
            w(sty.SUCCESS("── Day-by-day ──────────────────────────────────────"))
            w(f"{'Day':<12} {'Model':<40} {'calls':>7} {'in_tok':>10} {'out_tok':>10}")
            w("-" * 72)
            for row in r["daily"]:
                w(f"{row['day']:<12} {row['model']:<40} {_fmt(row['calls']):>7} "
                  f"{_fmt(row['inputTokens']):>10} {_fmt(row['outputTokens']):>10}")
            w("")
