using System;

namespace RentalPlatform.Data.Entities;

public class Owner
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string EmergencyPhone { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? DetailedAddress { get; set; }
    public decimal CommissionRate { get; set; }
    public string? Notes { get; set; }
    public string Status { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public DateTime? DeletedAt { get; set; }
}
