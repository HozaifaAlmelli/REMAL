using Microsoft.EntityFrameworkCore;
using Npgsql;
using RentalPlatform.Business.Exceptions;
using RentalPlatform.Business.Models;
using RentalPlatform.Business.Services;
using RentalPlatform.Data;
using RentalPlatform.Data.Entities;
using RentalPlatform.Shared.Constants;
using RentalPlatform.Shared.Enums;
using RentalPlatform.Tests.Infrastructure;
using Xunit;

namespace RentalPlatform.Tests;

[Collection(PostgreSqlTestCollection.Name)]
[Trait(TestCategories.Name, TestCategories.PostgreSql)]
public sealed class HistoricalPaymentPostgreSqlTests
{
    private static readonly DateTimeOffset Now =
        new(2026, 8, 1, 19, 0, 0, TimeSpan.Zero);
    private readonly PostgreSqlFixture _fixture;

    public HistoricalPaymentPostgreSqlTests(PostgreSqlFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task RecordsImmutableEvidenceAndReplaysSamePersistedResult()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        SeededData seed;
        RecordHistoricalPaymentCommand command;
        HistoricalPaymentResult initial;
        HistoricalPaymentResult replay;
        await using (var context = database.CreateDbContext())
        {
            seed = await SeedAsync(context, agreedAmount: 1000m);
            command = Command(seed.Booking.Id, seed.Admin.Id, Guid.NewGuid(), 400m, " Legacy-Receipt-1 ");
            var service = Service(context);
            initial = await service.RecordAsync(command);
            replay = await service.RecordAsync(command with
            {
                PaymentMethod = " CASH ",
                ReferenceNumber = "legacy-receipt-1",
                Reason = "Recorded   from verified legacy receipt"
            });
            var mismatch = await Assert.ThrowsAsync<ConflictException>(() => service.RecordAsync(
                command with { Amount = 401m }));
            Assert.Equal(HistoricalErrorCodes.HistoricalPaymentIdempotencyKeyReused, mismatch.Code);
        }

        Assert.False(initial.IsReplay);
        Assert.True(replay.IsReplay);
        Assert.Equal(initial.Payment.Id, replay.Payment.Id);
        Assert.Equal(initial.HistoryEventId, replay.HistoryEventId);

        await using var verify = database.CreateDbContext();
        var payment = await verify.Payments.AsNoTracking().SingleAsync();
        Assert.True(payment.IsHistoricalRecord);
        Assert.Equal("paid", payment.PaymentStatus);
        Assert.Equal(seed.Admin.Id, payment.CreatedByAdminUserId);
        Assert.Equal("Recorded from verified legacy receipt", payment.RecordedReason);
        Assert.Equal("Legacy-Receipt-1", payment.ReferenceNumber);
        Assert.Equal(400m, payment.Amount);
        Assert.Null(payment.InvoiceId);
        Assert.Equal(1, await verify.BookingStatusHistories.CountAsync(history =>
            history.Notes == BookingHistoryEvents.HistoricalPaymentRecordedFor(payment.Id)));
        Assert.Equal(1, await verify.HistoricalPaymentIdempotencyKeys.CountAsync());
        Assert.Equal(0, await verify.Invoices.CountAsync());
        Assert.Equal(0, await verify.OwnerPayouts.CountAsync());
        Assert.Equal(0, await verify.Notifications.CountAsync());
        Assert.Equal(0, await verify.NotificationDeliveryLogs.CountAsync());
        Assert.Equal(0, await verify.CrmLeads.CountAsync());
        Assert.Equal(0, await verify.CrmNotes.CountAsync());
        Assert.Equal(0, await verify.CrmAssignments.CountAsync());
        var booking = await verify.Bookings.AsNoTracking().SingleAsync(item => item.Id == seed.Booking.Id);
        Assert.Equal(1000m, booking.AgreedAmount);
        Assert.Equal(1000m, booking.BaseAmount);
        Assert.Equal(1000m, booking.FinalAmount);
    }

    [Fact]
    public async Task MultiplePaymentsReferenceRulesAndStableRejectionsAreEnforced()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        await using var context = database.CreateDbContext();
        var seed = await SeedAsync(context, agreedAmount: 100m);
        var secondBooking = await AddHistoricalBookingAsync(context, seed, 100m);
        var service = Service(context);

        await service.RecordAsync(Command(seed.Booking.Id, seed.Admin.Id, Guid.NewGuid(), 40m, "REF-1"));
        await service.RecordAsync(Command(seed.Booking.Id, seed.Admin.Id, Guid.NewGuid(), 60m, null));
        await service.RecordAsync(Command(secondBooking.Id, seed.Admin.Id, Guid.NewGuid(), 10m, "ref-1"));

        var over = await Assert.ThrowsAsync<ConflictException>(() =>
            service.RecordAsync(Command(seed.Booking.Id, seed.Admin.Id, Guid.NewGuid(), 1m, null)));
        Assert.Equal(HistoricalErrorCodes.HistoricalPaymentExceedsAgreedAmount, over.Code);

        var duplicate = await Assert.ThrowsAsync<ConflictException>(() =>
            service.RecordAsync(Command(secondBooking.Id, seed.Admin.Id, Guid.NewGuid(), 10m, " REF-1 ")));
        Assert.Equal(HistoricalErrorCodes.HistoricalPaymentReferenceAlreadyExists, duplicate.Code);

        var normalBooking = await AddNormalBookingAsync(context, seed);
        var nonhistorical = await Assert.ThrowsAsync<ConflictException>(() =>
            service.RecordAsync(Command(normalBooking.Id, seed.Admin.Id, Guid.NewGuid(), 10m, null)));
        Assert.Equal(HistoricalErrorCodes.HistoricalPaymentBookingRequired, nonhistorical.Code);

        await context.Database.ExecuteSqlRawAsync(
            "ALTER TABLE bookings DROP CONSTRAINT ck_bookings_historical_agreed_amount_coherent");
        await context.Database.ExecuteSqlInterpolatedAsync($"""
            UPDATE bookings
            SET is_historical = TRUE,
                actual_booked_at = DATE '2026-07-01',
                historical_entry_reason = 'external_platform_import',
                original_source = 'legacy_system',
                booking_status = 'completed',
                agreed_amount = NULL
            WHERE id = {normalBooking.Id}
            """);
        context.ChangeTracker.Clear();
        var snapshot = await Assert.ThrowsAsync<ConflictException>(() =>
            service.RecordAsync(Command(normalBooking.Id, seed.Admin.Id, Guid.NewGuid(), 10m, null)));
        Assert.Equal(HistoricalErrorCodes.HistoricalPaymentSnapshotRequired, snapshot.Code);

        Assert.Equal(3, await context.Payments.CountAsync());
        Assert.Equal(3, await context.HistoricalPaymentIdempotencyKeys.CountAsync());

        var missingBookingKey = Guid.NewGuid();
        var missing = await Assert.ThrowsAsync<NotFoundException>(() => service.RecordAsync(
            Command(Guid.NewGuid(), seed.Admin.Id, missingBookingKey, 10m, null)));
        Assert.Equal(HistoricalErrorCodes.HistoricalPaymentBookingNotFound, missing.Code);
        Assert.False(await context.HistoricalPaymentIdempotencyKeys.AnyAsync(item => item.Key == missingBookingKey));

        var inProgressCommand = Command(seed.Booking.Id, seed.Admin.Id, Guid.NewGuid(), 1m, null);
        context.HistoricalPaymentIdempotencyKeys.Add(new HistoricalPaymentIdempotencyKey
        {
            ActorAdminUserId = seed.Admin.Id,
            Endpoint = HistoricalPaymentService.Endpoint,
            Key = inProgressCommand.IdempotencyKey,
            RequestHash = HistoricalPaymentRequestHasher.Compute(inProgressCommand),
            CreatedAt = Now.UtcDateTime
        });
        await context.SaveChangesAsync();
        var inProgress = await Assert.ThrowsAsync<ConflictException>(() =>
            service.RecordAsync(inProgressCommand));
        Assert.Equal(HistoricalErrorCodes.HistoricalPaymentRequestInProgress, inProgress.Code);
    }

    [Fact]
    [Trait(TestCategories.Name, TestCategories.Concurrency)]
    public async Task ConcurrentSameCommandReplaysOnceAndTextualKeyRemainsActorScoped()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        SeededData seed;
        await using (var setup = database.CreateDbContext())
            seed = await SeedAsync(setup, agreedAmount: 100m, addSecondAdmin: true);

        var key = Guid.NewGuid();
        var command = Command(seed.Booking.Id, seed.Admin.Id, key, 30m, null);
        await using var firstContext = database.CreateDbContext();
        await using var secondContext = database.CreateDbContext();
        var results = await Task.WhenAll(
            Service(firstContext).RecordAsync(command),
            Service(secondContext).RecordAsync(command));

        Assert.Equal(results[0].Payment.Id, results[1].Payment.Id);
        Assert.Single(results, result => result.IsReplay);

        await using (var otherActorContext = database.CreateDbContext())
        {
            var otherActorResult = await Service(otherActorContext).RecordAsync(
                Command(seed.Booking.Id, seed.SecondAdmin!.Id, key, 20m, null));
            Assert.NotEqual(results[0].Payment.Id, otherActorResult.Payment.Id);
        }

        await using var verify = database.CreateDbContext();
        Assert.Equal(2, await verify.Payments.CountAsync(payment => payment.IsHistoricalRecord));
        Assert.Equal(2, await verify.HistoricalPaymentIdempotencyKeys.CountAsync());
        Assert.Equal(2, await verify.BookingStatusHistories.CountAsync(history =>
            history.Notes != null && history.Notes.StartsWith(BookingHistoryEvents.HistoricalPaymentRecorded)));
    }

    [Fact]
    [Trait(TestCategories.Name, TestCategories.Concurrency)]
    public async Task ConcurrentDifferentKeysSerializeCumulativeAmountAndLoserRollsBack()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        SeededData seed;
        await using (var setup = database.CreateDbContext())
            seed = await SeedAsync(setup, agreedAmount: 100m, addSecondAdmin: true);

        await using var firstContext = database.CreateDbContext();
        await using var secondContext = database.CreateDbContext();
        var first = Service(firstContext).RecordAsync(
            Command(seed.Booking.Id, seed.Admin.Id, Guid.NewGuid(), 70m, null));
        var second = Service(secondContext).RecordAsync(
            Command(seed.Booking.Id, seed.SecondAdmin!.Id, Guid.NewGuid(), 70m, null));

        var outcomes = await Task.WhenAll(Capture(first), Capture(second));
        Assert.Single(outcomes, outcome => outcome.Result is not null);
        var loser = Assert.Single(outcomes, outcome => outcome.Error is not null).Error!;
        Assert.Equal(HistoricalErrorCodes.HistoricalPaymentExceedsAgreedAmount, loser.Code);

        await using var verify = database.CreateDbContext();
        Assert.Equal(1, await verify.Payments.CountAsync(payment => payment.IsHistoricalRecord));
        Assert.Equal(1, await verify.HistoricalPaymentIdempotencyKeys.CountAsync());
        Assert.Equal(1, await verify.BookingStatusHistories.CountAsync(history =>
            history.Notes != null && history.Notes.StartsWith(BookingHistoryEvents.HistoricalPaymentRecorded)));
    }

    [Fact]
    public async Task ImmutableAndLivePaymentPathsAreGuardedWhileNormalPaymentsRemainUnchanged()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        await using var context = database.CreateDbContext();
        var seed = await SeedAsync(context, agreedAmount: 100m);
        var result = await Service(context).RecordAsync(
            Command(seed.Booking.Id, seed.Admin.Id, Guid.NewGuid(), 50m, null));

        var normalService = new PaymentService(new UnitOfWork(context));
        var live = await Assert.ThrowsAsync<ConflictException>(() => normalService.CreateAsync(
            seed.Booking.Id, null, "cash", 10m, null, null));
        Assert.Equal(HistoricalErrorCodes.HistoricalPaymentLiveCollectionForbidden, live.Code);
        var mutate = await Assert.ThrowsAsync<ConflictException>(() =>
            normalService.MarkFailedAsync(result.Payment.Id, "not allowed"));
        Assert.Equal(HistoricalErrorCodes.HistoricalPaymentImmutable, mutate.Code);

        context.ChangeTracker.Clear();
        var tracked = await context.Payments.SingleAsync(payment => payment.Id == result.Payment.Id);
        tracked.Amount = 1m;
        var central = await Assert.ThrowsAsync<Data.Exceptions.HistoricalPaymentImmutableException>(
            () => context.SaveChangesAsync());
        Assert.Equal(HistoricalErrorCodes.HistoricalPaymentImmutable, central.Code);
        context.ChangeTracker.Clear();
        tracked = await context.Payments.SingleAsync(payment => payment.Id == result.Payment.Id);
        context.Payments.Remove(tracked);
        await Assert.ThrowsAsync<Data.Exceptions.HistoricalPaymentImmutableException>(
            () => context.SaveChangesAsync());

        context.ChangeTracker.Clear();
        var normalBooking = await AddNormalBookingAsync(context, seed);
        var normalPayment = await normalService.CreateAsync(
            normalBooking.Id, null, "cash", 10m, null, "sanitized normal payment");
        Assert.False(normalPayment.IsHistoricalRecord);
        Assert.Equal("pending", normalPayment.PaymentStatus);
    }

    [Fact]
    public async Task ManualInvoiceIssueLeavesHistoricalEvidenceStandaloneAndLinksOrdinaryPayment()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        await using var context = database.CreateDbContext();
        var seed = await SeedAsync(context, agreedAmount: 100m);
        var evidence = await Service(context).RecordAsync(
            Command(seed.Booking.Id, seed.Admin.Id, Guid.NewGuid(), 100m, "INVOICE-STANDALONE"));
        var evidenceBefore = EvidenceValues(evidence.Payment);
        var invoiceService = new InvoiceService(new UnitOfWork(context));

        var historicalDraft = await invoiceService.CreateDraftFromBookingAsync(
            seed.Booking.Id, null, "manual historical invoice");
        var historicalIssued = await invoiceService.IssueAsync(historicalDraft.Id);
        Assert.Equal("issued", historicalIssued.InvoiceStatus);

        var normalBooking = await AddNormalBookingAsync(context, seed);
        var normalPayment = await new PaymentService(new UnitOfWork(context)).CreateAsync(
            normalBooking.Id, null, "cash", 25m, null, "ordinary payment");
        var normalDraft = await invoiceService.CreateDraftFromBookingAsync(
            normalBooking.Id, null, "normal invoice");
        await invoiceService.IssueAsync(normalDraft.Id);

        context.ChangeTracker.Clear();
        var persistedEvidence = await context.Payments.AsNoTracking()
            .SingleAsync(payment => payment.Id == evidence.Payment.Id);
        var persistedNormal = await context.Payments.AsNoTracking()
            .SingleAsync(payment => payment.Id == normalPayment.Id);
        Assert.Null(persistedEvidence.InvoiceId);
        Assert.Equal(evidenceBefore, EvidenceValues(persistedEvidence));
        Assert.Equal(normalDraft.Id, persistedNormal.InvoiceId);
    }

    [Fact]
    public async Task ReissueLeavesHistoricalEvidenceUntouched()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        await using var context = database.CreateDbContext();
        var seed = await SeedAsync(context, agreedAmount: 100m);
        var evidence = await Service(context).RecordAsync(
            Command(seed.Booking.Id, seed.Admin.Id, Guid.NewGuid(), 100m, "REISSUE-STANDALONE"));
        var evidenceBefore = EvidenceValues(evidence.Payment);
        var invoiceService = new InvoiceService(new UnitOfWork(context));
        var draft = await invoiceService.CreateDraftFromBookingAsync(
            seed.Booking.Id, null, "manual historical invoice");
        var issued = await invoiceService.IssueAsync(draft.Id);

        var replacement = await invoiceService.ReissueAsync(
            issued.Id, $"INV-REISSUE-{Guid.NewGuid():N}", "replacement");

        Assert.Equal("issued", replacement.InvoiceStatus);
        context.ChangeTracker.Clear();
        var persistedEvidence = await context.Payments.AsNoTracking()
            .SingleAsync(payment => payment.Id == evidence.Payment.Id);
        Assert.Null(persistedEvidence.InvoiceId);
        Assert.Equal(evidenceBefore, EvidenceValues(persistedEvidence));
    }

    [Fact]
    public async Task GlobalOrphanLinkingLinksOnlyOrdinaryPayments()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        await using var context = database.CreateDbContext();
        var seed = await SeedAsync(context, agreedAmount: 100m);
        var evidence = await Service(context).RecordAsync(
            Command(seed.Booking.Id, seed.Admin.Id, Guid.NewGuid(), 20m, "ORPHAN-STANDALONE"));
        var evidenceBefore = EvidenceValues(evidence.Payment);
        var invoiceService = new InvoiceService(new UnitOfWork(context));
        await invoiceService.CreateDraftFromBookingAsync(seed.Booking.Id, null, "historical draft");

        var normalBooking = await AddNormalBookingAsync(context, seed);
        var normalPayment = await new PaymentService(new UnitOfWork(context)).CreateAsync(
            normalBooking.Id, null, "cash", 25m, null, "ordinary orphan");
        var normalDraft = await invoiceService.CreateDraftFromBookingAsync(
            normalBooking.Id, null, "normal draft");

        Assert.Equal(1, await invoiceService.LinkOrphanedPaymentsAsync());

        context.ChangeTracker.Clear();
        var persistedEvidence = await context.Payments.AsNoTracking()
            .SingleAsync(payment => payment.Id == evidence.Payment.Id);
        var persistedNormal = await context.Payments.AsNoTracking()
            .SingleAsync(payment => payment.Id == normalPayment.Id);
        Assert.Null(persistedEvidence.InvoiceId);
        Assert.Equal(evidenceBefore, EvidenceValues(persistedEvidence));
        Assert.Equal(normalDraft.Id, persistedNormal.InvoiceId);
    }

    [Fact]
    public async Task Migration0061VerifierUpgradeAndRollbackGuardsAreExecutable()
    {
        await using var database = await _fixture.CreateTestDatabaseAsync();
        var root = RepositoryRoot();
        var migration = await File.ReadAllTextAsync(Path.Combine(root, "db", "migrations", "0061_add_historical_payment_recording.sql"));
        var verifier = await File.ReadAllTextAsync(Path.Combine(root, "db", "migrations", "0061_add_historical_payment_recording_verify.sql"));
        var rollback = await File.ReadAllTextAsync(Path.Combine(root, "db", "migrations", "0061_add_historical_payment_recording_rollback.sql"));
        var reportingRollback = await File.ReadAllTextAsync(Path.Combine(root, "db", "migrations", "0063_add_historical_reporting_read_models_rollback.sql"));

        await using (var connection = await database.OpenConnectionAsync())
        {
            await ExecuteAsync(connection, verifier);
            await ExecuteAsync(connection, reportingRollback);
            await ExecuteAsync(connection, rollback);
            Assert.True(Convert.ToBoolean(await ScalarAsync(connection,
                "SELECT to_regclass('public.historical_payment_idempotency_keys') IS NULL")));
            await ExecuteAsync(connection, migration);
            await ExecuteAsync(connection, verifier);
        }

        await using (var context = database.CreateDbContext())
        {
            var seed = await SeedAsync(context, 100m);
            await Service(context).RecordAsync(Command(
                seed.Booking.Id, seed.Admin.Id, Guid.NewGuid(), 25m, "ROLLBACK-GUARD"));
        }

        await using (var guardedConnection = await database.OpenConnectionAsync())
        {
            var refusal = await Assert.ThrowsAsync<PostgresException>(() => ExecuteAsync(guardedConnection, rollback));
            Assert.Contains("rollback refused", refusal.MessageText, StringComparison.OrdinalIgnoreCase);
        }

        await using var verificationConnection = await database.OpenConnectionAsync();
        await ExecuteAsync(verificationConnection, verifier);
        Assert.Equal(1L, Convert.ToInt64(await ScalarAsync(
            verificationConnection, "SELECT count(*) FROM payments WHERE is_historical_record")));
    }

    private static HistoricalPaymentService Service(AppDbContext context) =>
        new(new UnitOfWork(context), new FixedTimeProvider(Now));

    private static RecordHistoricalPaymentCommand Command(
        Guid bookingId,
        Guid actorId,
        Guid key,
        decimal amount,
        string? reference) => new(
            bookingId,
            amount,
            "cash",
            new DateTimeOffset(2026, 7, 15, 7, 30, 0, TimeSpan.Zero),
            reference,
            "Recorded from verified legacy receipt",
            actorId,
            key);

    private static async Task<Outcome> Capture(Task<HistoricalPaymentResult> operation)
    {
        try { return new Outcome(await operation, null); }
        catch (ConflictException exception) { return new Outcome(null, exception); }
    }

    private static async Task<SeededData> SeedAsync(
        AppDbContext context,
        decimal agreedAmount,
        bool addSecondAdmin = false)
    {
        var suffix = Guid.NewGuid().ToString("N");
        var owner = new Owner
        {
            Id = Guid.NewGuid(), Name = "Sanitized payment owner",
            Phone = TestPhone("20"), EmergencyPhone = TestPhone("21"),
            CommissionRate = 10m, Status = "active", PasswordHash = "test-only-hash"
        };
        var project = new Project { Id = Guid.NewGuid(), Name = $"Sanitized payment project {suffix}", IsActive = true };
        var client = new Client
        {
            Id = Guid.NewGuid(), Name = "Sanitized payment client", Phone = TestPhone("22"),
            PasswordHash = "test-only-hash", IsActive = true
        };
        var admin = Admin($"payment-{suffix}@example.test");
        var secondAdmin = addSecondAdmin ? Admin($"payment-second-{suffix}@example.test") : null;
        var unit = new Unit
        {
            Id = Guid.NewGuid(), OwnerId = owner.Id, ProjectId = project.Id,
            Name = $"Sanitized payment unit {suffix}", UnitType = "apartment",
            Bedrooms = 2, Bathrooms = 1, MaxGuests = 4, BasePricePerNight = 100m,
            IsActive = true, IsVisibleInPortfolio = true
        };
        context.AddRange(owner, project, client, admin, unit);
        if (secondAdmin is not null) context.AdminUsers.Add(secondAdmin);
        await context.SaveChangesAsync();
        var booking = await AddHistoricalBookingAsync(
            context, new SeededData(owner, client, admin, secondAdmin, unit, null!), agreedAmount);
        return new SeededData(owner, client, admin, secondAdmin, unit, booking);
    }

    private static AdminUser Admin(string email) => new()
    {
        Id = Guid.NewGuid(), Name = "Sanitized payment admin", Email = email,
        PasswordHash = "test-only-hash",
        RoleTemplateId = Guid.Parse("10000000-0000-0000-0000-000000000001"), IsActive = true
    };

    private static async Task<Booking> AddHistoricalBookingAsync(
        AppDbContext context,
        SeededData seed,
        decimal agreedAmount)
    {
        var booking = new Booking
        {
            Id = Guid.NewGuid(), ClientId = seed.Client.Id, UnitId = seed.Unit.Id, OwnerId = seed.Owner.Id,
            BookingStatus = BookingStatus.Completed,
            CheckInDate = new DateOnly(2026, 7, 10), CheckOutDate = new DateOnly(2026, 7, 12),
            GuestCount = 2, BaseAmount = agreedAmount, FinalAmount = agreedAmount, AgreedAmount = agreedAmount,
            Source = "admin", IsHistorical = true, ActualBookedAt = new DateOnly(2026, 7, 1),
            HistoricalEntryReason = HistoricalEntryReasons.ExternalPlatformImport,
            OriginalSource = "legacy_system"
        };
        context.Bookings.Add(booking);
        await context.SaveChangesAsync();
        return booking;
    }

    private static async Task<Booking> AddNormalBookingAsync(AppDbContext context, SeededData seed)
    {
        var booking = new Booking
        {
            Id = Guid.NewGuid(), ClientId = seed.Client.Id, UnitId = seed.Unit.Id, OwnerId = seed.Owner.Id,
            BookingStatus = BookingStatus.Booked,
            CheckInDate = new DateOnly(2026, 9, 10), CheckOutDate = new DateOnly(2026, 9, 12),
            GuestCount = 2, BaseAmount = 100m, FinalAmount = 100m,
            Source = "admin", IsHistorical = false
        };
        context.Bookings.Add(booking);
        await context.SaveChangesAsync();
        return booking;
    }

    private static string TestPhone(string prefix)
    {
        var value = BitConverter.ToUInt32(Guid.NewGuid().ToByteArray(), 0) % 10_000_000_000L;
        return $"+{prefix}{value:D10}";
    }

    private static object?[] EvidenceValues(Payment payment) =>
    [
        payment.Id,
        payment.BookingId,
        payment.InvoiceId,
        payment.PaymentStatus,
        payment.PaymentMethod,
        payment.Amount,
        payment.ReferenceNumber,
        payment.Notes,
        payment.PaidAt,
        payment.IsHistoricalRecord,
        payment.CreatedByAdminUserId,
        payment.RecordedReason,
        payment.CreatedAt,
        payment.UpdatedAt
    ];

    private static async Task ExecuteAsync(NpgsqlConnection connection, string sql)
    {
        await using var command = new NpgsqlCommand(sql, connection) { CommandTimeout = 120 };
        await command.ExecuteNonQueryAsync();
    }

    private static async Task<object?> ScalarAsync(NpgsqlConnection connection, string sql)
    {
        await using var command = new NpgsqlCommand(sql, connection);
        return await command.ExecuteScalarAsync();
    }

    private static string RepositoryRoot()
    {
        for (var directory = new DirectoryInfo(Directory.GetCurrentDirectory()); directory is not null; directory = directory.Parent)
            if (File.Exists(Path.Combine(directory.FullName, "RentalPlatform.slnx"))) return directory.FullName;
        throw new DirectoryNotFoundException("Repository root not found.");
    }

    private sealed record SeededData(
        Owner Owner, Client Client, AdminUser Admin, AdminUser? SecondAdmin, Unit Unit, Booking Booking);
    private sealed record Outcome(HistoricalPaymentResult? Result, ConflictException? Error);

    private sealed class FixedTimeProvider : TimeProvider
    {
        private readonly DateTimeOffset _now;
        public FixedTimeProvider(DateTimeOffset now) => _now = now;
        public override DateTimeOffset GetUtcNow() => _now;
    }
}
