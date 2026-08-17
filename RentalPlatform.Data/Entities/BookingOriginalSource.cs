namespace RentalPlatform.Data.Entities;

public sealed class BookingOriginalSource
{
    public string Code { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
