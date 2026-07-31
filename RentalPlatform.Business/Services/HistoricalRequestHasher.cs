using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using RentalPlatform.Business.Models;

namespace RentalPlatform.Business.Services;

public static class HistoricalRequestHasher
{
    public static string Compute(RecordHistoricalBookingCommand command)
    {
        using var stream = new MemoryStream();
        using (var writer = new Utf8JsonWriter(stream))
        {
            writer.WriteStartObject();
            writer.WriteString("actualBookedAt", FormatDate(command.ActualBookedAt));
            writer.WriteString("agreedAmount", command.AgreedAmount.ToString("0.00", CultureInfo.InvariantCulture));
            WriteGuid(writer, "assignedAdminUserId", command.AssignedAdminUserId);
            writer.WriteString("checkInDate", FormatDate(command.CheckInDate));
            writer.WriteString("checkOutDate", FormatDate(command.CheckOutDate));
            WriteGuid(writer, "clientId", command.ClientId);
            writer.WriteString("externalReference", Normalize(command.ExternalReference));
            writer.WriteNumber("guestCount", command.GuestCount);
            writer.WriteString("historicalEntryNote", Normalize(command.HistoricalEntryNote));
            writer.WriteString("historicalEntryReason", Normalize(command.HistoricalEntryReason));
            writer.WriteString("internalNotes", Normalize(command.InternalNotes));
            writer.WritePropertyName("newClient");
            if (command.NewClient is null)
            {
                writer.WriteNullValue();
            }
            else
            {
                writer.WriteStartObject();
                writer.WriteString("email", Normalize(command.NewClient.Email)?.ToLowerInvariant());
                writer.WriteString("name", Normalize(command.NewClient.Name));
                writer.WriteString("phone", Normalize(command.NewClient.Phone)?.TrimStart('+'));
                writer.WriteEndObject();
            }
            writer.WriteString("originalSource", Normalize(command.OriginalSource)?.ToLowerInvariant());
            writer.WriteString("unitId", command.UnitId.ToString("N"));
            writer.WriteEndObject();
        }

        return Convert.ToHexString(SHA256.HashData(stream.ToArray())).ToLowerInvariant();
    }

    private static string FormatDate(DateOnly value) =>
        value.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

    private static string? Normalize(string? value) =>
        string.IsNullOrWhiteSpace(value)
            ? null
            : string.Join(' ', value.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));

    private static void WriteGuid(Utf8JsonWriter writer, string propertyName, Guid? value)
    {
        if (value.HasValue)
            writer.WriteString(propertyName, value.Value.ToString("N"));
        else
            writer.WriteNull(propertyName);
    }
}
