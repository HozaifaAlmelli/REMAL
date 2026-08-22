#!/usr/bin/env bash

verify_built_image_provenance() {
  local image="$1" expected_sha="$2" expected_control_sha="$3"
  local image_id revision control_revision
  image_id="$(docker image inspect -f '{{.Id}}' "$image")"
  revision="$(docker image inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$image")"
  control_revision="$(docker image inspect -f '{{index .Config.Labels "com.kaza.deployment.control-revision"}}' "$image")"
  if [ -z "$image_id" ] || [ "$revision" != "$expected_sha" ] || [ "$control_revision" != "$expected_control_sha" ]; then
    echo "FATAL: built image provenance mismatch: $image" >&2
    return 1
  fi
  printf '%s\n' "$image_id"
}

verify_running_image_provenance() {
  local container="$1" expected_image_id="$2" expected_sha="$3" expected_control_sha="$4"
  local running revision control_revision
  running="$(docker inspect -f '{{.Image}}' "$container")"
  revision="$(docker inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$container")"
  control_revision="$(docker inspect -f '{{index .Config.Labels "com.kaza.deployment.control-revision"}}' "$container")"
  if [ "$running" != "$expected_image_id" ] || [ "$revision" != "$expected_sha" ] || [ "$control_revision" != "$expected_control_sha" ]; then
    echo "FATAL: running container provenance mismatch: $container" >&2
    return 1
  fi
}

verify_existing_runtime_provenance() {
  local previous_sha="$1" target_sha="$2" control_sha="$3" live_dir="$4"
  local deployment_ledger="$5" approve_legacy="$6" control_dir="$7"
  local recovery_manifest="${8:-}"
  local service running_id revision control_revision expected_id
  local normal_provenance=1

  [[ "$previous_sha" =~ ^[0-9a-f]{40}$ ]] || {
    echo "FATAL: current-sha.txt is not a full application SHA" >&2
    return 1
  }

  if [ -n "$recovery_manifest" ]; then
    [ -f "$recovery_manifest" ] && [ ! -L "$recovery_manifest" ] || {
      echo "FATAL: authorized recovery manifest is not a regular file" >&2
      return 1
    }
    for service in api demo portal; do
      running_id="$(docker inspect -f '{{.Image}}' "kaza-prod-$service")"
      revision="$(docker inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' "kaza-prod-$service")"
      control_revision="$(docker inspect -f '{{index .Config.Labels "com.kaza.deployment.control-revision"}}' "kaza-prod-$service")"
      python3 - "$recovery_manifest" "$service" "$running_id" "$revision" "$control_revision" <<'PY'
import json, sys
path, service, running_id, revision, control_revision = sys.argv[1:]
with open(path, encoding="utf-8") as handle:
    manifest=json.load(handle)
previous_id=manifest["previous_image_ids"][service]
target_id=manifest["target_image_ids"][service]
changed=service in manifest["changed_services"]
if running_id == previous_id:
    if revision not in {manifest["previous_sha"], "prod"}:
        raise SystemExit("previous recovery image has the wrong revision")
elif changed and running_id == target_id:
    if revision != manifest["target_sha"] or control_revision != manifest["control_sha"]:
        raise SystemExit("target recovery image has the wrong provenance")
else:
    raise SystemExit("running image is not authorized by the failed recovery manifest")
PY
    done
    echo "### Existing mixed runtime matches the authorized failed-run manifest"
    return 0
  fi

  for service in api demo portal; do
    running_id="$(docker inspect -f '{{.Image}}' "kaza-prod-$service")"
    revision="$(docker inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' "kaza-prod-$service")"
    control_revision="$(docker inspect -f '{{index .Config.Labels "com.kaza.deployment.control-revision"}}' "kaza-prod-$service")"
    if ! expected_id="$(DEPLOYMENT_LEDGER="$deployment_ledger" \
      bash "$control_dir/scripts/release-state.sh" deployed-image-id "$previous_sha" "$service" 2>/dev/null)"; then
      normal_provenance=0
      continue
    fi
    if [ "$running_id" != "$expected_id" ] || [ "$revision" != "$previous_sha" ] ||
       [[ ! "$control_revision" =~ ^[0-9a-f]{40}$ ]]; then
      echo "FATAL: existing $service container differs from its last successful deployment evidence" >&2
      return 1
    fi
  done
  [ "$normal_provenance" = "1" ] && return 0

  [ "$approve_legacy" = "1" ] || {
    echo "FATAL: existing application has no complete trusted provenance; explicit one-time baseline approval is required" >&2
    return 1
  }
  [ "$target_sha" = "$control_sha" ] || {
    echo "FATAL: legacy provenance may be adopted only while deploying current main" >&2
    return 1
  }
  DEPLOYMENT_LEDGER="$deployment_ledger" \
    bash "$control_dir/scripts/release-state.sh" no-successful-deployments >/dev/null || {
      echo "FATAL: legacy provenance cannot be adopted after a successful trusted deployment" >&2
      return 1
    }
  [ "$(git -C "$live_dir" rev-parse HEAD)" = "$previous_sha" ] || {
    echo "FATAL: legacy live checkout does not match current-sha.txt" >&2
    return 1
  }
  for service in api demo portal; do
    revision="$(docker inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' "kaza-prod-$service")"
    [ "$revision" = "prod" ] || {
      echo "FATAL: legacy $service container has an unexpected revision label" >&2
      return 1
    }
  done
  echo "WARNING: explicitly adopting the one-time legacy application provenance baseline" >&2
}
