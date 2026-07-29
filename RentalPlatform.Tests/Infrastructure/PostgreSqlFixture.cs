using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using RentalPlatform.Data;
using Xunit;

namespace RentalPlatform.Tests.Infrastructure;

public sealed class PostgreSqlFixture : IAsyncLifetime
{
    public const string ConnectionStringEnvironmentVariable = "KAZA_TEST_DB";

    private static readonly Regex SafeDatabaseName = new(
        @"^kaza_test(?:_[a-z0-9]+)*$",
        RegexOptions.Compiled | RegexOptions.CultureInvariant | RegexOptions.IgnoreCase);

    private static readonly Regex BootstrapInclude = new(
        @"^\s*\\i\s+/docker-entrypoint-initdb\.d/migrations/(?<file>[^\s]+\.sql)\s*$",
        RegexOptions.Compiled | RegexOptions.CultureInvariant | RegexOptions.Multiline);

    private readonly SemaphoreSlim _databaseGate = new(1, 1);
    private readonly HashSet<string> _databases = new(StringComparer.Ordinal);
    private readonly string _runId = $"{Environment.ProcessId:x}_{Guid.NewGuid():N}"[..13];
    private NpgsqlConnectionStringBuilder? _baseConnection;
    private string? _templateDatabase;
    private int _databaseSequence;

    public async Task InitializeAsync()
    {
        _baseConnection = ValidateConnectionString(GetRequiredConnectionString());
        _templateDatabase = $"kaza_test_tpl_{_runId}";

        try
        {
            await VerifyPostgreSql16Async();
            await CreateDatabaseAsync(_templateDatabase);
            await ApplyBootstrapAsync(_templateDatabase);
        }
        catch (Exception exception)
        {
            await TryDropDatabaseAsync(_templateDatabase);
            throw new InvalidOperationException(
                $"PostgreSQL integration test initialization failed for the test-only " +
                $"database '{_baseConnection.Database}' at " +
                $"{_baseConnection.Host}:{_baseConnection.Port}. Start PostgreSQL 16 and set " +
                $"{ConnectionStringEnvironmentVariable} to a local connection whose database " +
                "name starts with 'kaza_test'. No SQLite or in-memory fallback is used.",
                exception);
        }
    }

    public static string GetRequiredConnectionString()
    {
        var configuredConnection = Environment.GetEnvironmentVariable(
            ConnectionStringEnvironmentVariable);
        if (string.IsNullOrWhiteSpace(configuredConnection))
        {
            throw new InvalidOperationException(
                $"{ConnectionStringEnvironmentVariable} is required for PostgreSQL integration " +
                "tests. Set it to an authorized disposable local PostgreSQL 16 instance using a " +
                "database name beginning with 'kaza_test'. No automatic connection to the " +
                "developer Docker Compose database is performed, and no SQLite, EF Core " +
                "InMemory, mock, localhost-default, or repository-configuration fallback is used.");
        }

        return configuredConnection;
    }

    public async Task<PostgreSqlTestDatabase> CreateTestDatabaseAsync(
        CancellationToken cancellationToken = default)
    {
        EnsureInitialized();
        var databaseName =
            $"kaza_test_{_runId}_{Interlocked.Increment(ref _databaseSequence):x}";

        await _databaseGate.WaitAsync(cancellationToken);
        try
        {
            await CreateDatabaseAsync(databaseName, _templateDatabase, cancellationToken);
            _databases.Add(databaseName);
        }
        finally
        {
            _databaseGate.Release();
        }

        return new PostgreSqlTestDatabase(
            this,
            databaseName,
            BuildConnectionString(databaseName));
    }

    public async Task DisposeAsync()
    {
        await _databaseGate.WaitAsync();
        try
        {
            foreach (var databaseName in _databases.ToArray())
            {
                await DropDatabaseAsync(databaseName);
            }

            _databases.Clear();
            if (_templateDatabase is not null)
            {
                await DropDatabaseAsync(_templateDatabase);
            }
        }
        finally
        {
            _databaseGate.Release();
            _databaseGate.Dispose();
        }
    }

    public static NpgsqlConnectionStringBuilder ValidateConnectionString(
        string connectionString)
    {
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException(
                $"{ConnectionStringEnvironmentVariable} must contain a PostgreSQL connection string.");
        }

        NpgsqlConnectionStringBuilder builder;
        try
        {
            builder = new NpgsqlConnectionStringBuilder(connectionString);
        }
        catch (ArgumentException exception)
        {
            throw new InvalidOperationException(
                $"{ConnectionStringEnvironmentVariable} is not a valid PostgreSQL connection string.",
                exception);
        }

        var host = (builder.Host ?? string.Empty).Trim().Trim('[', ']');
        if (!host.Equals("localhost", StringComparison.OrdinalIgnoreCase)
            && !host.Equals("127.0.0.1", StringComparison.OrdinalIgnoreCase)
            && !host.Equals("::1", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException(
                $"PostgreSQL integration tests refuse non-local host '{host}'.");
        }

        if (!SafeDatabaseName.IsMatch(builder.Database ?? string.Empty))
        {
            throw new InvalidOperationException(
                "PostgreSQL integration tests require a database name beginning with 'kaza_test'.");
        }

        builder.Pooling = false;
        builder.Timeout = builder.Timeout is <= 0 or > 5 ? 5 : builder.Timeout;
        builder.CommandTimeout = Math.Max(builder.CommandTimeout, 120);
        builder.ApplicationName = "Kaza PRE-02 integration tests";
        return builder;
    }

    internal AppDbContext CreateDbContext(string connectionString)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(connectionString)
            .Options;
        return new AppDbContext(options);
    }

    internal async Task<NpgsqlConnection> OpenConnectionAsync(
        string connectionString,
        CancellationToken cancellationToken)
    {
        var connection = new NpgsqlConnection(connectionString);
        try
        {
            await connection.OpenAsync(cancellationToken);
            return connection;
        }
        catch
        {
            await connection.DisposeAsync();
            throw;
        }
    }

    internal async Task ResetDatabaseAsync(
        string databaseName,
        CancellationToken cancellationToken)
    {
        EnsureOwnedDatabase(databaseName);
        await _databaseGate.WaitAsync(cancellationToken);
        try
        {
            await DropDatabaseAsync(databaseName, cancellationToken);
            await CreateDatabaseAsync(databaseName, _templateDatabase, cancellationToken);
        }
        finally
        {
            _databaseGate.Release();
        }
    }

    internal async Task ReleaseDatabaseAsync(string databaseName)
    {
        await _databaseGate.WaitAsync();
        try
        {
            if (_databases.Remove(databaseName))
            {
                await DropDatabaseAsync(databaseName);
            }
        }
        finally
        {
            _databaseGate.Release();
        }
    }

    private async Task VerifyPostgreSql16Async()
    {
        await using var connection = await OpenAdminConnectionAsync();
        await using var command = new NpgsqlCommand("SHOW server_version_num", connection);
        var version = Convert.ToInt32(await command.ExecuteScalarAsync());
        if (version < 160000 || version >= 170000)
        {
            throw new InvalidOperationException(
                $"PostgreSQL 16 is required; the local server reported version number {version}.");
        }
    }

    private async Task ApplyBootstrapAsync(string databaseName)
    {
        var repositoryRoot = ResolveRepositoryRoot();
        var initPath = Path.Combine(repositoryRoot, "db", "init.sql");
        var migrationsPath = Path.Combine(repositoryRoot, "db", "migrations");
        var initSql = await File.ReadAllTextAsync(initPath);
        var migrationFiles = BootstrapInclude.Matches(initSql)
            .Select(match => match.Groups["file"].Value)
            .ToArray();

        if (migrationFiles.Length == 0)
        {
            throw new InvalidOperationException(
                $"No migration includes were found in '{initPath}'.");
        }

        var duplicate = migrationFiles
            .GroupBy(file => file, StringComparer.Ordinal)
            .FirstOrDefault(group => group.Count() > 1);
        if (duplicate is not null)
        {
            throw new InvalidOperationException(
                $"Bootstrap migration '{duplicate.Key}' is included more than once.");
        }

        await using var connection = await OpenConnectionAsync(
            BuildConnectionString(databaseName),
            CancellationToken.None);

        foreach (var migrationFile in migrationFiles)
        {
            if (!migrationFile.Equals(Path.GetFileName(migrationFile), StringComparison.Ordinal)
                || !migrationFile.EndsWith(".sql", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException(
                    $"Unsafe migration include '{migrationFile}' in '{initPath}'.");
            }

            var migrationPath = Path.Combine(migrationsPath, migrationFile);
            if (!File.Exists(migrationPath))
            {
                throw new FileNotFoundException(
                    $"Bootstrap migration '{migrationFile}' does not exist.",
                    migrationPath);
            }

            var sql = await File.ReadAllTextAsync(migrationPath);
            await using var command = new NpgsqlCommand(sql, connection)
            {
                CommandTimeout = 120
            };

            try
            {
                await command.ExecuteNonQueryAsync();
            }
            catch (Exception exception)
            {
                throw new InvalidOperationException(
                    $"Bootstrap migration '{migrationFile}' failed in the PostgreSQL test template.",
                    exception);
            }
        }
    }

    private async Task CreateDatabaseAsync(
        string databaseName,
        string? templateDatabase = null,
        CancellationToken cancellationToken = default)
    {
        EnsureSafeGeneratedName(databaseName);
        await using var connection = await OpenAdminConnectionAsync(cancellationToken);
        var templateClause = templateDatabase is null
            ? string.Empty
            : $" TEMPLATE {QuoteIdentifier(templateDatabase)}";
        await using var command = new NpgsqlCommand(
            $"CREATE DATABASE {QuoteIdentifier(databaseName)}{templateClause}",
            connection)
        {
            CommandTimeout = 120
        };
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private async Task DropDatabaseAsync(
        string databaseName,
        CancellationToken cancellationToken = default)
    {
        EnsureSafeGeneratedName(databaseName);
        NpgsqlConnection.ClearAllPools();
        await using var connection = await OpenAdminConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(
            $"DROP DATABASE IF EXISTS {QuoteIdentifier(databaseName)} WITH (FORCE)",
            connection)
        {
            CommandTimeout = 30
        };
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private async Task TryDropDatabaseAsync(string databaseName)
    {
        try
        {
            await DropDatabaseAsync(databaseName);
        }
        catch
        {
            // Initialization errors should retain the original failure; successful test
            // runs still use the strict cleanup path in ReleaseDatabaseAsync.
        }
    }

    private async Task<NpgsqlConnection> OpenAdminConnectionAsync(
        CancellationToken cancellationToken = default)
    {
        EnsureInitializedConnection();
        var builder = new NpgsqlConnectionStringBuilder(_baseConnection!.ConnectionString)
        {
            Database = "postgres",
            Pooling = false
        };
        return await OpenConnectionAsync(builder.ConnectionString, cancellationToken);
    }

    private string BuildConnectionString(string databaseName)
    {
        EnsureInitializedConnection();
        var builder = new NpgsqlConnectionStringBuilder(_baseConnection!.ConnectionString)
        {
            Database = databaseName,
            Pooling = false
        };
        return builder.ConnectionString;
    }

    private void EnsureInitialized()
    {
        EnsureInitializedConnection();
        if (_templateDatabase is null)
        {
            throw new InvalidOperationException(
                "The PostgreSQL integration fixture has not initialized its template database.");
        }
    }

    private void EnsureInitializedConnection()
    {
        if (_baseConnection is null)
        {
            throw new InvalidOperationException(
                "The PostgreSQL integration fixture has not resolved its test connection.");
        }
    }

    private void EnsureOwnedDatabase(string databaseName)
    {
        EnsureSafeGeneratedName(databaseName);
        if (!_databases.Contains(databaseName))
        {
            throw new InvalidOperationException(
                $"Database '{databaseName}' is not owned by this test fixture.");
        }
    }

    private static void EnsureSafeGeneratedName(string databaseName)
    {
        if (!SafeDatabaseName.IsMatch(databaseName))
        {
            throw new InvalidOperationException(
                $"Refusing database operation for unsafe name '{databaseName}'.");
        }
    }

    private static string QuoteIdentifier(string identifier) =>
        $"\"{identifier.Replace("\"", "\"\"", StringComparison.Ordinal)}\"";

    private static string ResolveRepositoryRoot()
    {
        var configuredRoot = Environment.GetEnvironmentVariable("KAZA_REPOSITORY_ROOT");
        if (!string.IsNullOrWhiteSpace(configuredRoot))
        {
            return ValidateRepositoryRoot(configuredRoot);
        }

        foreach (var start in new[] { Directory.GetCurrentDirectory(), AppContext.BaseDirectory })
        {
            for (var directory = new DirectoryInfo(start);
                 directory is not null;
                 directory = directory.Parent)
            {
                if (File.Exists(Path.Combine(directory.FullName, "RentalPlatform.slnx"))
                    && File.Exists(Path.Combine(directory.FullName, "db", "init.sql")))
                {
                    return directory.FullName;
                }
            }
        }

        throw new DirectoryNotFoundException(
            "Could not locate the repository root containing RentalPlatform.slnx and db/init.sql. " +
            "Set KAZA_REPOSITORY_ROOT explicitly.");
    }

    private static string ValidateRepositoryRoot(string configuredRoot)
    {
        var root = Path.GetFullPath(configuredRoot);
        if (!File.Exists(Path.Combine(root, "RentalPlatform.slnx"))
            || !File.Exists(Path.Combine(root, "db", "init.sql")))
        {
            throw new DirectoryNotFoundException(
                $"KAZA_REPOSITORY_ROOT '{root}' does not contain the expected repository files.");
        }

        return root;
    }
}

public sealed class PostgreSqlTestDatabase : IAsyncDisposable
{
    private readonly PostgreSqlFixture _fixture;
    private int _disposed;

    internal PostgreSqlTestDatabase(
        PostgreSqlFixture fixture,
        string databaseName,
        string connectionString)
    {
        _fixture = fixture;
        DatabaseName = databaseName;
        ConnectionString = connectionString;
    }

    public string DatabaseName { get; }
    public string ConnectionString { get; }

    public AppDbContext CreateDbContext() => _fixture.CreateDbContext(ConnectionString);

    public Task<NpgsqlConnection> OpenConnectionAsync(
        CancellationToken cancellationToken = default) =>
        _fixture.OpenConnectionAsync(ConnectionString, cancellationToken);

    public Task ResetAsync(CancellationToken cancellationToken = default) =>
        _fixture.ResetDatabaseAsync(DatabaseName, cancellationToken);

    public async ValueTask DisposeAsync()
    {
        if (Interlocked.Exchange(ref _disposed, 1) == 0)
        {
            await _fixture.ReleaseDatabaseAsync(DatabaseName);
        }
    }
}
