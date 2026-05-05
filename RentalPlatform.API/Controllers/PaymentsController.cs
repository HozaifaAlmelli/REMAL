using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RentalPlatform.API.DTOs.Requests.Payments;
using RentalPlatform.API.DTOs.Responses.Payments;
using RentalPlatform.API.Models;
using RentalPlatform.Business.Interfaces;
using RentalPlatform.Data.Entities;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace RentalPlatform.API.Controllers;

[ApiController]
[Route("api/internal/payments")]
public class PaymentsController : ControllerBase
{
    private readonly IPaymentService _paymentService;

    public PaymentsController(IPaymentService paymentService)
    {
        _paymentService = paymentService;
    }

    // GET /api/internal/payments
    [HttpGet]
    [Authorize(Policy = "FinanceOrSuperAdmin")]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<PaymentResponse>>>> ListPayments(
        [FromQuery] string? paymentStatus = null,
        [FromQuery] Guid? bookingId = null,
        [FromQuery] Guid? invoiceId = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var allPayments = await _paymentService.GetAllAsync(paymentStatus, bookingId, invoiceId);

        int total = allPayments.Count;
        int totalPages = (int)Math.Ceiling(total / (double)pageSize);
        if (totalPages == 0) totalPages = 1;

        var paged = allPayments
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToList();

        var response = paged.Select(MapToResponse).ToList();
        var pagination = new PaginationMeta(total, page, pageSize, totalPages);

        return Ok(ApiResponse<IReadOnlyList<PaymentResponse>>.CreateSuccess(response, null, pagination));
    }

    // GET /api/internal/payments/{id}
    [HttpGet("{id}")]
    [Authorize(Policy = "FinanceOrSuperAdmin")]
    public async Task<ActionResult<ApiResponse<PaymentResponse>>> GetPaymentById(Guid id)
    {
        var payment = await _paymentService.GetByIdAsync(id);

        if (payment == null)
            return NotFound(ApiResponse.CreateFailure("Payment not found."));

        return Ok(ApiResponse<PaymentResponse>.CreateSuccess(MapToResponse(payment)));
    }

    // POST /api/internal/payments
    [HttpPost]
    [Authorize(Policy = "FinanceOrSuperAdmin")]
    public async Task<ActionResult<ApiResponse<PaymentResponse>>> CreatePayment(CreatePaymentRequest request)
    {
        var payment = await _paymentService.CreateAsync(
            request.BookingId,
            request.InvoiceId,
            request.PaymentMethod,
            request.Amount,
            request.ReferenceNumber,
            request.Notes
        );

        return Ok(ApiResponse<PaymentResponse>.CreateSuccess(MapToResponse(payment), "Payment created successfully."));
    }

    // POST /api/internal/payments/{id}/mark-paid
    [HttpPost("{id}/mark-paid")]
    [Authorize(Policy = "FinanceOrSuperAdmin")]
    public async Task<ActionResult<ApiResponse<PaymentResponse>>> MarkPaymentPaid(Guid id, MarkPaymentPaidRequest request)
    {
        var payment = await _paymentService.MarkPaidAsync(id, request.ReferenceNumber, request.Notes);

        return Ok(ApiResponse<PaymentResponse>.CreateSuccess(MapToResponse(payment), "Payment marked as paid."));
    }

    // POST /api/internal/payments/{id}/mark-failed
    [HttpPost("{id}/mark-failed")]
    [Authorize(Policy = "FinanceOrSuperAdmin")]
    public async Task<ActionResult<ApiResponse<PaymentResponse>>> MarkPaymentFailed(Guid id, MarkPaymentFailedRequest request)
    {
        var payment = await _paymentService.MarkFailedAsync(id, request.Notes);

        return Ok(ApiResponse<PaymentResponse>.CreateSuccess(MapToResponse(payment), "Payment marked as failed."));
    }

    // POST /api/internal/payments/{id}/cancel
    [HttpPost("{id}/cancel")]
    [Authorize(Policy = "FinanceOrSuperAdmin")]
    public async Task<ActionResult<ApiResponse<PaymentResponse>>> CancelPayment(Guid id, CancelPaymentRequest request)
    {
        var payment = await _paymentService.CancelAsync(id, request.Notes);

        return Ok(ApiResponse<PaymentResponse>.CreateSuccess(MapToResponse(payment), "Payment cancelled."));
    }

    // POST /api/internal/payments/link-paid-to-invoices
    [HttpPost("link-paid-to-invoices")]
    [Authorize(Policy = "FinanceOrSuperAdmin")]
    public async Task<ActionResult<ApiResponse<object>>> LinkPaidPaymentsToInvoices()
    {
        var linkedCount = await _paymentService.LinkPaidPaymentsToInvoicesAsync();

        return Ok(ApiResponse<object>.CreateSuccess(
            new { linkedPaymentsCount = linkedCount },
            $"Successfully linked {linkedCount} paid payment(s) to their invoices."
        ));
    }

    private static PaymentResponse MapToResponse(Payment payment)
    {
        return new PaymentResponse
        {
            Id = payment.Id,
            BookingId = payment.BookingId,
            InvoiceId = payment.InvoiceId,
            PaymentStatus = payment.PaymentStatus,
            PaymentMethod = payment.PaymentMethod,
            Amount = payment.Amount,
            ReferenceNumber = payment.ReferenceNumber,
            Notes = payment.Notes,
            PaidAt = payment.PaidAt,
            CreatedAt = payment.CreatedAt,
            UpdatedAt = payment.UpdatedAt
        };
    }
}
