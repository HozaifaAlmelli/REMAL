using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RentalPlatform.API.DTOs.Requests.OwnerPortal;
using RentalPlatform.API.DTOs.Responses.OwnerPortal;
using RentalPlatform.API.Models;
using RentalPlatform.Business.Interfaces;
using RentalPlatform.Data.ReadModels;

namespace RentalPlatform.API.Controllers;

[ApiController]
[Authorize(Policy = "OwnerOnly")]
public class OwnerPortalBookingsController : ControllerBase
{
    private readonly IOwnerPortalBookingService _bookingService;

    public OwnerPortalBookingsController(IOwnerPortalBookingService bookingService)
    {
        _bookingService = bookingService;
    }

    // GET /api/owner/bookings
    [HttpGet("api/owner/bookings")]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<OwnerPortalBookingResponse>>>> GetBookings(
        [FromQuery] GetOwnerPortalBookingsRequest request,
        CancellationToken cancellationToken)
    {
        var ownerId = GetCurrentOwnerId();

        var bookings = await _bookingService.GetAllByOwnerAsync(
            ownerId,
            bookingStatus: request.BookingStatus,
            checkInFrom: request.CheckInFrom,
            checkInTo: request.CheckInTo,
            cancellationToken: cancellationToken);

        var totalCount = bookings.Count;
        var paged = bookings
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(MapToResponse)
            .ToList();

        var totalPages = (int)Math.Ceiling(totalCount / (double)request.PageSize);
        var pagination = new PaginationMeta(totalCount, request.Page, request.PageSize, totalPages);

        return Ok(ApiResponse<IReadOnlyList<OwnerPortalBookingResponse>>.CreateSuccess(paged, pagination: pagination));
    }

    // GET /api/owner/bookings/{bookingId}
    [HttpGet("api/owner/bookings/{bookingId}")]
    public async Task<ActionResult<ApiResponse<OwnerPortalBookingResponse>>> GetBooking(
        Guid bookingId,
        CancellationToken cancellationToken)
    {
        var ownerId = GetCurrentOwnerId();

        var booking = await _bookingService.GetByOwnerAndBookingIdAsync(ownerId, bookingId, cancellationToken);

        return Ok(ApiResponse<OwnerPortalBookingResponse>.CreateSuccess(MapToResponse(booking!)));
    }

    private Guid GetCurrentOwnerId()
    {
        var subClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(subClaim) || !Guid.TryParse(subClaim, out var ownerId))
            throw new UnauthorizedAccessException("Current owner ID not found in claims.");

        return ownerId;
    }

    private static OwnerPortalBookingResponse MapToResponse(OwnerPortalBookingOverview booking) =>
        new()
        {
            BookingId            = booking.BookingId,
            UnitId               = booking.UnitId,
            ClientId             = booking.ClientId,
            AssignedAdminUserId  = booking.AssignedAdminUserId,
            BookingStatus        = booking.BookingStatus,
            CheckInDate          = booking.CheckInDate,
            CheckOutDate         = booking.CheckOutDate,
            GuestCount           = booking.GuestCount,
            FinalAmount          = booking.FinalAmount,
            Source               = booking.Source,
            IsHistorical         = booking.IsHistorical,
            CreatedAt            = booking.CreatedAt,
            UpdatedAt            = booking.UpdatedAt,
        };
}
