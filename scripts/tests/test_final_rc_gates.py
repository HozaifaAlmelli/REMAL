#!/usr/bin/env python3
from __future__ import annotations

import datetime as dt
import hashlib
import json
import os
import pathlib
import subprocess
import sys
import tempfile
import types
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "lib"))

import final_rc_gates as gates


def command(*args: str, cwd: pathlib.Path) -> str:
    completed = subprocess.run(args, cwd=cwd, text=True, capture_output=True, check=True)
    return completed.stdout.strip()


class FinalRcGateTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.root = pathlib.Path(self.temp.name)
        self.repo_index = 0

    def tearDown(self) -> None:
        self.temp.cleanup()

    def make_repo(self) -> tuple[pathlib.Path, str]:
        self.repo_index += 1
        repo = self.root / f"repo-{self.repo_index}"
        docs = repo / "docs" / "plans" / "historical-bookings"
        docs.mkdir(parents=True)
        (docs / "00_MASTER_PLAN.md").write_text(
            "### 12.3 Error contract\n\n| Condition | Status | Code |\n|---|---|---|\n"
            "| Invalid | 400 | `SYNTHETIC_ERROR` |\n\n## 13. Next\n",
            encoding="utf-8",
        )
        (docs / "99_RELIABILITY_TEST_SCENARIOS.md").write_text(
            "#### SC-HAPPY-01 - Synthetic\n\n| | |\n|---|---|\n"
            "| **Priority · Category · Automate** | P0 · Happy · YES (unit) |\n",
            encoding="utf-8",
        )
        (docs / "01_TICKET.md").write_text(
            "| ID | Criterion |\n|---|---|\n| AC-HB01-01 | Required |\n| NAC-HB01-01 | Forbidden |\n",
            encoding="utf-8",
        )
        catalog_dir = repo / "release-gates" / "final-rc"
        catalog_dir.mkdir(parents=True)
        self.write_json(catalog_dir / "ratified-identities.json", self.catalog())
        (repo / ".gitignore").write_text("artifacts/\n", encoding="utf-8")
        command("git", "init", "-q", cwd=repo)
        command("git", "config", "user.email", "final-rc@example.invalid", cwd=repo)
        command("git", "config", "user.name", "Final RC Test", cwd=repo)
        command("git", "add", ".", cwd=repo)
        command("git", "commit", "-qm", "fixture", cwd=repo)
        return repo, command("git", "rev-parse", "HEAD", cwd=repo)

    @staticmethod
    def write_json(path: pathlib.Path, value: object) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")

    @staticmethod
    def catalog() -> dict:
        return {
            "schemaVersion": 1,
            "counts": {
                "scenarios": 1,
                "criteria": 2,
                "acceptanceCriteria": 1,
                "negativeAcceptanceCriteria": 1,
                "publicErrors": 1,
            },
            "scenarios": ["SC-HAPPY-01"],
            "criteria": ["AC-HB01-01", "NAC-HB01-01"],
            "publicErrors": ["SYNTHETIC_ERROR"],
        }

    @staticmethod
    def passing_command() -> list[str]:
        return [
            sys.executable,
            "-c",
            "print('FINAL_RC_PYTHON_TEST_RESULT total=1 passed=1 failures=0 errors=0 skipped=0 completion=complete')",
        ]

    @classmethod
    def manifest(cls, command_args: list[str] | None = None) -> dict:
        return {
            "schemaVersion": 1,
            "canonicalSources": {
                "masterContract": "docs/plans/historical-bookings/00_MASTER_PLAN.md",
                "scenarios": "docs/plans/historical-bookings/99_RELIABILITY_TEST_SCENARIOS.md",
                "ticketDirectory": "docs/plans/historical-bookings",
            },
            "identityEvidenceIndexRequired": True,
            "ownerDecision": {
                "id": "owner_go_no_go",
                "description": "Synthetic distinct owner decision",
            },
            "automatedGates": [{
                "id": "synthetic_gate",
                "lanes": ["full", "hosted", "synthetic"],
                "requiresTests": True,
                "testEvidence": {"type": "python-unittest"},
                "command": command_args or cls.passing_command(),
            }],
            "reliabilityCategories": {
                category: {
                    "automatedGateIds": ["synthetic_gate"],
                    "manualGateIds": ["reliability_99_completion"],
                }
                for category in gates.REQUIRED_RELIABILITY_CATEGORIES
            },
            "manualGates": [{
                "id": "reliability_99_completion",
                "sequence": 1,
                "description": "Synthetic manual gate",
            }],
        }

    def write_artifact(
        self,
        repo: pathlib.Path,
        sha: str,
        name: str,
        content: str = "verified evidence\n",
    ) -> tuple[str, str]:
        path = repo / "artifacts" / "final-rc" / sha / "manual" / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        return path.relative_to(repo).as_posix(), hashlib.sha256(path.read_bytes()).hexdigest()

    def valid_attestation(
        self,
        repo: pathlib.Path,
        identifier: str,
        sha: str,
        **overrides: object,
    ) -> dict:
        item = {
            "id": identifier,
            "result": "MANUAL_PASS",
            "rcSha": sha,
            "executor": "release-owner@example.invalid",
            "executedAtUtc": "2026-08-15T12:00:00+00:00",
            "evidenceType": "operator_attestation",
            "metadata": {"operatorRole": "release-reviewer", "attestedAction": "verified gate evidence"},
        }
        item.update(overrides)
        if "evidenceRef" not in overrides:
            receipt = {
                "schemaVersion": 1,
                "rcSha": item["rcSha"],
                "itemId": item["id"],
                "evidenceType": item["evidenceType"],
                "executor": item["executor"],
                "executedAtUtc": item["executedAtUtc"],
                "provenance": item["metadata"],
                "evidence": {"summary": "synthetic verified release evidence"},
            }
            evidence_ref, evidence_digest = self.write_artifact(
                repo,
                sha,
                f"{identifier}-{self.repo_index}.json",
                json.dumps(receipt, sort_keys=True) + "\n",
            )
            item["evidenceRef"] = evidence_ref
            if "evidenceSha256" not in overrides:
                item["evidenceSha256"] = evidence_digest
        return item

    def inventory(self, repo: pathlib.Path, manifest: dict) -> dict:
        catalog = gates.load_ratified_catalog(
            repo / "release-gates" / "final-rc" / "ratified-identities.json",
            enforce_reviewed_baseline=False,
        )
        return gates.canonical_inventory(repo, manifest, catalog)

    def write_identity_index(
        self,
        repo: pathlib.Path,
        sha: str,
        inventory: dict,
        missing_id: str | None = None,
        bad_digest_id: str | None = None,
    ) -> pathlib.Path:
        evidence_ref, evidence_digest = self.write_artifact(repo, sha, "identity-support.txt")
        identifiers = (
            [item["id"] for item in inventory["scenarios"]]
            + inventory["criteria"]
            + inventory["publicErrors"]
        )
        items = []
        for identifier in identifiers:
            if identifier == missing_id:
                continue
            items.append({
                "id": identifier,
                "evidenceRef": evidence_ref,
                "evidenceSha256": "0" * 64 if identifier == bad_digest_id else evidence_digest,
            })
        path = repo / "artifacts" / "final-rc" / sha / "manual" / "identity-index.json"
        self.write_json(path, {
            "schemaVersion": 1,
            "rcSha": sha,
            "executor": "release-reviewer@example.invalid",
            "generatedAtUtc": "2026-08-15T12:00:00+00:00",
            "items": items,
        })
        return path

    def test_wrong_rc_sha_is_refused(self) -> None:
        repo, _ = self.make_repo()
        with self.assertRaisesRegex(gates.GateError, "HEAD mismatch"):
            gates.assert_preflight(repo, "0" * 40)

    def test_dirty_tracked_tree_and_index_are_refused(self) -> None:
        repo, head = self.make_repo()
        path = repo / "docs" / "plans" / "historical-bookings" / "01_TICKET.md"
        path.write_text(path.read_text(encoding="utf-8") + "dirty\n", encoding="utf-8")
        with self.assertRaisesRegex(gates.GateError, "dirty"):
            gates.assert_preflight(repo, head)
        command("git", "add", str(path), cwd=repo)
        with self.assertRaisesRegex(gates.GateError, "index is dirty"):
            gates.assert_preflight(repo, head)

    def test_underlying_command_failure_propagates(self) -> None:
        repo, head = self.make_repo()
        result = gates.run_gate(
            repo,
            {"id": "failure", "command": [sys.executable, "-c", "raise SystemExit(7)"]},
            self.root / "evidence",
            [],
            head,
        )
        self.assertEqual(("AUTOMATED_FAIL", 7), (result["result"], result["exitCode"]))

    def test_gate_that_dirties_workspace_fails_postflight(self) -> None:
        repo, head = self.make_repo()
        target = repo / "docs" / "plans" / "historical-bookings" / "01_TICKET.md"
        result = gates.run_gate(
            repo,
            {"id": "dirty_gate", "command": [sys.executable, "-c", f"open({str(target)!r}, 'a').write('dirty')"]},
            self.root / "dirty-evidence",
            [],
            head,
        )
        self.assertEqual("AUTOMATED_FAIL", result["result"])
        self.assertTrue(result["workspaceDirty"])

    def test_node_tap_requires_complete_zero_skip_summary(self) -> None:
        complete = "ℹ tests 7\nℹ pass 7\nℹ fail 0\nℹ cancelled 0\nℹ skipped 0\nℹ todo 0\nℹ duration_ms 12.3\n"
        self.assertEqual(7, gates.parse_node_tap(complete)["passed"])
        self.assertTrue(gates.parse_node_tap(complete)["completionVerified"])
        skipped = complete.replace("pass 7", "pass 6").replace("skipped 0", "skipped 1")
        self.assertEqual(1, gates.parse_node_tap(skipped)["skipped"])
        self.assertFalse(gates.parse_node_tap(complete + "trailing garbage\n")["completionVerified"])

    def test_truncated_malformed_or_missing_completion_fails_closed(self) -> None:
        for output in ("84 passed", "garbage", "ℹ tests 1\nℹ pass 1\nℹ fail 0\nℹ skipped 0\n"):
            with self.subTest(output=output):
                self.assertFalse(gates.parse_node_tap(output)["completionVerified"])

    def test_dotnet_trx_requires_complete_structured_counters(self) -> None:
        report_dir = self.root / "trx"
        report_dir.mkdir()
        (report_dir / "results.trx").write_text(
            """<?xml version="1.0" encoding="utf-8"?>
<TestRun xmlns="http://microsoft.com/schemas/VisualStudio/TeamTest/2010">
  <ResultSummary outcome="Completed">
    <Counters total="3" executed="3" passed="3" failed="0" error="0"
      timeout="0" aborted="0" notExecuted="0" />
  </ResultSummary>
</TestRun>
""",
            encoding="utf-8",
        )
        counts = gates.parse_dotnet_trx(report_dir)
        self.assertEqual((3, 0, 0, True), (counts["passed"], counts["failed"], counts["skipped"], counts["completionVerified"]))
        (report_dir / "results.trx").write_text("<TestRun />", encoding="utf-8")
        self.assertFalse(gates.parse_dotnet_trx(report_dir)["completionVerified"])

    def test_playwright_json_requires_complete_structured_stats(self) -> None:
        report = self.root / "playwright.json"
        self.write_json(report, {
            "suites": [],
            "stats": {"expected": 4, "unexpected": 0, "flaky": 0, "skipped": 0, "duration": 12},
        })
        counts = gates.parse_playwright_json(report)
        self.assertEqual((4, 0, 0, True), (counts["passed"], counts["failed"], counts["skipped"], counts["completionVerified"]))
        self.write_json(report, {"suites": [], "stats": {"expected": 4}})
        self.assertFalse(gates.parse_playwright_json(report)["completionVerified"])

    def test_python_unittest_requires_explicit_terminal_completion_record(self) -> None:
        complete = (
            "test output\nFINAL_RC_PYTHON_TEST_RESULT "
            "total=25 passed=25 failures=0 errors=0 skipped=0 completion=complete\n"
        )
        counts = gates.parse_python_unittest(complete)
        self.assertEqual((25, 25, 0, 0), (counts["total"], counts["passed"], counts["failed"], counts["skipped"]))
        malformed = (
            "FINAL_RC_PYTHON_TEST_RESULT total=25 passed=25 failures=0 errors=0 "
            "skipped=0 completion=complete\ntrailing garbage\n"
        )
        missing = "FINAL_RC_PYTHON_TEST_RESULT total=25 passed=25 completion=complete\n"
        self.assertFalse(gates.parse_python_unittest(malformed)["completionVerified"])
        self.assertFalse(gates.parse_python_unittest(missing)["completionVerified"])

    def test_required_skip_fails_gate(self) -> None:
        repo, head = self.make_repo()
        output = "ℹ tests 2\nℹ pass 1\nℹ fail 0\nℹ cancelled 0\nℹ skipped 1\nℹ todo 0\nℹ duration_ms 1"
        result = gates.run_gate(
            repo,
            {"id": "skip", "requiresTests": True, "testEvidence": {"type": "node-tap"}, "command": [sys.executable, "-c", f"print({output!r})"]},
            self.root / "skip-evidence",
            [],
            head,
        )
        self.assertEqual("AUTOMATED_FAIL", result["result"])
        self.assertTrue(result["unexplainedSkipped"])

    def test_unsafe_gate_id_path_traversal_is_refused(self) -> None:
        manifest = self.manifest()
        manifest["automatedGates"][0]["id"] = "../../escaped"
        with self.assertRaisesRegex(gates.GateError, "unsafe gate ID"):
            gates.validate_manifest(manifest)
        repo, head = self.make_repo()
        with self.assertRaisesRegex(gates.GateError, "unsafe gate ID"):
            gates.run_gate(
                repo,
                {"id": "../../escaped", "command": [sys.executable, "-c", "print('unsafe')"]},
                self.root / "runner-evidence",
                [],
                head,
            )
        self.assertFalse((self.root / "escaped.log").exists())

    def test_evidence_root_traversal_symlink_and_overwrite_are_refused(self) -> None:
        repo, head = self.make_repo()
        with self.assertRaisesRegex(gates.GateError, "approved"):
            gates.create_run_directory(repo, "../escaped", head, "run-1")
        first = gates.create_run_directory(repo, "artifacts/final-rc", head, "run-1")
        self.assertTrue(first.is_dir())
        with self.assertRaisesRegex(gates.GateError, "will not be overwritten"):
            gates.create_run_directory(repo, "artifacts/final-rc", head, "run-1")
        if hasattr(os, "symlink"):
            linked_repo, linked_head = self.make_repo()
            target = self.root / "outside"
            target.mkdir()
            artifacts = linked_repo / "artifacts"
            try:
                os.symlink(target, artifacts, target_is_directory=True)
            except OSError:
                return
            with self.assertRaisesRegex(gates.GateError, "approved|symlink"):
                gates.create_run_directory(linked_repo, "artifacts/final-rc", linked_head, "run-2")

    def test_retry_uses_distinct_run_directory(self) -> None:
        repo, head = self.make_repo()
        one = gates.create_run_directory(repo, "artifacts/final-rc", head, "run-one")
        two = gates.create_run_directory(repo, "artifacts/final-rc", head, "run-two")
        self.assertNotEqual(one, two)

    def test_manual_pass_requires_complete_structured_attestation(self) -> None:
        repo, sha = self.make_repo()
        path = self.root / "manual.json"
        self.write_json(path, {"schemaVersion": 1, "rcSha": sha, "items": [{"id": "manual", "result": "MANUAL_PASS", "rcSha": sha, "evidenceRef": "fake"}]})
        with self.assertRaisesRegex(gates.GateError, "missing required attestation fields"):
            gates.load_manual_evidence(path, [{"id": "manual"}], sha, repo)

    def test_manual_attestation_rejects_stale_sha_duplicate_unknown_and_bad_digest(self) -> None:
        repo, sha = self.make_repo()
        path = self.root / "manual.json"
        cases = [
            ([self.valid_attestation(repo, "manual", "b" * 40)], "wrong RC SHA"),
            ([self.valid_attestation(repo, "manual", sha), self.valid_attestation(repo, "manual", sha)], "duplicate"),
            ([self.valid_attestation(repo, "unknown", sha)], "unknown"),
            ([self.valid_attestation(repo, "manual", sha, evidenceSha256="fake")], "SHA-256"),
            ([self.valid_attestation(repo, "manual", sha, executor="")], "executor"),
            ([self.valid_attestation(repo, "manual", sha, result="AUTOMATED_PASS")], "cannot become"),
        ]
        for items, message in cases:
            with self.subTest(message=message):
                self.write_json(path, {"schemaVersion": 1, "rcSha": sha, "items": items})
                with self.assertRaisesRegex(gates.GateError, message):
                    gates.load_manual_evidence(path, [{"id": "manual"}], sha, repo)

    def test_fake_or_modified_manual_artifact_is_rejected(self) -> None:
        repo, sha = self.make_repo()
        path = self.root / "manual.json"
        fake = self.valid_attestation(
            repo,
            "manual",
            sha,
            evidenceRef=f"artifacts/final-rc/{sha}/manual/nonexistent.txt",
            evidenceSha256=hashlib.sha256(b"attacker bytes").hexdigest(),
        )
        self.write_json(path, {"schemaVersion": 1, "rcSha": sha, "items": [fake]})
        with self.assertRaisesRegex(gates.GateError, "does not exist"):
            gates.load_manual_evidence(path, [{"id": "manual"}], sha, repo)
        modified = self.valid_attestation(repo, "manual", sha)
        (repo / modified["evidenceRef"]).write_text("modified after attestation\n", encoding="utf-8")
        self.write_json(path, {"schemaVersion": 1, "rcSha": sha, "items": [modified]})
        with self.assertRaisesRegex(gates.GateError, "digest does not match"):
            gates.load_manual_evidence(path, [{"id": "manual"}], sha, repo)

    def test_manual_artifact_path_escape_and_free_form_receipt_are_rejected(self) -> None:
        repo, sha = self.make_repo()
        path = self.root / "manual.json"
        escaped = self.valid_attestation(
            repo,
            "manual",
            sha,
            evidenceRef=f"artifacts/final-rc/{sha}/../escaped.txt",
            evidenceSha256=hashlib.sha256(b"escaped").hexdigest(),
        )
        self.write_json(path, {"schemaVersion": 1, "rcSha": sha, "items": [escaped]})
        with self.assertRaisesRegex(gates.GateError, "escapes"):
            gates.load_manual_evidence(path, [{"id": "manual"}], sha, repo)
        evidence_ref, digest = self.write_artifact(repo, sha, "free-form.txt", "arbitrary claim\n")
        free_form = self.valid_attestation(
            repo,
            "manual",
            sha,
            evidenceRef=evidence_ref,
            evidenceSha256=digest,
        )
        self.write_json(path, {"schemaVersion": 1, "rcSha": sha, "items": [free_form]})
        with self.assertRaisesRegex(gates.GateError, "structured evidence receipt"):
            gates.load_manual_evidence(path, [{"id": "manual"}], sha, repo)

    def test_prepopulated_owner_decision_is_not_regular_manual_evidence(self) -> None:
        repo, sha = self.make_repo()
        path = self.root / "manual.json"
        item = self.valid_attestation(repo, "owner_go_no_go", sha)
        self.write_json(path, {"schemaVersion": 1, "rcSha": sha, "items": [item]})
        with self.assertRaisesRegex(gates.GateError, "unknown manual evidence IDs"):
            gates.load_manual_evidence(path, [{"id": "manual"}], sha, repo)

    def test_valid_manual_attestation_is_sha_bound(self) -> None:
        repo, sha = self.make_repo()
        path = self.root / "manual.json"
        item = self.valid_attestation(repo, "manual", sha)
        self.write_json(path, {"schemaVersion": 1, "rcSha": sha, "items": [item]})
        result = gates.load_manual_evidence(path, [{"id": "manual"}], sha, repo)
        self.assertEqual(("MANUAL_PASS", sha), (result[0]["result"], result[0]["rcSha"]))

    def test_external_evidence_requires_type_specific_trust_metadata(self) -> None:
        repo, sha = self.make_repo()
        path = self.root / "external.json"
        item = self.valid_attestation(
            repo,
            "manual",
            sha,
            evidenceType="external_artifact",
            metadata={"provider": "ci"},
        )
        self.write_json(path, {"schemaVersion": 1, "rcSha": sha, "items": [item]})
        with self.assertRaisesRegex(gates.GateError, "lacks required external_artifact metadata"):
            gates.load_manual_evidence(path, [{"id": "manual"}], sha, repo)
        item = self.valid_attestation(
            repo,
            "manual",
            sha,
            evidenceType="external_artifact",
            metadata={
                "provider": "github-actions",
                "immutableArtifactId": "run-123/artifact-456",
                "verificationMethod": "downloaded-and-hashed",
                "verifiedBy": "release-reviewer@example.invalid",
            },
        )
        self.write_json(path, {"schemaVersion": 1, "rcSha": sha, "items": [item]})
        self.assertEqual(
            "MANUAL_PASS",
            gates.load_manual_evidence(path, [{"id": "manual"}], sha, repo)[0]["result"],
        )

    def test_source_scenario_ac_nac_and_error_must_match_ratified_catalog(self) -> None:
        mutations = {
            "scenario": ("99_RELIABILITY_TEST_SCENARIOS.md", "#### SC-HAPPY-01", "#### SC-MISSING-01"),
            "AC": ("01_TICKET.md", "AC-HB01-01", "AC-HB01-02"),
            "NAC": ("01_TICKET.md", "NAC-HB01-01", "NAC-HB01-02"),
            "error": ("00_MASTER_PLAN.md", "SYNTHETIC_ERROR", "OTHER_ERROR"),
        }
        for name, (filename, old, new) in mutations.items():
            with self.subTest(identity=name):
                repo, _ = self.make_repo()
                path = repo / "docs" / "plans" / "historical-bookings" / filename
                path.write_text(path.read_text(encoding="utf-8").replace(old, new), encoding="utf-8")
                with self.assertRaisesRegex(gates.GateError, "identity mismatch"):
                    self.inventory(repo, self.manifest())

    def test_catalog_declared_counts_and_reviewed_baseline_are_enforced(self) -> None:
        repo, _ = self.make_repo()
        path = repo / "release-gates" / "final-rc" / "ratified-identities.json"
        catalog = self.catalog()
        catalog["scenarios"] = []
        self.write_json(path, catalog)
        with self.assertRaisesRegex(gates.GateError, "declared counts"):
            gates.load_ratified_catalog(path, enforce_reviewed_baseline=False)
        real = gates.load_ratified_catalog(ROOT / "release-gates" / "final-rc" / "ratified-identities.json")
        self.assertEqual(gates.RATIFIED_CATALOG_COUNTS["criteria"], len(real["criteria"]))

    def test_missing_catalog_evidence_identity_fails_packet_validation(self) -> None:
        repo, head = self.make_repo()
        manifest = self.manifest()
        inventory = self.inventory(repo, manifest)
        packet = self.ready_packet(head, manifest)
        packet["inventory"]["criteria"].pop()
        packet["readinessConditions"] = gates.readiness_conditions(packet, manifest)
        packet["finalGoStatus"] = "NOT_READY"
        with self.assertRaisesRegex(gates.GateError, "criteria evidence mismatch"):
            gates.validate_packet(packet, inventory, manifest["manualGates"], manifest)

    def test_identity_index_requires_every_exact_identity_and_digest(self) -> None:
        repo, sha = self.make_repo()
        manifest = self.manifest()
        inventory = self.inventory(repo, manifest)
        missing = self.write_identity_index(repo, sha, inventory, missing_id="AC-HB01-01")
        with self.assertRaisesRegex(gates.GateError, "identity mismatch"):
            gates.load_identity_evidence(missing, repo, sha, inventory)
        invalid = self.write_identity_index(repo, sha, inventory, bad_digest_id="NAC-HB01-01")
        with self.assertRaisesRegex(gates.GateError, "digest does not match"):
            gates.load_identity_evidence(invalid, repo, sha, inventory)

    def test_broad_99_attestation_cannot_prove_identity_inventory(self) -> None:
        repo, sha = self.make_repo()
        manifest = self.manifest()
        inventory = self.inventory(repo, manifest)
        manual = self.valid_attestation(repo, "reliability_99_completion", sha)
        manual_path = self.root / "manual-99.json"
        self.write_json(manual_path, {"schemaVersion": 1, "rcSha": sha, "items": [manual]})
        loaded = gates.load_manual_evidence(manual_path, manifest["manualGates"], sha, repo)
        self.assertEqual("MANUAL_PASS", loaded[0]["result"])
        rows, index = gates.load_identity_evidence(None, repo, sha, inventory)
        self.assertIsNone(index)
        self.assertTrue(all(row["result"] == "MANUAL_EVIDENCE_REQUIRED" for section in rows.values() for row in section))

    def test_valid_identity_index_proves_each_identity_separately(self) -> None:
        repo, sha = self.make_repo()
        inventory = self.inventory(repo, self.manifest())
        path = self.write_identity_index(repo, sha, inventory)
        rows, index = gates.load_identity_evidence(path, repo, sha, inventory)
        self.assertIsNotNone(index)
        self.assertEqual(4, sum(len(section) for section in rows.values()))
        self.assertTrue(all(row["result"] == "MANUAL_PASS" for section in rows.values() for row in section))

    def test_recursive_redaction_covers_nested_secrets_and_urls(self) -> None:
        raw = {
            "password": "tiny",
            "metadata": {
                "DATABASE_URL": "postgres://user:pass@host/db",
                "note": "Bearer abc.def.ghi and https://user:pass@example.invalid/path",
                "nested": ["Host=x;Database=y;Username=z;Password=hidden;Pooling=false"],
            },
        }
        serialized = json.dumps(gates.redact_value(raw, ["tiny"]))
        for forbidden in ("tiny", "user:pass", "abc.def.ghi", "Password=hidden"):
            self.assertNotIn(forbidden, serialized)
        self.assertEqual("value [REDACTED] value", gates.redact("value xy value", ["xy"]))

    def test_structured_manual_metadata_is_redacted_before_json_write(self) -> None:
        path = self.root / "redacted.json"
        gates.write_json_exclusive(path, {"metadata": {"token": "short", "ref": "postgresql://u:p@h/db"}}, ["short"])
        stored = path.read_text(encoding="utf-8")
        self.assertNotIn("short", stored)
        self.assertNotIn("u:p", stored)

    def ready_packet(self, sha: str, manifest: dict, lane: str = "full", manual_pass: bool = True) -> dict:
        manual_result = "MANUAL_PASS" if manual_pass else "MANUAL_EVIDENCE_REQUIRED"
        manual = [{"id": "reliability_99_completion", "classification": "manual", "result": manual_result, "evidenceRefs": ["evidence://x"] if manual_pass else []}]
        identity = lambda identifier: {
            "id": identifier,
            "classification": "manual",
            "result": manual_result,
            "evidenceRefs": ["artifacts/final-rc/evidence.txt"] if manual_pass else [],
            "evidenceSha256": "a" * 64 if manual_pass else None,
        }
        category_result = "MANUAL_PASS" if manual_pass else "MANUAL_EVIDENCE_REQUIRED"
        packet = {
            "schemaVersion": 3,
            "rcSha": sha,
            "expectedRcSha": sha,
            "generatedAtUtc": "2026-08-15T12:30:00+00:00",
            "runId": "run-1",
            "lane": lane,
            "mode": "final",
            "postflightClean": True,
            "automatedResult": "AUTOMATED_PASS",
            "finalGoStatus": "NOT_READY",
            "gates": [{"id": "synthetic_gate", "result": "AUTOMATED_PASS"}],
            "manualEvidence": manual,
            "reliabilityCategories": [
                {"id": category, "result": category_result, "automatedGateIds": ["synthetic_gate"], "manualGateIds": ["reliability_99_completion"]}
                for category in gates.REQUIRED_RELIABILITY_CATEGORIES
            ],
            "inventory": {
                "scenarios": [identity("SC-HAPPY-01")],
                "criteria": [identity("AC-HB01-01"), identity("NAC-HB01-01")],
                "publicErrors": [identity("SYNTHETIC_ERROR")],
            },
            "identityEvidenceIndex": {"evidenceRef": "index.json"} if manual_pass else None,
        }
        packet["readinessConditions"] = gates.readiness_conditions(packet, manifest)
        if all(packet["readinessConditions"].values()):
            packet["finalGoStatus"] = "READY_FOR_OWNER_GO_NO_GO"
        return packet

    def write_ready_packet(self, repo: pathlib.Path, sha: str, ready: bool = True) -> pathlib.Path:
        manifest = self.manifest()
        inventory = self.inventory(repo, manifest)
        identity_path = self.write_identity_index(repo, sha, inventory)
        identity_rows, identity_index = gates.load_identity_evidence(identity_path, repo, sha, inventory)
        manual_item = self.valid_attestation(repo, "reliability_99_completion", sha)
        manual_path = self.root / f"manual-{self.repo_index}.json"
        self.write_json(manual_path, {"schemaVersion": 1, "rcSha": sha, "items": [manual_item]})
        manual = gates.load_manual_evidence(manual_path, manifest["manualGates"], sha, repo)
        packet = self.ready_packet(sha, manifest, manual_pass=True)
        packet["manualEvidence"] = manual
        packet["inventory"] = identity_rows
        packet["identityEvidenceIndex"] = identity_index
        packet["reliabilityCategories"] = [
            {
                "id": category,
                "result": "MANUAL_PASS",
                "automatedGateIds": ["synthetic_gate"],
                "manualGateIds": ["reliability_99_completion"],
            }
            for category in gates.REQUIRED_RELIABILITY_CATEGORIES
        ]
        if not ready:
            packet["manualEvidence"][0]["result"] = "MANUAL_EVIDENCE_REQUIRED"
        packet["readinessConditions"] = gates.readiness_conditions(packet, manifest)
        packet["finalGoStatus"] = (
            "READY_FOR_OWNER_GO_NO_GO"
            if all(packet["readinessConditions"].values())
            else "NOT_READY"
        )
        path = repo / "artifacts" / "final-rc" / sha / "manual" / ("ready.json" if ready else "not-ready.json")
        self.write_json(path, packet)
        return path

    def write_owner_decision(
        self,
        repo: pathlib.Path,
        sha: str,
        ready_path: pathlib.Path,
        decision: str,
    ) -> pathlib.Path:
        support_ref, support_digest = self.write_artifact(repo, sha, f"owner-{decision.lower()}.txt", f"owner decision {decision}\n")
        path = repo / "artifacts" / "final-rc" / sha / "manual" / f"owner-{decision.lower()}.json"
        self.write_json(path, {
            "schemaVersion": 1,
            "rcSha": sha,
            "decision": decision,
            "executor": "release-owner@example.invalid",
            "decidedAtUtc": "2026-08-15T13:00:00+00:00",
            "readyEvidenceRef": ready_path.relative_to(repo).as_posix(),
            "readyEvidenceSha256": hashlib.sha256(ready_path.read_bytes()).hexdigest(),
            "evidenceRef": support_ref,
            "evidenceSha256": support_digest,
            "metadata": {"decisionAuthority": "owner", "rationaleCode": "RC_REVIEW_COMPLETE"},
        })
        return path

    def test_hosted_lane_never_becomes_ready_even_with_all_manual_evidence(self) -> None:
        manifest = self.manifest()
        for manual_pass in (False, True):
            packet = self.ready_packet("a" * 40, manifest, lane="hosted", manual_pass=manual_pass)
            self.assertEqual("NOT_READY", packet["finalGoStatus"])
            self.assertFalse(packet["readinessConditions"]["fullLaneSelected"])

    def test_full_lane_requires_manual_identity_and_99_completion(self) -> None:
        manifest = self.manifest()
        unresolved = self.ready_packet("a" * 40, manifest, lane="full", manual_pass=False)
        self.assertEqual("NOT_READY", unresolved["finalGoStatus"])
        ready = self.ready_packet("a" * 40, manifest, lane="full", manual_pass=True)
        self.assertEqual("READY_FOR_OWNER_GO_NO_GO", ready["finalGoStatus"])
        self.assertTrue(all(ready["readinessConditions"].values()))

    def test_complete_pre_owner_evidence_reaches_ready_but_not_terminal_go(self) -> None:
        repo, sha = self.make_repo()
        ready_path = self.write_ready_packet(repo, sha)
        packet = gates.load_json(ready_path)
        self.assertEqual("READY_FOR_OWNER_GO_NO_GO", packet["finalGoStatus"])
        self.assertNotIn(packet["finalGoStatus"], {"GO", "NO_GO"})

    def test_distinct_owner_go_and_no_go_transitions_are_terminal(self) -> None:
        for decision in ("GO", "NO_GO"):
            with self.subTest(decision=decision):
                repo, sha = self.make_repo()
                ready_path = self.write_ready_packet(repo, sha)
                decision_path = self.write_owner_decision(repo, sha, ready_path, decision)
                manifest = self.manifest()
                result = gates.apply_owner_decision(
                    repo,
                    sha,
                    decision_path,
                    manifest,
                    self.inventory(repo, manifest),
                )
                self.assertEqual(decision, result["finalGoStatus"])
                self.assertEqual("READY_FOR_OWNER_GO_NO_GO", gates.load_json(ready_path)["finalGoStatus"])

    def test_owner_decision_cannot_bypass_not_ready_state(self) -> None:
        repo, sha = self.make_repo()
        not_ready_path = self.write_ready_packet(repo, sha, ready=False)
        decision_path = self.write_owner_decision(repo, sha, not_ready_path, "GO")
        with self.assertRaisesRegex(gates.GateError, "requires a complete READY"):
            manifest = self.manifest()
            gates.apply_owner_decision(
                repo,
                sha,
                decision_path,
                manifest,
                self.inventory(repo, manifest),
            )

    def test_final_status_cannot_claim_ready_when_condition_is_false(self) -> None:
        repo, head = self.make_repo()
        manifest = self.manifest()
        packet = self.ready_packet(head, manifest, lane="hosted", manual_pass=True)
        packet["finalGoStatus"] = "READY_FOR_OWNER_GO_NO_GO"
        with self.assertRaisesRegex(gates.GateError, "does not match"):
            gates.validate_packet(packet, self.inventory(repo, manifest), manifest["manualGates"], manifest)

    def test_successful_synthetic_run_is_sha_bound_unique_and_not_ready(self) -> None:
        repo, head = self.make_repo()
        manifest_path = self.root / "manifest.json"
        self.write_json(manifest_path, self.manifest())
        args = types.SimpleNamespace(
            repo_root=str(repo),
            manifest=str(manifest_path),
            catalog=str(repo / "release-gates" / "final-rc" / "ratified-identities.json"),
            expected_sha=head,
            evidence_root="artifacts/final-rc",
            run_id="synthetic-run",
            manual_evidence=None,
            lane="synthetic",
            mode="automated",
        )
        self.assertEqual(0, gates.run(args))
        packet_path = repo / "artifacts" / "final-rc" / head / "synthetic-run" / "evidence.json"
        packet = gates.load_json(packet_path)
        self.assertEqual((head, "NOT_READY"), (packet["rcSha"], packet["finalGoStatus"]))


if __name__ == "__main__":
    suite = unittest.defaultTestLoader.loadTestsFromModule(sys.modules[__name__])
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    failures = len(result.failures)
    errors = len(result.errors)
    skipped = len(result.skipped)
    passed = result.testsRun - failures - errors - skipped
    print(
        "FINAL_RC_PYTHON_TEST_RESULT "
        f"total={result.testsRun} passed={passed} failures={failures} "
        f"errors={errors} skipped={skipped} completion=complete",
        flush=True,
    )
    raise SystemExit(0 if result.wasSuccessful() else 1)
