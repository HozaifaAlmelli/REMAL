# PostgreSQL integration tests

The PostgreSQL test tier exercises behavior that EF Core InMemory and SQLite
cannot reproduce: PostgreSQL transactions, advisory locks, raw schema constraints,
partial indexes, and concurrent independent connections.

## Test tiers

| Trait | Purpose | Command filter |
|---|---|---|
| `Fast` | Existing unit/service tests using isolated InMemory stores | `Category=Fast` |
| `PostgreSQL` | Real PostgreSQL schema and integration tests | `Category=PostgreSQL` |
| `Concurrency` | Future slower multi-connection race tests | `Category=Concurrency` |

PostgreSQL tests never fall back to another provider. If PostgreSQL is missing or
unsafe, fixture initialization fails with an actionable error.

## Local disposable PostgreSQL 16

PostgreSQL integration tests require an explicit `KAZA_TEST_DB` connection string
for an authorized, disposable local PostgreSQL 16 instance. The configured database
name must begin with `kaza_test`. Running the PostgreSQL test tier without the
variable fails intentionally before any connection or database creation is attempted.

Never point `KAZA_TEST_DB` at a development, shared, staging, or production database.
The fixture does not automatically use the repository's development Docker Compose
database or any repository application configuration.

PowerShell:

```powershell
docker run --detach --rm --name kaza-test-postgres `
  --publish 55432:5432 `
  --env POSTGRES_DB=kaza_test `
  --env POSTGRES_USER=postgres `
  --env POSTGRES_PASSWORD=kaza_test_local `
  postgres:16-alpine

$env:KAZA_TEST_DB = "Host=127.0.0.1;Port=55432;Database=kaza_test;Username=postgres;Password=kaza_test_local;Pooling=false"
dotnet test RentalPlatform.Tests/RentalPlatform.Tests.csproj `
  --configuration Release `
  --filter "Category=PostgreSQL"

docker rm --force kaza-test-postgres
Remove-Item Env:KAZA_TEST_DB
```

Bash:

```bash
docker run --detach --rm --name kaza-test-postgres \
  --publish 55432:5432 \
  --env POSTGRES_DB=kaza_test \
  --env POSTGRES_USER=postgres \
  --env POSTGRES_PASSWORD=kaza_test_local \
  postgres:16-alpine

export KAZA_TEST_DB='Host=127.0.0.1;Port=55432;Database=kaza_test;Username=postgres;Password=kaza_test_local;Pooling=false'
dotnet test RentalPlatform.Tests/RentalPlatform.Tests.csproj \
  --configuration Release \
  --filter 'Category=PostgreSQL'

docker rm --force kaza-test-postgres
unset KAZA_TEST_DB
```
## Fixture contract

Join `PostgreSqlTestCollection` and consume `PostgreSqlFixture`:

```csharp
[Collection(PostgreSqlTestCollection.Name)]
[Trait(TestCategories.Name, TestCategories.PostgreSql)]
public sealed class ExamplePostgreSqlTests
{
    private readonly PostgreSqlFixture _fixture;

    public ExamplePostgreSqlTests(PostgreSqlFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task Example()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        await using var context = database.CreateDbContext();
        await using var connection = await database.OpenConnectionAsync();
    }
}
```

The fixture:

- accepts only local hosts and base database names beginning with `kaza_test`;
- requires PostgreSQL major version 16;
- creates one unique template from the real `db/init.sql`;
- clones a unique database for each test;
- supplies real `AppDbContext` and independent Npgsql connections;
- supports `ResetAsync()` by replacing only a fixture-owned test database;
- force-drops only generated `kaza_test_*` databases during disposal.

Concurrency tests must open a separate context or connection per concurrent
operation. Sharing one `DbContext` serializes work and does not prove concurrency.

## CI

`.github/workflows/pr-checks.yml` provisions `postgres:16-alpine` as a disposable
service, supplies `KAZA_TEST_DB` automatically, and runs the PostgreSQL trait
explicitly. The workflow uses only job-local test credentials and does not read
repository secrets or production configuration.
