namespace RentalPlatform.Data.Entities;

public class RentableCapacityLedger
{
    public Guid Id { get; set; }
    public string Scope { get; set; } = "global";
    public string PublicationStatus { get; set; } = "uninitialized";
    public DateOnly? CoverageStartDate { get; set; }
    public DateTime? PublishedAt { get; set; }
    public Guid? PublishedByAdminUserId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
