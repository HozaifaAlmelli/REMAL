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
SECRET_PATTERNS = (
    re.compile(r"(?i)(password|pwd|token|jwt|secret)\s*[=:]\s*[^;\s]+"),
    re.compile(r"(?i)(Password|Pwd)=[^;\s]+"),
    re.compile(r"(?i)Bearer\s+[A-Za-z0-9._~+/=-]+"),
)
SCENARIO_RE = re.compile(r"^####\s+(SC-[A-Z]+-\d{2})\b", re.MULTILINE)
CRITERION_RE = re.compile(r"^\|\s*((?:NAC|AC)-HB\d+[A-Z]?-\d{2})\s*\|", re.MULTILINE)


class GateError(RuntimeError):
    pass


def load_json(path: pathlib.Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path: pathlib.Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def redact(value: str, secret_values: list[str] | None = None) -> str:
    result = value
    for secret in secret_values or []:
        if len(secret) >= 8:
            result = result.replace(secret, "[REDACTED]")
    for pattern in SECRET_PATTERNS:
        result = pattern.sub(lambda match: f"{match.group(1)}=[REDACTED]" if match.lastindex else "[REDACTED]", result)
    return result


def git(repo: pathlib.Path, *args: str) -> str:
    completed = subprocess.run(
        ["git", *args], cwd=repo, text=True, capture_output=True, check=False
    )
    if completed.returncode:
        raise GateError(redact(completed.stderr.strip() or completed.stdout.strip()))
    return completed.stdout.strip()


def assert_preflight(repo: pathlib.Path, expected_sha: str) -> str:
    if not re.fullmatch(r"[0-9a-f]{40}", expected_sha):
        raise GateError("expected RC SHA must be a full lowercase 40-character commit SHA")
    head = git(repo, "rev-parse", "HEAD")
    if head != expected_sha:
        raise GateError(f"HEAD mismatch: expected {expected_sha}, found {head}")
    if git(repo, "diff", "--name-only") or git(repo, "diff", "--cached", "--name-only"):
        raise GateError("tracked working tree or index is dirty")
    return head


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


def canonical_inventory(repo: pathlib.Path, manifest: dict[str, Any]) -> dict[str, Any]:
    sources = manifest["canonicalSources"]
    scenarios = parse_scenarios(repo / sources["scenarios"])
    criteria = parse_criteria(repo / sources["ticketDirectory"])
    errors = parse_errors(repo / sources["masterContract"])
    automated_gate_ids = [item["id"] for item in manifest["automatedGates"]]
    manual_gate_ids = [item["id"] for item in manifest["manualGates"]]
    assert_unique("automated gate", automated_gate_ids)
    assert_unique("manual gate", manual_gate_ids)
    automated_ids = set(automated_gate_ids)
    manual_ids = set(manual_gate_ids)
    group_mapping = manifest["scenarioGroupEvidence"]
    missing_groups = sorted({item["group"] for item in scenarios} - set(group_mapping))
    if missing_groups:
        raise GateError(f"scenario groups lack evidence mapping: {', '.join(missing_groups)}")
    for group, gate_ids in group_mapping.items():
        unknown = sorted(set(gate_ids) - automated_ids)
        if unknown:
            raise GateError(f"scenario group {group} references unknown automated gates: {', '.join(unknown)}")
    ticket_mapping = manifest["ticketEvidence"]
    missing_tickets = sorted(
        {re.match(r"(?:NAC|AC)-(HB\d+[A-Z]?)-", item).group(1) for item in criteria}
        - set(ticket_mapping)
    )
    if missing_tickets:
        raise GateError(f"AC/NAC tickets lack evidence mapping: {', '.join(missing_tickets)}")
    for ticket, gate_ids in ticket_mapping.items():
        unknown = sorted(set(gate_ids) - automated_ids)
        if unknown:
            raise GateError(f"ticket {ticket} references unknown automated gates: {', '.join(unknown)}")
    if errors and not manifest.get("publicErrorEvidence"):
        raise GateError("public error contracts lack evidence mapping")
    unknown_error_gates = sorted(set(manifest["publicErrorEvidence"]) - automated_ids)
    if unknown_error_gates:
        raise GateError(f"public error contracts reference unknown gates: {', '.join(unknown_error_gates)}")
    missing_categories = sorted(REQUIRED_RELIABILITY_CATEGORIES - set(manifest["reliabilityCategories"]))
    if missing_categories:
        raise GateError(f"#99 evidence categories are missing: {', '.join(missing_categories)}")
    for category, mapping in manifest["reliabilityCategories"].items():
        unknown_automated = sorted(set(mapping["automatedGateIds"]) - automated_ids)
        unknown_manual = sorted(set(mapping["manualGateIds"]) - manual_ids)
        if unknown_automated or unknown_manual:
            raise GateError(
                f"#99 category {category} has unknown gates; automated={unknown_automated}, manual={unknown_manual}"
            )
    return {"scenarios": scenarios, "criteria": criteria, "publicErrors": errors}


def parse_counts(output: str) -> dict[str, int | None]:
    patterns = (
        re.compile(r"Failed:\s*(\d+),\s*Passed:\s*(\d+),\s*Skipped:\s*(\d+),\s*Total:\s*(\d+)", re.I),
        re.compile(
            r"(?:#|ℹ)\s*tests\s+(\d+).*?(?:#|ℹ)\s*pass\s+(\d+).*?"
            r"(?:#|ℹ)\s*fail\s+(\d+).*?(?:#|ℹ)\s*skipped\s+(\d+)",
            re.I | re.S,
        ),
    )
    first = patterns[0].search(output)
    if first:
        return {"failed": int(first.group(1)), "passed": int(first.group(2)), "skipped": int(first.group(3)), "total": int(first.group(4))}
    second = patterns[1].search(output)
    if second:
        return {"total": int(second.group(1)), "passed": int(second.group(2)), "failed": int(second.group(3)), "skipped": int(second.group(4))}
    unittest_total = re.search(r"^Ran\s+(\d+)\s+tests?\s+in\s+[^\n]+$", output, re.MULTILINE)
    unittest_result = re.search(r"^OK(?:\s+\([^\n]*skipped=(\d+)[^\n]*\))?\s*$", output, re.MULTILINE)
    if unittest_total and unittest_result:
        total = int(unittest_total.group(1))
        skipped = int(unittest_result.group(1) or 0)
        return {"total": total, "passed": total - skipped, "failed": 0, "skipped": skipped}
    passed = sum(int(value) for value in re.findall(r"(?:^|\s)(\d+) passed(?:\s|$)", output, re.M))
    failed = sum(int(value) for value in re.findall(r"(?:^|\s)(\d+) failed(?:\s|$)", output, re.M))
    skipped = sum(int(value) for value in re.findall(r"(?:^|\s)(\d+) skipped(?:\s|$)", output, re.M))
    if passed or failed or skipped:
        return {"passed": passed, "failed": failed, "skipped": skipped, "total": passed + failed + skipped}
    return {"passed": None, "failed": None, "skipped": None, "total": None}


def run_gate(
    repo: pathlib.Path,
    gate: dict[str, Any],
    evidence_dir: pathlib.Path,
    secret_values: list[str],
) -> dict[str, Any]:
    gate_id = gate["id"]
    log_path = evidence_dir / "logs" / f"{gate_id}.log"
    log_path.parent.mkdir(parents=True, exist_ok=True)
    environment = os.environ.copy()
    environment.setdefault("PYTHONIOENCODING", "utf-8")
    environment.update(gate.get("environment", {}))
    command = [sys.executable if value == "{python}" else value for value in gate["command"]]
    if os.name == "nt" and command:
        command[0] = shutil.which(command[0]) or command[0]
    display = " ".join(command)
    started = dt.datetime.now(dt.timezone.utc)
    print(f"\n=== FINAL-RC GATE {gate_id}: {display} ===", flush=True)
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
    with log_path.open("w", encoding="utf-8") as log:
        for raw_line in process.stdout:
            line = redact(raw_line, secret_values)
            captured.append(line)
            log.write(line)
            print(line, end="", flush=True)
    exit_code = process.wait()
    process.stdout.close()
    output = "".join(captured)
    counts = parse_counts(output)
    unexplained_skip = bool(counts["skipped"] and counts["skipped"] > 0)
    missing_tests = bool(gate.get("requiresTests") and not counts["total"])
    passed = exit_code == 0 and not unexplained_skip and not missing_tests
    return {
        "id": gate_id,
        "classification": "automated",
        "result": "AUTOMATED_PASS" if passed else "AUTOMATED_FAIL",
        "exitCode": exit_code,
        "command": redact(display, secret_values),
        "startedAtUtc": started.isoformat(),
        "completedAtUtc": dt.datetime.now(dt.timezone.utc).isoformat(),
        "counts": counts,
        "evidenceRef": str(log_path.relative_to(evidence_dir)).replace("\\", "/"),
        "unexplainedSkipped": unexplained_skip,
        "requiredTestsMissing": missing_tests,
    }


def evidence_item(identifier: str, gate_ids: list[str], gate_results: dict[str, dict[str, Any]]) -> dict[str, Any]:
    evidence = [gate_results[gate_id]["evidenceRef"] for gate_id in gate_ids if gate_id in gate_results]
    passed = bool(gate_ids) and all(
        gate_id in gate_results and gate_results[gate_id]["result"] == "AUTOMATED_PASS"
        for gate_id in gate_ids
    )
    return {
        "id": identifier,
        "classification": "automated",
        "result": "AUTOMATED_PASS" if passed else "NOT_RUN",
        "evidenceRefs": evidence,
    }


def build_inventory_evidence(
    inventory: dict[str, Any],
    manifest: dict[str, Any],
    gate_results: dict[str, dict[str, Any]],
    manual_evidence: list[dict[str, Any]],
) -> dict[str, list[dict[str, Any]]]:
    scenarios = []
    manual_by_id = {item["id"]: item for item in manual_evidence}
    for scenario in inventory["scenarios"]:
        if scenario["automate"] == "NO":
            manual = manual_by_id["reliability_99_completion"]
            scenarios.append({
                "id": scenario["id"],
                "classification": "manual",
                "result": manual["result"],
                "evidenceRefs": manual["evidenceRefs"],
            })
            continue
        mapping = manifest["scenarioGroupEvidence"][scenario["group"]]
        scenarios.append(evidence_item(scenario["id"], mapping, gate_results))
    criteria = []
    for criterion in inventory["criteria"]:
        ticket = re.match(r"(?:NAC|AC)-(HB\d+[A-Z]?)-", criterion).group(1)
        criteria.append(evidence_item(criterion, manifest["ticketEvidence"][ticket], gate_results))
    errors = [
        evidence_item(code, manifest["publicErrorEvidence"], gate_results)
        for code in inventory["publicErrors"]
    ]
    return {"scenarios": scenarios, "criteria": criteria, "publicErrors": errors}


def load_manual_evidence(path: pathlib.Path | None, definitions: list[dict[str, Any]], rc_sha: str) -> list[dict[str, Any]]:
    supplied: dict[str, Any] = {}
    if path:
        document = load_json(path)
        if document.get("rcSha") != rc_sha:
            raise GateError("manual evidence is bound to the wrong RC SHA")
        items = document.get("items", [])
        assert_unique("manual evidence", [item.get("id", "") for item in items])
        supplied = {item["id"]: item for item in items}
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
            result.append({
                "id": definition["id"],
                "classification": "manual",
                "result": "MANUAL_EVIDENCE_REQUIRED",
                "evidenceRefs": [],
            })
            continue
        if item.get("result") != "MANUAL_PASS" or not item.get("evidenceRefs"):
            raise GateError(f"manual evidence {definition['id']} requires MANUAL_PASS and an evidence reference")
        result.append({
            "id": definition["id"],
            "classification": "manual",
            "result": "MANUAL_PASS",
            "evidenceRefs": item["evidenceRefs"],
        })
    unknown = sorted(set(supplied) - {item["id"] for item in definitions})
    if unknown:
        raise GateError(f"unknown manual evidence IDs: {', '.join(unknown)}")
    return result


def validate_packet(packet: dict[str, Any], inventory: dict[str, Any], manual_definitions: list[dict[str, Any]]) -> None:
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
            if row["result"] == "AUTOMATED_PASS" and not row.get("evidenceRefs"):
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


def human_summary(packet: dict[str, Any]) -> str:
    lines = [
        "# Final RC Evidence Summary",
        "",
        f"- RC SHA: `{packet['rcSha']}`",
        f"- Generated UTC: `{packet['generatedAtUtc']}`",
        f"- Automated result: **{packet['automatedResult']}**",
        f"- Final GO status: **{packet['finalGoStatus']}**",
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
    lines.extend(["", "## #99 evidence categories", "", "| Category | Result | Automated gates | Manual gates |", "|---|---|---|---|"])
    for category in packet["reliabilityCategories"]:
        lines.append(
            f"| `{category['id']}` | {category['result']} | "
            f"{', '.join(f'`{item}`' for item in category['automatedGateIds'])} | "
            f"{', '.join(f'`{item}`' for item in category['manualGateIds'])} |"
        )
    lines.extend(["", "## Manual and external evidence", "", "| Gate | Result | Evidence |", "|---|---|---|"])
    for item in packet["manualEvidence"]:
        refs = ", ".join(f"`{ref}`" for ref in item["evidenceRefs"]) or "-"
        lines.append(f"| `{item['id']}` | {item['result']} | {refs} |")
    return "\n".join(lines) + "\n"


def run(args: argparse.Namespace) -> int:
    repo = pathlib.Path(args.repo_root).resolve()
    manifest_path = pathlib.Path(args.manifest) if args.manifest else repo / "release-gates/final-rc/gates.json"
    manifest = load_json(manifest_path)
    head = assert_preflight(repo, args.expected_sha)
    inventory = canonical_inventory(repo, manifest)
    evidence_dir = pathlib.Path(args.evidence_dir).resolve()
    evidence_dir.mkdir(parents=True, exist_ok=True)
    secret_values = [value for key, value in os.environ.items() if re.search(r"PASSWORD|TOKEN|SECRET|JWT|_DB$", key, re.I)]
    selected = [gate for gate in manifest["automatedGates"] if args.lane in gate["lanes"]]
    gate_rows: list[dict[str, Any]] = []
    gate_results: dict[str, dict[str, Any]] = {}
    for gate in selected:
        result = run_gate(repo, gate, evidence_dir, secret_values)
        gate_rows.append(result)
        gate_results[gate["id"]] = result
        if result["result"] != "AUTOMATED_PASS":
            break
    manual = load_manual_evidence(
        pathlib.Path(args.manual_evidence).resolve() if args.manual_evidence else None,
        manifest["manualGates"],
        head,
    )
    inventory_evidence = build_inventory_evidence(inventory, manifest, gate_results, manual)
    automated_pass = len(gate_rows) == len(selected) and all(row["result"] == "AUTOMATED_PASS" for row in gate_rows)
    manual_pass = all(row["result"] == "MANUAL_PASS" for row in manual)
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
    packet = {
        "schemaVersion": 1,
        "rcSha": head,
        "expectedRcSha": args.expected_sha,
        "generatedAtUtc": dt.datetime.now(dt.timezone.utc).isoformat(),
        "lane": args.lane,
        "automatedResult": "AUTOMATED_PASS" if automated_pass else "AUTOMATED_FAIL",
        "finalGoStatus": "READY_FOR_OWNER_GO_NO_GO" if automated_pass and manual_pass else "NOT_READY",
        "gates": gate_rows,
        "manualEvidence": manual,
        "reliabilityCategories": categories,
        "inventory": inventory_evidence,
        "catalogCounts": {key: len(value) for key, value in inventory.items()},
        "statusVocabulary": sorted(RESULTS),
    }
    validate_packet(packet, inventory, manifest["manualGates"])
    packet_path = evidence_dir / "evidence.json"
    summary_path = evidence_dir / "summary.md"
    write_json(packet_path, packet)
    summary = redact(human_summary(packet), secret_values)
    summary_path.write_text(summary, encoding="utf-8")
    print("\n" + summary)
    print(f"Machine-readable evidence: {packet_path}")
    print(f"Human-readable summary: {summary_path}")
    if not automated_pass:
        return 1
    if args.mode == "final" and not manual_pass:
        print("FINAL-RC refused: mandatory manual/release-database evidence remains unresolved.", file=sys.stderr)
        return 2
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo-root", default=".")
    parser.add_argument("--manifest")
    parser.add_argument("--expected-sha", required=True)
    parser.add_argument("--evidence-dir", required=True)
    parser.add_argument("--manual-evidence")
    parser.add_argument("--lane", choices=("full", "hosted", "synthetic"), default="full")
    parser.add_argument("--mode", choices=("automated", "final"), default="final")
    try:
        return run(parser.parse_args())
    except (GateError, OSError, json.JSONDecodeError, KeyError, ValueError) as error:
        print(f"FINAL-RC validation error: {redact(str(error))}", file=sys.stderr)
        return 64


if __name__ == "__main__":
    raise SystemExit(main())
