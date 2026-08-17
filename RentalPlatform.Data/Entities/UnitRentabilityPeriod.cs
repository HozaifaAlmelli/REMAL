namespace RentalPlatform.Data.Entities;

public class UnitRentabilityPeriod
{
    public Guid Id { get; set; }
    public Guid UnitId { get; set; }
    public DateOnly EffectiveFromDate { get; set; }
    public DateOnly? EffectiveToDate { get; set; }
    public bool IsRentable { get; set; }
    public string ResolvedReason { get; set; } = string.Empty;
    public Guid RevisionId { get; set; }
    public string ChangeSourceType { get; set; } = string.Empty;
    public Guid? ChangeSourceId { get; set; }
    public string? ActorType { get; set; }
    public Guid? ActorId { get; set; }
    public DateTime RecordedAt { get; set; }
    public DateTime? SupersededAt { get; set; }
    public Guid? SupersededByRevisionId { get; set; }

    public Unit Unit { get; set; } = null!;
}
