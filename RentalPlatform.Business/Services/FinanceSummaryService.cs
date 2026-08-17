using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using RentalPlatform.Business.Exceptions;
using RentalPlatform.Business.Interfaces;
using RentalPlatform.Business.Models;
using RentalPlatform.Data;
using RentalPlatform.Shared.Enums;

namespace RentalPlatform.Business.Services;

public class FinanceSummaryService : IFinanceSummaryService
{
    private readonly IUnitOfWork _unitOfWork;

    public FinanceSummaryService(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<InvoiceBalanceResult> GetInvoiceBalanceAsync(
        Guid invoiceId,
        CancellationToken cancellationToken = default)
    {
        var invoice = await _unitOfWork.Invoices.GetByIdAsync(invoiceId, cancellationToken);
        if (invoice == null)
            throw new NotFoundException($"Invoice with ID {invoiceId} not found");

        // Ordinary unlinked payments remain settlement-eligible before invoice creation.
        // Historical payment evidence is external receipt evidence and never settlement.
        var paidAmount = await _unitOfWork.Payments.Query()
            .Where(p => p.BookingId == invoice.BookingId
                && p.PaymentStatus == "paid"
                && !p.IsHistoricalRecord)
            .SumAsync(p => p.Amount, cancellationToken);

        var historicalEvidenceQuery = _unitOfWork.Payments.Query()
            .Where(p => p.BookingId == invoice.BookingId
                && p.PaymentStatus == "paid"
                && p.IsHistoricalRecord
                && p.InvoiceId == null);
        var historicalEvidenceCount = await historicalEvidenceQuery.CountAsync(cancellationToken);
        var historicalEvidenceAmount = await historicalEvidenceQuery
            .SumAsync(p => p.Amount, cancellationToken);

        var remaining = invoice.TotalAmount - paidAmount;

        return new InvoiceBalanceResult
        {
            InvoiceId = invoiceId,
            TotalAmount = invoice.TotalAmount,
            PaidAmount = paidAmount,
            RemainingAmount = remaining,
            IsFullyPaid = remaining <= 0,
            HistoricalPaymentEvidenceCount = historicalEvidenceCount,
            HistoricalPaymentEvidenceAmount = historicalEvidenceAmount
        };
    }

    public async Task<BookingFinanceSnapshotResult> GetBookingFinanceSnapshotAsync(
        Guid bookingId,
        CancellationToken cancellationToken = default)
    {
        var bookingExists = await _unitOfWork.Bookings.ExistsAsync(b => b.Id == bookingId, cancellationToken);
        if (!bookingExists)
            throw new NotFoundException($"Booking with ID {bookingId} not found");

        // Active invoice only (exclude cancelled and superseded)
        var invoice = await _unitOfWork.Invoices
            .FirstOrDefaultAsync(i => i.BookingId == bookingId
                && i.InvoiceStatus != "cancelled"
                && i.InvoiceStatus != "superseded", cancellationToken);

        var payout = await _unitOfWork.OwnerPayouts
            .FirstOrDefaultAsync(op => op.BookingId == bookingId, cancellationToken);

        var invoicedAmount = invoice?.TotalAmount ?? 0m;

        // Preserve ordinary pre-invoice settlement while keeping historical evidence separate.
        decimal paidAmount = await _unitOfWork.Payments.Query()
            .Where(p => p.BookingId == bookingId
                && p.PaymentStatus == "paid"
                && !p.IsHistoricalRecord)
            .SumAsync(p => p.Amount, cancellationToken);

        var historicalEvidenceQuery = _unitOfWork.Payments.Query()
            .Where(p => p.BookingId == bookingId
                && p.PaymentStatus == "paid"
                && p.IsHistoricalRecord
                && p.InvoiceId == null);
        var historicalEvidenceCount = await historicalEvidenceQuery.CountAsync(cancellationToken);
        var historicalEvidenceAmount = await historicalEvidenceQuery
            .SumAsync(p => p.Amount, cancellationToken);

        // Calculate remaining based on invoice total (if exists) or 0
        decimal remaining = invoicedAmount - paidAmount;

        return new BookingFinanceSnapshotResult
        {
            BookingId = bookingId,
            InvoiceId = invoice?.Id,
            InvoiceStatus = invoice?.InvoiceStatus,
            InvoicedAmount = invoicedAmount,
            PaidAmount = paidAmount,
            RemainingAmount = remaining,
            HistoricalPaymentEvidenceCount = historicalEvidenceCount,
            HistoricalPaymentEvidenceAmount = historicalEvidenceAmount,
            OwnerPayoutStatus = payout?.PayoutStatus.ToString().ToLowerInvariant()
        };
    }

    public async Task<OwnerPayoutSummaryResult> GetOwnerPayoutSummaryAsync(
        Guid ownerId,
        CancellationToken cancellationToken = default)
    {
        var ownerExists = await _unitOfWork.Owners.ExistsAsync(
            o => o.Id == ownerId && o.DeletedAt == null, cancellationToken);
        if (!ownerExists)
            throw new NotFoundException($"Active owner with ID {ownerId} not found");

        var payouts = await _unitOfWork.OwnerPayouts.Query()
            .Where(op => op.OwnerId == ownerId)
            .ToListAsync(cancellationToken);

        return new OwnerPayoutSummaryResult
        {
            OwnerId = ownerId,
            TotalPending = payouts.Where(op => op.PayoutStatus == OwnerPayoutStatus.Pending).Sum(op => op.PayoutAmount),
            TotalScheduled = payouts.Where(op => op.PayoutStatus == OwnerPayoutStatus.Scheduled).Sum(op => op.PayoutAmount),
            TotalPaid = payouts.Where(op => op.PayoutStatus == OwnerPayoutStatus.Paid).Sum(op => op.PayoutAmount)
        };
    }
}
