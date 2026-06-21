namespace RentalPlatform.API.DTOs.Requests.Owners;

public record CreateOwnerRequest(
    string Name,
    string Phone,
    string EmergencyPhone,
    string? Email,
    string? DetailedAddress,
    decimal CommissionRate,
    string? Notes,
    string Status,
    string Password
);
