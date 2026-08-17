namespace RentalPlatform.Data.Entities;

public class Payment
{
    public Guid Id { get; set; }
    public Guid BookingId { get; set; }
    public Guid? InvoiceId { get; set; }
    public string PaymentStatus { get; set; } = null!;
    public string PaymentMethod { get; set; } = null!;
    public decimal Amount { get; set; }
    public bool IsHistoricalRecord { get; set; }
    public Guid? CreatedByAdminUserId { get; set; }
    public string? RecordedReason { get; set; }

    public string? ReferenceNumber { get; set; }
    public string? Notes { get; set; }
    public DateTime? PaidAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    // Navigation
    public Booking Booking { get; set; } = null!;
    public Invoice? Invoice { get; set; }
    public AdminUser? CreatedByAdminUser { get; set; }
}
