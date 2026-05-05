using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RentalPlatform.API.DTOs.Requests.Invoices;
using RentalPlatform.API.DTOs.Responses.Invoices;
using RentalPlatform.API.Models;
using RentalPlatform.Business.Interfaces;
using RentalPlatform.Data.Entities;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace RentalPlatform.API.Controllers;

[ApiController]
[Route("api/internal/invoices")]
public class InvoicesController : ControllerBase
{
    private readonly IInvoiceService _invoiceService;

    public InvoicesController(IInvoiceService invoiceService)
    {
        _invoiceService = invoiceService;
    }

    // GET /api/internal/invoices
    [HttpGet]
    [Authorize(Policy = "FinanceOrSuperAdmin")]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<InvoiceResponse>>>> ListInvoices(
        [FromQuery] string? invoiceStatus = null,
        [FromQuery] Guid? bookingId = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var allInvoices = await _invoiceService.GetAllAsync(invoiceStatus, bookingId);

        int total = allInvoices.Count;
        int totalPages = (int)Math.Ceiling(total / (double)pageSize);
        if (totalPages == 0) totalPages = 1;

        var paged = allInvoices
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToList();

        var response = paged.Select(MapToResponse).ToList();
        var pagination = new PaginationMeta(total, page, pageSize, totalPages);

        return Ok(ApiResponse<IReadOnlyList<InvoiceResponse>>.CreateSuccess(response, null, pagination));
    }

    // GET /api/internal/invoices/{id}
    [HttpGet("{id}")]
    [Authorize(Policy = "FinanceOrSuperAdmin")]
    public async Task<ActionResult<ApiResponse<InvoiceResponse>>> GetInvoiceById(Guid id)
    {
        var invoice = await _invoiceService.GetByIdAsync(id);

        if (invoice == null)
            return NotFound(ApiResponse.CreateFailure("Invoice not found."));

        return Ok(ApiResponse<InvoiceResponse>.CreateSuccess(MapToResponse(invoice)));
    }

    // POST /api/internal/invoices/drafts
    [HttpPost("drafts")]
    [Authorize(Policy = "FinanceOrSuperAdmin")]
    public async Task<ActionResult<ApiResponse<InvoiceResponse>>> CreateInvoiceDraft(CreateInvoiceDraftRequest request)
    {
        var invoice = await _invoiceService.CreateDraftFromBookingAsync(
            request.BookingId,
            request.InvoiceNumber,
            request.Notes
        );

        return Ok(ApiResponse<InvoiceResponse>.CreateSuccess(MapToResponse(invoice), "Invoice draft created successfully."));
    }

    // POST /api/internal/invoices/{id}/items/manual-adjustment
    [HttpPost("{id}/items/manual-adjustment")]
    [Authorize(Policy = "FinanceOrSuperAdmin")]
    public async Task<ActionResult<ApiResponse<InvoiceResponse>>> AddManualAdjustment(Guid id, AddInvoiceManualAdjustmentRequest request)
    {
        var invoice = await _invoiceService.AddManualAdjustmentAsync(
            id,
            request.Description,
            request.Quantity,
            request.UnitAmount
        );

        return Ok(ApiResponse<InvoiceResponse>.CreateSuccess(MapToResponse(invoice), "Manual adjustment added."));
    }

    // POST /api/internal/invoices/{id}/issue
    [HttpPost("{id}/issue")]
    [Authorize(Policy = "FinanceOrSuperAdmin")]
    public async Task<ActionResult<ApiResponse<InvoiceResponse>>> IssueInvoice(Guid id)
    {
        var invoice = await _invoiceService.IssueAsync(id);

        return Ok(ApiResponse<InvoiceResponse>.CreateSuccess(MapToResponse(invoice), "Invoice issued successfully."));
    }

    // POST /api/internal/invoices/{id}/cancel
    [HttpPost("{id}/cancel")]
    [Authorize(Policy = "FinanceOrSuperAdmin")]
    public async Task<ActionResult<ApiResponse<InvoiceResponse>>> CancelInvoice(Guid id, CancelInvoiceRequest request)
    {
        var invoice = await _invoiceService.CancelAsync(id, request.Notes);

        return Ok(ApiResponse<InvoiceResponse>.CreateSuccess(MapToResponse(invoice), "Invoice cancelled."));
    }

    // POST /api/internal/invoices/link-orphaned-payments
    [HttpPost("link-orphaned-payments")]
    [Authorize(Policy = "FinanceOrSuperAdmin")]
    public async Task<ActionResult<ApiResponse<object>>> LinkOrphanedPayments()
    {
        var linkedCount = await _invoiceService.LinkOrphanedPaymentsAsync();

        return Ok(ApiResponse<object>.CreateSuccess(
            new { linkedPaymentsCount = linkedCount },
            $"Successfully linked {linkedCount} orphaned payment(s) to their invoices."
        ));
    }

    // POST /api/internal/invoices/fix-paid-payments
    [HttpPost("fix-paid-payments")]
    [Authorize(Policy = "FinanceOrSuperAdmin")]
    public async Task<ActionResult<ApiResponse<object>>> FixPaidPayments()
    {
        var linkedCount = await _invoiceService.LinkOrphanedPaymentsAsync();

        return Ok(ApiResponse<object>.CreateSuccess(
            new { linkedPaymentsCount = linkedCount },
            $"Fixed {linkedCount} paid payment(s) by linking them to their invoices."
        ));
    }

    private static InvoiceItemResponse MapToItemResponse(InvoiceItem item)
    {
        return new InvoiceItemResponse
        {
            Id = item.Id,
            InvoiceId = item.InvoiceId,
            LineType = item.LineType,
            Description = item.Description,
            Quantity = item.Quantity,
            UnitAmount = item.UnitAmount,
            LineTotal = item.LineTotal,
            CreatedAt = item.CreatedAt,
            UpdatedAt = item.UpdatedAt
        };
    }

    private static InvoiceResponse MapToResponse(Invoice invoice)
    {
        return new InvoiceResponse
        {
            Id = invoice.Id,
            BookingId = invoice.BookingId,
            InvoiceNumber = invoice.InvoiceNumber,
            InvoiceStatus = invoice.InvoiceStatus,
            SubtotalAmount = invoice.SubtotalAmount,
            TotalAmount = invoice.TotalAmount,
            IssuedAt = invoice.IssuedAt,
            DueDate = invoice.DueDate,
            Notes = invoice.Notes,
            Items = invoice.InvoiceItems.Select(MapToItemResponse).ToList(),
            CreatedAt = invoice.CreatedAt,
            UpdatedAt = invoice.UpdatedAt
        };
    }
}
