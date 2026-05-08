using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RentalPlatform.API.DTOs.Requests.CrmLeads;
using RentalPlatform.API.DTOs.Responses.CrmLeads;
using RentalPlatform.API.DTOs.Responses.Bookings;
using RentalPlatform.API.Models;
using RentalPlatform.Business.Interfaces;
using RentalPlatform.Data.Entities;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace RentalPlatform.API.Controllers;

[ApiController]
public class CrmLeadsController : ControllerBase
{
    private readonly ICrmLeadService _crmLeadService;

    public CrmLeadsController(ICrmLeadService crmLeadService)
    {
        _crmLeadService = crmLeadService;
    }

    // 1. POST /api/crm/leads - Public Capture
    [HttpPost("api/crm/leads")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<CrmLeadDetailsResponse>>> PublicCaptureLead(PublicCreateCrmLeadRequest request)
    {
        var lead = await _crmLeadService.CreateAsync(
            request.ClientId,
            request.TargetUnitId,
            null, // AssignedAdminUserId strictly null for public capture
            request.ContactName,
            request.ContactPhone,
            request.ContactEmail,
            request.DesiredCheckInDate,
            request.DesiredCheckOutDate,
            request.GuestCount,
            request.Source,
            request.Notes
        );

        return Ok(ApiResponse<CrmLeadDetailsResponse>.CreateSuccess(MapToDetailsResponse(lead), "Lead captured successfully."));
    }

    // 2. GET /api/internal/crm/leads - Internal List
    [HttpGet("api/internal/crm/leads")]
    [Authorize(Policy = "SalesOrSuperAdmin")]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<CrmLeadListItemResponse>>>> ListInternalLeads(
        [FromQuery] string? leadStatus = null,
        [FromQuery] Guid? assignedAdminUserId = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var allLeads = await _crmLeadService.GetAllAsync(leadStatus, assignedAdminUserId);

        int total = allLeads.Count;
        int totalPages = (int)Math.Ceiling(total / (double)pageSize);
        if (totalPages == 0) totalPages = 1;

        var pagedLeads = allLeads
            .OrderByDescending(l => l.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToList();

        var response = pagedLeads.Select(MapToListItemResponse).ToList();
        var pagination = new PaginationMeta(total, page, pageSize, totalPages);

        return Ok(ApiResponse<IReadOnlyList<CrmLeadListItemResponse>>.CreateSuccess(response, null, pagination));
    }

    // 3. GET /api/internal/crm/leads/{id} - Internal Detail
    [HttpGet("api/internal/crm/leads/{id}")]
    [Authorize(Policy = "SalesOrSuperAdmin")]
    public async Task<ActionResult<ApiResponse<CrmLeadDetailsResponse>>> GetInternalLeadById(Guid id)
    {
        var lead = await _crmLeadService.GetByIdAsync(id);
        if (lead == null)
            return NotFound(ApiResponse.CreateFailure("CRM Lead not found."));

        return Ok(ApiResponse<CrmLeadDetailsResponse>.CreateSuccess(MapToDetailsResponse(lead)));
    }

    // 4. PUT /api/internal/crm/leads/{id} - Internal Update
    [HttpPut("api/internal/crm/leads/{id}")]
    [Authorize(Policy = "SalesOrSuperAdmin")]
    public async Task<ActionResult<ApiResponse<CrmLeadDetailsResponse>>> UpdateInternalLead(Guid id, UpdateCrmLeadRequest request)
    {
        var lead = await _crmLeadService.UpdateAsync(
            id,
            request.ClientId,
            request.TargetUnitId,
            request.AssignedAdminUserId,
            request.ContactName,
            request.ContactPhone,
            request.ContactEmail,
            request.DesiredCheckInDate,
            request.DesiredCheckOutDate,
            request.GuestCount,
            request.Source,
            request.Notes
        );

        return Ok(ApiResponse<CrmLeadDetailsResponse>.CreateSuccess(MapToDetailsResponse(lead), "Lead updated successfully."));
    }

    // 5. PATCH /api/internal/crm/leads/{id}/status - Internal Status Update
    [HttpPatch("api/internal/crm/leads/{id}/status")]
    [Authorize(Policy = "SalesOrSuperAdmin")]
    public async Task<ActionResult<ApiResponse<CrmLeadDetailsResponse>>> UpdateLeadStatus(Guid id, UpdateCrmLeadStatusRequest request)
    {
        var lead = await _crmLeadService.SetStatusAsync(id, request.LeadStatus);
        return Ok(ApiResponse<CrmLeadDetailsResponse>.CreateSuccess(MapToDetailsResponse(lead), "Lead status updated successfully."));
    }

    // 6. POST /api/internal/crm/leads/{id}/convert-to-booking - Internal Conversion
    [HttpPost("api/internal/crm/leads/{id}/convert-to-booking")]
    [Authorize(Policy = "SalesOrSuperAdmin")]
    public async Task<ActionResult<ApiResponse<BookingDetailsResponse>>> ConvertLeadToBooking(Guid id, ConvertLeadToBookingRequest request)
    {
        var booking = await _crmLeadService.ConvertToBookingAsync(
            id,
            request.ClientId,
            request.UnitId,
            request.CheckInDate,
            request.CheckOutDate,
            request.GuestCount,
            request.InternalNotes
        );

        return Ok(ApiResponse<BookingDetailsResponse>.CreateSuccess(MapToBookingDetailsResponse(booking), "Lead converted to booking successfully."));
    }

    private static CrmLeadListItemResponse MapToListItemResponse(CrmLead lead)
    {
        return new CrmLeadListItemResponse
        {
            Id = lead.Id,
            ClientId = lead.ClientId,
            TargetUnitId = lead.TargetUnitId,
            AssignedAdminUserId = lead.AssignedAdminUserId,
            ContactName = lead.ContactName,
            ContactPhone = lead.ContactPhone,
            ContactEmail = lead.ContactEmail,
            DesiredCheckInDate = lead.DesiredCheckInDate,
            DesiredCheckOutDate = lead.DesiredCheckOutDate,
            GuestCount = lead.GuestCount,
            LeadStatus = lead.LeadStatus.ToString(),
            Source = lead.Source,
            TargetUnitName = lead.TargetUnit?.Name,
            CreatedAt = lead.CreatedAt
        };
    }

    private static CrmLeadDetailsResponse MapToDetailsResponse(CrmLead lead)
    {
        return new CrmLeadDetailsResponse
        {
            Id = lead.Id,
            ClientId = lead.ClientId,
            TargetUnitId = lead.TargetUnitId,
            AssignedAdminUserId = lead.AssignedAdminUserId,
            ContactName = lead.ContactName,
            ContactPhone = lead.ContactPhone,
            ContactEmail = lead.ContactEmail,
            DesiredCheckInDate = lead.DesiredCheckInDate,
            DesiredCheckOutDate = lead.DesiredCheckOutDate,
            GuestCount = lead.GuestCount,
            LeadStatus = lead.LeadStatus.ToString(),
            Source = lead.Source,
            Notes = lead.Notes,
            TargetUnitName = lead.TargetUnit?.Name,
            CreatedAt = lead.CreatedAt,
            UpdatedAt = lead.UpdatedAt
        };
    }

    private static BookingDetailsResponse MapToBookingDetailsResponse(Booking booking)
    {
        return new BookingDetailsResponse
        {
            Id = booking.Id,
            ClientId = booking.ClientId,
            UnitId = booking.UnitId,
            OwnerId = booking.OwnerId,
            AssignedAdminUserId = booking.AssignedAdminUserId,
            BookingStatus = booking.BookingStatus.ToString(),
            CheckInDate = booking.CheckInDate,
            CheckOutDate = booking.CheckOutDate,
            GuestCount = booking.GuestCount,
            BaseAmount = booking.BaseAmount,
            FinalAmount = booking.FinalAmount,
            Source = booking.Source,
            InternalNotes = booking.InternalNotes,
            CreatedAt = booking.CreatedAt,
            UpdatedAt = booking.UpdatedAt
        };
    }
}
