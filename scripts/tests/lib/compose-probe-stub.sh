#!/usr/bin/env bash
# ============================================================================
# Shared docker-stub helper for the release-script test harnesses.
#
# scripts/lib/env-file.sh proves its parsed identifiers agree with docker
# compose by asking compose to resolve them from a throwaway probe project.
# Harnesses that stub the docker binary must answer that probe, and they must
# answer it INDEPENDENTLY of the parser under test — otherwise the agreement
# check would be comparing the parser with itself.
#
# So the answer comes from KAZA_PROBE_POSTGRES_USER / KAZA_PROBE_POSTGRES_DB,
# which each suite sets to the literal values its own fixture declares. If the
# parser ever regressed, the comparison would fail exactly as it should.
# ============================================================================

respond_to_compose_probe() {
  case "$*" in
    *kaza-env-probe.yml*) ;;
    *) return 0 ;;
  esac

  local probe=""
  local prev=""
  local arg
  for arg in "$@"; do
    if [ "$prev" = "-f" ]; then
      probe="$arg"
    fi
    prev="$arg"
  done

  if [ -z "$probe" ] || [ ! -f "$probe" ]; then
    echo "compose probe project not found in the stub invocation" >&2
    exit 3
  fi

  local key
  key="$(sed -n 's/.*PROBE: "\${\([A-Za-z_][A-Za-z0-9_]*\)}".*/\1/p' "$probe")"
  case "$key" in
    POSTGRES_USER) printf '        "PROBE": "%s"\n' "${KAZA_PROBE_POSTGRES_USER?probe user not configured}" ;;
    POSTGRES_DB) printf '        "PROBE": "%s"\n' "${KAZA_PROBE_POSTGRES_DB?probe database not configured}" ;;
    *)
      echo "unexpected compose probe key: $key" >&2
      exit 3
      ;;
  esac
  exit 0
}
