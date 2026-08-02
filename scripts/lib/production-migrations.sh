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
