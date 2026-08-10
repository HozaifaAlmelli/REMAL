import assert from "node:assert/strict";
import test from "node:test";
import { ApiError } from "@/lib/api/api-error";
import {
  HISTORICAL_PERMISSION_KEYS,
  historicalRolePermissionState,
  normalizeHistoricalRolePermissions,
  rbacMutationErrorMessage,
  SUPERADMIN_ROLE_TEMPLATE_ID,
} from "@/lib/rbac/historical-permission-policy";

const SALES_ROLE_TEMPLATE_ID = "10000000-0000-0000-0000-000000000002";

test("SuperAdmin historical permissions are normalized as protected baselines", () => {
  const normalized = normalizeHistoricalRolePermissions(
    SUPERADMIN_ROLE_TEMPLATE_ID,
    []
  );
  assert.deepEqual(new Set(normalized), new Set(Object.values(HISTORICAL_PERMISSION_KEYS)));
  for (const key of Object.values(HISTORICAL_PERMISSION_KEYS)) {
    assert.deepEqual(
      historicalRolePermissionState(SUPERADMIN_ROLE_TEMPLATE_ID, key, false),
      {
        checked: true,
        disabled: true,
        helperText: "Mandatory SuperAdmin baseline permission.",
      }
    );
  }
});

test("non-SuperAdmin historical booking and payment remain independent and editable", () => {
  const normalized = normalizeHistoricalRolePermissions(SALES_ROLE_TEMPLATE_ID, [
    HISTORICAL_PERMISSION_KEYS.booking,
    HISTORICAL_PERMISSION_KEYS.payment,
    HISTORICAL_PERMISSION_KEYS.correction,
  ]);
  assert.deepEqual(
    new Set(normalized),
    new Set([
      HISTORICAL_PERMISSION_KEYS.booking,
      HISTORICAL_PERMISSION_KEYS.payment,
    ])
  );
  assert.equal(
    historicalRolePermissionState(
      SALES_ROLE_TEMPLATE_ID,
      HISTORICAL_PERMISSION_KEYS.booking,
      true
    ).disabled,
    false
  );
  assert.equal(
    historicalRolePermissionState(
      SALES_ROLE_TEMPLATE_ID,
      HISTORICAL_PERMISSION_KEYS.payment,
      false
    ).disabled,
    false
  );
  assert.deepEqual(
    historicalRolePermissionState(
      SALES_ROLE_TEMPLATE_ID,
      HISTORICAL_PERMISSION_KEYS.correction,
      true
    ),
    {
      checked: false,
      disabled: true,
      helperText: "Restricted to the SuperAdmin role.",
    }
  );
});

test("RBAC invariant errors map to static operator-safe messages", () => {
  assert.equal(
    rbacMutationErrorMessage(
      new ApiError(
        400,
        "Validation failed",
        [],
        "RBAC_HISTORICAL_SUPERADMIN_BASELINE_REQUIRED"
      ),
      "fallback"
    ),
    "The SuperAdmin historical-booking baseline permissions are mandatory."
  );
  assert.equal(
    rbacMutationErrorMessage(
      new ApiError(
        400,
        "Validation failed",
        [],
        "RBAC_OWNER_CORRECTION_SUPERADMIN_ONLY"
      ),
      "fallback"
    ),
    "Historical owner-attribution correction is restricted to SuperAdmin."
  );
});
