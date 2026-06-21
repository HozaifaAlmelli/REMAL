using System;

namespace RentalPlatform.API.DTOs.Responses.Owners;

public record OwnerListItemResponse(
    Guid Id,
    string Name,
    string Phone,
    string? Email,
    decimal CommissionRate,
    string Status,
    DateTime CreatedAt
);

public record OwnerDetailsResponse(
    Guid Id,
    string Name,
    string Phone,
    string EmergencyPhone,
    string? Email,
    string? DetailedAddress,
    decimal CommissionRate,
    string? Notes,
    string Status,
    DateTime CreatedAt,
    DateTime UpdatedAt
);

public record OwnerUnitResponse(
    Guid Id,
    string Name,
    string UnitType,
    Guid AreaId,
    int Bedrooms,
    int Bathrooms,
    int MaxGuests,
    decimal BasePricePerNight,
    bool IsActive,
    DateTime CreatedAt
);
