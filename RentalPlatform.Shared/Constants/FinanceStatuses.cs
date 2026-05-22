namespace RentalPlatform.Shared.Constants;

public static class InvoiceStatuses
{
    public const string Draft      = "draft";
    public const string Issued     = "issued";
    public const string Paid       = "paid";
    public const string Cancelled  = "cancelled";
    public const string Superseded = "superseded";
}

public static class PaymentStatuses
{
    public const string Pending   = "pending";
    public const string Paid      = "paid";
    public const string Failed    = "failed";
    public const string Cancelled = "cancelled";
    public const string Refunded  = "refunded";
}

public static class PayoutStatuses
{
    public const string Pending   = "pending";
    public const string Scheduled = "scheduled";
    public const string Paid      = "paid";
    public const string Cancelled = "cancelled";
}
