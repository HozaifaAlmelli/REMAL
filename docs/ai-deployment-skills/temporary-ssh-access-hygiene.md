---
name: temporary-ssh-access-hygiene
description: >
  Manage temporary agent SSH access to the VPS cleanly: add a tagged key with a backup of
  authorized_keys, use it for the task, then remove it and VERIFY access is denied. Never
  leave an agent key installed; never put private keys in the repo or logs.
risk_level: high
when_to_use: >
  You were granted temporary SSH access (a key you added, or one added for you) to perform
  a production task on the VPS.
do_not_use_when: >
  You are operating through an existing, human-owned, permanent access path and added no
  key of your own.
required_inputs:
  - The public key to install and a unique comment tag (e.g. claude-kaza-debug)
  - The private key held locally (never committed, never printed)
forbidden_actions:
  - Committing or printing any private key
  - Leaving the temporary key in authorized_keys after the task
  - Editing authorized_keys without a backup
  - Reusing/sharing one private key across tasks or agents
preflight_checks:
  - Back up authorized_keys before editing
  - Ensure the key carries a unique, greppable comment tag
safe_procedure: "See 'Add tagged, remove verified' below."
verification: "After removal, an auth attempt with that key is DENIED (Permission denied); local key files deleted."
rollback: "Restore authorized_keys from the backup if an edit went wrong."
stop_conditions: "See 'Global Stop Conditions' below."
final_report_required: true
lessons_from_kaza_incident: >
  A temporary agent key (comment tag claude-kaza-debug) was added to
  /root/.ssh/authorized_keys to do the work, then removed via
  `sed -i '/claude-kaza-debug/d'` at the end. Removal was VERIFIED by attempting to
  connect and confirming "Permission denied (publickey,password)", and the local private
  key material was deleted. Always leave the host as you found it.
---

# Temporary SSH access hygiene

Borrowed access must be returned. A leftover agent key is a standing backdoor into a
shared production host.

## Add tagged, remove verified

```bash
# --- ADD (on the VPS, as the granting human or via an existing channel) ---
cp ~/.ssh/authorized_keys ~/.ssh/authorized_keys.bak.$(date +%Y%m%d-%H%M%S)   # backup first
# Append the PUBLIC key with a UNIQUE comment tag so it is greppable/removable:
#   ssh-ed25519 AAAA...   claude-kaza-debug
# (Add the line with your editor/tooling; never paste the PRIVATE key anywhere.)
grep -c 'claude-kaza-debug' ~/.ssh/authorized_keys   # expect 1

# --- REMOVE (end of task) ---
sed -i '/claude-kaza-debug/d' ~/.ssh/authorized_keys
grep -c 'claude-kaza-debug' ~/.ssh/authorized_keys || echo "tag absent (good)"

# --- VERIFY DENIED (from the machine holding the key) ---
ssh -i ./kaza_vps_key -o BatchMode=yes -o ConnectTimeout=10 root@<VPS> true \
  && echo "STILL WORKS — NOT SAFE" || echo "DENIED — good"

# --- DELETE local key material ---
rm -f ./kaza_vps_key ./kaza_vps_key.pub
```

## Rules

- **Unique comment tag** per key so removal is exact (`sed -i '/<tag>/d'`).
- **Back up `authorized_keys`** before editing; restore from the backup if anything looks
  off.
- **Never** commit or print a private key; never store VPS passwords in the repo/logs.
- **One key per task/agent** — do not reuse or share private keys.
- **Verify denial** after removal — "I ran the sed" is not proof; a failed connection is.
- Delete the local key files when done.

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

State the key tag used; that `authorized_keys` was backed up before editing; that the key
was removed; the **verified denial** result; and that local key material was deleted.
