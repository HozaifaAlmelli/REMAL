#!/usr/bin/env python3
import json
import os
import sys


def env(name: str, default: str = "") -> str:
    return os.environ.get(name, default)


def parse_json(name: str, default):
    raw = env(name)
    if not raw:
        return default
    value = json.loads(raw)
    if not isinstance(value, type(default)):
        raise ValueError(f"{name} has the wrong JSON type")
    return value


def audit_payload() -> dict:
    return {
        "schema": "kaza-production-deployment-v1",
        "event": env("KAZA_AUDIT_EVENT", "DEPLOYMENT_RESULT"),
        "commit_sha": env("KAZA_AUDIT_SHA"),
        "control_sha": env("KAZA_AUDIT_CONTROL_SHA"),
        "branch": env("KAZA_AUDIT_BRANCH"),
        "actor": env("KAZA_AUDIT_ACTOR"),
        "deployment_id": env("KAZA_AUDIT_RUN_ID"),
        "workflow_run": env("DEPLOY_WORKFLOW_RUN"),
        "authorization_ref": env("DEPLOY_AUTHORIZATION_REF"),
        "mode": env("KAZA_AUDIT_MODE"),
        "timestamp": env("KAZA_AUDIT_TIMESTAMP"),
        "started_at": env("KAZA_AUDIT_STARTED_AT"),
        "previous_version": env("KAZA_AUDIT_PREVIOUS_SHA"),
        "database_migration_before": env("KAZA_AUDIT_MIGRATION_BEFORE"),
        "database_migration_after": env("KAZA_AUDIT_MIGRATION_AFTER"),
        "backup_artifact": env("KAZA_AUDIT_BACKUP_ARTIFACT"),
        "result": env("KAZA_AUDIT_RESULT"),
        "changed_services": parse_json("KAZA_AUDIT_CHANGED_SERVICES", []),
        "image_digests": parse_json("KAZA_AUDIT_IMAGE_IDS", {}),
        "rollback_images": parse_json("KAZA_AUDIT_ROLLBACK_IMAGES", {}),
        "recovery_manifest": env("KAZA_AUDIT_RECOVERY_MANIFEST"),
    }


def recovery_payload() -> dict:
    return {
        "schema": "kaza-production-recovery-v1",
        "run_id": env("KAZA_AUDIT_RUN_ID"),
        "target_sha": env("KAZA_AUDIT_SHA"),
        "control_sha": env("KAZA_AUDIT_CONTROL_SHA"),
        "previous_sha": env("KAZA_AUDIT_PREVIOUS_SHA"),
        "source_dir": env("KAZA_RECOVERY_SOURCE_DIR"),
        "status": env("KAZA_RECOVERY_STATUS", "PREPARED"),
        "changed_services": parse_json("KAZA_AUDIT_CHANGED_SERVICES", []),
        "previous_image_ids": parse_json("KAZA_RECOVERY_PREVIOUS_IMAGE_IDS", {}),
        "target_image_ids": parse_json("KAZA_AUDIT_IMAGE_IDS", {}),
        "rollback_images": parse_json("KAZA_AUDIT_ROLLBACK_IMAGES", {}),
    }


def main() -> int:
    if len(sys.argv) != 2 or sys.argv[1] not in {"audit", "recovery"}:
        print("usage: deployment-record.py audit|recovery", file=sys.stderr)
        return 64

    payload = audit_payload() if sys.argv[1] == "audit" else recovery_payload()
    print(json.dumps(payload, separators=(",", ":"), sort_keys=True))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (json.JSONDecodeError, ValueError) as exc:
        print(f"FATAL: invalid deployment evidence input: {exc}", file=sys.stderr)
        raise SystemExit(1)
