# AN-OPS-01B1 Rentable-Capacity Ledger

This tool owns the explicit one-time opening seed and the read-only integrity gate for
the rentable-capacity ledger. Installing migration 0064 leaves the ledger unpublished.
It never infers or backfills pre-epoch availability.

Set `KAZA_RENTABLE_CAPACITY_DB` to the target PostgreSQL connection string.

```powershell
dotnet run --project RentalPlatform.RentableCapacityLedger -- verify
dotnet run --project RentalPlatform.RentableCapacityLedger -- initialize --epoch 2026-08-14 --confirm-opening-seed
```

Initialization is accepted only when the requested epoch is the current Cairo date,
the ledger is uninitialized, no periods exist, and the seeded projection passes the
integrity verifier. Publication and seed rows commit atomically under the exclusive
`rentable-capacity:publication` transaction advisory lock. Re-running fails closed.

`verify` runs in a repeatable-read, database-enforced read-only transaction and reports
overlaps, gaps, invalid bounds, missing opening/current periods, pre-epoch claims, and
malformed supersession truth. It never repairs data.

Production initialization is a later owner/operator action. This PR does not run it.
