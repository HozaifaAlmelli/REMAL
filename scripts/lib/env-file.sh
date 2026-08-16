#!/usr/bin/env bash
# ============================================================================
# KAZA — safe production env-file handling for release-operational scripts.
#
# WHY THIS EXISTS
# ---------------
# The release scripts used to load /opt/kaza/env/.env.production with
#
#     set -a; source "$ENV_FILE"; set +a
#
# `source` is shell evaluation, not env-file parsing. In an assignment such as
# `KEY=first second`, the shell runs `second` as a command and the script dies
# with exit 127 — before the backup is taken and before any migration SQL runs.
# Several production values legitimately contain whitespace, so the deployed
# backup and migration wrappers could not run at all.
#
# Docker Compose is unaffected: it parses `--env-file` with its own dotenv
# parser, so the running containers already hold the correct values.
#
# THE FIX
# -------
# The env file is now PARSED, never evaluated. `env_file_value` reads one
# assignment with docker-compose dotenv semantics — strip an optional `export`,
# split on the first `=`, drop one layer of matching surrounding quotes — and
# performs no expansion, substitution or command execution whatsoever. A value
# containing whitespace, `$`, backticks or `;` is returned verbatim and is never
# interpreted, so operators are not asked to rewrite production secrets.
#
# Only the two non-secret connection identifiers the scripts actually need,
# POSTGRES_USER and POSTGRES_DB, are ever read. POSTGRES_PASSWORD is required to
# be present but is never read on the host: psql and pg_dump run inside the db
# container over its local socket.
#
# ENV_FILE remains authoritative for which database is targeted, exactly as
# before, so callers that point the scripts at a different database keep working.
#
# A fail-fast preflight proves the file is readable, declares the keys the
# rollout depends on, and parses under Compose itself — before the migration
# lock, before the backup and before any migration SQL.
# ============================================================================

# Presence check for one key. Values are never read, expanded, printed or run.
env_file_has_key() {
  local env_file="$1"
  local key="$2"

  awk -v want="$key" '
    NR == 1 { sub(/^\xef\xbb\xbf/, "") }
    { line = $0 }
    line ~ /^[[:space:]]*#/ { next }
    line ~ /^[[:space:]]*$/ { next }
    {
      sub(/^[[:space:]]*/, "", line)
      sub(/^export[[:space:]]+/, "", line)
      eq = index(line, "=")
      if (eq < 2) next
      name = substr(line, 1, eq - 1)
      sub(/[[:space:]]+$/, "", name)
      if (name !~ /^[A-Za-z_][A-Za-z0-9_]*$/) next
      if (name == want) { found = 1; exit }
    }
    END { exit(found ? 0 : 1) }
  ' "$env_file"
}

# Fail-fast host-side preflight. Nothing downstream — no backup, no migration
# SQL — may start unless this returns 0.
env_file_preflight() {
  local env_file="$1"
  shift

  [ -n "$env_file" ] || {
    echo "REFUSING: no environment file was configured" >&2
    return 1
  }
  [ -e "$env_file" ] || {
    echo "REFUSING: environment file does not exist: $env_file" >&2
    return 1
  }
  [ -f "$env_file" ] || {
    echo "REFUSING: environment file is not a regular file: $env_file" >&2
    return 1
  }
  [ -r "$env_file" ] || {
    echo "REFUSING: environment file is not readable: $env_file" >&2
    return 1
  }
  [ -s "$env_file" ] || {
    echo "REFUSING: environment file is empty: $env_file" >&2
    return 1
  }

  local key
  local missing=0
  for key in "$@"; do
    if ! env_file_has_key "$env_file" "$key"; then
      echo "REFUSING: environment file is missing a required key: $key" >&2
      missing=1
    fi
  done
  [ "$missing" -eq 0 ] || return 1

  echo "### env preflight OK: $env_file is readable and declares $# required key(s)"
}

# Compose is the authority on env-file semantics, so let Compose prove it can
# parse the file. `config --quiet` validates and prints nothing, so no value
# reaches the log.
compose_env_preflight() {
  local compose_file="$1"
  local env_file="$2"

  if ! docker compose -f "$compose_file" --env-file "$env_file" config --quiet >/dev/null 2>&1; then
    echo "REFUSING: docker compose cannot parse the deployment configuration with $env_file" >&2
    return 1
  fi

  echo "### compose preflight OK: $compose_file parses with the configured env file"
}

# Read one value with docker-compose dotenv semantics. Nothing is expanded,
# substituted or executed. The rules, which match Compose's parser:
#   * a double- or single-quoted value ends at its closing quote, and anything
#     after it (typically an inline comment) is discarded; double-quoted values
#     honour \\, \" , \n and \t escapes
#   * an unquoted value ends at the first `#` preceded by whitespace, and its
#     trailing whitespace is trimmed
#   * when a key is assigned more than once the LAST assignment wins, exactly as
#     Compose resolves it — reading the first would silently disagree with the
#     value the running containers were created from
# This function is a convenience reader, not the authority: compose_identifier_-
# agreement_preflight proves the result equals what Compose itself resolves.
# Never call this for a secret.
env_file_value() {
  local env_file="$1"
  local key="$2"

  awk -v want="$key" '
    function unquote_double(s,   i, c, out) {
      out = ""
      i = 1
      while (i <= length(s)) {
        c = substr(s, i, 1)
        if (c == "\\" && i < length(s)) {
          i++
          c = substr(s, i, 1)
          if (c == "n") out = out "\n"
          else if (c == "t") out = out "\t"
          else if (c == "r") out = out "\r"
          else out = out c
        } else {
          out = out c
        }
        i++
      }
      return out
    }
    function closing(s, q,   i, c) {
      i = 2
      while (i <= length(s)) {
        c = substr(s, i, 1)
        if (q == "\"" && c == "\\") { i += 2; continue }
        if (c == q) return i
        i++
      }
      return 0
    }
    NR == 1 { sub(/^\xef\xbb\xbf/, "") }
    { line = $0 }
    line ~ /^[[:space:]]*#/ { next }
    line ~ /^[[:space:]]*$/ { next }
    {
      sub(/^[[:space:]]*/, "", line)
      sub(/^export[[:space:]]+/, "", line)
      eq = index(line, "=")
      if (eq < 2) next
      name = substr(line, 1, eq - 1)
      sub(/[[:space:]]+$/, "", name)
      if (name !~ /^[A-Za-z_][A-Za-z0-9_]*$/) next
      if (name != want) next

      value = substr(line, eq + 1)
      sub(/^[[:space:]]+/, "", value)
      quote = substr(value, 1, 1)
      if (quote == "\"" || quote == "'"'"'") {
        end = closing(value, quote)
        if (end > 0) {
          inner = substr(value, 2, end - 2)
          resolved = (quote == "\"") ? unquote_double(inner) : inner
          found = 1
          next
        }
      }
      # Unquoted: an inline comment starts at the first `#` preceded by whitespace.
      if (match(value, /[[:space:]]#/)) value = substr(value, 1, RSTART - 1)
      sub(/[[:space:]]+$/, "", value)
      resolved = value
      found = 1
    }
    # Last assignment wins, matching Compose.
    END { if (found) print resolved }
  ' "$env_file"
}

# Ask docker compose itself what a key resolves to, using a throwaway probe
# project. This is `config` only: it reads, renders and exits, so no production
# service is created, recreated, started or restarted.
#
# Going through Compose means the agreement check below stays correct even for
# dotenv behaviour this file does not implement — `${VAR}` interpolation, `$$`
# escaping, future parser changes — without reimplementing any of it here.
compose_resolved_value() {
  local env_file="$1"
  local key="$2"

  if ! printf '%s' "$key" | grep -Eq '^[A-Za-z_][A-Za-z0-9_]*$'; then
    echo "REFUSING: refusing to resolve a malformed environment key" >&2
    return 1
  fi

  local probe_dir
  probe_dir="$(mktemp -d)" || return 1

  {
    printf 'services:\n'
    printf '  kazaenvprobe:\n'
    printf '    image: busybox\n'
    printf '    environment:\n'
    printf '      PROBE: "${%s}"\n' "$key"
  } > "$probe_dir/kaza-env-probe.yml"

  local rendered
  rendered="$(
    docker compose -f "$probe_dir/kaza-env-probe.yml" --env-file "$env_file" \
      config --format json 2>/dev/null |
      awk '
        function unescape(s,   i, c, out) {
          out = ""
          i = 1
          while (i <= length(s)) {
            c = substr(s, i, 1)
            if (c == "\\" && i < length(s)) {
              i++
              c = substr(s, i, 1)
              if (c == "n") out = out "\n"
              else if (c == "t") out = out "\t"
              else if (c == "r") out = out "\r"
              else if (c == "b") out = out sprintf("%c", 8)
              else if (c == "f") out = out sprintf("%c", 12)
              else out = out c
            } else {
              out = out c
            }
            i++
          }
          return out
        }
        /^[[:space:]]*"PROBE":[[:space:]]*"/ {
          line = $0
          sub(/^[[:space:]]*"PROBE":[[:space:]]*"/, "", line)
          sub(/",?[[:space:]]*$/, "", line)
          printf "%s", unescape(line)
          found = 1
          exit
        }
        END { exit(found ? 0 : 1) }
      '
  )"
  local status=$?

  rm -rf -- "$probe_dir"
  [ "$status" -eq 0 ] || return 1
  printf '%s' "$rendered"
}

# Fail-closed proof that what this library parsed is exactly what Docker Compose
# resolves from the same file — so the identifiers the backup and the migration
# use cannot drift from the ones the running containers were created with.
# Values are compared, never printed.
compose_identifier_agreement_preflight() {
  local env_file="$1"
  shift

  local key parsed resolved
  local mismatch=0
  local checked=0

  for key in "$@"; do
    parsed="$(env_file_value "$env_file" "$key")"
    if ! resolved="$(compose_resolved_value "$env_file" "$key")"; then
      echo "REFUSING: docker compose could not resolve $key from $env_file" >&2
      return 1
    fi
    if [ -z "$resolved" ]; then
      echo "REFUSING: docker compose resolves $key to an empty value in $env_file" >&2
      return 1
    fi
    if [ "$parsed" != "$resolved" ]; then
      # Deliberately no values: a mismatch is reported by key only.
      echo "REFUSING: $key as parsed from $env_file does not match the value docker compose resolves from it" >&2
      echo "          (a duplicate assignment, an interpolation or an escape this reader does not model)" >&2
      mismatch=1
    fi
    checked=$((checked + 1))
  done

  [ "$mismatch" -eq 0 ] || return 1
  echo "### compose agreement OK: $checked identifier(s) parse identically to docker compose"
}

# Load the two non-secret connection identifiers the release scripts need into
# POSTGRES_USER / POSTGRES_DB. POSTGRES_PASSWORD is deliberately NOT read: psql
# and pg_dump run inside the db container over its local socket.
load_db_connection_identifiers() {
  local env_file="$1"

  POSTGRES_USER="$(env_file_value "$env_file" POSTGRES_USER)"
  POSTGRES_DB="$(env_file_value "$env_file" POSTGRES_DB)"

  [ -n "$POSTGRES_USER" ] || {
    echo "REFUSING: POSTGRES_USER is empty in $env_file" >&2
    return 1
  }
  [ -n "$POSTGRES_DB" ] || {
    echo "REFUSING: POSTGRES_DB is empty in $env_file" >&2
    return 1
  }
}
