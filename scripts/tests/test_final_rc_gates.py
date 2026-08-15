#!/usr/bin/env python3
from __future__ import annotations

import json
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

    def tearDown(self) -> None:
        self.temp.cleanup()

    def make_repo(self) -> tuple[pathlib.Path, str]:
        repo = self.root / "repo"
        docs = repo / "docs" / "plans" / "historical-bookings"
        docs.mkdir(parents=True)
        (docs / "00_MASTER_PLAN.md").write_text(
            "### 12.3 Error contract — transport and codes\n\n"
            "| Condition | Status | Code | Owner |\n|---|---|---|---|\n"
            "| Invalid | 400 | `SYNTHETIC_ERROR` | HB-01 |\n\n## 13. Next\n",
            encoding="utf-8",
        )
        (docs / "99_RELIABILITY_TEST_SCENARIOS.md").write_text(
            "#### SC-HAPPY-01 — Synthetic\n\n"
            "| | |\n|---|---|\n"
            "| **Priority · Category · Automate** | P0 · Happy · YES (unit) |\n",
            encoding="utf-8",
        )
        (docs / "01_TICKET.md").write_text(
            "| ID | Criterion |\n|---|---|\n"
            "| AC-HB01-01 | Required |\n"
            "| NAC-HB01-01 | Forbidden |\n",
            encoding="utf-8",
        )
        command("git", "init", "-q", cwd=repo)
        command("git", "config", "user.email", "final-rc@example.invalid", cwd=repo)
        command("git", "config", "user.name", "Final RC Test", cwd=repo)
        command("git", "add", ".", cwd=repo)
        command("git", "commit", "-qm", "fixture", cwd=repo)
        return repo, command("git", "rev-parse", "HEAD", cwd=repo)

    @staticmethod
    def manifest(command_args: list[str] | None = None) -> dict:
        return {
            "canonicalSources": {
                "masterContract": "docs/plans/historical-bookings/00_MASTER_PLAN.md",
                "scenarios": "docs/plans/historical-bookings/99_RELIABILITY_TEST_SCENARIOS.md",
                "ticketDirectory": "docs/plans/historical-bookings",
            },
            "automatedGates": [{
                "id": "synthetic_gate",
                "lanes": ["synthetic"],
                "command": command_args or [sys.executable, "-c", "print('1 passed')"],
            }],
            "scenarioGroupEvidence": {"HAPPY": ["synthetic_gate"]},
            "ticketEvidence": {"HB01": ["synthetic_gate"]},
            "publicErrorEvidence": ["synthetic_gate"],
            "reliabilityCategories": {
                category: {"automatedGateIds": ["synthetic_gate"], "manualGateIds": ["reliability_99_completion"]}
                for category in gates.REQUIRED_RELIABILITY_CATEGORIES
            },
            "manualGates": [{"id": "reliability_99_completion", "sequence": 1, "description": "Synthetic manual gate"}],
        }

    def test_wrong_rc_sha_is_refused(self) -> None:
        repo, _ = self.make_repo()
        with self.assertRaisesRegex(gates.GateError, "HEAD mismatch"):
            gates.assert_preflight(repo, "0" * 40)

    def test_dirty_tracked_tree_is_refused(self) -> None:
        repo, head = self.make_repo()
        path = repo / "docs" / "plans" / "historical-bookings" / "01_TICKET.md"
        path.write_text(path.read_text(encoding="utf-8") + "dirty\n", encoding="utf-8")
        with self.assertRaisesRegex(gates.GateError, "dirty"):
            gates.assert_preflight(repo, head)

    def test_dirty_index_is_refused(self) -> None:
        repo, head = self.make_repo()
        path = repo / "docs" / "plans" / "historical-bookings" / "01_TICKET.md"
        path.write_text(path.read_text(encoding="utf-8") + "staged\n", encoding="utf-8")
        command("git", "add", str(path), cwd=repo)
        with self.assertRaisesRegex(gates.GateError, "index is dirty"):
            gates.assert_preflight(repo, head)

    def test_mandatory_command_failure_propagates(self) -> None:
        repo, _ = self.make_repo()
        result = gates.run_gate(
            repo,
            {"id": "failure", "command": [sys.executable, "-c", "raise SystemExit(7)"]},
            self.root / "evidence",
            [],
        )
        self.assertEqual("AUTOMATED_FAIL", result["result"])
        self.assertEqual(7, result["exitCode"])

    def test_unicode_test_output_is_streamed_and_recorded(self) -> None:
        repo, _ = self.make_repo()
        result = gates.run_gate(
            repo,
            {"id": "unicode", "command": [sys.executable, "-c", "print('✔ 1 passed')"]},
            self.root / "evidence-unicode",
            [],
        )
        self.assertEqual("AUTOMATED_PASS", result["result"])
        self.assertIn("✔", (self.root / "evidence-unicode" / "logs" / "unicode.log").read_text(encoding="utf-8"))

    def test_required_skipped_result_fails(self) -> None:
        repo, _ = self.make_repo()
        result = gates.run_gate(
            repo,
            {"id": "skip", "command": [sys.executable, "-c", "print('1 passed 1 skipped')"]},
            self.root / "evidence",
            [],
        )
        self.assertEqual("AUTOMATED_FAIL", result["result"])
        self.assertTrue(result["unexplainedSkipped"])

    def test_node_info_test_counts_are_discovered(self) -> None:
        counts = gates.parse_counts("ℹ tests 7\nℹ pass 7\nℹ fail 0\nℹ skipped 0\n")
        self.assertEqual({"total": 7, "passed": 7, "failed": 0, "skipped": 0}, counts)

    def test_unittest_summary_wins_over_intentional_skip_fixture_text(self) -> None:
        counts = gates.parse_counts("1 passed 1 skipped\nRan 16 tests in 1.2s\n\nOK\n")
        self.assertEqual({"total": 16, "passed": 16, "failed": 0, "skipped": 0}, counts)

    def test_missing_hb09_scenario_fails(self) -> None:
        repo, _ = self.make_repo()
        manifest = self.manifest()
        manifest["scenarioGroupEvidence"] = {}
        with self.assertRaisesRegex(gates.GateError, "scenario groups lack evidence"):
            gates.canonical_inventory(repo, manifest)

    def test_missing_final_scenario_or_public_error_evidence_fails(self) -> None:
        inventory = {
            "scenarios": [{"id": "SC-HAPPY-01"}],
            "criteria": ["AC-HB01-01"],
            "publicErrors": ["SYNTHETIC_ERROR"],
        }
        packet = {
            "rcSha": "a" * 40,
            "expectedRcSha": "a" * 40,
            "inventory": {
                "scenarios": [],
                "criteria": [{"id": "AC-HB01-01", "result": "NOT_RUN", "evidenceRefs": []}],
                "publicErrors": [],
            },
            "manualEvidence": [{
                "id": "manual",
                "classification": "manual",
                "result": "MANUAL_EVIDENCE_REQUIRED",
                "evidenceRefs": [],
            }],
        }
        with self.assertRaisesRegex(gates.GateError, "scenarios evidence mismatch"):
            gates.validate_packet(packet, inventory, [{"id": "manual"}])

        packet["inventory"]["scenarios"] = [{"id": "SC-HAPPY-01", "result": "NOT_RUN", "evidenceRefs": []}]
        with self.assertRaisesRegex(gates.GateError, "publicErrors evidence mismatch"):
            gates.validate_packet(packet, inventory, [{"id": "manual"}])

    def test_missing_ac_nac_evidence_fails(self) -> None:
        repo, _ = self.make_repo()
        manifest = self.manifest()
        manifest["ticketEvidence"] = {}
        with self.assertRaisesRegex(gates.GateError, "AC/NAC tickets lack evidence"):
            gates.canonical_inventory(repo, manifest)

    def test_duplicate_scenario_inventory_fails(self) -> None:
        repo, _ = self.make_repo()
        scenario = repo / "docs" / "plans" / "historical-bookings" / "99_RELIABILITY_TEST_SCENARIOS.md"
        scenario.write_text(scenario.read_text(encoding="utf-8") * 2, encoding="utf-8")
        with self.assertRaisesRegex(gates.GateError, "duplicate/conflicting scenario"):
            gates.parse_scenarios(scenario)

    def test_manual_required_item_cannot_be_automatic_pass(self) -> None:
        manual = self.root / "manual.json"
        manual.write_text(json.dumps({
            "rcSha": "a" * 40,
            "items": [{"id": "manual", "result": "AUTOMATED_PASS", "evidenceRefs": ["fake"]}],
        }), encoding="utf-8")
        with self.assertRaisesRegex(gates.GateError, "cannot become AUTOMATED_PASS"):
            gates.load_manual_evidence(manual, [{"id": "manual"}], "a" * 40)

    def test_evidence_bound_to_wrong_sha_fails(self) -> None:
        manual = self.root / "manual.json"
        manual.write_text(json.dumps({"rcSha": "b" * 40, "items": []}), encoding="utf-8")
        with self.assertRaisesRegex(gates.GateError, "wrong RC SHA"):
            gates.load_manual_evidence(manual, [], "a" * 40)

    def test_secret_redaction_covers_connection_and_token_values(self) -> None:
        value = gates.redact(
            "Password=do-not-print TOKEN=do-not-print Bearer abc.def.ghi",
            ["Host=x;Password=another-secret"],
        )
        self.assertNotIn("do-not-print", value)
        self.assertNotIn("abc.def.ghi", value)
        self.assertNotIn("another-secret", value)

    def test_summary_redacts_secret_values(self) -> None:
        packet = {
            "rcSha": "a" * 40,
            "generatedAtUtc": "2026-08-15T00:00:00+00:00",
            "automatedResult": "AUTOMATED_PASS",
            "finalGoStatus": "NOT_READY",
            "gates": [{
                "id": "gate",
                "result": "AUTOMATED_PASS",
                "exitCode": 0,
                "counts": {"passed": 1, "failed": 0, "skipped": 0},
                "evidenceRef": "do-not-emit/log.txt",
            }],
            "reliabilityCategories": [],
            "manualEvidence": [],
        }
        summary = gates.redact(gates.human_summary(packet), ["do-not-emit"])
        self.assertNotIn("do-not-emit", summary)

    def test_final_mode_refuses_unresolved_manual_evidence(self) -> None:
        repo, head = self.make_repo()
        manifest_path = self.root / "manifest-final.json"
        manifest_path.write_text(json.dumps(self.manifest()), encoding="utf-8")
        args = types.SimpleNamespace(
            repo_root=str(repo),
            manifest=str(manifest_path),
            expected_sha=head,
            evidence_dir=str(self.root / "packet-final"),
            manual_evidence=None,
            lane="synthetic",
            mode="final",
        )
        self.assertEqual(2, gates.run(args))

    def test_successful_synthetic_fixture_has_deterministic_summary(self) -> None:
        repo, head = self.make_repo()
        manifest_path = self.root / "manifest.json"
        manifest_path.write_text(json.dumps(self.manifest()), encoding="utf-8")
        args = types.SimpleNamespace(
            repo_root=str(repo),
            manifest=str(manifest_path),
            expected_sha=head,
            evidence_dir=str(self.root / "packet"),
            manual_evidence=None,
            lane="synthetic",
            mode="automated",
        )
        self.assertEqual(0, gates.run(args))
        packet = gates.load_json(self.root / "packet" / "evidence.json")
        self.assertEqual(head, packet["rcSha"])
        self.assertEqual("AUTOMATED_PASS", packet["automatedResult"])
        self.assertEqual("NOT_READY", packet["finalGoStatus"])
        self.assertEqual(1, packet["catalogCounts"]["scenarios"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
