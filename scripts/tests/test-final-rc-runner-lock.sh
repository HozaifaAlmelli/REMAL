#!/usr/bin/env bash
set -Eeuo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
lock_dir="$(git -C "$repo_root" rev-parse --path-format=absolute --git-path final-rc-gates.lock)"
created_lock=false

cleanup() {
  if [[ "$created_lock" == true ]]; then
    rm -f "$lock_dir/pid"
    rmdir "$lock_dir" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

if [[ ! -d "$lock_dir" ]]; then
  mkdir "$lock_dir"
  printf '%s\n' "$$" > "$lock_dir/pid"
  created_lock=true
fi

set +e
output="$(bash "$repo_root/scripts/final-rc-gates.sh" \
  --expected-sha "$(git -C "$repo_root" rev-parse HEAD)" \
  --lane hosted \
  --mode automated \
  --evidence-root artifacts/final-rc \
  --run-id nested-lock-test 2>&1)"
status=$?
set -e

if [[ "$status" -ne 73 ]] || [[ "$output" != *"another runner owns the exclusive gate lock"* ]]; then
  echo "expected nested final-RC runner to refuse the active lock; status=$status" >&2
  exit 1
fi

echo "final-RC exclusive runner lock test passed"
