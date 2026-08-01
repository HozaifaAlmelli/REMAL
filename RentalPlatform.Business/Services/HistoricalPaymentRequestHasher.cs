using System.Globalization;
using System.Security.Cryptography;
using System.Text.Json;
using RentalPlatform.Business.Models;

namespace RentalPlatform.Business.Services;

public static class HistoricalPaymentRequestHasher
{
    public static string Compute(RecordHistoricalPaymentCommand command)
    {
        using var stream = new MemoryStream();
        using (var writer = new Utf8JsonWriter(stream))
        {
            writer.WriteStartObject();
            writer.WriteString("amount", command.Amount.ToString("0.00", CultureInfo.InvariantCulture));
            writer.WriteString("bookingId", command.BookingId.ToString("N"));
            writer.WriteString("paidAt", command.PaidAt.ToUniversalTime().ToString("O", CultureInfo.InvariantCulture));
            writer.WriteString("paymentMethod", Normalize(command.PaymentMethod)?.ToLowerInvariant());
            writer.WriteString("reason", Normalize(command.Reason));
            writer.WriteString("referenceNumber", Normalize(command.ReferenceNumber)?.ToLowerInvariant());
            writer.WriteEndObject();
        }

        return Convert.ToHexString(SHA256.HashData(stream.ToArray())).ToLowerInvariant();
    }

    public static string? Normalize(string? value) =>
        string.IsNullOrWhiteSpace(value)
            ? null
            : string.Join(' ', value.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
}
