namespace RentalPlatform.Data.Entities;

public sealed class HistoricalOwnerAttributionCorrection
{
    public Guid Id { get; set; }
    public Guid BookingId { get; set; }
    public Guid PreviousOwnerId { get; set; }
    public Guid TargetOwnerId { get; set; }
    public Guid CorrectedByAdminUserId { get; set; }
    public string Reason { get; set; } = string.Empty;
    public string? Note { get; set; }
    public DateTime CorrectedAt { get; set; }

    public Booking Booking { get; set; } = null!;
    public Owner PreviousOwner { get; set; } = null!;
    public Owner TargetOwner { get; set; } = null!;
    public AdminUser CorrectedByAdminUser { get; set; } = null!;
}
