namespace RentalPlatform.Business.Services;

public static class InvoiceMutationLocks
{
    public static string ForInvoice(Guid invoiceId) =>
        $"invoice-mutation:{invoiceId:N}";
}
