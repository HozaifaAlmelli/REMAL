#!/usr/bin/env bash

# Lists the ordered migration files explicitly included by the production
# bootstrap. Directory presence alone never makes a migration production-eligible.
list_production_migrations() {
  local manifest="$1"
  local migration_dir="$2"
  local previous_number=""
  local declared_count
  local migration
  local number
  local -a migrations=()
  local -A seen_numbers=()

  [ -f "$manifest" ] || {
    echo "ERROR: production migration manifest not found: $manifest" >&2
    return 1
  }
  [ -d "$migration_dir" ] || {
    echo "ERROR: migration directory not found: $migration_dir" >&2
    return 1
  }

  declared_count="$(awk '$1 == "\\i" && $0 ~ /\/migrations\// { count++ } END { print count + 0 }' "$manifest")"
  mapfile -t migrations < <(
    awk '
      $1 == "\\i" && $2 ~ /^\/docker-entrypoint-initdb.d\/migrations\/[0-9]{4}_.+\.sql$/ {
        migration = $2
        sub(/^.*\/migrations\//, "", migration)
        print migration
      }
    ' "$manifest"
  )

  if [ "$declared_count" -ne "${#migrations[@]}" ]; then
    echo "ERROR: production bootstrap contains an unsupported migration include directive" >&2
    return 1
  fi
  if [ "${#migrations[@]}" -eq 0 ]; then
    echo "ERROR: production bootstrap contains no migration include directives" >&2
    return 1
  fi

  for migration in "${migrations[@]}"; do
    if [[ ! "$migration" =~ ^[0-9]{4}_.+\.sql$ ]] ||
       [[ "$migration" =~ _(rollback|verify|test)\.sql$ ]]; then
      echo "ERROR: invalid production migration entry: $migration" >&2
      return 1
    fi
    if [ ! -f "$migration_dir/$migration" ]; then
      echo "ERROR: production migration is missing: $migration" >&2
      return 1
    fi

    number="${migration:0:4}"
    if [ -n "${seen_numbers[$number]:-}" ]; then
      echo "ERROR: duplicate production migration number: $number" >&2
      return 1
    fi
    if [ -n "$previous_number" ] && (( 10#$number <= 10#$previous_number )); then
      echo "ERROR: production migrations are not strictly ordered at $migration" >&2
      return 1
    fi

    seen_numbers[$number]=1
    previous_number="$number"
    printf '%s\n' "$migration"
  done
}

# Migration checksums are defined over LF-normalized content so the registry is
# stable across Linux production checkouts and Windows development worktrees.
canonical_migration_sha256() {
  local path="$1"

  sed 's/\r$//' "$path" | sha256sum | awk '{ print $1 }'
}

validate_production_migration_checksums() {
  local checksum_manifest="$1"
  local migration_dir="$2"
  shift 2
  local -a migrations=("$@")
  local -a registry_hashes=()
  local -a registry_files=()
  local line
  local hash
  local file
  local actual_hash
  local index

  [ -f "$checksum_manifest" ] || {
    echo "ERROR: production migration checksum registry not found: $checksum_manifest" >&2
    return 1
  }

  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%$'\r'}"
    [[ "$line" =~ ^([0-9a-f]{64})[[:space:]][[:space:]]([0-9]{4}_.+\.sql)$ ]] || {
      echo "ERROR: malformed production migration checksum entry" >&2
      return 1
    }
    registry_hashes+=("${BASH_REMATCH[1]}")
    registry_files+=("${BASH_REMATCH[2]}")
  done < "$checksum_manifest"

  if [ "${#registry_files[@]}" -ne "${#migrations[@]}" ]; then
    echo "ERROR: production migration checksum registry count does not match the ordered manifest" >&2
    return 1
  fi

  for index in "${!migrations[@]}"; do
    file="${migrations[$index]}"
    hash="${registry_hashes[$index]}"
    if [ "${registry_files[$index]}" != "$file" ]; then
      echo "ERROR: production migration checksum registry order differs at $file" >&2
      return 1
    fi
    actual_hash="$(canonical_migration_sha256 "$migration_dir/$file")"
    if [ "$actual_hash" != "$hash" ]; then
      echo "ERROR: production migration checksum mismatch: $file" >&2
      return 1
    fi
  done
}

# Valid ledger state is a non-empty strict prefix of the ordered production
# registry. Historical bootstrap rows use the explicit baseline marker; rows
# applied by the runner use the exact migration filename.
validate_migration_ledger_rows() {
  local ledger_rows="$1"
  shift
  local -a migrations=("$@")
  local -A expected_numbers=()
  local -A seen_numbers=()
  local index=0
  local migration
  local expected_number
  local number
  local name
  local extra

  for migration in "${migrations[@]}"; do
    expected_numbers["${migration:0:4}"]=1
  done

  [ -n "$ledger_rows" ] || {
    echo "REFUSING: schema_migrations is empty. The baseline must be seeded by init.prod.sql" >&2
    echo "on first boot. Running every migration onto an existing schema would fail/corrupt it." >&2
    return 1
  }

  while IFS='|' read -r number name extra; do
    [ -z "$extra" ] || {
      echo "REFUSING: malformed schema_migrations ledger row" >&2
      return 1
    }
    [[ "$number" =~ ^[0-9]{4}$ ]] || {
      echo "REFUSING: malformed migration number in schema_migrations" >&2
      return 1
    }
    if [ -n "${seen_numbers[$number]:-}" ]; then
      echo "REFUSING: duplicate schema_migrations entry: $number" >&2
      return 1
    fi
    seen_numbers[$number]=1

    if [ -z "${expected_numbers[$number]:-}" ]; then
      echo "REFUSING: applied migration is absent from the production registry: $number" >&2
      return 1
    fi
    if [ "$index" -ge "${#migrations[@]}" ]; then
      echo "REFUSING: schema_migrations contains entries beyond the production registry" >&2
      return 1
    fi

    migration="${migrations[$index]}"
    expected_number="${migration:0:4}"
    if [ "$number" != "$expected_number" ]; then
      echo "REFUSING: schema_migrations has an ordering gap; expected $expected_number but found $number" >&2
      return 1
    fi
    if [ "$name" != "baseline (init.prod.sql)" ] && [ "$name" != "$migration" ]; then
      echo "REFUSING: schema_migrations name conflicts with the production registry for $number" >&2
      return 1
    fi

    index=$((index + 1))
  done <<< "$ledger_rows"

  MIGRATION_LEDGER_APPLIED_COUNT="$index"
}
