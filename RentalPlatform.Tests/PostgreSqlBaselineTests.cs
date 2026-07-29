using Microsoft.EntityFrameworkCore;
using Npgsql;
using RentalPlatform.Data;
using RentalPlatform.Data.Entities;
using RentalPlatform.Tests.Infrastructure;
using Xunit;

namespace RentalPlatform.Tests;

[Collection(PostgreSqlTestCollection.Name)]
[Trait(TestCategories.Name, TestCategories.PostgreSql)]
public sealed class PostgreSqlBaselineTests
{
    private readonly PostgreSqlFixture _fixture;

    public PostgreSqlBaselineTests(PostgreSqlFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task RealSchemaSupportsTransactionAdvisoryLockRollbackAndCheckConstraint()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        var marker = $"Sanitized PRE02 rollback {Guid.NewGuid():N}";

        await using (var context = database.CreateDbContext())
        {
            Assert.Equal(
                "Npgsql.EntityFrameworkCore.PostgreSQL",
                context.Database.ProviderName);

            var unitOfWork = new UnitOfWork(context);
            await using var transaction = await unitOfWork.BeginTransactionAsync();
            await unitOfWork.AcquireTransactionAdvisoryLockAsync(
                "pre02:baseline:transaction");
            context.Amenities.Add(new Amenity
            {
                Id = Guid.NewGuid(),
                Name = marker,
                IsActive = true
            });
            await unitOfWork.SaveChangesAsync();
            await transaction.RollbackAsync();
        }

        await using (var connection = await database.OpenConnectionAsync())
        {
            await using var versionCommand = new NpgsqlCommand(
                "SHOW server_version_num",
                connection);
            var version = Convert.ToInt32(await versionCommand.ExecuteScalarAsync());
            Assert.InRange(version, 160000, 169999);

            await using var rollbackCommand = new NpgsqlCommand(
                "SELECT count(*) FROM amenities WHERE name = $1",
                connection);
            rollbackCommand.Parameters.AddWithValue(marker);
            Assert.Equal(0L, Convert.ToInt64(await rollbackCommand.ExecuteScalarAsync()));

            await using var constraintCommand = new NpgsqlCommand(
                """
                INSERT INTO owners (
                    name, phone, emergency_phone, commission_rate, status,
                    password_hash, created_at, updated_at
                )
                VALUES (
                    'Sanitized Invalid Owner', '+201099999901', '+201099999902',
                    101.00, 'active', 'test-only-hash', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                )
                """,
                connection);
            var exception = await Assert.ThrowsAsync<PostgresException>(
                () => constraintCommand.ExecuteNonQueryAsync());
            Assert.Equal(PostgresErrorCodes.CheckViolation, exception.SqlState);
            Assert.Equal("ck_owners_commission_rate", exception.ConstraintName);
        }
    }

    [Fact]
    public async Task ResetRestoresAnIsolatedCopyOfTheBootstrapTemplate()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        var marker = $"Sanitized PRE02 reset {Guid.NewGuid():N}";

        await using (var connection = await database.OpenConnectionAsync())
        {
            await using var insert = new NpgsqlCommand(
                """
                INSERT INTO amenities (name, is_active, created_at, updated_at)
                VALUES ($1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """,
                connection);
            insert.Parameters.AddWithValue(marker);
            await insert.ExecuteNonQueryAsync();
        }

        await database.ResetAsync();

        await using var resetConnection = await database.OpenConnectionAsync();
        await using var count = new NpgsqlCommand(
            "SELECT count(*) FROM amenities WHERE name = $1",
            resetConnection);
        count.Parameters.AddWithValue(marker);
        Assert.Equal(0L, Convert.ToInt64(await count.ExecuteScalarAsync()));
    }
}
