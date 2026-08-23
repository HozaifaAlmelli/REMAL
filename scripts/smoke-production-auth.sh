#!/usr/bin/env bash
# Read-only authentication smoke. Credential validation and token generation are
# read-only in AuthService; this script never registers, resets or writes users.
set -Eeuo pipefail

CREDENTIALS_FILE="${AUTH_SMOKE_CREDENTIALS_FILE:-/opt/kaza/secrets/auth-smoke.json}"
API_BASE_URL="${API_BASE_URL:-https://api.kaza-booking.com}"
MODE="${1:-run}"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf -- "$TMP_DIR"' EXIT

if [ ! -f "$CREDENTIALS_FILE" ] || [ ! -s "$CREDENTIALS_FILE" ]; then
  echo "FATAL: authentication smoke credential file is missing or empty" >&2
  exit 1
fi
[ ! -L "$CREDENTIALS_FILE" ] || { echo "FATAL: authentication smoke credential file must not be a symlink" >&2; exit 1; }
[ "$(stat -c '%u' "$CREDENTIALS_FILE")" = "$(id -u)" ] || {
  echo "FATAL: authentication smoke credential file must be owned by the deploy user" >&2; exit 1; }
mode="$(stat -c '%a' "$CREDENTIALS_FILE")"
case "$mode" in 400|600) ;; *) echo "FATAL: authentication smoke credential file mode must be 400 or 600" >&2; exit 1 ;; esac

python3 - "$CREDENTIALS_FILE" <<'PY'
import json, sys
with open(sys.argv[1], encoding="utf-8") as handle:
    data=json.load(handle)
if not isinstance(data,dict) or set(data)!={"admin","owner","client"}:
    raise SystemExit("authentication smoke file must contain exactly admin, owner, and client")
for subject in ("admin","owner","client"):
    entry=data[subject]
    identifier="email" if subject=="admin" else "phone"
    if not isinstance(entry,dict) or set(entry)!={identifier,"password"}:
        raise SystemExit(f"authentication smoke {subject} fields are invalid")
    if any(not isinstance(entry[key],str) or not entry[key] for key in (identifier,"password")):
        raise SystemExit(f"authentication smoke {subject} values are invalid")
PY

case "$MODE" in
  --validate-only) echo "OK: authentication smoke credential structure and permissions are valid"; exit 0 ;;
  run) ;;
  *) echo "usage: smoke-production-auth.sh [--validate-only]" >&2; exit 64 ;;
esac

for subject in admin owner client; do
  request="$TMP_DIR/$subject-request.json"
  response="$TMP_DIR/$subject-response.json"
  python3 - "$CREDENTIALS_FILE" "$subject" "$request" <<'PY'
import json, os, sys
source, subject, output = sys.argv[1:]
with open(source, encoding="utf-8") as handle:
    data = json.load(handle)
entry = data.get(subject)
if not isinstance(entry, dict):
    raise SystemExit(f"missing {subject} smoke credentials")
identifier = "email" if subject == "admin" else "phone"
if not isinstance(entry.get(identifier), str) or not entry[identifier]:
    raise SystemExit(f"missing {subject} {identifier}")
if not isinstance(entry.get("password"), str) or not entry["password"]:
    raise SystemExit(f"missing {subject} password")
with open(output, "x", encoding="utf-8") as handle:
    json.dump({identifier: entry[identifier], "password": entry["password"]}, handle)
os.chmod(output, 0o600)
PY

  code="$(curl -sS --max-time 20 -o "$response" -w '%{http_code}' \
    -H 'Content-Type: application/json' --data-binary "@$request" \
    "$API_BASE_URL/api/auth/$subject/login")"
  [ "$code" = "200" ] || { echo "FATAL: $subject authentication smoke returned HTTP $code" >&2; exit 1; }
  python3 - "$response" "$subject" <<'PY'
import json, sys
path, subject = sys.argv[1:]
with open(path, encoding="utf-8") as handle:
    payload = json.load(handle)
data = payload.get("data") if payload.get("success") is True else None
expected = subject.capitalize()
if not isinstance(data, dict) or not isinstance(data.get("accessToken"), str) or not data["accessToken"]:
    raise SystemExit(f"{subject} authentication smoke did not return an access token")
if data.get("subjectType") != expected:
    raise SystemExit(f"{subject} authentication smoke returned the wrong subject type")
PY
  echo "OK: $subject authentication succeeded and returned the expected subject type"
done
