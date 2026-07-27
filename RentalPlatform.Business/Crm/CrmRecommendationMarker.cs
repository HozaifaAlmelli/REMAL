using System;
using System.Linq;
using RentalPlatform.Data.Entities;
using RentalPlatform.Shared.Enums;

namespace RentalPlatform.Business.Crm;

/// <summary>
/// The single source of truth for CRM leads that require a unit recommendation.
/// Nothing else may derive this rule or read/write the signature.
/// </summary>
public static class CrmRecommendationMarker
{
    public const string Signature = "[[kaza:lead:needs-recommendation:v1]]";

    private static readonly LeadStatus[] RelevantStatuses =
    {
        LeadStatus.Prospecting,
        LeadStatus.Relevant,
        LeadStatus.NoAnswer,
        LeadStatus.Booked
    };

    public static bool IsSigned(string? storedNotes) =>
        storedNotes is not null &&
        storedNotes.StartsWith(Signature, StringComparison.Ordinal);

    public static string? Strip(string? storedNotes)
    {
        if (!IsSigned(storedNotes))
            return storedNotes;

        var rest = storedNotes![Signature.Length..].TrimStart('\r', '\n', ' ', '\t');
        return rest.Length == 0 ? null : rest;
    }

    public static string Apply(string? cleanNotes) =>
        string.IsNullOrWhiteSpace(cleanNotes)
            ? Signature
            : $"{Signature}\n{cleanNotes.Trim()}";

    public static bool NeedsRecommendation(CrmLead lead) =>
        IsSigned(lead.Notes) &&
        lead.TargetUnitId is null &&
        RelevantStatuses.Contains(lead.LeadStatus);
}
