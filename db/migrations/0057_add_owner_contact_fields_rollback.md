# Migration 0057 rollback policy

Migration `0057_add_owner_contact_fields.sql` has no executable rollback script by
design.

It adds `owners.emergency_phone` and `owners.detailed_address`. Both columns are
part of the current application schema, and either column may contain valid owner
contact data. Dropping them would delete that data and break application versions
that map those columns.

The safe rollback for application code is to leave these additive columns in
place. If the migration itself requires correction, use a new uniquely numbered
forward-repair migration. If recovery to the pre-migration schema is unavoidable,
restore a verified pre-migration backup into an isolated database, validate it,
and use the repository's approved restore procedure. Do not drop these columns as
an automated rollback.

`0048_add_owner_contact_fields_rollback.sql` targets the same columns, but it is a
legacy artifact of the superseded duplicate-number owner-contact migration. It
must not be used to roll back migration `0057`: executing it can destroy valid
owner contact data and break current application code. Migration `0057` must use
the forward-repair or verified-backup-restoration strategy described above.
