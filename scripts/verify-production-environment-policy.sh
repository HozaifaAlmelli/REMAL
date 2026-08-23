#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXPECTED="$ROOT/.github/production-environment-policy.json"
REPOSITORY="${GITHUB_REPOSITORY:-HozaifaAlmelli/REMAL}"
FIXTURE="${1:-}"
TMP=""

if [ -z "$FIXTURE" ]; then
  command -v gh >/dev/null 2>&1 || { echo "FATAL: gh is required to inspect the live environment policy" >&2; exit 1; }
  TMP="$(mktemp -d)"
  trap 'rm -rf -- "$TMP"' EXIT
  gh api "repos/$REPOSITORY/environments/production" > "$TMP/environment.json"
  gh api "repos/$REPOSITORY/environments/production/deployment-branch-policies" > "$TMP/branches.json"
  gh api "repos/$REPOSITORY/environments/production/secrets" > "$TMP/secrets.json"
  FIXTURE="$TMP/environment.json"
  BRANCHES="$TMP/branches.json"
  SECRETS="$TMP/secrets.json"
else
  BRANCHES="$FIXTURE"
  SECRETS="$FIXTURE"
fi

python3 - "$EXPECTED" "$FIXTURE" "$BRANCHES" "$SECRETS" <<'PY'
import json, sys
expected_path, environment_path, branches_path, secrets_path = sys.argv[1:]
with open(expected_path, encoding="utf-8") as handle:
    expected=json.load(handle)
with open(environment_path, encoding="utf-8") as handle:
    environment=json.load(handle)

if "allowedBranches" in environment:
    actual=environment
else:
    with open(branches_path, encoding="utf-8") as handle:
        branches=json.load(handle)
    with open(secrets_path, encoding="utf-8") as handle:
        secrets=json.load(handle)
    reviewers=next((r for r in environment.get("protection_rules",[]) if r.get("type")=="required_reviewers"), None)
    policy=environment.get("deployment_branch_policy") or {}
    actual={
        "environment": environment.get("name"),
        "allowedBranches": sorted(p.get("name") for p in branches.get("branch_policies",[])),
        "requiredReviewers": sorted(
            entry.get("reviewer",{}).get("login") for entry in (reviewers or {}).get("reviewers",[])
        ),
        "preventSelfReview": bool(reviewers and reviewers.get("prevent_self_review")),
        "canAdminsBypass": environment.get("can_admins_bypass"),
        "customBranchPolicies": policy.get("custom_branch_policies"),
        "protectedBranches": policy.get("protected_branches"),
        "allowedSecrets": sorted(entry.get("name") for entry in secrets.get("secrets",[])),
    }
if actual != expected:
    print("REFUSING: production environment policy differs from the checked-in contract", file=sys.stderr)
    print(json.dumps(actual, sort_keys=True), file=sys.stderr)
    raise SystemExit(1)
print("PASS: production environment is main-only, independently reviewed, and non-bypassable")
PY
