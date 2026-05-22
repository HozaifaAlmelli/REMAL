using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using RentalPlatform.Business.Exceptions;
using RentalPlatform.Business.Interfaces;
using RentalPlatform.Data;
using RentalPlatform.Data.Entities;
using RentalPlatform.Shared.Models;

namespace RentalPlatform.Business.Services;

public class InvoiceService : IInvoiceService
{
    private readonly IUnitOfWork _unitOfWork;

    public InvoiceService(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<PagedResult<Invoice>> GetAllAsync(
        string? invoiceStatus = null,
        Guid? bookingId = null,
        int page = 1,
        int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        IQueryable<Invoice> query = _unitOfWork.Invoices.Query()
            .Include(i => i.InvoiceItems);

        if (!string.IsNullOrWhiteSpace(invoiceStatus))
            query = query.Where(i => i.InvoiceStatus == invoiceStatus.Trim().ToLower());

        if (bookingId.HasValue)
            query = query.Where(i => i.BookingId == bookingId.Value);

        var total = await query.CountAsync(cancellationToken);
        var items = await query
            .OrderByDescending(i => i.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return new PagedResult<Invoice>(items, total);
    }

    public async Task<Invoice?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return await _unitOfWork.Invoices.Query()
            .Include(i => i.InvoiceItems)
            .FirstOrDefaultAsync(i => i.Id == id, cancellationToken);
    }

    public async Task<Invoice> CreateDraftFromBookingAsync(
        Guid bookingId,
        string invoiceNumber,
        string? notes,
        CancellationToken cancellationToken = default)
    {
        var booking = await _unitOfWork.Bookings.GetByIdAsync(bookingId, cancellationToken);
        if (booking == null)
            throw new NotFoundException($"Booking with ID {bookingId} not found");

        var normalizedNumber = invoiceNumber.Trim();
        if (string.IsNullOrEmpty(normalizedNumber))
            throw new BusinessValidationException("InvoiceNumber is required");

        // One non-cancelled invoice per booking rule
        var hasActiveInvoice = await _unitOfWork.Invoices.ExistsAsync(
            i => i.BookingId == bookingId && i.InvoiceStatus != "cancelled",
            cancellationToken);
        if (hasActiveInvoice)
            throw new ConflictException(
                $"Booking {bookingId} already has an active invoice (draft, issued, or paid). Cancel the existing invoice before creating a new one.");

        // Invoice number uniqueness
        var duplicate = await _unitOfWork.Invoices.ExistsAsync(
            i => i.InvoiceNumber == normalizedNumber, cancellationToken);
        if (duplicate)
            throw new ConflictException($"Invoice number '{normalizedNumber}' is already in use");

        var invoice = new Invoice
        {
            Id = Guid.NewGuid(),
            BookingId = bookingId,
            InvoiceNumber = normalizedNumber,
            InvoiceStatus = "draft",
            SubtotalAmount = booking.FinalAmount,
            TotalAmount = booking.FinalAmount,
            Notes = notes?.Trim(),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _unitOfWork.Invoices.AddAsync(invoice, cancellationToken);

        // Create initial booking_stay line item
        var bookingStayItem = new InvoiceItem
        {
            Id = Guid.NewGuid(),
            InvoiceId = invoice.Id,
            LineType = "booking_stay",
            Description = "Booking stay charges",
            Quantity = 1,
            UnitAmount = booking.FinalAmount,
            LineTotal = booking.FinalAmount,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _unitOfWork.InvoiceItems.AddAsync(bookingStayItem, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        // Reload with items
        return await _unitOfWork.Invoices.Query()
            .Include(i => i.InvoiceItems)
            .FirstOrDefaultAsync(i => i.Id == invoice.Id, cancellationToken) ?? invoice;
    }

    public async Task<Invoice> AddManualAdjustmentAsync(
        Guid invoiceId,
        string description,
        int quantity,
        decimal unitAmount,
        CancellationToken cancellationToken = default)
    {
        var invoice = await _unitOfWork.Invoices.Query()
            .Include(i => i.InvoiceItems)
            .FirstOrDefaultAsync(i => i.Id == invoiceId, cancellationToken);

        if (invoice == null)
            throw new NotFoundException($"Invoice with ID {invoiceId} not found");

        if (invoice.InvoiceStatus != "draft")
            throw new ConflictException(
                $"Cannot add items to invoice {invoiceId}: current status is '{invoice.InvoiceStatus}'. Only draft invoices can be modified.");

        var lineTotal = quantity * unitAmount;

        var item = new InvoiceItem
        {
            Id = Guid.NewGuid(),
            InvoiceId = invoiceId,
            LineType = "manual_adjustment",
            Description = description.Trim(),
            Quantity = quantity,
            UnitAmount = unitAmount,
            LineTotal = lineTotal,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _unitOfWork.InvoiceItems.AddAsync(item, cancellationToken);

        // Recalculate totals including new item
        var allItems = invoice.InvoiceItems.ToList();
        allItems.Add(item);
        invoice.SubtotalAmount = allItems.Sum(ii => ii.LineTotal);
        invoice.TotalAmount = invoice.SubtotalAmount;
        invoice.UpdatedAt = DateTime.UtcNow;

        _unitOfWork.Invoices.Update(invoice);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        // Reload with persisted items
        return await _unitOfWork.Invoices.Query()
            .Include(i => i.InvoiceItems)
            .FirstOrDefaultAsync(i => i.Id == invoiceId, cancellationToken) ?? invoice;
    }

    public async Task<Invoice> IssueAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var invoice = await _unitOfWork.Invoices.Query()
            .Include(i => i.InvoiceItems)
            .FirstOrDefaultAsync(i => i.Id == id, cancellationToken);

        if (invoice == null)
            throw new NotFoundException($"Invoice with ID {id} not found");

        if (invoice.InvoiceStatus != "draft")
            throw new ConflictException(
                $"Invoice {id} cannot be issued: current status is '{invoice.InvoiceStatus}'. Only draft invoices can be issued.");

        if (!invoice.InvoiceItems.Any())
            throw new ConflictException($"Invoice {id} cannot be issued: invoice has no line items.");

        invoice.InvoiceStatus = "issued";
        invoice.IssuedAt ??= DateTime.UtcNow;
        invoice.UpdatedAt = DateTime.UtcNow;

        _unitOfWork.Invoices.Update(invoice);

        // Link ALL payments for this booking to this invoice (not just unlinked ones)
        // This ensures all payments (pending, paid, failed, cancelled) are associated with the invoice
        var allBookingPayments = await _unitOfWork.Payments.Query()
            .Where(p => p.BookingId == invoice.BookingId && p.InvoiceId == null)
            .ToListAsync(cancellationToken);

        foreach (var payment in allBookingPayments)
        {
            payment.InvoiceId = invoice.Id;
            payment.UpdatedAt = DateTime.UtcNow;
            _unitOfWork.Payments.Update(payment);
        }

        // Check if invoice should be marked as paid based on existing paid payments
        var totalPaid = await _unitOfWork.Payments.Query()
            .Where(p => p.InvoiceId == invoice.Id && p.PaymentStatus == "paid")
            .SumAsync(p => p.Amount, cancellationToken);

        if (totalPaid >= invoice.TotalAmount)
        {
            invoice.InvoiceStatus = "paid";
        }

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return invoice;
    }

    public async Task<Invoice> CancelAsync(Guid id, string? notes, CancellationToken cancellationToken = default)
    {
        var invoice = await _unitOfWork.Invoices.Query()
            .Include(i => i.InvoiceItems)
            .FirstOrDefaultAsync(i => i.Id == id, cancellationToken);

        if (invoice == null)
            throw new NotFoundException($"Invoice with ID {id} not found");

        if (invoice.InvoiceStatus == "cancelled")
            throw new ConflictException($"Invoice {id} is already cancelled.");

        if (invoice.InvoiceStatus == "paid")
            throw new ConflictException($"Invoice {id} cannot be cancelled: invoice is already paid.");

        // Check for linked paid payments
        var hasPaidPayment = await _unitOfWork.Payments.ExistsAsync(
            p => p.InvoiceId == id && p.PaymentStatus == "paid",
            cancellationToken);
        if (hasPaidPayment)
            throw new ConflictException(
                $"Invoice {id} cannot be cancelled: there are paid payments linked to this invoice.");

        invoice.InvoiceStatus = "cancelled";

        if (notes != null)
            invoice.Notes = notes.Trim();

        invoice.UpdatedAt = DateTime.UtcNow;

        _unitOfWork.Invoices.Update(invoice);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return invoice;
    }

    public async Task<int> LinkOrphanedPaymentsAsync(CancellationToken cancellationToken = default)
    {
        // Find all payments that have no invoice_id but belong to bookings with active invoices
        var orphanedPayments = await _unitOfWork.Payments.Query()
            .Where(p => p.InvoiceId == null)
            .ToListAsync(cancellationToken);

        int linkedCount = 0;

        foreach (var payment in orphanedPayments)
        {
            // Find the active (non-cancelled) invoice for this booking
            var activeInvoice = await _unitOfWork.Invoices.Query()
                .Where(i => i.BookingId == payment.BookingId && i.InvoiceStatus != "cancelled")
                .FirstOrDefaultAsync(cancellationToken);

            if (activeInvoice != null)
            {
                payment.InvoiceId = activeInvoice.Id;
                payment.UpdatedAt = DateTime.UtcNow;
                _unitOfWork.Payments.Update(payment);
                linkedCount++;
            }
        }

        if (linkedCount > 0)
        {
            await _unitOfWork.SaveChangesAsync(cancellationToken);
        }

        return linkedCount;
    }

    public async Task<Invoice> ReissueAsync(
        Guid id,
        string newInvoiceNumber,
        string? notes,
        CancellationToken cancellationToken = default)
    {
        var oldInvoice = await _unitOfWork.Invoices.Query()
            .Include(i => i.InvoiceItems)
            .FirstOrDefaultAsync(i => i.Id == id, cancellationToken);

        if (oldInvoice == null)
            throw new NotFoundException($"Invoice with ID {id} not found");

        if (oldInvoice.InvoiceStatus != "issued" && oldInvoice.InvoiceStatus != "paid")
            throw new ConflictException(
                $"Invoice {id} cannot be re-issued: current status is '{oldInvoice.InvoiceStatus}'. Only issued or paid invoices can be re-issued.");

        var normalizedNumber = newInvoiceNumber.Trim();
        if (string.IsNullOrEmpty(normalizedNumber))
            throw new BusinessValidationException("InvoiceNumber is required");

        // Check invoice number uniqueness
        var duplicate = await _unitOfWork.Invoices.ExistsAsync(
            i => i.InvoiceNumber == normalizedNumber, cancellationToken);
        if (duplicate)
            throw new ConflictException($"Invoice number '{normalizedNumber}' is already in use");

        await using var tx = await _unitOfWork.BeginTransactionAsync(cancellationToken);
        try
        {
            // Mark old invoice as superseded (not cancelled, to preserve audit trail)
            oldInvoice.InvoiceStatus = "superseded";
            oldInvoice.Notes = string.IsNullOrEmpty(oldInvoice.Notes)
                ? $"Superseded by {normalizedNumber}"
                : $"{oldInvoice.Notes}\n\nSuperseded by {normalizedNumber}";
            oldInvoice.UpdatedAt = DateTime.UtcNow;
            _unitOfWork.Invoices.Update(oldInvoice);

            // Create new draft invoice with same structure
            var newInvoice = new Invoice
            {
                Id = Guid.NewGuid(),
                BookingId = oldInvoice.BookingId,
                InvoiceNumber = normalizedNumber,
                InvoiceStatus = "draft",
                SubtotalAmount = oldInvoice.SubtotalAmount,
                TotalAmount = oldInvoice.TotalAmount,
                Notes = notes?.Trim() ?? "Re-issued invoice",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            await _unitOfWork.Invoices.AddAsync(newInvoice, cancellationToken);

            // Flush so the new invoice row exists before FK-referencing items are inserted
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            // Copy all line items from old invoice to new invoice
            foreach (var oldItem in oldInvoice.InvoiceItems)
            {
                var newItem = new InvoiceItem
                {
                    Id = Guid.NewGuid(),
                    InvoiceId = newInvoice.Id,
                    LineType = oldItem.LineType,
                    Description = oldItem.Description,
                    Quantity = oldItem.Quantity,
                    UnitAmount = oldItem.UnitAmount,
                    LineTotal = oldItem.LineTotal,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                await _unitOfWork.InvoiceItems.AddAsync(newItem, cancellationToken);
            }

            // Transfer ALL payments from old invoice to new invoice (including paid, pending, failed, cancelled)
            var paymentsToTransfer = await _unitOfWork.Payments.Query()
                .Where(p => p.InvoiceId == oldInvoice.Id)
                .ToListAsync(cancellationToken);

            decimal totalPaidFromTransferred = 0m;

            foreach (var payment in paymentsToTransfer)
            {
                payment.InvoiceId = newInvoice.Id;
                payment.UpdatedAt = DateTime.UtcNow;
                _unitOfWork.Payments.Update(payment);

                if (payment.PaymentStatus == "paid")
                    totalPaidFromTransferred += payment.Amount;
            }

            // Also link any unlinked payments for this booking
            var unlinkedPayments = await _unitOfWork.Payments.Query()
                .Where(p => p.BookingId == oldInvoice.BookingId && p.InvoiceId == null)
                .ToListAsync(cancellationToken);

            foreach (var payment in unlinkedPayments)
            {
                payment.InvoiceId = newInvoice.Id;
                payment.UpdatedAt = DateTime.UtcNow;
                _unitOfWork.Payments.Update(payment);

                if (payment.PaymentStatus == "paid")
                    totalPaidFromTransferred += payment.Amount;
            }

            // Determine final status for new invoice based on transferred paid amount
            if (totalPaidFromTransferred >= newInvoice.TotalAmount)
            {
                newInvoice.InvoiceStatus = "paid";
            }
            else
            {
                // Auto-issue the new invoice since it's replacing an issued/paid invoice
                newInvoice.InvoiceStatus = "issued";
                newInvoice.IssuedAt = DateTime.UtcNow;
            }

            newInvoice.UpdatedAt = DateTime.UtcNow;
            _unitOfWork.Invoices.Update(newInvoice);

            await _unitOfWork.SaveChangesAsync(cancellationToken);
            await tx.CommitAsync(cancellationToken);

            // Reload with items
            return await _unitOfWork.Invoices.Query()
                .Include(i => i.InvoiceItems)
                .FirstOrDefaultAsync(i => i.Id == newInvoice.Id, cancellationToken) ?? newInvoice;
        }
        catch
        {
            await tx.RollbackAsync(cancellationToken);
            throw;
        }
    }
}
