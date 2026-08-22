#!/usr/bin/env bash

production_lock_acquire() {
  local lock_file="${PRODUCTION_LOCK_FILE:-/opt/kaza/releases/production-operation.lock}"
  local lock_dir
  local fd

  command -v flock >/dev/null 2>&1 || {
    echo "FATAL: flock is required for production operation serialization" >&2
    return 1
  }

  lock_dir="$(dirname "$lock_file")"
  mkdir -p "$lock_dir"

  if [ -n "${KAZA_PRODUCTION_LOCK_FD:-}" ]; then
    fd="$KAZA_PRODUCTION_LOCK_FD"
    [[ "$fd" =~ ^[0-9]+$ ]] || {
      echo "FATAL: inherited production lock descriptor is malformed" >&2
      return 1
    }
    [ -e "/proc/$$/fd/$fd" ] || {
      echo "FATAL: inherited production lock descriptor is not open" >&2
      return 1
    }
    local inherited_path expected_path
    inherited_path="$(readlink -f "/proc/$$/fd/$fd")"
    expected_path="$(realpath -m "$lock_file")"
    [ "$inherited_path" = "$expected_path" ] || {
      echo "FATAL: inherited production lock descriptor targets the wrong file" >&2
      return 1
    }
    flock -n "$fd" || {
      echo "FATAL: inherited production operation lock is not held" >&2
      return 1
    }
    return 0
  fi

  exec {fd}>"$lock_file"
  if ! flock -n "$fd"; then
    eval "exec ${fd}>&-"
    echo "REFUSING: another Kaza production deploy or release is already running" >&2
    return 1
  fi

  export KAZA_PRODUCTION_LOCK_FD="$fd"
  export PRODUCTION_LOCK_FILE="$lock_file"
}
