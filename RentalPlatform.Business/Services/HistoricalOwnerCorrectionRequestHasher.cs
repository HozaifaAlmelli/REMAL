using System.Security.Cryptography;
using System.Text.Json;
using RentalPlatform.Business.Models;

namespace RentalPlatform.Business.Services;

public static class HistoricalOwnerCorrectionRequestHasher
{
    public static string Compute(CorrectHistoricalOwnerAttributionCommand command)
    {
        using var stream = new MemoryStream();
        using (var writer = new Utf8JsonWriter(stream))
        {
            writer.WriteStartObject();
            writer.WriteString("bookingId", command.BookingId.ToString("N"));
            writer.WriteString("expectedCurrentOwnerId", command.ExpectedCurrentOwnerId.ToString("N"));
            writer.WriteString("note", Normalize(command.Note));
            writer.WriteString("reason", Normalize(command.Reason)?.ToLowerInvariant());
            writer.WriteString("targetOwnerId", command.TargetOwnerId.ToString("N"));
            writer.WriteEndObject();
        }

        return Convert.ToHexString(SHA256.HashData(stream.ToArray())).ToLowerInvariant();
    }

    public static string? Normalize(string? value) =>
        string.IsNullOrWhiteSpace(value)
            ? null
            : string.Join(' ', value.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
}
