using Microsoft.EntityFrameworkCore;
using RentalPlatform.API.Authorization;
using RentalPlatform.Business.Exceptions;
using RentalPlatform.Business.Services;
using RentalPlatform.Data;
using RentalPlatform.Data.Entities;
using RentalPlatform.Shared.Constants;
using RentalPlatform.Tests.Infrastructure;
using Xunit;

namespace RentalPlatform.Tests;

[Collection(PostgreSqlTestCollection.Name)]
[Trait(TestCategories.Name, TestCategories.PostgreSql)]
public sealed class RbacHistoricalPermissionPostgreSqlTests
{
    private static readonly Guid SalesRoleId =
        Guid.Parse("10000000-0000-0000-0000-000000000002");
    private static readonly Guid FinanceRoleId =
        Guid.Parse("10000000-0000-0000-0000-000000000003");

    private readonly PostgreSqlFixture _fixture;

    public RbacHistoricalPermissionPostgreSqlTests(PostgreSqlFixture fixture)
    {
        _fixture = fixture;
    }

    [Theory]
    [InlineData(RbacPermissionKeys.BookingsRecordHistorical)]
    [InlineData(RbacPermissionKeys.PaymentsRecordHistorical)]
    [InlineData(RbacPermissionKeys.BookingsCorrectOwnerAttribution)]
    public async Task SuperAdminHistoricalBaselinesCannotBeRemoved(string permissionKey)
    {
        await using var scope = await TestScope.CreateAsync(_fixture);
        var beforePermissions = await scope.PermissionKeysAsync(RbacSystemRoleTemplates.SuperAdminId);
        var beforeStamp = await scope.AdminUpdatedAtAsync(scope.Caller.Id);
        var proposed = beforePermissions.Where(key => key != permissionKey).ToArray();

        var error = await Assert.ThrowsAsync<BusinessValidationException>(() =>
            scope.Rbac.UpdateRoleTemplateAsync(
                scope.Caller.Id,
                RbacSystemRoleTemplates.SuperAdminId,
                "SuperAdmin",
                "Full platform administration.",
                proposed));

        Assert.Equal(RbacErrorCodes.HistoricalSuperAdminBaselineRequired, error.Code);
        Assert.Equal(beforePermissions, await scope.PermissionKeysAsync(RbacSystemRoleTemplates.SuperAdminId));
        Assert.Equal(beforeStamp, await scope.AdminUpdatedAtAsync(scope.Caller.Id));
    }

    [Fact]
    public async Task NonSuperAdminHistoricalCreationAndPaymentRemainIndependentAndEditable()
    {
        await using var scope = await TestScope.CreateAsync(_fixture);
        var salesMember = await scope.AddAdminAsync("RBAC Editable Sales", SalesRoleId);
        var sales = await scope.RoleAsync(SalesRoleId);
        var original = sales.Permissions.Select(entry => entry.PermissionKey).ToHashSet();

        var beforeBookingGrant = await scope.AdminUpdatedAtAsync(salesMember.Id);
        var withBooking = original.Append(RbacPermissionKeys.BookingsRecordHistorical).ToArray();
        await scope.Rbac.UpdateRoleTemplateAsync(
            scope.Caller.Id, sales.Id, sales.Name, sales.Description, withBooking);
        Assert.True(await scope.AdminUpdatedAtAsync(salesMember.Id) > beforeBookingGrant);
        Assert.Contains(RbacPermissionKeys.BookingsRecordHistorical, await scope.PermissionKeysAsync(sales.Id));
        Assert.DoesNotContain(RbacPermissionKeys.PaymentsRecordHistorical, await scope.PermissionKeysAsync(sales.Id));

        await scope.Rbac.UpdateRoleTemplateAsync(
            scope.Caller.Id, sales.Id, sales.Name, sales.Description, original.ToArray());
        Assert.DoesNotContain(RbacPermissionKeys.BookingsRecordHistorical, await scope.PermissionKeysAsync(sales.Id));

        var withPayment = original.Append(RbacPermissionKeys.PaymentsRecordHistorical).ToArray();
        await scope.Rbac.UpdateRoleTemplateAsync(
            scope.Caller.Id, sales.Id, sales.Name, sales.Description, withPayment);
        Assert.Contains(RbacPermissionKeys.PaymentsRecordHistorical, await scope.PermissionKeysAsync(sales.Id));
        Assert.DoesNotContain(RbacPermissionKeys.BookingsRecordHistorical, await scope.PermissionKeysAsync(sales.Id));

        await scope.Rbac.UpdateRoleTemplateAsync(
            scope.Caller.Id, sales.Id, sales.Name, sales.Description, original.ToArray());
        Assert.DoesNotContain(RbacPermissionKeys.PaymentsRecordHistorical, await scope.PermissionKeysAsync(sales.Id));
    }

    [Fact]
    public async Task CustomRoleCannotBeCreatedWithOwnerCorrection()
    {
        await using var scope = await TestScope.CreateAsync(_fixture);
        var beforeCount = await scope.Context.RbacRoleTemplates.CountAsync();

        var error = await Assert.ThrowsAsync<BusinessValidationException>(() =>
            scope.Rbac.CreateRoleTemplateAsync(
                "RBAC Custom Role",
                "Sanitized custom role.",
                [RbacPermissionKeys.BookingsCorrectOwnerAttribution]));

        Assert.Equal(RbacErrorCodes.OwnerCorrectionSuperAdminOnly, error.Code);
        Assert.Equal(beforeCount, await scope.Context.RbacRoleTemplates.CountAsync());
    }

    [Fact]
    public async Task NonSuperAdminTemplateCannotReceiveOwnerCorrectionAndRejectionIsAtomic()
    {
        await using var scope = await TestScope.CreateAsync(_fixture);
        var salesMember = await scope.AddAdminAsync("RBAC Sales", SalesRoleId);
        var sales = await scope.RoleAsync(SalesRoleId);
        var beforePermissions = await scope.PermissionKeysAsync(sales.Id);
        var beforeStamp = await scope.AdminUpdatedAtAsync(salesMember.Id);
        var proposed = beforePermissions
            .Append(RbacPermissionKeys.BookingsCorrectOwnerAttribution)
            .ToArray();

        var error = await Assert.ThrowsAsync<BusinessValidationException>(() =>
            scope.Rbac.UpdateRoleTemplateAsync(
                scope.Caller.Id, sales.Id, sales.Name, sales.Description, proposed));

        Assert.Equal(RbacErrorCodes.OwnerCorrectionSuperAdminOnly, error.Code);
        Assert.Equal(beforePermissions, await scope.PermissionKeysAsync(sales.Id));
        Assert.Equal(beforeStamp, await scope.AdminUpdatedAtAsync(salesMember.Id));
    }

    [Fact]
    public async Task UserOverridesCannotGrantOrNeutralizeOwnerCorrection()
    {
        await using var scope = await TestScope.CreateAsync(_fixture);
        var salesUser = await scope.AddAdminAsync("RBAC Sales Override", SalesRoleId);
        var superAdmin = await scope.AddAdminAsync(
            "RBAC SuperAdmin Override",
            RbacSystemRoleTemplates.SuperAdminId);
        var salesStamp = await scope.AdminUpdatedAtAsync(salesUser.Id);
        var superAdminStamp = await scope.AdminUpdatedAtAsync(superAdmin.Id);

        var grantError = await Assert.ThrowsAsync<BusinessValidationException>(() =>
            scope.Rbac.ReplaceUserOverridesAsync(
                scope.Caller.Id,
                salesUser.Id,
                [RbacPermissionKeys.BookingsCorrectOwnerAttribution],
                []));
        Assert.Equal(RbacErrorCodes.OwnerCorrectionSuperAdminOnly, grantError.Code);
        Assert.Equal(salesStamp, await scope.AdminUpdatedAtAsync(salesUser.Id));

        var denyError = await Assert.ThrowsAsync<BusinessValidationException>(() =>
            scope.Rbac.ReplaceUserOverridesAsync(
                scope.Caller.Id,
                superAdmin.Id,
                [],
                [RbacPermissionKeys.BookingsCorrectOwnerAttribution]));
        Assert.Equal(RbacErrorCodes.OwnerCorrectionSuperAdminOnly, denyError.Code);
        Assert.Equal(superAdminStamp, await scope.AdminUpdatedAtAsync(superAdmin.Id));
        Assert.Empty(await scope.OverrideKeysAsync(salesUser.Id));
        Assert.Empty(await scope.OverrideKeysAsync(superAdmin.Id));

        await scope.Rbac.ReplaceUserOverridesAsync(
            scope.Caller.Id,
            salesUser.Id,
            [PermissionKeys.AnalyticsRead, RbacPermissionKeys.BookingsRecordHistorical],
            [PermissionKeys.ReviewsModerate, RbacPermissionKeys.PaymentsRecordHistorical]);
        var unrelated = await scope.OverrideKeysAsync(salesUser.Id);
        Assert.Contains((PermissionKeys.AnalyticsRead, "grant"), unrelated);
        Assert.Contains((PermissionKeys.ReviewsModerate, "deny"), unrelated);
        Assert.Contains((RbacPermissionKeys.BookingsRecordHistorical, "grant"), unrelated);
        Assert.Contains((RbacPermissionKeys.PaymentsRecordHistorical, "deny"), unrelated);
    }

    [Fact]
    public async Task ResolverFailsClosedForCorrectionOverrideDrift()
    {
        await using var scope = await TestScope.CreateAsync(_fixture);
        var salesUser = await scope.AddAdminAsync("RBAC Drift Sales", SalesRoleId);
        var superAdmin = await scope.AddAdminAsync(
            "RBAC Drift SuperAdmin",
            RbacSystemRoleTemplates.SuperAdminId);
        scope.Context.RbacAdminUserPermissionOverrides.AddRange(
            Override(salesUser.Id, "grant"),
            Override(superAdmin.Id, "deny"));
        await scope.Context.SaveChangesAsync();

        Assert.DoesNotContain(
            RbacPermissionKeys.BookingsCorrectOwnerAttribution,
            await scope.Resolver.ResolveAsync(salesUser.Id));
        Assert.Contains(
            RbacPermissionKeys.BookingsCorrectOwnerAttribution,
            await scope.Resolver.ResolveAsync(superAdmin.Id));
    }

    [Fact]
    public async Task RoleReassignmentCannotActivateAStaleCorrectionOverride()
    {
        await using var scope = await TestScope.CreateAsync(_fixture);
        var salesUser = await scope.AddAdminAsync("RBAC Role Change", SalesRoleId);
        scope.Context.RbacAdminUserPermissionOverrides.Add(Override(salesUser.Id, "grant"));
        await scope.Context.SaveChangesAsync();
        var service = new AdminUserService(scope.UnitOfWork);

        var error = await Assert.ThrowsAsync<BusinessValidationException>(() =>
            service.UpdateRoleAsync(salesUser.Id, FinanceRoleId));

        Assert.Equal(RbacErrorCodes.OwnerCorrectionSuperAdminOnly, error.Code);
        Assert.Equal(SalesRoleId, (await scope.Context.AdminUsers.AsNoTracking()
            .SingleAsync(admin => admin.Id == salesUser.Id)).RoleTemplateId);
    }

    private static RbacAdminUserPermissionOverride Override(Guid adminUserId, string modifierType) =>
        new()
        {
            AdminUserId = adminUserId,
            PermissionKey = RbacPermissionKeys.BookingsCorrectOwnerAttribution,
            ModifierType = modifierType
        };

    private sealed class TestScope : IAsyncDisposable
    {
        private readonly PostgreSqlTestDatabase _database;

        private TestScope(
            PostgreSqlTestDatabase database,
            AppDbContext context,
            UnitOfWork unitOfWork,
            RbacAdminService rbac,
            PermissionResolver resolver,
            AdminUser caller)
        {
            _database = database;
            Context = context;
            UnitOfWork = unitOfWork;
            Rbac = rbac;
            Resolver = resolver;
            Caller = caller;
        }

        public AppDbContext Context { get; }
        public UnitOfWork UnitOfWork { get; }
        public RbacAdminService Rbac { get; }
        public PermissionResolver Resolver { get; }
        public AdminUser Caller { get; }

        public static async Task<TestScope> CreateAsync(PostgreSqlFixture fixture)
        {
            var database = await fixture.CreateTestDatabaseAsync();
            var context = database.CreateDbContext();
            var unitOfWork = new UnitOfWork(context);
            var resolver = new PermissionResolver(unitOfWork);
            var rbac = new RbacAdminService(
                unitOfWork,
                resolver,
                new RbacPermissionRegistry());
            var caller = await context.AdminUsers
                .SingleAsync(admin => admin.RoleTemplateId == RbacSystemRoleTemplates.SuperAdminId);
            return new TestScope(database, context, unitOfWork, rbac, resolver, caller);
        }

        public Task<RbacRoleTemplate> RoleAsync(Guid id) =>
            Context.RbacRoleTemplates.Include(role => role.Permissions)
                .AsNoTracking()
                .SingleAsync(role => role.Id == id);

        public async Task<string[]> PermissionKeysAsync(Guid roleId) =>
            await Context.RbacRoleTemplatePermissions.AsNoTracking()
                .Where(entry => entry.RoleTemplateId == roleId)
                .OrderBy(entry => entry.PermissionKey)
                .Select(entry => entry.PermissionKey)
                .ToArrayAsync();

        public Task<DateTime> AdminUpdatedAtAsync(Guid id) =>
            Context.AdminUsers.AsNoTracking()
                .Where(admin => admin.Id == id)
                .Select(admin => admin.UpdatedAt)
                .SingleAsync();

        public async Task<(string Key, string Modifier)[]> OverrideKeysAsync(Guid adminUserId) =>
            await Context.RbacAdminUserPermissionOverrides.AsNoTracking()
                .Where(entry => entry.AdminUserId == adminUserId)
                .OrderBy(entry => entry.PermissionKey)
                .Select(entry => new ValueTuple<string, string>(entry.PermissionKey, entry.ModifierType))
                .ToArrayAsync();

        public async Task<AdminUser> AddAdminAsync(string name, Guid roleTemplateId)
        {
            var admin = new AdminUser
            {
                Id = Guid.NewGuid(),
                Name = name,
                Email = $"{Guid.NewGuid():N}@example.test",
                PasswordHash = "not-used",
                RoleTemplateId = roleTemplateId,
                IsActive = true
            };
            Context.AdminUsers.Add(admin);
            await Context.SaveChangesAsync();
            return admin;
        }

        public async ValueTask DisposeAsync()
        {
            await Context.DisposeAsync();
            await _database.DisposeAsync();
        }
    }
}
