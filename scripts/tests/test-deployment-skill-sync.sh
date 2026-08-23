#!/usr/bin/env bash
# The production-deployment skill is mirrored for three agent harnesses, and the three
# copies of its predecessor (deploy-safety) had already drifted into three different sets
# of instructions - one of which still recommended a manual live hotfix that would now
# permanently block deployment. Documentation drift is therefore not hypothetical here;
# it is the failure mode this file exists to catch.
#
# It also pins the handful of facts the skill asserts about the deployment code, so the
# skill cannot quietly go stale against the workflow it documents.
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
fail() { echo "FAIL: $*" >&2; exit 1; }

SKILL_NAME=production-deployment
CANONICAL=".github/skills/$SKILL_NAME/SKILL.md"
MIRROR=".agents/skills/$SKILL_NAME/SKILL.md"
GUIDE="docs/operations/production-deployment.md"
WORKFLOW=".github/workflows/deploy-production.yml"

# ---------------------------------------------------------------------------
# 1. The tracked mirrors must be byte-identical.
#    (.claude/ is gitignored, so CI cannot see it; the skill documents the copy step.)
# ---------------------------------------------------------------------------
[ -f "$CANONICAL" ] || fail "canonical skill is missing: $CANONICAL"
[ -f "$MIRROR" ] || fail "mirrored skill is missing: $MIRROR"
cmp -s "$CANONICAL" "$MIRROR" ||
  fail "skill mirrors have drifted: $CANONICAL != $MIRROR"

# ---------------------------------------------------------------------------
# 2. The skill's identity must match its directory, or no harness will load it.
# ---------------------------------------------------------------------------
head -1 "$CANONICAL" | grep -qx -- '---' || fail "skill has no YAML frontmatter"
grep -qx "name: $SKILL_NAME" "$CANONICAL" ||
  fail "skill 'name:' does not match its directory ($SKILL_NAME)"
grep -q '^description:' "$CANONICAL" || fail "skill has no description"

# ---------------------------------------------------------------------------
# 3. Exactly one deployment skill. The superseded router must not come back:
#    two skills that both fire on "deploy Kaza" is how the instructions diverged.
# ---------------------------------------------------------------------------
for root in .github/skills .agents/skills; do
  [ -e "$root/deploy-safety" ] &&
    fail "superseded skill $root/deploy-safety was reintroduced; there is one deployment skill"
done

# ---------------------------------------------------------------------------
# 4. Every repo-relative link in the skill and the guide must resolve.
# ---------------------------------------------------------------------------
check_links() {
  local doc="$1" dir target resolved
  dir="$(dirname "$doc")"
  # Markdown link targets, minus external URLs and pure anchors.
  grep -o ']([^)]*)' "$doc" | sed 's/^](//; s/)$//' | while IFS= read -r target; do
    case "$target" in ''|http*|'#'*|mailto:*) continue ;; esac
    target="${target%%#*}"
    [ -n "$target" ] || continue
    resolved="$dir/$target"
    [ -e "$resolved" ] || { echo "$doc -> $target"; }
  done
}

broken="$( { check_links "$CANONICAL"; check_links "$GUIDE"; } )"
[ -z "$broken" ] || fail "unresolved documentation links:
$broken"

# ---------------------------------------------------------------------------
# 5. The documented modes must be exactly the modes the workflow accepts.
#    A new mode that nobody documented is the same hazard as a documented mode
#    that does not exist.
# ---------------------------------------------------------------------------
workflow_modes="$(sed -n '/^      mode:/,/^      [a-z_]*:$/p' "$WORKFLOW" |
  sed -n 's/^          - \([a-z]*\)$/\1/p' | sort | tr '\n' ' ')"
[ "$workflow_modes" = "deploy inspect release " ] ||
  fail "deploy-production.yml modes changed to '$workflow_modes'; update $GUIDE and $CANONICAL"

for mode in inspect deploy release; do
  grep -q "mode=$mode\|\`$mode\`" "$GUIDE" || fail "$GUIDE does not document mode '$mode'"
done

# ---------------------------------------------------------------------------
# 6. script_stop must stay false. drone-ssh injects an exit-code check after every
#    line of the transported script when it is true, which splits every multi-line
#    bash construct; the bootstrap died on its first `case ... in` and the hardened
#    workflow had never once executed. Both documents state this - pin the fact.
# ---------------------------------------------------------------------------
grep -q '^          script_stop: false$' "$WORKFLOW" ||
  fail "script_stop is no longer explicitly false in $WORKFLOW; it shreds the bootstrap script"

# ---------------------------------------------------------------------------
# 7. The skill must keep pointing at the guide, and the guide must exist.
# ---------------------------------------------------------------------------
[ -f "$GUIDE" ] || fail "the deployment guide is missing: $GUIDE"
grep -q 'docs/operations/production-deployment.md' "$CANONICAL" ||
  fail "the skill no longer references its reference guide"

echo "PASS: the production-deployment skill is single, mirrored, linked, and matches the deployment code"
