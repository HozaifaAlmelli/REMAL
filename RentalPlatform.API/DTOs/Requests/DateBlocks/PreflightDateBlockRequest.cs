using System;

namespace RentalPlatform.API.DTOs.Requests.DateBlocks;

public record PreflightDateBlockRequest
{
    public DateOnly StartDate { get; init; }
    public DateOnly EndDate { get; init; }
}
