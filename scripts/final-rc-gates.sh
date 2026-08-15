#!/usr/bin/env bash
set -Eeuo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
lane="full"
expected_sha=""
args=("$@")

for ((index = 0; index < ${#args[@]}; index++)); do
  if [[ "${args[$index]}" == "--lane" && $((index + 1)) -lt ${#args[@]} ]]; then
    lane="${args[$((index + 1))]}"
  elif [[ "${args[$index]}" == "--expected-sha" && $((index + 1)) -lt ${#args[@]} ]]; then
    expected_sha="${args[$((index + 1))]}"
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

container=""
volume=""
cleanup() {
  if [[ -n "$container" ]]; then
    docker rm -f "$container" >/dev/null 2>&1 || true
  fi
  if [[ -n "$volume" ]]; then
    docker volume rm "$volume" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

if [[ "$lane" == "full" ]]; then
  command -v docker >/dev/null 2>&1 || {
    echo "FINAL-RC configuration error: Docker is required to provision isolated PostgreSQL 16." >&2
    exit 64
  }

  suffix="${RANDOM:-0}-$$"
  container="kaza-final-rc-pg16-$suffix"
  volume="kaza-final-rc-pg16-$suffix"
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

python_command="python3"
command -v "$python_command" >/dev/null 2>&1 || python_command="python"

"$python_command" "$repo_root/scripts/lib/final_rc_gates.py" \
  --repo-root "$repo_root" \
  "${args[@]}"
