namespace RentalPlatform.API.DTOs.Requests.DateBlocks;

public record ResolveDateBlockRequest
{
    public string Decision { get; init; } = string.Empty;
    public string? Notes { get; init; }
}
