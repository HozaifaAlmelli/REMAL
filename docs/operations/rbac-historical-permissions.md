# Historical Booking RBAC Governance

Historical Booking access uses independent permissions administered through **Admin
Settings → Role Access**:

- `bookings:record_historical` and `payments:record_historical` are mandatory
  bootstrap grants for the canonical SuperAdmin template. They may be granted or
  revoked independently for supported non-SuperAdmin templates.
- `bookings:correct_owner_attribution` is permanently restricted to the canonical
  SuperAdmin template. Role-template updates and per-user overrides cannot remove it
  from SuperAdmin or grant it elsewhere.
- Supporting reads remain independent. Unit selection requires **View units**;
  existing-client selection requires **View clients** (new-client entry remains
  available without it); post-create owner review requires **View bookings**; and the
  optional payment command requires **Record historical payments**.
- Saving a role template updates the security timestamp of its assigned operators.
  Their current sessions are rejected on the next authenticated action, and the new
  permission set is issued after they sign in again.

These rules do not bundle permissions, change ordinary booking access, or claim an
RBAC change-audit facility.
