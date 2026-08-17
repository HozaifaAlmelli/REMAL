#!/usr/bin/env bash

validate_postgres_backup_artifact() {
  local path="$1"

  [ -f "$path" ] || {
    echo "ERROR: backup artifact is missing: $path" >&2
    return 1
  }
  [ -s "$path" ] || {
    echo "ERROR: backup artifact is empty: $path" >&2
    return 1
  }
  gzip -t "$path" 2>/dev/null || {
    echo "ERROR: backup artifact is not a valid gzip stream: $path" >&2
    return 1
  }
  gzip -dc "$path" | awk '
    /^-- PostgreSQL database dump$/ { header = 1 }
    /^-- PostgreSQL database dump complete$/ { complete = 1 }
    END { exit !(header && complete) }
  ' || {
    echo "ERROR: backup artifact lacks complete PostgreSQL plain-dump metadata: $path" >&2
    return 1
  }
}

publish_postgres_backup_artifact() {
  local partial="$1"
  local final="$2"

  [ ! -e "$final" ] || {
    echo "ERROR: refusing to overwrite an existing backup artifact: $final" >&2
    return 1
  }
  # A hard link is an atomic no-clobber publication on the same backup volume.
  # The partial name is created in that same directory by mktemp.
  ln -- "$partial" "$final" || {
    echo "ERROR: unable to publish backup artifact without overwriting: $final" >&2
    return 1
  }
  rm -f -- "$partial"
}

# Retention pruning that can never delete quietly.
#   - RETENTION_DAYS=0 disables pruning outright (use it during a rollout).
#   - The newest $min_retained artifacts are always kept, whatever their age, so
#     a long-lived reference backup cannot disappear because the clock moved.
#   - Every candidate is named on stdout before it is removed.
prune_postgres_backup_artifacts() {
  local backup_dir="$1"
  local retention_days="$2"
  local min_retained="${3:-3}"

  if [ "$retention_days" -le 0 ] 2>/dev/null; then
    echo "$(date -Is) retention pruning disabled (RETENTION_DAYS=$retention_days); no artifact removed"
    return 0
  fi

  local all=()
  mapfile -t all < <(
    find "$backup_dir" -maxdepth 1 -name 'kaza_postgres_*.sql.gz' -type f -printf '%T@\t%p\n' 2>/dev/null |
      sort -rn |
      cut -f2-
  )

  if [ "${#all[@]}" -le "$min_retained" ]; then
    echo "$(date -Is) retention: ${#all[@]} artifact(s) present, minimum retained is $min_retained; nothing pruned"
    return 0
  fi

  local removed=0
  local index=0
  local artifact
  for artifact in "${all[@]}"; do
    index=$((index + 1))
    [ "$index" -gt "$min_retained" ] || continue
    if [ -n "$(find "$artifact" -maxdepth 0 -mtime +"$retention_days" -print -quit 2>/dev/null)" ]; then
      echo "$(date -Is) retention: removing $artifact (older than ${retention_days} days)"
      rm -f -- "$artifact"
      removed=$((removed + 1))
    fi
  done

  echo "$(date -Is) retention: removed ${removed} artifact(s); kept $(( ${#all[@]} - removed ))"
}
