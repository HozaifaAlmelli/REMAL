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
