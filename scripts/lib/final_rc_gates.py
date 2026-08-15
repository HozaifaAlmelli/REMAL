#!/usr/bin/env python3
"""Fail-closed final Release Candidate gate orchestration and evidence validation."""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys
import xml.etree.ElementTree as ET
from collections import Counter
from typing import Any


for stream in (sys.stdout, sys.stderr):
    if hasattr(stream, "reconfigure"):
        stream.reconfigure(encoding="utf-8", errors="replace")


RESULTS = {
    "AUTOMATED_PASS",
    "AUTOMATED_FAIL",
    "MANUAL_PASS",
    "MANUAL_EVIDENCE_REQUIRED",
    "NOT_RUN",
    "NOT_APPLICABLE",
}
REQUIRED_RELIABILITY_CATEGORIES = {"P0", "P1", "security", "accounting", "release_critical_uat"}
RATIFIED_CATALOG_COUNTS = {
    "scenarios": 160,
    "criteria": 363,
    "acceptanceCriteria": 208,
    "negativeAcceptanceCriteria": 155,
    "publicErrors": 45,
}
SAFE_IDENTIFIER_RE = re.compile(r"^[a-z][a-z0-9_]{0,63}$")
SAFE_RUN_ID_RE = re.compile(r"^[a-z0-9][a-z0-9._-]{0,79}$")
SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
MANUAL_EVIDENCE_TYPES = {
    "database_verification",
    "deployment_record",
    "external_artifact",
    "operator_attestation",
    "release_snapshot_record",
    "uat_record",
}
EVIDENCE_METADATA_RULES = {
    "database_verification": {"databaseScope", "verificationTool", "verificationResult"},
    "deployment_record": {"environment", "deploymentId", "deployedSha"},
    "external_artifact": {"provider", "immutableArtifactId", "verificationMethod", "verifiedBy"},
    "operator_attestation": {"operatorRole", "attestedAction"},
    "release_snapshot_record": {"snapshotId", "sourceEnvironment", "provenanceRecordId"},
    "uat_record": {"uatScope", "approver", "result"},
}
FINAL_STATUSES = {"NOT_READY", "READY_FOR_OWNER_GO_NO_GO", "GO", "NO_GO"}
SENSITIVE_KEY_RE = re.compile(
    r"(?:password|passwd|pwd|token|secret|jwt|authorization|database_url|"
    r"kaza_invoice_audit_db|kaza_rentable_capacity_db|kaza_test_db|connection_string|api_key|(?:^|_)db$)",
    re.IGNORECASE,
)
SECRET_PATTERNS = (
    re.compile(
        r"(?i)\b(?:DATABASE_URL|KAZA_INVOICE_AUDIT_DB|KAZA_RENTABLE_CAPACITY_DB|"
        r"PASSWORD|PASSWD|PWD|TOKEN|SECRET|JWT|AUTHORIZATION)\b\s*[=:]\s*"
        r"(?:\"[^\"]*\"|'[^']*'|[^\s,}\]]+)"
    ),
    re.compile(r"(?i)\bBearer\s+[A-Za-z0-9._~+/=-]+"),
    re.compile(r"(?i)\bpostgres(?:ql)?://[^\s\"'<>]+"),
    re.compile(r"(?i)\bhttps?://[^\s/:@]+:[^\s/@]+@[^\s\"'<>]+"),
    re.compile(
        r"(?i)\b(?:Host|Server)=[^\r\n]+?(?:Password|Pwd)=[^;\r\n]+(?:;[^\r\n]*)?"
    ),
    re.compile(r"\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\b"),
)
SCENARIO_RE = re.compile(r"^####\s+(SC-[A-Z]+-\d{2})\b", re.MULTILINE)
CRITERION_RE = re.compile(r"^\|\s*((?:NAC|AC)-HB\d+[A-Z]?-\d{2})\s*\|", re.MULTILINE)


class GateError(RuntimeError):
    pass


def load_json(path: pathlib.Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def write_json_exclusive(path: pathlib.Path, value: Any, secret_values: list[str]) -> None:
    redacted = redact_value(value, secret_values)
    with path.open("x", encoding="utf-8") as handle:
        json.dump(redacted, handle, indent=2, sort_keys=True)
        handle.write("\n")


def redact(value: str, secret_values: list[str] | None = None) -> str:
    result = value
    for secret in secret_values or []:
        if len(secret) >= 4:
            result = result.replace(secret, "[REDACTED]")
        elif secret:
            result = re.sub(
                rf"(?<![A-Za-z0-9]){re.escape(secret)}(?![A-Za-z0-9])",
                "[REDACTED]",
                result,
            )
    for pattern in SECRET_PATTERNS:
        result = pattern.sub("[REDACTED]", result)
    return result


def redact_value(value: Any, secret_values: list[str] | None = None, key: str = "") -> Any:
    if key and SENSITIVE_KEY_RE.search(key):
        return "[REDACTED]"
    if isinstance(value, dict):
        return {item_key: redact_value(item_value, secret_values, str(item_key)) for item_key, item_value in value.items()}
    if isinstance(value, list):
        return [redact_value(item, secret_values) for item in value]
    if isinstance(value, str):
        return redact(value, secret_values)
    return value


def configured_secret_values(environment: dict[str, str]) -> list[str]:
    values = []
    for key, value in environment.items():
        if value and SENSITIVE_KEY_RE.search(key):
            values.append(value)
    return sorted(set(values), key=len, reverse=True)


def git(repo: pathlib.Path, *args: str) -> str:
    completed = subprocess.run(
        ["git", *args], cwd=repo, text=True, capture_output=True, check=False
    )
    if completed.returncode:
        raise GateError(redact(completed.stderr.strip() or completed.stdout.strip()))
    return completed.stdout.strip()


def assert_repository_clean(repo: pathlib.Path, expected_sha: str, phase: str) -> str:
    if not re.fullmatch(r"[0-9a-f]{40}", expected_sha):
        raise GateError("expected RC SHA must be a full lowercase 40-character commit SHA")
    head = git(repo, "rev-parse", "HEAD")
    if head != expected_sha:
        raise GateError(f"{phase} HEAD mismatch: expected {expected_sha}, found {head}")
    if git(repo, "diff", "--name-only") or git(repo, "diff", "--cached", "--name-only"):
        raise GateError(f"tracked working tree or index is dirty during {phase}")
    return head


def assert_preflight(repo: pathlib.Path, expected_sha: str) -> str:
    return assert_repository_clean(repo, expected_sha, "preflight")


def parse_scenarios(path: pathlib.Path) -> list[dict[str, str]]:
    text = path.read_text(encoding="utf-8")
    matches = list(SCENARIO_RE.finditer(text))
    scenarios: list[dict[str, str]] = []
    for index, match in enumerate(matches):
        block_end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        block = text[match.end():block_end]
        contract = re.search(
            r"\|\s*\*\*Priority\s*·\s*Category\s*·\s*Automate\*\*\s*\|\s*"
            r"\*{0,2}(P[0-2])\*{0,2}\s*·\s*([^·|]+?)\s*·\s*(YES|NO)\b",
            block,
            re.IGNORECASE,
        )
        if not contract:
            raise GateError(f"scenario {match.group(1)} lacks a parseable Priority/Category/Automate row")
        scenario_id = match.group(1)
        scenarios.append(
            {
                "id": scenario_id,
                "group": scenario_id.split("-")[1],
                "priority": contract.group(1).upper(),
                "category": contract.group(2).strip(),
                "automate": contract.group(3).upper(),
            }
        )
    assert_unique("scenario", [item["id"] for item in scenarios])
    return scenarios


def parse_criteria(directory: pathlib.Path) -> list[str]:
    criteria: list[str] = []
    for path in sorted(directory.glob("[0-9][0-9]_*.md")):
        criteria.extend(CRITERION_RE.findall(path.read_text(encoding="utf-8")))
    assert_unique("AC/NAC", criteria)
    return sorted(criteria)


def parse_errors(path: pathlib.Path) -> list[str]:
    text = path.read_text(encoding="utf-8")
    start = text.index("### 12.3 Error contract")
    end = text.index("\n## 13.", start)
    codes = re.findall(r"^\|[^\n]+\|\s*`([A-Z][A-Z0-9_]+)`\s*\|", text[start:end], re.MULTILINE)
    assert_unique("public error", codes)
    return sorted(codes)


def assert_unique(kind: str, identifiers: list[str]) -> None:
    duplicates = sorted(identifier for identifier, count in Counter(identifiers).items() if count > 1)
    if duplicates:
        raise GateError(f"duplicate/conflicting {kind} IDs: {', '.join(duplicates)}")


def load_ratified_catalog(path: pathlib.Path, enforce_reviewed_baseline: bool = True) -> dict[str, Any]:
    catalog = load_json(path)
    if catalog.get("schemaVersion") != 1:
        raise GateError("ratified identity catalog schemaVersion must be 1")
    scenarios = catalog.get("scenarios")
    criteria = catalog.get("criteria")
    errors = catalog.get("publicErrors")
    if not all(isinstance(section, list) and all(isinstance(item, str) for item in section) for section in (scenarios, criteria, errors)):
        raise GateError("ratified identity catalog sections must be string arrays")
    assert_unique("ratified scenario", scenarios)
    assert_unique("ratified AC/NAC", criteria)
    assert_unique("ratified public error", errors)
    counts = {
        "scenarios": len(scenarios),
        "criteria": len(criteria),
        "acceptanceCriteria": sum(item.startswith("AC-") for item in criteria),
        "negativeAcceptanceCriteria": sum(item.startswith("NAC-") for item in criteria),
        "publicErrors": len(errors),
    }
    if catalog.get("counts") != counts:
        raise GateError(f"ratified identity catalog declared counts do not match its exact identities: {counts}")
    if enforce_reviewed_baseline and counts != RATIFIED_CATALOG_COUNTS:
        raise GateError(f"ratified identity catalog counts do not match the reviewed baseline: {counts}")
    return {"scenarios": scenarios, "criteria": criteria, "publicErrors": errors}


def assert_exact_identities(kind: str, observed: list[str], expected: list[str]) -> None:
    missing = sorted(set(expected) - set(observed))
    extra = sorted(set(observed) - set(expected))
    if missing or extra or len(observed) != len(expected):
        raise GateError(f"{kind} identity mismatch; missing={missing}, extra={extra}")


def validate_manifest(manifest: dict[str, Any]) -> None:
    automated = manifest.get("automatedGates", [])
    manual = manifest.get("manualGates", [])
    automated_ids = [item.get("id", "") for item in automated]
    manual_ids = [item.get("id", "") for item in manual]
    assert_unique("automated gate", automated_ids)
    assert_unique("manual gate", manual_ids)
    for identifier in automated_ids + manual_ids:
        if not SAFE_IDENTIFIER_RE.fullmatch(identifier):
            raise GateError(f"unsafe gate ID: {identifier}")
    for gate in automated:
        lanes = gate.get("lanes", [])
        if not lanes or not set(lanes) <= {"full", "hosted", "synthetic"}:
            raise GateError(f"gate {gate['id']} has invalid lanes")
        if gate.get("mandatory", True) and "full" not in lanes and "synthetic" not in lanes:
            raise GateError(f"mandatory gate {gate['id']} is absent from the full lane")
        if gate.get("requiresTests") and gate.get("testEvidence", {}).get("type") not in {
            "dotnet-trx",
            "node-tap",
            "playwright-json",
            "python-unittest",
        }:
            raise GateError(f"test gate {gate['id']} lacks a supported structured completion contract")
    automated_set = set(automated_ids)
    manual_set = set(manual_ids)
    if manifest.get("identityEvidenceIndexRequired") is not True:
        raise GateError("ratified identity evidence must require an exact identity index")
    owner_definition = manifest.get("ownerDecision")
    if not isinstance(owner_definition, dict) or owner_definition.get("id") != "owner_go_no_go":
        raise GateError("the distinct owner GO/NO-GO transition is missing")
    if "owner_go_no_go" in manual_set:
        raise GateError("owner GO/NO-GO must not be a pre-readiness manual gate")
    if set(manifest.get("reliabilityCategories", {})) != REQUIRED_RELIABILITY_CATEGORIES:
        raise GateError("#99 evidence categories must exactly match the ratified category set")
    for category, mapping in manifest["reliabilityCategories"].items():
        unknown_automated = sorted(set(mapping.get("automatedGateIds", [])) - automated_set)
        unknown_manual = sorted(set(mapping.get("manualGateIds", [])) - manual_set)
        if unknown_automated or unknown_manual or not mapping.get("manualGateIds"):
            raise GateError(
                f"#99 category {category} has incomplete/unknown evidence; automated={unknown_automated}, manual={unknown_manual}"
            )


def canonical_inventory(
    repo: pathlib.Path,
    manifest: dict[str, Any],
    catalog: dict[str, Any],
) -> dict[str, Any]:
    validate_manifest(manifest)
    sources = manifest["canonicalSources"]
    scenarios = parse_scenarios(repo / sources["scenarios"])
    criteria = parse_criteria(repo / sources["ticketDirectory"])
    errors = parse_errors(repo / sources["masterContract"])
    assert_exact_identities("scenario source/catalog", [item["id"] for item in scenarios], catalog["scenarios"])
    assert_exact_identities("AC/NAC source/catalog", criteria, catalog["criteria"])
    assert_exact_identities("public error source/catalog", errors, catalog["publicErrors"])
    return {"scenarios": scenarios, "criteria": criteria, "publicErrors": errors}


def incomplete_counts(source: str) -> dict[str, Any]:
    return {
        "total": None,
        "passed": None,
        "failed": None,
        "skipped": None,
        "completionVerified": False,
        "source": source,
    }


def complete_counts(total: int, passed: int, failed: int, skipped: int, source: str) -> dict[str, Any]:
    if min(total, passed, failed, skipped) < 0 or total != passed + failed + skipped:
        return incomplete_counts(source)
    return {
        "total": total,
        "passed": passed,
        "failed": failed,
        "skipped": skipped,
        "completionVerified": True,
        "source": source,
    }


def parse_node_tap(output: str) -> dict[str, Any]:
    lines = output.replace("\r\n", "\n").rstrip("\n").split("\n")
    starts = [
        index
        for index, line in enumerate(lines)
        if re.fullmatch(r"(?:#|ℹ)\s*tests\s+\d+\s*", line)
    ]
    if not starts:
        return incomplete_counts("node-tap")
    summary_lines = lines[starts[-1]:]
    values: dict[str, int] = {}
    for line in summary_lines:
        match = re.fullmatch(
            r"(?:#|ℹ)\s*(tests|suites|pass|fail|cancelled|skipped|todo|duration_ms)\s+(\d+(?:\.\d+)?)\s*",
            line,
        )
        if not match or match.group(1) in values:
            return incomplete_counts("node-tap")
        name, raw_value = match.groups()
        if name != "duration_ms" and "." in raw_value:
            return incomplete_counts("node-tap")
        values[name] = int(float(raw_value))
    required = {"tests", "pass", "fail", "cancelled", "skipped", "todo", "duration_ms"}
    if not required <= set(values):
        return incomplete_counts("node-tap")
    failed = values["fail"] + values["cancelled"]
    skipped = values["skipped"] + values["todo"]
    return complete_counts(values["tests"], values["pass"], failed, skipped, "node-tap")


def parse_python_unittest(output: str) -> dict[str, Any]:
    match = re.search(
        r"(?:^|\n)FINAL_RC_PYTHON_TEST_RESULT "
        r"total=(\d+) passed=(\d+) failures=(\d+) errors=(\d+) skipped=(\d+) "
        r"completion=complete\s*\Z",
        output.replace("\r\n", "\n"),
    )
    if not match:
        return incomplete_counts("python-unittest")
    total, passed, failures, errors, skipped = (int(value) for value in match.groups())
    return complete_counts(total, passed, failures + errors, skipped, "python-unittest")


def parse_dotnet_trx(report_dir: pathlib.Path) -> dict[str, Any]:
    reports = list(report_dir.glob("*.trx"))
    if len(reports) != 1:
        return incomplete_counts("dotnet-trx")
    try:
        root = ET.parse(reports[0]).getroot()
    except (ET.ParseError, OSError):
        return incomplete_counts("dotnet-trx")
    counters = next((element for element in root.iter() if element.tag.rsplit("}", 1)[-1] == "Counters"), None)
    required = {"total", "executed", "passed", "failed", "error", "timeout", "aborted", "notExecuted"}
    if counters is None or not required <= set(counters.attrib):
        return incomplete_counts("dotnet-trx")
    values = {key: int(counters.attrib[key]) for key in required}
    failed = values["failed"] + values["error"] + values["timeout"] + values["aborted"]
    skipped = values["notExecuted"]
    return complete_counts(values["total"], values["passed"], failed, skipped, "dotnet-trx")


def parse_playwright_json(report_path: pathlib.Path) -> dict[str, Any]:
    try:
        report = load_json(report_path)
    except (OSError, json.JSONDecodeError):
        return incomplete_counts("playwright-json")
    stats = report.get("stats")
    required = {"expected", "unexpected", "flaky", "skipped", "duration"}
    if not isinstance(stats, dict) or not required <= set(stats) or not isinstance(report.get("suites"), list):
        return incomplete_counts("playwright-json")
    try:
        passed = int(stats["expected"])
        failed = int(stats["unexpected"]) + int(stats["flaky"])
        skipped = int(stats["skipped"])
    except (TypeError, ValueError):
        return incomplete_counts("playwright-json")
    return complete_counts(passed + failed + skipped, passed, failed, skipped, "playwright-json")


def parse_test_completion(kind: str, output: str, report_dir: pathlib.Path) -> dict[str, Any]:
    if kind == "node-tap":
        return parse_node_tap(output)
    if kind == "python-unittest":
        return parse_python_unittest(output)
    if kind == "dotnet-trx":
        return parse_dotnet_trx(report_dir)
    if kind == "playwright-json":
        return parse_playwright_json(report_dir / "results.json")
    return incomplete_counts(kind or "none")


def run_gate(
    repo: pathlib.Path,
    gate: dict[str, Any],
    evidence_dir: pathlib.Path,
    secret_values: list[str],
    expected_sha: str,
) -> dict[str, Any]:
    gate_id = gate["id"]
    if not SAFE_IDENTIFIER_RE.fullmatch(gate_id):
        raise GateError(f"unsafe gate ID: {gate_id}")
    log_path = evidence_dir / "logs" / f"{gate_id}.log"
    log_path.parent.mkdir(parents=True, exist_ok=True)
    report_dir = evidence_dir / ".reports" / gate_id
    report_dir.mkdir(parents=True, exist_ok=False)
    environment = os.environ.copy()
    environment.setdefault("PYTHONIOENCODING", "utf-8")
    environment.update({key: value.replace("{repo}", str(repo)) for key, value in gate.get("environment", {}).items()})
    command = [
        sys.executable if value == "{python}" else value.replace("{repo}", str(repo))
        for value in gate["command"]
    ]
    test_kind = gate.get("testEvidence", {}).get("type", "")
    if test_kind == "dotnet-trx":
        command.extend(["--logger", "trx;LogFileName=results.trx", "--results-directory", str(report_dir)])
    elif test_kind == "playwright-json":
        environment["PLAYWRIGHT_JSON_OUTPUT_NAME"] = str(report_dir / "results.json")
    if os.name == "nt" and command:
        command[0] = shutil.which(command[0]) or command[0]
    gate_secret_values = sorted(set(secret_values + configured_secret_values(environment)), key=len, reverse=True)
    display = " ".join(command)
    started = dt.datetime.now(dt.timezone.utc)
    print(f"\n=== FINAL-RC GATE {gate_id}: {redact(display, gate_secret_values)} ===", flush=True)
    process = subprocess.Popen(
        command,
        cwd=repo / gate.get("workingDirectory", "."),
        env=environment,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    captured: list[str] = []
    assert process.stdout is not None
    with log_path.open("x", encoding="utf-8") as log:
        for raw_line in process.stdout:
            line = redact(raw_line, gate_secret_values)
            captured.append(line)
            log.write(line)
            print(line, end="", flush=True)
    exit_code = process.wait()
    process.stdout.close()
    output = "".join(captured)
    counts = (
        parse_test_completion(test_kind, output, report_dir)
        if gate.get("requiresTests")
        else incomplete_counts("not-applicable")
    )
    shutil.rmtree(report_dir, ignore_errors=True)
    unexplained_skip = bool(counts["skipped"] is not None and counts["skipped"] > 0)
    test_failure = bool(counts["failed"] is not None and counts["failed"] > 0)
    missing_tests = bool(gate.get("requiresTests") and (not counts["completionVerified"] or not counts["total"]))
    workspace_dirty = False
    try:
        assert_repository_clean(repo, expected_sha, f"postflight for {gate_id}")
    except GateError as error:
        workspace_dirty = True
        diagnostic = redact(f"FINAL-RC postflight error: {error}\n", gate_secret_values)
        with log_path.open("a", encoding="utf-8") as log:
            log.write(diagnostic)
        print(diagnostic, end="", file=sys.stderr)
    passed = exit_code == 0 and not unexplained_skip and not test_failure and not missing_tests and not workspace_dirty
    return {
        "id": gate_id,
        "classification": "automated",
        "result": "AUTOMATED_PASS" if passed else "AUTOMATED_FAIL",
        "exitCode": exit_code,
        "command": redact(display, gate_secret_values),
        "startedAtUtc": started.isoformat(),
        "completedAtUtc": dt.datetime.now(dt.timezone.utc).isoformat(),
        "counts": counts,
        "evidenceRef": str(log_path.relative_to(evidence_dir)).replace("\\", "/"),
        "unexplainedSkipped": unexplained_skip,
        "requiredTestsMissing": missing_tests,
        "workspaceDirty": workspace_dirty,
    }


def sha256_file(path: pathlib.Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def resolve_approved_artifact(repo: pathlib.Path, rc_sha: str, evidence_ref: Any) -> pathlib.Path:
    if not isinstance(evidence_ref, str) or not evidence_ref or "\\" in evidence_ref:
        raise GateError("evidence reference must be a non-empty repository-relative POSIX path")
    reference = pathlib.PurePosixPath(evidence_ref)
    expected_prefix = ("artifacts", "final-rc", rc_sha)
    if reference.is_absolute() or ".." in reference.parts or reference.parts[:3] != expected_prefix:
        raise GateError("evidence reference escapes the approved RC SHA evidence boundary")
    candidate = repo.joinpath(*reference.parts)
    boundary = repo / "artifacts" / "final-rc" / rc_sha
    for current in (repo / "artifacts", repo / "artifacts" / "final-rc", boundary):
        if current.exists() and current.is_symlink():
            raise GateError("evidence reference traverses a symlink")
    current = boundary
    for part in reference.parts[3:]:
        current = current / part
        if current.exists() and current.is_symlink():
            raise GateError("evidence reference traverses a symlink")
    try:
        candidate.resolve(strict=True).relative_to(boundary.resolve(strict=True))
    except (FileNotFoundError, ValueError) as error:
        raise GateError("evidence artifact does not exist inside the approved RC SHA boundary") from error
    if not candidate.is_file() or candidate.is_symlink():
        raise GateError("evidence artifact must be a real regular file")
    return candidate


def verify_artifact(
    repo: pathlib.Path,
    rc_sha: str,
    evidence_ref: Any,
    expected_digest: Any,
    identifier: str,
) -> tuple[str, str]:
    if not isinstance(expected_digest, str) or not SHA256_RE.fullmatch(expected_digest):
        raise GateError(f"{identifier} requires a lowercase SHA-256 artifact digest")
    path = resolve_approved_artifact(repo, rc_sha, evidence_ref)
    actual_digest = sha256_file(path)
    if actual_digest != expected_digest:
        raise GateError(f"{identifier} artifact digest does not match the referenced file bytes")
    return str(evidence_ref), actual_digest


def validate_manual_evidence_receipt(
    repo: pathlib.Path,
    rc_sha: str,
    item: dict[str, Any],
    evidence_ref: str,
    normalized_timestamp: str,
    metadata: dict[str, Any],
) -> None:
    artifact = resolve_approved_artifact(repo, rc_sha, evidence_ref)
    try:
        receipt = load_json(artifact)
    except (json.JSONDecodeError, UnicodeDecodeError) as error:
        raise GateError(
            f"manual evidence {item['id']} artifact must be a structured evidence receipt"
        ) from error
    expected_fields = {
        "schemaVersion",
        "rcSha",
        "itemId",
        "evidenceType",
        "executor",
        "executedAtUtc",
        "provenance",
        "evidence",
    }
    if set(receipt) != expected_fields or receipt.get("schemaVersion") != 1:
        raise GateError(f"manual evidence {item['id']} receipt has missing or unknown fields")
    receipt_timestamp = parse_attestation_timestamp(
        receipt.get("executedAtUtc"), f"{item['id']} receipt"
    )
    expected = {
        "rcSha": rc_sha,
        "itemId": item["id"],
        "evidenceType": item["evidenceType"],
        "executor": item["executor"].strip(),
        "executedAtUtc": normalized_timestamp,
        "provenance": metadata,
    }
    observed = {key: receipt.get(key) for key in expected}
    observed["executedAtUtc"] = receipt_timestamp
    if observed != expected:
        raise GateError(f"manual evidence {item['id']} receipt does not match its attestation")
    if not isinstance(receipt.get("evidence"), dict) or not receipt["evidence"]:
        raise GateError(f"manual evidence {item['id']} receipt requires structured supporting evidence")


def empty_inventory_evidence(inventory: dict[str, Any]) -> dict[str, list[dict[str, Any]]]:
    def row(identifier: str) -> dict[str, Any]:
        return {
            "id": identifier,
            "classification": "manual",
            "result": "MANUAL_EVIDENCE_REQUIRED",
            "evidenceRefs": [],
        }

    return {
        "scenarios": [row(item["id"]) for item in inventory["scenarios"]],
        "criteria": [row(identifier) for identifier in inventory["criteria"]],
        "publicErrors": [row(identifier) for identifier in inventory["publicErrors"]],
    }


def load_identity_evidence(
    path: pathlib.Path | None,
    repo: pathlib.Path,
    rc_sha: str,
    inventory: dict[str, Any],
) -> tuple[dict[str, list[dict[str, Any]]], dict[str, Any] | None]:
    if path is None:
        return empty_inventory_evidence(inventory), None
    try:
        index_ref = path.resolve(strict=True).relative_to(repo.resolve()).as_posix()
    except (FileNotFoundError, ValueError) as error:
        raise GateError("identity evidence index must be a real file inside the approved evidence boundary") from error
    index_path = resolve_approved_artifact(repo, rc_sha, index_ref)
    document = load_json(index_path)
    if set(document) != {"schemaVersion", "rcSha", "executor", "generatedAtUtc", "items"}:
        raise GateError("identity evidence index has missing or unknown top-level fields")
    if document.get("schemaVersion") != 1 or document.get("rcSha") != rc_sha:
        raise GateError("identity evidence index is not bound to the exact RC SHA")
    executor = document.get("executor")
    if not isinstance(executor, str) or not executor.strip():
        raise GateError("identity evidence index requires an executor identity")
    generated_at = parse_attestation_timestamp(document.get("generatedAtUtc"), "identity evidence index")
    items = document.get("items")
    if not isinstance(items, list) or not all(isinstance(item, dict) for item in items):
        raise GateError("identity evidence index items must be an array of objects")
    for item in items:
        if set(item) != {"id", "evidenceRef", "evidenceSha256"}:
            raise GateError(f"identity evidence item {item.get('id', '<missing>')} has missing or unknown fields")
    item_ids = [item.get("id", "") for item in items]
    assert_unique("identity evidence", item_ids)
    section_ids = {
        "scenarios": [item["id"] for item in inventory["scenarios"]],
        "criteria": inventory["criteria"],
        "publicErrors": inventory["publicErrors"],
    }
    expected_ids = [identifier for identifiers in section_ids.values() for identifier in identifiers]
    assert_exact_identities("identity evidence index/catalog", item_ids, expected_ids)
    verified: dict[str, dict[str, Any]] = {}
    for item in items:
        if item["evidenceRef"] == index_ref:
            raise GateError(f"identity {item['id']} cannot use the evidence index itself as supporting evidence")
        evidence_ref, digest = verify_artifact(
            repo, rc_sha, item["evidenceRef"], item["evidenceSha256"], f"identity {item['id']}"
        )
        verified[item["id"]] = {
            "id": item["id"],
            "classification": "manual",
            "result": "MANUAL_PASS",
            "evidenceRefs": [evidence_ref],
            "evidenceSha256": digest,
        }
    return (
        {section: [verified[identifier] for identifier in identifiers] for section, identifiers in section_ids.items()},
        {
            "evidenceRef": index_ref,
            "evidenceSha256": sha256_file(index_path),
            "executor": executor.strip(),
            "generatedAtUtc": generated_at,
        },
    )


def parse_attestation_timestamp(value: Any, identifier: str) -> str:
    if not isinstance(value, str):
        raise GateError(f"manual evidence {identifier} requires an ISO-8601 timestamp")
    try:
        parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise GateError(f"manual evidence {identifier} has an invalid timestamp") from error
    if parsed.tzinfo is None:
        raise GateError(f"manual evidence {identifier} timestamp must include a timezone")
    if parsed > dt.datetime.now(dt.timezone.utc) + dt.timedelta(minutes=5):
        raise GateError(f"manual evidence {identifier} timestamp is in the future")
    return parsed.astimezone(dt.timezone.utc).isoformat()


def validate_evidence_metadata(evidence_type: str, metadata: Any, rc_sha: str, identifier: str) -> dict[str, Any]:
    if not isinstance(metadata, dict):
        raise GateError(f"manual evidence {identifier} metadata must be an object")
    required = EVIDENCE_METADATA_RULES[evidence_type]
    missing = sorted(
        key for key in required
        if not isinstance(metadata.get(key), str) or not metadata[key].strip()
    )
    if missing:
        raise GateError(
            f"manual evidence {identifier} lacks required {evidence_type} metadata: {', '.join(missing)}"
        )
    if evidence_type == "deployment_record" and metadata["deployedSha"] != rc_sha:
        raise GateError(f"manual evidence {identifier} deployment metadata is bound to the wrong RC SHA")
    if evidence_type in {"database_verification", "uat_record"} and metadata.get("verificationResult", metadata.get("result")) != "PASS":
        raise GateError(f"manual evidence {identifier} must record a PASS verification result")
    return metadata


def validate_manual_pass(
    item: dict[str, Any],
    definition: dict[str, Any],
    rc_sha: str,
    repo: pathlib.Path,
) -> dict[str, Any]:
    identifier = definition["id"]
    required = {
        "id",
        "result",
        "rcSha",
        "executor",
        "executedAtUtc",
        "evidenceType",
        "evidenceRef",
        "evidenceSha256",
    }
    missing = sorted(required - set(item))
    if missing:
        raise GateError(f"manual evidence {identifier} is missing required attestation fields: {', '.join(missing)}")
    if item.get("rcSha") != rc_sha:
        raise GateError(f"manual evidence {identifier} is bound to the wrong RC SHA")
    executor = item.get("executor")
    if not isinstance(executor, str) or not executor.strip() or len(executor) > 200:
        raise GateError(f"manual evidence {identifier} requires an executor identity")
    evidence_type = item.get("evidenceType")
    if evidence_type not in MANUAL_EVIDENCE_TYPES:
        raise GateError(f"manual evidence {identifier} has an unsupported evidence type")
    evidence_ref = item.get("evidenceRef")
    if not isinstance(evidence_ref, str) or not evidence_ref.strip() or len(evidence_ref) > 2048:
        raise GateError(f"manual evidence {identifier} requires an evidence reference")
    if redact(evidence_ref) != evidence_ref:
        raise GateError(f"manual evidence {identifier} reference contains secret-like material")
    digest = item.get("evidenceSha256")
    if not isinstance(digest, str) or not SHA256_RE.fullmatch(digest):
        raise GateError(f"manual evidence {identifier} requires a lowercase SHA-256 provenance digest")
    timestamp = parse_attestation_timestamp(item.get("executedAtUtc"), identifier)
    metadata = validate_evidence_metadata(evidence_type, item.get("metadata"), rc_sha, identifier)
    evidence_ref, digest = verify_artifact(repo, rc_sha, evidence_ref.strip(), digest, f"manual evidence {identifier}")
    validate_manual_evidence_receipt(repo, rc_sha, item, evidence_ref, timestamp, metadata)
    return {
        "id": identifier,
        "classification": "manual",
        "result": "MANUAL_PASS",
        "rcSha": rc_sha,
        "executor": executor.strip(),
        "executedAtUtc": timestamp,
        "evidenceType": evidence_type,
        "evidenceRef": evidence_ref.strip(),
        "evidenceSha256": digest,
        "evidenceRefs": [evidence_ref.strip()],
        "metadata": metadata,
    }


def load_manual_evidence(
    path: pathlib.Path | None,
    definitions: list[dict[str, Any]],
    rc_sha: str,
    repo: pathlib.Path,
) -> list[dict[str, Any]]:
    supplied: dict[str, Any] = {}
    if path:
        document = load_json(path)
        unknown_document_fields = sorted(set(document) - {"schemaVersion", "rcSha", "items"})
        if unknown_document_fields:
            raise GateError(f"manual evidence document has unknown fields: {', '.join(unknown_document_fields)}")
        if document.get("schemaVersion") != 1:
            raise GateError("manual evidence schemaVersion must be 1")
        if document.get("rcSha") != rc_sha:
            raise GateError("manual evidence is bound to the wrong RC SHA")
        items = document.get("items", [])
        if not isinstance(items, list) or not all(isinstance(item, dict) for item in items):
            raise GateError("manual evidence items must be an array of objects")
        allowed_item_fields = {
            "id",
            "result",
            "rcSha",
            "executor",
            "executedAtUtc",
            "evidenceType",
            "evidenceRef",
            "evidenceSha256",
            "metadata",
        }
        for item in items:
            unknown_item_fields = sorted(set(item) - allowed_item_fields)
            if unknown_item_fields:
                raise GateError(
                    f"manual evidence {item.get('id', '<missing>')} has unknown fields: {', '.join(unknown_item_fields)}"
                )
        assert_unique("manual evidence", [item.get("id", "") for item in items])
        supplied = {item.get("id", ""): item for item in items}
    result = []
    for definition in definitions:
        item = supplied.get(definition["id"])
        if not item:
            result.append({
                "id": definition["id"],
                "classification": "manual",
                "result": "MANUAL_EVIDENCE_REQUIRED",
                "evidenceRefs": [],
            })
            continue
        if item.get("result") == "AUTOMATED_PASS":
            raise GateError(f"manual-required item {definition['id']} cannot become AUTOMATED_PASS")
        if item.get("result") in {"MANUAL_EVIDENCE_REQUIRED", "NOT_RUN"}:
            if item.get("rcSha") not in {None, rc_sha}:
                raise GateError(f"manual evidence {definition['id']} is bound to the wrong RC SHA")
            result.append({
                "id": definition["id"],
                "classification": "manual",
                "result": "MANUAL_EVIDENCE_REQUIRED",
                "evidenceRefs": [],
            })
            continue
        if item.get("result") != "MANUAL_PASS":
            raise GateError(f"manual evidence {definition['id']} has an unsupported result")
        result.append(validate_manual_pass(item, definition, rc_sha, repo))
    unknown = sorted(set(supplied) - {item["id"] for item in definitions})
    if unknown:
        raise GateError(f"unknown manual evidence IDs: {', '.join(unknown)}")
    return result


def validate_ready_source_artifacts(repo: pathlib.Path, rc_sha: str, packet: dict[str, Any]) -> None:
    for item in packet.get("manualEvidence", []):
        if item.get("result") != "MANUAL_PASS":
            raise GateError("owner decision source contains unresolved manual evidence")
        validate_manual_pass(item, {"id": item.get("id")}, rc_sha, repo)
    for section in packet.get("inventory", {}).values():
        for item in section:
            refs = item.get("evidenceRefs", [])
            if item.get("result") != "MANUAL_PASS" or len(refs) != 1:
                raise GateError("owner decision source contains unresolved identity evidence")
            verify_artifact(
                repo,
                rc_sha,
                refs[0],
                item.get("evidenceSha256"),
                f"identity {item.get('id', '<missing>')}",
            )


def apply_owner_decision(
    repo: pathlib.Path,
    rc_sha: str,
    decision_path: pathlib.Path,
    manifest: dict[str, Any],
    inventory: dict[str, Any],
) -> dict[str, Any]:
    try:
        decision_ref = decision_path.resolve(strict=True).relative_to(repo.resolve()).as_posix()
    except (FileNotFoundError, ValueError) as error:
        raise GateError("owner decision document must be inside the approved evidence boundary") from error
    decision_file = resolve_approved_artifact(repo, rc_sha, decision_ref)
    document = load_json(decision_file)
    required = {
        "schemaVersion",
        "rcSha",
        "decision",
        "executor",
        "decidedAtUtc",
        "readyEvidenceRef",
        "readyEvidenceSha256",
        "evidenceRef",
        "evidenceSha256",
        "metadata",
    }
    if set(document) != required:
        raise GateError("owner decision document has missing or unknown fields")
    if document.get("schemaVersion") != 1 or document.get("rcSha") != rc_sha:
        raise GateError("owner decision is bound to the wrong RC SHA")
    decision = document.get("decision")
    if decision not in {"GO", "NO_GO"}:
        raise GateError("owner decision must be exactly GO or NO_GO")
    executor = document.get("executor")
    if not isinstance(executor, str) or not executor.strip():
        raise GateError("owner decision requires an executor identity")
    decided_at = parse_attestation_timestamp(document.get("decidedAtUtc"), "owner decision")
    metadata = document.get("metadata")
    if not isinstance(metadata, dict):
        raise GateError("owner decision metadata must be an object")
    missing_metadata = sorted(
        key for key in {"decisionAuthority", "rationaleCode"}
        if not isinstance(metadata.get(key), str) or not metadata[key].strip()
    )
    if missing_metadata:
        raise GateError(f"owner decision lacks required metadata: {', '.join(missing_metadata)}")
    ready_ref, ready_digest = verify_artifact(
        repo,
        rc_sha,
        document.get("readyEvidenceRef"),
        document.get("readyEvidenceSha256"),
        "owner decision READY evidence",
    )
    evidence_ref, evidence_digest = verify_artifact(
        repo,
        rc_sha,
        document.get("evidenceRef"),
        document.get("evidenceSha256"),
        "owner decision supporting evidence",
    )
    ready_packet = load_json(repo.joinpath(*pathlib.PurePosixPath(ready_ref).parts))
    ready_generated_at = parse_attestation_timestamp(
        ready_packet.get("generatedAtUtc"), "owner decision READY packet"
    )
    if dt.datetime.fromisoformat(decided_at) < dt.datetime.fromisoformat(ready_generated_at):
        raise GateError("owner decision predates the READY_FOR_OWNER_GO_NO_GO transition")
    if (
        ready_packet.get("rcSha") != rc_sha
        or ready_packet.get("expectedRcSha") != rc_sha
        or ready_packet.get("lane") != "full"
        or ready_packet.get("mode") != "final"
        or ready_packet.get("finalGoStatus") != "READY_FOR_OWNER_GO_NO_GO"
        or ready_packet.get("postflightClean") is not True
        or not ready_packet.get("readinessConditions")
        or not all(ready_packet["readinessConditions"].values())
    ):
        raise GateError("owner decision requires a complete READY_FOR_OWNER_GO_NO_GO source packet")
    validate_packet(ready_packet, inventory, manifest["manualGates"], manifest)
    validate_ready_source_artifacts(repo, rc_sha, ready_packet)
    return {
        "schemaVersion": 1,
        "rcSha": rc_sha,
        "generatedAtUtc": dt.datetime.now(dt.timezone.utc).isoformat(),
        "sourceReadyEvidenceRef": ready_ref,
        "sourceReadyEvidenceSha256": ready_digest,
        "ownerDecisionDocumentRef": decision_ref,
        "ownerDecisionDocumentSha256": sha256_file(decision_file),
        "ownerDecision": {
            "decision": decision,
            "executor": executor.strip(),
            "decidedAtUtc": decided_at,
            "evidenceRef": evidence_ref,
            "evidenceSha256": evidence_digest,
            "metadata": metadata,
        },
        "finalGoStatus": decision,
    }


def create_run_directory(
    repo: pathlib.Path,
    requested_root: str,
    rc_sha: str,
    run_id: str,
) -> pathlib.Path:
    if not SAFE_RUN_ID_RE.fullmatch(run_id) or ".." in run_id:
        raise GateError("run ID must use only lowercase letters, digits, dots, underscores or hyphens")
    approved_root = repo / "artifacts" / "final-rc"
    requested = pathlib.Path(requested_root)
    if not requested.is_absolute():
        requested = repo / requested
    if requested.resolve() != approved_root.resolve():
        raise GateError("evidence output must be the approved artifacts/final-rc root")
    for candidate in (repo / "artifacts", approved_root):
        if candidate.exists() and candidate.is_symlink():
            raise GateError("evidence output must not traverse a symlink")
    approved_root.mkdir(parents=True, exist_ok=True)
    sha_dir = approved_root / rc_sha
    if sha_dir.exists() and sha_dir.is_symlink():
        raise GateError("RC SHA evidence directory must not be a symlink")
    sha_dir.mkdir(exist_ok=True)
    run_dir = sha_dir / run_id
    try:
        run_dir.mkdir(exist_ok=False)
    except FileExistsError as error:
        raise GateError(f"evidence run already exists and will not be overwritten: {run_id}") from error
    if run_dir.resolve().parent != sha_dir.resolve():
        raise GateError("evidence run escaped the approved SHA directory")
    return run_dir


def mandatory_full_gate_ids(manifest: dict[str, Any]) -> list[str]:
    return [
        gate["id"]
        for gate in manifest["automatedGates"]
        if gate.get("mandatory", True) and "full" in gate["lanes"]
    ]


def readiness_conditions(packet: dict[str, Any], manifest: dict[str, Any]) -> dict[str, bool]:
    required_ids = mandatory_full_gate_ids(manifest)
    observed_ids = [gate["id"] for gate in packet["gates"]]
    return {
        "finalModeSelected": packet.get("mode") == "final",
        "fullLaneSelected": packet.get("lane") == "full",
        "allMandatoryAutomatedExecuted": observed_ids == required_ids,
        "allMandatoryAutomatedPassed": bool(required_ids) and all(
            gate["result"] == "AUTOMATED_PASS" for gate in packet["gates"]
        ),
        "allRatifiedIdentitiesEvidenced": all(
            row["result"] == "MANUAL_PASS"
            for section in packet["inventory"].values()
            for row in section
        ),
        "allReliabilityCategoriesResolved": all(
            category["result"] == "MANUAL_PASS" for category in packet["reliabilityCategories"]
        ),
        "allManualEvidenceValid": all(
            row["result"] == "MANUAL_PASS" for row in packet["manualEvidence"]
        ),
        "exactShaBound": packet.get("rcSha") == packet.get("expectedRcSha"),
        "postflightClean": packet.get("postflightClean") is True,
    }


def validate_packet(
    packet: dict[str, Any],
    inventory: dict[str, Any],
    manual_definitions: list[dict[str, Any]],
    manifest: dict[str, Any],
) -> None:
    if packet.get("rcSha") != packet.get("expectedRcSha"):
        raise GateError("evidence packet is bound to the wrong RC SHA")
    expected = {
        "scenarios": [item["id"] for item in inventory["scenarios"]],
        "criteria": inventory["criteria"],
        "publicErrors": inventory["publicErrors"],
    }
    for section, identifiers in expected.items():
        rows = packet["inventory"][section]
        row_ids = [row["id"] for row in rows]
        assert_unique(section, row_ids)
        missing = sorted(set(identifiers) - set(row_ids))
        extra = sorted(set(row_ids) - set(identifiers))
        if missing or extra:
            raise GateError(f"{section} evidence mismatch; missing={missing}, extra={extra}")
        for row in rows:
            if row["result"] not in RESULTS:
                raise GateError(f"invalid result {row['result']} for {row['id']}")
            if row["result"] == "MANUAL_PASS" and (
                len(row.get("evidenceRefs", [])) != 1
                or not SHA256_RE.fullmatch(str(row.get("evidenceSha256", "")))
            ):
                raise GateError(f"{row['id']} is marked passed without an evidence reference")
    manual_rows = packet["manualEvidence"]
    assert_unique("manual gate", [row["id"] for row in manual_rows])
    if {row["id"] for row in manual_rows} != {row["id"] for row in manual_definitions}:
        raise GateError("manual evidence inventory is incomplete or contains unknown items")
    for row in manual_rows:
        if row["result"] not in RESULTS:
            raise GateError(f"invalid manual result {row['result']} for {row['id']}")
        if row["classification"] != "manual" or row["result"] == "AUTOMATED_PASS":
            raise GateError(f"manual-required item {row['id']} cannot become automatic PASS")
    expected_conditions = readiness_conditions(packet, manifest)
    if packet.get("readinessConditions") != expected_conditions:
        raise GateError("final readiness condition evidence is inconsistent")
    expected_status = "READY_FOR_OWNER_GO_NO_GO" if all(expected_conditions.values()) else "NOT_READY"
    if packet.get("finalGoStatus") != expected_status:
        raise GateError("final GO/NO-GO status does not match fail-closed readiness conditions")


def human_summary(packet: dict[str, Any]) -> str:
    lines = [
        "# Final RC Evidence Summary",
        "",
        f"- RC SHA: `{packet['rcSha']}`",
        f"- Generated UTC: `{packet['generatedAtUtc']}`",
        f"- Automated result: **{packet['automatedResult']}**",
        f"- Final GO status: **{packet['finalGoStatus']}**",
        f"- Lane: `{packet['lane']}`",
        f"- Mode: `{packet['mode']}`",
        f"- Run ID: `{packet['runId']}`",
        "",
        "## Automated gates",
        "",
        "| Gate | Result | Exit | Passed | Failed | Skipped | Evidence |",
        "|---|---|---:|---:|---:|---:|---|",
    ]
    for gate in packet["gates"]:
        counts = gate["counts"]
        lines.append(
            f"| `{gate['id']}` | {gate['result']} | {gate['exitCode']} | "
            f"{counts['passed'] if counts['passed'] is not None else '-'} | "
            f"{counts['failed'] if counts['failed'] is not None else '-'} | "
            f"{counts['skipped'] if counts['skipped'] is not None else '-'} | "
            f"`{gate['evidenceRef']}` |"
        )
    lines.extend(["", "## Readiness conditions", "", "| Condition | Satisfied |", "|---|---|"])
    for condition, satisfied in packet["readinessConditions"].items():
        lines.append(f"| `{condition}` | {'YES' if satisfied else 'NO'} |")
    lines.extend(["", "## #99 evidence categories", "", "| Category | Result | Automated gates | Manual gates |", "|---|---|---|---|"])
    for category in packet["reliabilityCategories"]:
        lines.append(
            f"| `{category['id']}` | {category['result']} | "
            f"{', '.join(f'`{item}`' for item in category['automatedGateIds'])} | "
            f"{', '.join(f'`{item}`' for item in category['manualGateIds'])} |"
        )
    lines.extend([
        "",
        "## Manual and external evidence",
        "",
        "| Gate | Result | Executor | Type | Evidence | SHA-256 |",
        "|---|---|---|---|---|---|",
    ])
    for item in packet["manualEvidence"]:
        refs = ", ".join(f"`{ref}`" for ref in item["evidenceRefs"]) or "-"
        digest = item.get("evidenceSha256", "-")
        lines.append(
            f"| `{item['id']}` | {item['result']} | {item.get('executor', '-')} | "
            f"{item.get('evidenceType', '-')} | {refs} | `{digest}` |"
        )
    return "\n".join(lines) + "\n"


def run(args: argparse.Namespace) -> int:
    repo = pathlib.Path(args.repo_root).resolve()
    head = assert_preflight(repo, args.expected_sha)
    manifest_path = pathlib.Path(args.manifest) if args.manifest else repo / "release-gates/final-rc/gates.json"
    catalog_path = pathlib.Path(args.catalog) if args.catalog else repo / "release-gates/final-rc/ratified-identities.json"
    if args.lane != "synthetic" and (args.manifest or args.catalog):
        raise GateError("full and hosted lanes must use the checked-in manifest and ratified identity catalog")
    manifest = load_json(manifest_path)
    catalog = load_ratified_catalog(catalog_path, enforce_reviewed_baseline=args.lane != "synthetic")
    inventory = canonical_inventory(repo, manifest, catalog)
    owner_decision_path = getattr(args, "owner_decision", None)
    if args.mode == "owner-decision":
        if args.lane != "full" or not owner_decision_path:
            raise GateError("owner-decision mode requires lane=full and --owner-decision")
        evidence_dir = create_run_directory(repo, args.evidence_root, head, args.run_id)
        decision_packet = apply_owner_decision(
            repo,
            head,
            pathlib.Path(owner_decision_path).resolve(),
            manifest,
            inventory,
        )
        decision_packet["runId"] = args.run_id
        packet_path = evidence_dir / "owner-decision.json"
        write_json_exclusive(packet_path, decision_packet, configured_secret_values(os.environ))
        print(f"Owner decision: {decision_packet['finalGoStatus']}")
        print(f"Owner decision evidence: {packet_path}")
        return 0
    if owner_decision_path:
        raise GateError("owner decision evidence is accepted only by the distinct owner-decision transition")
    evidence_dir = create_run_directory(repo, args.evidence_root, head, args.run_id)
    secret_values = configured_secret_values(os.environ)
    selected = [gate for gate in manifest["automatedGates"] if args.lane in gate["lanes"]]
    gate_rows: list[dict[str, Any]] = []
    gate_results: dict[str, dict[str, Any]] = {}
    for gate in selected:
        result = run_gate(repo, gate, evidence_dir, secret_values, head)
        gate_rows.append(result)
        gate_results[gate["id"]] = result
        if result["result"] != "AUTOMATED_PASS":
            break
    manual = load_manual_evidence(
        pathlib.Path(args.manual_evidence).resolve() if args.manual_evidence else None,
        manifest["manualGates"],
        head,
        repo,
    )
    inventory_evidence, identity_index = load_identity_evidence(
        pathlib.Path(getattr(args, "identity_evidence_index", "")).resolve()
        if getattr(args, "identity_evidence_index", None)
        else None,
        repo,
        head,
        inventory,
    )
    automated_pass = len(gate_rows) == len(selected) and all(row["result"] == "AUTOMATED_PASS" for row in gate_rows)
    manual_by_id = {row["id"]: row for row in manual}
    categories = []
    for category_id, mapping in manifest["reliabilityCategories"].items():
        category_automated = all(
            gate_id in gate_results and gate_results[gate_id]["result"] == "AUTOMATED_PASS"
            for gate_id in mapping["automatedGateIds"]
        )
        category_manual = all(manual_by_id[gate_id]["result"] == "MANUAL_PASS" for gate_id in mapping["manualGateIds"])
        categories.append({
            "id": category_id,
            "result": "MANUAL_PASS" if category_automated and category_manual else (
                "MANUAL_EVIDENCE_REQUIRED" if category_automated else "NOT_RUN"
            ),
            "automatedGateIds": mapping["automatedGateIds"],
            "manualGateIds": mapping["manualGateIds"],
        })
    postflight_clean = True
    try:
        assert_repository_clean(repo, head, "final postflight")
    except GateError:
        postflight_clean = False
    packet = {
        "schemaVersion": 3,
        "rcSha": head,
        "expectedRcSha": args.expected_sha,
        "generatedAtUtc": dt.datetime.now(dt.timezone.utc).isoformat(),
        "runId": args.run_id,
        "lane": args.lane,
        "mode": args.mode,
        "automatedResult": "AUTOMATED_PASS" if automated_pass else "AUTOMATED_FAIL",
        "finalGoStatus": "NOT_READY",
        "postflightClean": postflight_clean,
        "gates": gate_rows,
        "manualEvidence": manual,
        "reliabilityCategories": categories,
        "inventory": inventory_evidence,
        "identityEvidenceIndex": identity_index,
        "catalogCounts": RATIFIED_CATALOG_COUNTS,
        "mandatoryFullGateIds": mandatory_full_gate_ids(manifest),
        "statusVocabulary": sorted(RESULTS),
    }
    packet["readinessConditions"] = readiness_conditions(packet, manifest)
    if all(packet["readinessConditions"].values()):
        packet["finalGoStatus"] = "READY_FOR_OWNER_GO_NO_GO"
    validate_packet(packet, inventory, manifest["manualGates"], manifest)
    packet_path = evidence_dir / "evidence.json"
    summary_path = evidence_dir / "summary.md"
    write_json_exclusive(packet_path, packet, secret_values)
    redacted_packet = redact_value(packet, secret_values)
    summary = human_summary(redacted_packet)
    with summary_path.open("x", encoding="utf-8") as handle:
        handle.write(summary)
    print("\n" + summary)
    print(f"Machine-readable evidence: {packet_path}")
    print(f"Human-readable summary: {summary_path}")
    if not automated_pass:
        return 1
    if args.mode == "final" and packet["finalGoStatus"] != "READY_FOR_OWNER_GO_NO_GO":
        print("FINAL-RC refused: full-lane, identity, #99 or manual evidence remains unresolved.", file=sys.stderr)
        return 2
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo-root", default=".")
    parser.add_argument("--manifest")
    parser.add_argument("--catalog")
    parser.add_argument("--expected-sha", required=True)
    parser.add_argument("--evidence-root", default="artifacts/final-rc")
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--manual-evidence")
    parser.add_argument("--identity-evidence-index")
    parser.add_argument("--owner-decision")
    parser.add_argument("--lane", choices=("full", "hosted", "synthetic"), default="full")
    parser.add_argument("--mode", choices=("automated", "final", "owner-decision"), default="final")
    try:
        return run(parser.parse_args())
    except (GateError, OSError, json.JSONDecodeError, KeyError, ValueError) as error:
        print(f"FINAL-RC validation error: {redact(str(error))}", file=sys.stderr)
        return 64


if __name__ == "__main__":
    raise SystemExit(main())
