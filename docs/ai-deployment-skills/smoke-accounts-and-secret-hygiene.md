---
name: smoke-accounts-and-secret-hygiene
description: >
  Test production login safely with dedicated smoke accounts (Admin/Owner/Client) created
  via the app's real password hashing, stored in a root-only file, and never printed. Do
  not use dev credentials in prod and never reset real users.
risk_level: high
when_to_use: >
  You need to verify production login/roles end-to-end, or set up/rotate smoke-test
  accounts for automated login checks.
do_not_use_when: >
  A real user reports a bug you can reproduce without credentials, or you would be tempted
  to reset a real user's password (never do that).
required_inputs:
  - The smoke-account creation mechanism (the repo's hasher/seed path, not ad-hoc SQL)
  - A root-only location for the credentials file
forbidden_actions:
  - Using dev credentials against production
  - Resetting or altering real production users' passwords
  - Printing passwords/tokens in chat, terminal, or CI logs
  - Inserting plaintext or mismatched-scheme password hashes
preflight_checks:
  - Confirm the app's password-hashing scheme / seeding path
  - Confirm the credentials file is chmod 600 and root-owned
safe_procedure: "See 'Create + use smoke accounts without leaks' below."
verification: "All three roles authenticate (HTTP 200, token present) with subjectType/role correct; no secret printed."
rollback: "Disable/remove the smoke accounts if the task requires; they are additive and isolated from real users."
stop_conditions: "See 'Global Stop Conditions' below."
final_report_required: true
lessons_from_kaza_incident: >
  Dev credentials (e.g. *.dev@rental.local) are intentionally NOT valid in production.
  Dedicated smoke Admin/Owner/Client accounts were created using the app's real hashing,
  and their passwords were stored ONLY in a root-only file on the VPS — never printed in
  chat, terminal, or GitHub Actions logs. Login checks reported only HTTP status, role,
  and token-exists (boolean), never the password or the token itself. See also
  scripts/production-login-smoke-maintenance.sh.
---

# Smoke accounts & secret hygiene

Prove login works without ever exposing a secret or disturbing a real user.

## Create + use smoke accounts without leaks

```bash
# 1. Create accounts via the app's REAL hashing (never hand-written hashes / plaintext).
#    Use the repo's smoke maintenance path; it uses the same hashing the API verifies.
sh /opt/apps/kaza-booking/scripts/production-login-smoke-maintenance.sh

# 2. Store credentials ONLY in a root-only file (never echo them).
CRED_FILE="/root/kaza-login-fix-logs/$(date +%Y%m%d-%H%M%S)-smoke-credentials.txt"
install -m 600 /dev/null "$CRED_FILE"   # create empty, mode 600, root-owned
#   ...the maintenance script / your tooling writes creds into $CRED_FILE...
ls -l "$CRED_FILE"                        # confirm 600, never `cat` it into the transcript

# 3. Verify login and print ONLY status/role/token-exists — NEVER the token or password.
#    (Read creds from the file into shell vars; do not echo them.)
for role in admin owner client; do
  # EMAIL/PASS are read from $CRED_FILE into vars WITHOUT printing.
  code=$(curl -sS -o /tmp/login.json -w '%{http_code}' \
    -X POST "https://api.kaza-booking.com/api/auth/$role/login" \
    -H 'content-type: application/json' \
    --data "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" --max-time 15)
  has_token=$(grep -q '"accessToken"' /tmp/login.json && echo yes || echo no)
  subj=$(grep -oE '"subjectType":"[^"]*"' /tmp/login.json | head -1)
  echo "$role -> HTTP $code token=$has_token $subj"
  rm -f /tmp/login.json
done
unset EMAIL PASS
```

## Hard rules

- **Dev creds are not prod creds.** They are disabled in production by design; don't try
  them, don't re-enable them.
- **Never reset a real user's password** to "test login". Create a smoke account instead.
- **Never print secrets.** Report `HTTP 200 / role / token=yes`, never the token or
  password. Pipe any env/log output through `redact`.
- **Credentials live in a root-only `chmod 600` file** on the VPS. Never scp them to a
  local machine; never paste them into chat or CI.
- **Rotate/disable** smoke accounts after the task if the environment requires it.

## Global Stop Conditions — halt and report, do not proceed

Stop immediately if any of these is true:
- A command would affect Novatova (any `novatova-*` container, config, or data).
- A command would start a service that binds host ports 80 or 443.
- A step requires `docker compose down`.
- A step is a bare `docker compose up -d` (no `--no-deps <service>`, no service list).
- `docker exec novatova-nginx nginx -t` fails.
- The env file `/opt/kaza/env/.env.production` is missing or empty.
- The live repo path is uncertain (compose labels don't confirm it).
- Compose labels do not match the expected project `kaza-prod` / expected service.
- A DB backup fails (or cannot be verified) before any DB write.
- The live working tree has unexpected local changes before a git operation.
- A secret (password/token/JWT/connection string) would be printed or written unredacted.
- An already-applied migration would need editing, or a migration number would be reused.
- A production user's password would be reset.
- A temporary SSH key cannot be removed at the end of the task.

## Forbidden Commands — never run these on the shared VPS

Named here only to mark them forbidden. Do not execute them.
- `docker compose down`
- `docker compose up -d` (bare — no service scope)
- `docker system prune` / `docker builder prune -a`
- `docker volume rm ...`
- `rm -rf /etc/letsencrypt`
- `certbot delete ...`
- `docker restart novatova-nginx` and `docker restart novatova-*`
- `DROP TABLE ...` / `TRUNCATE TABLE ...` / `DELETE FROM ...` without WHERE + backup + approval
- `git reset --hard` on the live repo (unless explicitly approved AND already backed up)
- `git push --force` to `main`

## Final report (required)

State that smoke accounts (not real users, not dev creds) were used; the per-role result
as `HTTP / role / token=yes|no` only; that credentials stayed in a root-only 600 file; and
that no secret was printed anywhere.
