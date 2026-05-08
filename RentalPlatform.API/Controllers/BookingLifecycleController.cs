using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RentalPlatform.API.DTOs.Requests.BookingLifecycle;
using RentalPlatform.API.DTOs.Responses.Bookings;
using RentalPlatform.API.Models;
using RentalPlatform.Business.Interfaces;
using RentalPlatform.Data.Entities;
using System;
using System.Security.Claims;
using System.Threading.Tasks;

namespace RentalPlatform.API.Controllers;

[ApiController]
[Route("api/internal/bookings/{id}")]
[Authorize(Policy = "SalesOrSuperAdmin")]
public class BookingLifecycleController : ControllerBase
{
    private readonly IBookingLifecycleService _lifecycleService;

    public BookingLifecycleController(IBookingLifecycleService lifecycleService)
    {
        _lifecycleService = lifecycleService;
    }

    // 1. POST /api/internal/bookings/{id}/confirm
    [HttpPost("confirm")]
    public async Task<ActionResult<ApiResponse<BookingDetailsResponse>>> ConfirmBooking(Guid id, ConfirmBookingRequest request)
    {
        var adminId = GetCurrentAdminId();
        var booking = await _lifecycleService.ConfirmAsync(id, adminId, request.Notes);
        
        return Ok(ApiResponse<BookingDetailsResponse>.CreateSuccess(MapToDetailsResponse(booking), "Booking confirmed successfully."));
    }

    // 2. POST /api/internal/bookings/{id}/cancel
    [HttpPost("cancel")]
    public async Task<ActionResult<ApiResponse<BookingDetailsResponse>>> CancelBooking(Guid id, CancelBookingRequest request)
    {
        var adminId = GetCurrentAdminId();
        var booking = await _lifecycleService.CancelAsync(id, adminId, request.Notes);
        
        return Ok(ApiResponse<BookingDetailsResponse>.CreateSuccess(MapToDetailsResponse(booking), "Booking cancelled successfully."));
    }

    // 3. POST /api/internal/bookings/{id}/complete
    [HttpPost("complete")]
    public async Task<ActionResult<ApiResponse<BookingDetailsResponse>>> CompleteBooking(Guid id, CompleteBookingRequest request)
    {
        var adminId = GetCurrentAdminId();
        var booking = await _lifecycleService.CompleteAsync(id, adminId, request.Notes);
        
        return Ok(ApiResponse<BookingDetailsResponse>.CreateSuccess(MapToDetailsResponse(booking), "Booking completed successfully."));
    }

    // 4. POST /api/internal/bookings/{id}/check-in
    [HttpPost("check-in")]
    public async Task<ActionResult<ApiResponse<BookingDetailsResponse>>> CheckInBooking(Guid id, CheckInBookingRequest request)
    {
        var adminId = GetCurrentAdminId();
        var booking = await _lifecycleService.CheckInAsync(id, adminId, request.Notes);
        
        return Ok(ApiResponse<BookingDetailsResponse>.CreateSuccess(MapToDetailsResponse(booking), "Booking checked in successfully."));
    }

    // 5. POST /api/internal/bookings/{id}/left-early
    [HttpPost("left-early")]
    public async Task<ActionResult<ApiResponse<BookingDetailsResponse>>> LeftEarlyBooking(Guid id, LeftEarlyBookingRequest request)
    {
        var adminId = GetCurrentAdminId();
        var booking = await _lifecycleService.LeftEarlyAsync(id, adminId, request.Notes);
        
        return Ok(ApiResponse<BookingDetailsResponse>.CreateSuccess(MapToDetailsResponse(booking), "Booking marked as left early successfully."));
    }

    private Guid GetCurrentAdminId()
    {
        var subClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(subClaim) || !Guid.TryParse(subClaim, out var adminId))
        {
            throw new UnauthorizedAccessException("Current user ID not found in claims.");
        }
        return adminId;
    }

    private static BookingDetailsResponse MapToDetailsResponse(Booking booking)
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
