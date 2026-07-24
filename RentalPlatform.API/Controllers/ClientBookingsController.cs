using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using RentalPlatform.API.DTOs.Requests.Bookings;
using RentalPlatform.API.DTOs.Responses.Auth;
using RentalPlatform.API.DTOs.Responses.Bookings;
using RentalPlatform.API.Models;
using RentalPlatform.API.Options;
using RentalPlatform.API.Services;
using RentalPlatform.Business.Exceptions;
using RentalPlatform.Business.Interfaces;
using RentalPlatform.Business.Models;
using RentalPlatform.Data.Entities;
using RentalPlatform.Shared.Enums;

namespace RentalPlatform.API.Controllers;

[ApiController]
[Route("api/client/bookings")]
[Authorize(Policy = "ClientOnly")]
public class ClientBookingsController : ControllerBase
{
    private readonly IBookingService _bookingService;
    private readonly IGuestBookingService _guestBookingService;
    private readonly ICrmLeadService _crmLeadService;
    private readonly IUnitAvailabilityService _availabilityService;
    private readonly ITokenService _tokenService;
    private readonly IWebHostEnvironment _environment;
    private readonly JwtOptions _jwtOptions;
    private readonly ILogger<ClientBookingsController> _logger;

    public ClientBookingsController(
        IBookingService bookingService,
        IGuestBookingService guestBookingService,
        ICrmLeadService crmLeadService,
        IUnitAvailabilityService availabilityService,
        ITokenService tokenService,
        IWebHostEnvironment environment,
        Microsoft.Extensions.Options.IOptions<JwtOptions> jwtOptions,
        ILogger<ClientBookingsController> logger)
    {
        _bookingService = bookingService;
        _guestBookingService = guestBookingService;
        _crmLeadService = crmLeadService;
        _availabilityService = availabilityService;
        _tokenService = tokenService;
        _environment = environment;
        _jwtOptions = jwtOptions.Value;
        _logger = logger;
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
        combined.AddRange(bookingsResult.Items.Select(MapToListItemResponse));

        var filteredLeads = leads.Where(l => !IsTerminalLeadStatus(l.LeadStatus));
        if (!string.IsNullOrWhiteSpace(bookingStatus))
        {
            if (Enum.TryParse<LeadStatus>(bookingStatus.Trim(), ignoreCase: true, out var requestedLeadStatus))
                filteredLeads = filteredLeads.Where(l => l.LeadStatus == requestedLeadStatus);
            else
                filteredLeads = Enumerable.Empty<CrmLead>();
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

    // Client-portal booking: creates a booking directly at "Prospecting" for the
    // authenticated client (no CRM lead). The client id comes from the token only.
    [HttpPost]
    public async Task<ActionResult<ApiResponse<BookingDetailsResponse>>> CreateOwnBooking(
        [FromBody] CreateClientBookingRequest request,
        CancellationToken cancellationToken)
    {
        var clientId = GetCurrentClientId();

        var booking = await _bookingService.CreateQuickAsync(
            clientId,
            request.UnitId,
            request.CheckInDate,
            request.CheckOutDate,
            request.GuestCount,
            source: "website",
            assignedAdminUserId: null,
            createdByAdminUserId: null,
            internalNotes: null,
            requirePortfolioVisibility: true,
            rejectSoftHoldOverlaps: true,
            cancellationToken);

        return Ok(ApiResponse<BookingDetailsResponse>.CreateSuccess(
            MapToDetailsResponse(booking),
            "Booking request submitted."));
    }

    [HttpPost("guest")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<GuestBookingResponse>>> CreateGuestBooking(
        [FromBody] CreateGuestBookingRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _guestBookingService.CreateAsync(
            request.FirstName,
            request.LastName,
            request.Phone,
            request.UnitId,
            request.CheckInDate,
            request.CheckOutDate,
            request.GuestCount,
            cancellationToken);

        var response = new GuestBookingResponse
        {
            Booking = MapToDetailsResponse(result.Booking),
            Auth = GenerateClientAuthResponse(result.Client)
        };

        return Ok(ApiResponse<GuestBookingResponse>.CreateSuccess(
            response,
            "Booking request submitted."));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiResponse<BookingDetailsResponse>>> GetOwnBooking(Guid id, CancellationToken cancellationToken)
    {
        var clientId = GetCurrentClientId();
        var booking = await _bookingService.GetByIdAsync(id, cancellationToken);

        if (booking == null)
        {
            var lead = await _crmLeadService.GetByIdAsync(id, cancellationToken);
            if (lead == null || lead.ClientId != clientId || IsTerminalLeadStatus(lead.LeadStatus))
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

    private AuthResponse GenerateClientAuthResponse(Client client)
    {
        var subject = new AuthenticatedSubject
        {
            UserId = client.Id,
            SubjectType = "Client",
            Identifier = client.Phone,
            Name = client.Name,
            AdminRole = null,
            ClientUpdatedAt = client.UpdatedAt
        };

        var accessToken = _tokenService.GenerateAccessToken(subject);
        var refreshToken = _tokenService.GenerateRefreshToken(subject);
        SetRefreshTokenCookie(refreshToken);

        return new AuthResponse(
            AccessToken: accessToken,
            ExpiresInSeconds: _jwtOptions.AccessTokenExpirationMinutes * 60,
            SubjectType: subject.SubjectType,
            AdminRole: null,
            RoleName: null,
            User: new AuthenticatedUserResponse(
                UserId: client.Id,
                Identifier: client.Phone,
                SubjectType: subject.SubjectType,
                AdminRole: null,
                Name: client.Name),
            Permissions: Array.Empty<string>());
    }

    private void SetRefreshTokenCookie(string refreshToken)
    {
        var cookieOptions = new CookieOptions
        {
            HttpOnly = true,
            Secure = !_environment.IsDevelopment(),
            SameSite = SameSiteMode.Strict,
            Expires = DateTime.UtcNow.AddDays(7)
        };

        Response.Cookies.Append("refresh_token", refreshToken, cookieOptions);
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
                _logger.LogWarning(
                    ex,
                    "Could not calculate client-visible pricing for CRM lead {LeadId}.",
                    lead.Id);
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
            BookingStatus = lead.LeadStatus.ToString(),
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
                _logger.LogWarning(
                    ex,
                    "Could not calculate client-visible pricing for CRM lead {LeadId}.",
                    lead.Id);
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
            BookingStatus = lead.LeadStatus.ToString(),
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

    private static bool IsTerminalLeadStatus(LeadStatus status)
    {
        return status is LeadStatus.NotRelevant
            or LeadStatus.Completed
            or LeadStatus.Cancelled
            or LeadStatus.LeftEarly;
    }
}
