using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RentalPlatform.API.DTOs.Requests.Bookings;
using RentalPlatform.API.DTOs.Responses.Bookings;
using RentalPlatform.API.DTOs.Responses.BookingLifecycle;
using RentalPlatform.API.Models;
using RentalPlatform.API.Authorization;
using RentalPlatform.Business.Interfaces;
using RentalPlatform.Data.Entities;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using RentalPlatform.Shared.Constants;
using RentalPlatform.Shared.Enums;

namespace RentalPlatform.API.Controllers;

[ApiController]
[Route("api/internal/bookings")]
public class BookingsController : ControllerBase
{
    private readonly IBookingService _bookingService;

    public BookingsController(IBookingService bookingService)
    {
        _bookingService = bookingService;
    }

    // 1. GET /api/internal/bookings
    [HttpGet]
    [Authorize(Policy = PermissionKeys.BookingsRead)]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<BookingListItemResponse>>>> ListInternalBookings(
        [FromQuery] string? bookingStatus = null,
        [FromQuery] Guid? assignedAdminUserId = null,
        [FromQuery] Guid? clientId = null,
        [FromQuery] Guid? ownerId = null,
        [FromQuery] string? search = null,
        [FromQuery] DateOnly? checkInFrom = null,
        [FromQuery] DateOnly? checkInTo = null,
        [FromQuery] bool agedSoftHoldsOnly = false,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var result = await _bookingService.GetAllAsync(
            bookingStatus,
            assignedAdminUserId,
            clientId,
            ownerId,
            search,
            checkInFrom,
            checkInTo,
            page,
            pageSize,
            agedSoftHoldsOnly);

        int totalPages = (int)Math.Ceiling(result.Total / (double)pageSize);
        if (totalPages == 0) totalPages = 1;

        var response = result.Items.Select(MapToListItemResponse).ToList();
        var pagination = new PaginationMeta(result.Total, page, pageSize, totalPages);

        return Ok(ApiResponse<IReadOnlyList<BookingListItemResponse>>.CreateSuccess(response, null, pagination));
    }

    // 2. GET /api/internal/bookings/{id}
    [HttpGet("{id}")]
    [Authorize(Policy = PermissionKeys.BookingsRead)]
    public async Task<ActionResult<ApiResponse<BookingDetailsResponse>>> GetInternalBookingById(Guid id)
    {
        var booking = await _bookingService.GetByIdAsync(id);
        
        if (booking == null)
            return NotFound(ApiResponse.CreateFailure("Booking not found."));

        return Ok(ApiResponse<BookingDetailsResponse>.CreateSuccess(MapToDetailsResponse(booking)));
    }

    // 3. GET /api/internal/bookings/{id}/status-history
    [HttpGet("{id}/status-history")]
    [Authorize(Policy = PermissionKeys.BookingsRead)]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<BookingStatusHistoryResponse>>>> GetBookingStatusHistory(Guid id)
    {
        // First check if booking exists
        var booking = await _bookingService.GetByIdAsync(id);
        if (booking == null)
            return NotFound(ApiResponse.CreateFailure("Booking not found."));
            
        var history = await _bookingService.GetStatusHistoryAsync(id);
        var response = history.Select(MapToHistoryResponse).ToList();
        
        return Ok(ApiResponse<IReadOnlyList<BookingStatusHistoryResponse>>.CreateSuccess(response));
    }

    // 4. POST /api/internal/bookings
    [HttpPost]
    [Authorize(Policy = PermissionKeys.BookingsWrite)]
    public async Task<ActionResult<ApiResponse<BookingDetailsResponse>>> CreateBooking(CreateBookingRequest request)
    {
        var creatorAdminUserId = GetCurrentAdminId();
        var booking = await _bookingService.CreateAsync(
            request.ClientId,
            request.UnitId,
            request.CheckInDate,
            request.CheckOutDate,
            request.GuestCount,
            request.Source,
            assignedAdminUserId: request.AssignedAdminUserId,
            createdByAdminUserId: creatorAdminUserId,
            internalNotes: request.InternalNotes
        );
        
        return Ok(ApiResponse<BookingDetailsResponse>.CreateSuccess(MapToDetailsResponse(booking), "Booking created successfully."));
    }

    // 4b. POST /api/internal/bookings/quick
    [HttpPost("quick")]
    [Authorize(Policy = PermissionKeys.BookingsWrite)]
    public async Task<ActionResult<ApiResponse<BookingDetailsResponse>>> CreateQuickBooking(CreateBookingRequest request)
    {
        var creatorAdminUserId = GetCurrentAdminId();
        var booking = await _bookingService.CreateQuickAsync(
            request.ClientId,
            request.UnitId,
            request.CheckInDate,
            request.CheckOutDate,
            request.GuestCount,
            string.IsNullOrWhiteSpace(request.Source) ? "admin" : request.Source,
            assignedAdminUserId: request.AssignedAdminUserId,
            createdByAdminUserId: creatorAdminUserId,
            internalNotes: request.InternalNotes
        );

        return Ok(ApiResponse<BookingDetailsResponse>.CreateSuccess(MapToDetailsResponse(booking), "Quick booking created successfully."));
    }

    // 5. PUT /api/internal/bookings/{id}
    [HttpPut("{id}")]
    [Authorize(Policy = PermissionKeys.BookingsWrite)]
    public async Task<ActionResult<ApiResponse<BookingDetailsResponse>>> UpdatePendingBooking(Guid id, UpdatePendingBookingRequest request)
    {
        var booking = await _bookingService.UpdatePendingAsync(
            id,
            request.CheckInDate,
            request.CheckOutDate,
            request.GuestCount,
            request.Source,
            request.AssignedAdminUserId,
            request.InternalNotes
        );
        
        return Ok(ApiResponse<BookingDetailsResponse>.CreateSuccess(MapToDetailsResponse(booking), "Booking updated successfully."));
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
            AssignedAdminUserName = booking.AssignedAdminUser?.Name,
            AssignedAdminUserRole = booking.AssignedAdminUser?.RoleTemplate?.Name
                ?? booking.AssignedAdminUser?.Role?.ToString(),
            BookingStatus = booking.BookingStatus.ToString(),
            CheckInDate = booking.CheckInDate,
            CheckOutDate = booking.CheckOutDate,
            GuestCount = booking.GuestCount,
            BaseAmount = booking.BaseAmount,
            FinalAmount = booking.FinalAmount,
            Source = booking.Source,
            CreatedAt = booking.CreatedAt,
            IsAgedSoftHold = IsAgedSoftHold(booking),
            SoftHoldAgeDays = GetSoftHoldAgeDays(booking)
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
            AssignedAdminUserName = booking.AssignedAdminUser?.Name,
            AssignedAdminUserRole = booking.AssignedAdminUser?.RoleTemplate?.Name
                ?? booking.AssignedAdminUser?.Role?.ToString(),
            BookingStatus = booking.BookingStatus.ToString(),
            CheckInDate = booking.CheckInDate,
            CheckOutDate = booking.CheckOutDate,
            GuestCount = booking.GuestCount,
            BaseAmount = booking.BaseAmount,
            FinalAmount = booking.FinalAmount,
            Source = booking.Source,
            InternalNotes = booking.InternalNotes,
            CreatedAt = booking.CreatedAt,
            UpdatedAt = booking.UpdatedAt,
            IsAgedSoftHold = IsAgedSoftHold(booking),
            SoftHoldAgeDays = GetSoftHoldAgeDays(booking)
        };
    }

    private static bool IsAgedSoftHold(Booking booking)
    {
        return BookingStatusTransitions.SoftHoldStatuses.Contains(booking.BookingStatus)
            && booking.CreatedAt <= DateTime.UtcNow.AddDays(-BookingStatusTransitions.AgedSoftHoldThresholdDays);
    }

    private static int? GetSoftHoldAgeDays(Booking booking)
    {
        if (!BookingStatusTransitions.SoftHoldStatuses.Contains(booking.BookingStatus))
            return null;

        return Math.Max(0, (int)Math.Floor((DateTime.UtcNow - booking.CreatedAt).TotalDays));
    }

    private static BookingStatusHistoryResponse MapToHistoryResponse(BookingStatusHistory history)
    {
        var actor = ResolveHistoryActor(history);

        return new BookingStatusHistoryResponse
        {
            Id = history.Id,
            BookingId = history.BookingId,
            OldStatus = NormalizeBookingStatus(history.OldStatus),
            NewStatus = NormalizeBookingStatus(history.NewStatus) ?? history.NewStatus,
            ChangedByAdminUserId = history.ChangedByAdminUserId,
            ActorDisplayName = actor.DisplayName,
            ActorType = actor.Type,
            Notes = history.Notes,
            ChangedAt = history.ChangedAt
        };
    }

    private Guid GetCurrentAdminId()
    {
        var subject = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(subject) || !Guid.TryParse(subject, out var adminUserId))
            throw new UnauthorizedAccessException("Current admin user ID not found in claims.");

        return adminUserId;
    }

    private static (string DisplayName, string Type) ResolveHistoryActor(BookingStatusHistory history)
    {
        if (history.ChangedByAdminUser != null)
        {
            var displayName = !string.IsNullOrWhiteSpace(history.ChangedByAdminUser.Name)
                ? history.ChangedByAdminUser.Name.Trim()
                : history.ChangedByAdminUser.Email.Trim();

            if (!string.IsNullOrWhiteSpace(displayName))
                return (displayName, "admin");
        }

        var isCreationEntry =
            history.OldStatus == null &&
            string.Equals(
                history.Notes,
                BookingHistoryEvents.BookingCreated,
                StringComparison.Ordinal);
        if (isCreationEntry &&
            string.Equals(history.Booking?.Source, "website", StringComparison.OrdinalIgnoreCase))
        {
            return ("Online booking", "online");
        }

        if (string.Equals(
                history.Notes,
                BookingHistoryEvents.AutomaticCompletion,
                StringComparison.Ordinal))
        {
            return ("System", "system");
        }

        return isCreationEntry
            ? ("Creator unavailable", "unavailable")
            : ("Actor unavailable", "unavailable");
    }

    private static string? NormalizeBookingStatus(string? status)
    {
        return Enum.TryParse<BookingStatus>(status, ignoreCase: true, out var parsed)
            ? parsed.ToString()
            : status;
    }
}
