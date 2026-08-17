using RentalPlatform.Tests.Infrastructure;
using Xunit;

namespace RentalPlatform.Tests;

[Collection(EnvironmentVariableTestCollection.Name)]
[Trait(TestCategories.Name, TestCategories.Fast)]
public sealed class PostgreSqlConnectionSafetyTests
{
    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public async Task MissingExplicitConfigurationFailsBeforeInitialization(
        string? configuredValue)
    {
        var originalValue = Environment.GetEnvironmentVariable(
            PostgreSqlFixture.ConnectionStringEnvironmentVariable);

        try
        {
            Environment.SetEnvironmentVariable(
                PostgreSqlFixture.ConnectionStringEnvironmentVariable,
                configuredValue);
            var fixture = new PostgreSqlFixture();

            var exception = await Assert.ThrowsAsync<InvalidOperationException>(
                fixture.InitializeAsync);

            Assert.Contains("is required", exception.Message);
            Assert.Contains("authorized disposable local PostgreSQL 16", exception.Message);
            Assert.Contains("No automatic connection", exception.Message);
            Assert.Contains("no SQLite", exception.Message);
        }
        finally
        {
            Environment.SetEnvironmentVariable(
                PostgreSqlFixture.ConnectionStringEnvironmentVariable,
                originalValue);
        }
    }

    [Fact]
    public void ValidationRejectsMalformedConnectionString()
    {
        var exception = Assert.Throws<InvalidOperationException>(
            () => PostgreSqlFixture.ValidateConnectionString("not-a-connection-string"));

        Assert.Contains("not a valid PostgreSQL connection string", exception.Message);
    }

    [Theory]
    [InlineData("Host=production.example.com;Database=kaza_test;Username=test;Password=test")]
    [InlineData("Host=10.10.10.10;Database=kaza_test;Username=test;Password=test")]
    public void ValidationRejectsNonLocalHosts(string connectionString)
    {
        var exception = Assert.Throws<InvalidOperationException>(
            () => PostgreSqlFixture.ValidateConnectionString(connectionString));

        Assert.Contains("refuse non-local host", exception.Message);
    }

    [Theory]
    [InlineData("Host=127.0.0.1;Database=RentalPlatform;Username=test;Password=test")]
    [InlineData("Host=localhost;Database=postgres;Username=test;Password=test")]
    public void ValidationRejectsNonTestDatabaseNames(string connectionString)
    {
        var exception = Assert.Throws<InvalidOperationException>(
            () => PostgreSqlFixture.ValidateConnectionString(connectionString));

        Assert.Contains("beginning with 'kaza_test'", exception.Message);
    }

    [Fact]
    public void ValidationAcceptsOnlyExplicitLocalTestDatabase()
    {
        var result = PostgreSqlFixture.ValidateConnectionString(
            "Host=127.0.0.1;Port=55432;Database=kaza_test;Username=test;Password=test");

        Assert.Equal("127.0.0.1", result.Host);
        Assert.Equal("kaza_test", result.Database);
        Assert.False(result.Pooling);
    }
}
