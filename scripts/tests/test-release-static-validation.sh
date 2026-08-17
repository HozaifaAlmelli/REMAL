#!/usr/bin/env bash
set -Eeuo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
mount_root="$repo_root"
if command -v cygpath >/dev/null 2>&1; then
  mount_root="$(cygpath -w "$repo_root")"
fi
mode="${1:-}"

case "$mode" in
  shellcheck)
    mapfile -t shell_files < <(find "$repo_root/scripts" -type f -name '*.sh' -print | sort)
    if command -v shellcheck >/dev/null 2>&1; then
      shellcheck -x --severity=error --exclude=SC2261 "${shell_files[@]}"
      shellcheck -x "$repo_root/scripts/final-rc-gates.sh" "$repo_root/scripts/tests/test-release-static-validation.sh"
    else
      relative_files=()
      for file in "${shell_files[@]}"; do
        relative_files+=("/repo/${file#"$repo_root/"}")
      done
      MSYS_NO_PATHCONV=1 docker run --rm \
        -v "$mount_root:/repo:ro" \
        koalaman/shellcheck:v0.10.0 \
        -x --severity=error --exclude=SC2261 "${relative_files[@]}"
      MSYS_NO_PATHCONV=1 docker run --rm \
        -v "$mount_root:/repo:ro" \
        koalaman/shellcheck:v0.10.0 \
        -x /repo/scripts/final-rc-gates.sh /repo/scripts/tests/test-release-static-validation.sh
    fi
    echo "release ShellCheck validation passed"
    ;;
  actionlint)
    if command -v actionlint >/dev/null 2>&1; then
      (cd "$repo_root" && actionlint -color=false)
    else
      MSYS_NO_PATHCONV=1 docker run --rm \
        -v "$mount_root:/repo:ro" \
        -w /repo \
        rhysd/actionlint:1.7.7 \
        -color=false
    fi
    echo "GitHub workflow/action validation passed"
    ;;
  *)
    echo "usage: $0 shellcheck|actionlint" >&2
    exit 64
    ;;
esac
