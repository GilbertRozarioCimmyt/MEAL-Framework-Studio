"""Quick smoke-test for the running backend. Run with: python test_backend.py"""
import urllib.request
import urllib.error
import json

BASE = "http://127.0.0.1:8000"

def check(label, url, expected_status):
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req) as resp:
            body = json.loads(resp.read())
            status = resp.status
    except urllib.error.HTTPError as e:
        status = e.code
        body = {}

    ok = "PASS" if status == expected_status else "FAIL"
    print(f"  [{ok}] {label}: {status} (expected {expected_status})")
    return ok == "PASS"

print("\n=== Backend smoke tests ===")
all_pass = True
all_pass &= check("GET /healthz",         f"{BASE}/healthz",         200)
all_pass &= check("GET /api/auth/me (no session => 401)", f"{BASE}/api/auth/me", 401)

if all_pass:
    print("\nAll tests passed! Backend is running correctly.")
else:
    print("\nSome tests failed.")
