using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RentalPlatform.API.DTOs.Responses.Bookings;
using RentalPlatform.API.Models;
using RentalPlatform.Business.Exceptions;
using RentalPlatform.Business.Interfaces;
using RentalPlatform.Data.Entities;

namespace RentalPlatform.API.Controllers;

[ApiController]
[Route("api/client/bookings")]
[Authorize(Policy = "ClientOnly")]
public class ClientBookingsController : ControllerBase
{
    private readonly IBookingService _bookingService;
    private readonly ICrmLeadService _crmLeadService;
    private readonly IUnitAvailabilityService _availabilityService;

    public ClientBookingsController(
        IBookingService bookingService, 
        ICrmLeadService crmLeadService,
        IUnitAvailabilityService availabilityService)
    {
        _bookingService = bookingService;
        _crmLeadService = crmLeadService;
        _availabilityService = availabilityService;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<BookingListItemResponse>>>> ListOwnBookings(
        [FromQuery] string? bookingStatus = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var clientId = GetCurrentClientId();
        
        // Fetch all bookings for the client
        var bookingsResult = await _bookingService.GetAllAsync(
            bookingStatus: bookingStatus,
            clientId: clientId,
            page: 1,
            pageSize: 10000,
            cancellationToken: cancellationToken);

        // Fetch all leads (pending booking requests) for the client
        var leads = await _crmLeadService.GetByClientIdAsync(clientId, cancellationToken);
        var combined = new List<BookingListItemResponse>();
        Console.WriteLine($"[DEBUG] Fetched {leads.Count} leads for client {clientId}. Combined currently has {combined.Count} bookings.");
        combined.AddRange(bookingsResult.Items.Select(MapToListItemResponse));

        // Include active leads mapped to "Prospecting" status
        var filteredLeads = leads.AsEnumerable();
        if (!string.IsNullOrWhiteSpace(bookingStatus))
        {
            if (bookingStatus.Equals("Prospecting", StringComparison.OrdinalIgnoreCase))
                filteredLeads = filteredLeads.Where(l => l.LeadStatus != RentalPlatform.Shared.Enums.LeadStatus.Converted && l.LeadStatus != RentalPlatform.Shared.Enums.LeadStatus.Lost);
            else
                filteredLeads = Enumerable.Empty<CrmLead>();
        }
        else
        {
            filteredLeads = filteredLeads.Where(l => l.LeadStatus != RentalPlatform.Shared.Enums.LeadStatus.Converted && l.LeadStatus != RentalPlatform.Shared.Enums.LeadStatus.Lost);
        }

        foreach (var lead in filteredLeads)
        {
            combined.Add(await MapLeadToListItemResponseAsync(lead, cancellationToken));
        }

        var total = combined.Count;
        var totalPages = (int)Math.Ceiling(total / (double)pageSize);
        if (totalPages == 0) totalPages = 1;

        var pagedResponse = combined
            .OrderByDescending(x => x.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToList();

        var pagination = new PaginationMeta(total, page, pageSize, totalPages);

        return Ok(ApiResponse<IReadOnlyList<BookingListItemResponse>>.CreateSuccess(pagedResponse, null, pagination));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiResponse<BookingDetailsResponse>>> GetOwnBooking(Guid id, CancellationToken cancellationToken)
    {
        var clientId = GetCurrentClientId();
        var booking = await _bookingService.GetByIdAsync(id, cancellationToken);

        if (booking == null)
        {
            var lead = await _crmLeadService.GetByIdAsync(id, cancellationToken);
            if (lead == null || lead.ClientId != clientId)
                throw new NotFoundException($"Booking or request {id} not found.");

            return Ok(ApiResponse<BookingDetailsResponse>.CreateSuccess(await MapLeadToDetailsResponseAsync(lead, cancellationToken)));
        }

        if (booking.ClientId != clientId)
            throw new NotFoundException($"Booking {id} not found.");

        return Ok(ApiResponse<BookingDetailsResponse>.CreateSuccess(MapToDetailsResponse(booking)));
    }

    private Guid GetCurrentClientId()
    {
        var subClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrWhiteSpace(subClaim) || !Guid.TryParse(subClaim, out var clientId))
            throw new UnauthorizedBusinessException("Current client ID not found in claims.");

        return clientId;
    }

    private static BookingListItemResponse MapToListItemResponse(Booking booking)
    {
        return new BookingListItemResponse
        {
            Id = booking.Id,
            ClientId = booking.ClientId,
            ClientName = booking.Client?.Name,
            ClientPhone = booking.Client?.Phone,
            UnitId = booking.UnitId,
            UnitName = booking.Unit?.Name,
            OwnerId = booking.OwnerId,
            AssignedAdminUserId = booking.AssignedAdminUserId,
            BookingStatus = booking.BookingStatus.ToString(),
            CheckInDate = booking.CheckInDate,
            CheckOutDate = booking.CheckOutDate,
            GuestCount = booking.GuestCount,
            BaseAmount = booking.BaseAmount,
            FinalAmount = booking.FinalAmount,
            Source = booking.Source,
            CreatedAt = booking.CreatedAt
        };
    }

    private static BookingDetailsResponse MapToDetailsResponse(Booking booking)
    {
        return new BookingDetailsResponse
        {
            Id = booking.Id,
            ClientId = booking.ClientId,
            UnitId = booking.UnitId,
            UnitName = booking.Unit?.Name,
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

    private async Task<BookingListItemResponse> MapLeadToListItemResponseAsync(CrmLead lead, CancellationToken cancellationToken)
    {
        decimal finalAmount = 0;
        
        if (lead.TargetUnitId.HasValue && lead.DesiredCheckInDate.HasValue && lead.DesiredCheckOutDate.HasValue)
        {
            try 
            {
                var pricing = await _availabilityService.CalculatePricingAsync(
                    lead.TargetUnitId.Value, 
                    lead.DesiredCheckInDate.Value, 
                    lead.DesiredCheckOutDate.Value, 
                    cancellationToken);
                
                finalAmount = pricing.TotalPrice;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[WARNING] Failed to calculate pricing for lead {lead.Id}: {ex.Message}");
            }
        }

        return new BookingListItemResponse
        {
            Id = lead.Id,
            ClientId = lead.ClientId ?? Guid.Empty,
            ClientName = lead.ContactName,
            ClientPhone = lead.ContactPhone,
            UnitId = lead.TargetUnitId ?? Guid.Empty,
            UnitName = lead.TargetUnit?.Name,
            OwnerId = Guid.Empty,
            AssignedAdminUserId = lead.AssignedAdminUserId,
            BookingStatus = "Prospecting", // Map pending CRM leads as Prospecting requests
            CheckInDate = lead.DesiredCheckInDate ?? default,
            CheckOutDate = lead.DesiredCheckOutDate ?? default,
            GuestCount = lead.GuestCount ?? 0,
            BaseAmount = finalAmount,
            FinalAmount = finalAmount,
            Source = lead.Source,
            CreatedAt = lead.CreatedAt
        };
    }

    private async Task<BookingDetailsResponse> MapLeadToDetailsResponseAsync(CrmLead lead, CancellationToken cancellationToken)
    {
        decimal finalAmount = 0;
        
        if (lead.TargetUnitId.HasValue && lead.DesiredCheckInDate.HasValue && lead.DesiredCheckOutDate.HasValue)
        {
            try 
            {
                var pricing = await _availabilityService.CalculatePricingAsync(
                    lead.TargetUnitId.Value, 
                    lead.DesiredCheckInDate.Value, 
                    lead.DesiredCheckOutDate.Value, 
                    cancellationToken);
                
                finalAmount = pricing.TotalPrice;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[WARNING] Failed to calculate pricing for lead {lead.Id}: {ex.Message}");
            }
        }

        return new BookingDetailsResponse
        {
            Id = lead.Id,
            ClientId = lead.ClientId ?? Guid.Empty,
            UnitId = lead.TargetUnitId ?? Guid.Empty,
            UnitName = lead.TargetUnit?.Name,
            OwnerId = Guid.Empty,
            AssignedAdminUserId = lead.AssignedAdminUserId,
            BookingStatus = "Prospecting",
            CheckInDate = lead.DesiredCheckInDate ?? default,
            CheckOutDate = lead.DesiredCheckOutDate ?? default,
            GuestCount = lead.GuestCount ?? 0,
            BaseAmount = finalAmount,
            FinalAmount = finalAmount,
            Source = lead.Source,
            InternalNotes = null, // Do not expose CRM internal notes to the client
            CreatedAt = lead.CreatedAt,
            UpdatedAt = lead.UpdatedAt
        };
    }
}