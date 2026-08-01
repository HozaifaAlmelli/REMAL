namespace RentalPlatform.Data.Entities;

public sealed class HistoricalOwnerCorrectionIdempotencyKey
{
    public Guid ActorAdminUserId { get; set; }
    public string Endpoint { get; set; } = string.Empty;
    public Guid Key { get; set; }
    public string RequestHash { get; set; } = string.Empty;
    public Guid? CorrectionId { get; set; }
    public int? ResponseStatus { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? CompletedAt { get; set; }

    public AdminUser ActorAdminUser { get; set; } = null!;
    public HistoricalOwnerAttributionCorrection? Correction { get; set; }
}
