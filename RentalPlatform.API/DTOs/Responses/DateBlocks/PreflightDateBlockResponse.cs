namespace RentalPlatform.API.DTOs.Responses.DateBlocks;

public record PreflightDateBlockResponse
{
    public string Outcome { get; init; } = string.Empty;
    public string? ConflictType { get; init; }
    public IReadOnlyList<DateOnly> ConflictDates { get; init; } = Array.Empty<DateOnly>();
}
