using RentalPlatform.Shared.Constants;

namespace RentalPlatform.API.Authorization;

public sealed record PermissionDescriptor(
    string Key,
    string Module,
    string Label,
    string Description);

public static class PermissionKeys
{
    public const string CrmRead = "crm:read";
    public const string CrmWrite = "crm:write";
    public const string CrmAssign = "crm:assign";
    public const string BookingsRead = "bookings:read";
    public const string BookingsWrite = "bookings:write";
    public const string FinanceOverview = "finance:overview";
    public const string FinanceManage = "finance:manage";
    public const string FinancePayouts = "finance:payouts";
    public const string UnitsRead = "units:read";
    public const string UnitsManage = "units:manage";
    public const string OwnersRead = "owners:read";
    public const string OwnersManage = "owners:manage";
    public const string ClientsRead = "clients:read";
    public const string ClientsWrite = "clients:write";
    public const string ClientsResetPassword = "clients:reset_password";
    public const string ReviewsModerate = "reviews:moderate";
    public const string ProjectsManage = "projects:manage";
    public const string AmenitiesManage = "amenities:manage";
    public const string AnalyticsRead = "analytics:read";
    public const string SettingsAdmin = "settings:admin";
    public const string AvailabilityApprove = RbacPermissionKeys.AvailabilityApprove;

    public static readonly IReadOnlyList<PermissionDescriptor> Descriptors =
        new PermissionDescriptor[]
        {
            new(CrmRead, "CRM", "View CRM", "View leads, notes, and pipeline activity."),
            new(CrmWrite, "CRM", "Manage CRM", "Create and update leads, notes, and conversions."),
            new(CrmAssign, "CRM", "Assign leads", "Assign and reassign leads and bookings."),
            new(BookingsRead, "Bookings", "View bookings", "View bookings and status history."),
            new(BookingsWrite, "Bookings", "Manage bookings", "Create, update, and advance booking lifecycle stages."),
            new(FinanceOverview, "Finance", "View finance overview", "View finance summaries and dashboard metrics."),
            new(FinanceManage, "Finance", "Manage transactions", "Manage invoices and payment records."),
            new(FinancePayouts, "Finance", "Manage payouts", "Create and process owner payouts."),
            new(UnitsRead, "Inventory", "View units", "View units, pricing, amenities, and availability blocks."),
            new(UnitsManage, "Inventory", "Manage units", "Manage units, images, pricing, amenities, and date blocks."),
            new(OwnersRead, "People", "View owners", "View owner profiles and related units."),
            new(OwnersManage, "People", "Manage owners", "Create, update, activate, and deactivate owners."),
            new(ClientsRead, "People", "View clients", "View client profiles and booking history."),
            new(ClientsWrite, "People", "Manage clients", "Create and update client profiles."),
            new(ClientsResetPassword, "People", "Reset client passwords", "Reset credentials for client accounts."),
            new(ReviewsModerate, "Operations", "Moderate reviews", "Approve, reject, and moderate reviews."),
            new(ProjectsManage, "Configuration", "Manage projects", "Create and maintain resort projects."),
            new(AmenitiesManage, "Configuration", "Manage amenities", "Create and maintain the amenity catalog."),
            new(AnalyticsRead, "Analytics", "View analytics", "View booking and finance reports."),
            new(SettingsAdmin, "Security", "Manage access", "Manage admin users, roles, and permission overrides."),
            new(AvailabilityApprove, "Availability", "Approve owner date-block requests", "Review and resolve owner date-block requests that conflict with active pipeline records.")
        };

    public static readonly IReadOnlyList<string> All =
        Descriptors.Select(descriptor => descriptor.Key).ToArray();
}
