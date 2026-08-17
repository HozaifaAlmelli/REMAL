namespace RentalPlatform.Data.Entities;

public sealed class IdempotencyKey
{
    public Guid ActorAdminUserId { get; set; }
    public string Endpoint { get; set; } = string.Empty;
    public string Key { get; set; } = string.Empty;
    public string RequestHash { get; set; } = string.Empty;
    public int? ResponseStatus { get; set; }
    public Guid? BookingId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? CompletedAt { get; set; }

    public AdminUser ActorAdminUser { get; set; } = null!;
    public Booking? Booking { get; set; }
}
