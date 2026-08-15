#!/usr/bin/env bash
set -Eeuo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
lane="full"
expected_sha=""
run_id=""
args=("$@")

for ((index = 0; index < ${#args[@]}; index++)); do
  if [[ "${args[$index]}" == "--lane" && $((index + 1)) -lt ${#args[@]} ]]; then
    lane="${args[$((index + 1))]}"
  elif [[ "${args[$index]}" == "--expected-sha" && $((index + 1)) -lt ${#args[@]} ]]; then
    expected_sha="${args[$((index + 1))]}"
  elif [[ "${args[$index]}" == "--run-id" && $((index + 1)) -lt ${#args[@]} ]]; then
    run_id="${args[$((index + 1))]}"
  fi
done

if [[ ! "$expected_sha" =~ ^[0-9a-f]{40}$ ]]; then
  echo "FINAL-RC preflight error: --expected-sha requires a full lowercase 40-character SHA." >&2
  exit 64
fi
actual_sha="$(git -C "$repo_root" rev-parse HEAD)"
if [[ "$actual_sha" != "$expected_sha" ]]; then
  echo "FINAL-RC preflight error: expected $expected_sha but HEAD is $actual_sha." >&2
  exit 64
fi
if ! git -C "$repo_root" diff --quiet || ! git -C "$repo_root" diff --cached --quiet; then
  echo "FINAL-RC preflight error: tracked working tree or index is dirty." >&2
  exit 64
fi

if [[ -z "$run_id" ]]; then
  run_id="$(date -u +%Y%m%dt%H%M%sz)-$$-${RANDOM:-0}"
  args+=(--run-id "$run_id")
fi

lock_dir="$(git -C "$repo_root" rev-parse --path-format=absolute --git-path final-rc-gates.lock)"
lock_owned=false
container=""
volume=""
cleanup() {
  if [[ -n "$container" ]]; then
    docker rm -f "$container" >/dev/null 2>&1 || true
  fi
  if [[ -n "$volume" ]]; then
    docker volume rm "$volume" >/dev/null 2>&1 || true
  fi
  if [[ "$lock_owned" == true ]]; then
    rm -f "$lock_dir/pid"
    rmdir "$lock_dir" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

acquire_lock() {
  if mkdir "$lock_dir" 2>/dev/null; then
    printf '%s\n' "$$" > "$lock_dir/pid"
    lock_owned=true
    return
  fi
  owner="$(cat "$lock_dir/pid" 2>/dev/null || true)"
  if [[ "$owner" =~ ^[0-9]+$ ]] && kill -0 "$owner" 2>/dev/null; then
    echo "FINAL-RC concurrency error: another runner owns the exclusive gate lock (pid $owner)." >&2
    exit 73
  fi
  rm -f "$lock_dir/pid"
  rmdir "$lock_dir" 2>/dev/null || {
    echo "FINAL-RC concurrency error: stale lock could not be removed safely." >&2
    exit 73
  }
  mkdir "$lock_dir" 2>/dev/null || {
    echo "FINAL-RC concurrency error: another runner acquired the gate lock." >&2
    exit 73
  }
  printf '%s\n' "$$" > "$lock_dir/pid"
  lock_owned=true
}

acquire_lock

if [[ "$lane" == "full" ]]; then
  command -v docker >/dev/null 2>&1 || {
    echo "FINAL-RC configuration error: Docker is required to provision isolated PostgreSQL 16." >&2
    exit 64
  }

  suffix="${RANDOM:-0}-$$"
  container="kaza-final-rc-test-pg16-$suffix"
  volume="kaza-final-rc-test-pg16-$suffix"
  docker volume create "$volume" >/dev/null
  docker run -d --name "$container" \
    -v "$volume:/var/lib/postgresql/data" \
    -e POSTGRES_DB=kaza_test_final_rc \
    -e POSTGRES_USER=postgres \
    -e POSTGRES_PASSWORD=final_rc_test_only \
    -p 127.0.0.1::5432 \
    postgres:16-alpine >/dev/null

  for attempt in $(seq 1 60); do
    if docker exec "$container" pg_isready -U postgres -d kaza_test_final_rc >/dev/null 2>&1; then
      break
    fi
    [[ "$attempt" -lt 60 ]] || {
      echo "FINAL-RC configuration error: isolated PostgreSQL 16 did not become ready." >&2
      exit 64
    }
    sleep 1
  done

  host_port="$(docker port "$container" 5432/tcp | awk -F: 'NR == 1 { print $NF }')"
  export KAZA_TEST_DB="Host=127.0.0.1;Port=$host_port;Database=kaza_test_final_rc;Username=postgres;Password=final_rc_test_only;Pooling=false;Timeout=5;Command Timeout=120"
  export KAZA_MIGRATION_TEST_CONTAINER="$container"
  export KAZA_MIGRATION_TEST_DB_PREFIX="kaza_test_final_rc_migrations"
  echo "FINAL-RC: provisioned isolated postgres:16-alpine container $container on host port $host_port."
fi

python_command=""
for candidate in python3 python py; do
  if command -v "$candidate" >/dev/null 2>&1 && "$candidate" -c "import sys; raise SystemExit(0)" >/dev/null 2>&1; then
    python_command="$candidate"
    break
  fi
done
if [[ -z "$python_command" ]]; then
  echo "FINAL-RC configuration error: a working Python interpreter is required." >&2
  exit 64
fi

"$python_command" "$repo_root/scripts/lib/final_rc_gates.py" \
  --repo-root "$repo_root" \
  "${args[@]}"
