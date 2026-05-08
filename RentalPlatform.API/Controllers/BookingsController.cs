using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RentalPlatform.API.DTOs.Requests.Bookings;
using RentalPlatform.API.DTOs.Responses.Bookings;
using RentalPlatform.API.DTOs.Responses.BookingLifecycle;
using RentalPlatform.API.Models;
using RentalPlatform.Business.Interfaces;
using RentalPlatform.Data.Entities;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

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
    [Authorize(Policy = "InternalAdminRead")]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<BookingListItemResponse>>>> ListInternalBookings(
        [FromQuery] string? bookingStatus = null,
        [FromQuery] Guid? assignedAdminUserId = null,
        [FromQuery] Guid? clientId = null,
        [FromQuery] string? search = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var allBookings = await _bookingService.GetAllAsync(bookingStatus, assignedAdminUserId, clientId, search);
        
        int total = allBookings.Count;
        int totalPages = (int)Math.Ceiling(total / (double)pageSize);
        if (totalPages == 0) totalPages = 1;
        
        var pagedBookings = allBookings
            .OrderByDescending(b => b.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToList();
            
        var response = pagedBookings.Select(MapToListItemResponse).ToList();
        var pagination = new PaginationMeta(total, page, pageSize, totalPages);
        
        return Ok(ApiResponse<IReadOnlyList<BookingListItemResponse>>.CreateSuccess(response, null, pagination));
    }

    // 2. GET /api/internal/bookings/{id}
    [HttpGet("{id}")]
    [Authorize(Policy = "InternalAdminRead")]
    public async Task<ActionResult<ApiResponse<BookingDetailsResponse>>> GetInternalBookingById(Guid id)
    {
        var booking = await _bookingService.GetByIdAsync(id);
        
        if (booking == null)
            return NotFound(ApiResponse.CreateFailure("Booking not found."));

        return Ok(ApiResponse<BookingDetailsResponse>.CreateSuccess(MapToDetailsResponse(booking)));
    }

    // 3. GET /api/internal/bookings/{id}/status-history
    [HttpGet("{id}/status-history")]
    [Authorize(Policy = "InternalAdminRead")]
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
    [Authorize(Policy = "SalesOrSuperAdmin")]
    public async Task<ActionResult<ApiResponse<BookingDetailsResponse>>> CreateBooking(CreateBookingRequest request)
    {
        var booking = await _bookingService.CreateAsync(
            request.ClientId,
            request.UnitId,
            request.CheckInDate,
            request.CheckOutDate,
            request.GuestCount,
            request.Source,
            request.AssignedAdminUserId,
            request.InternalNotes
        );
        
        return Ok(ApiResponse<BookingDetailsResponse>.CreateSuccess(MapToDetailsResponse(booking), "Booking created successfully."));
    }

    // 5. PUT /api/internal/bookings/{id}
    [HttpPut("{id}")]
    [Authorize(Policy = "SalesOrSuperAdmin")]
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

    private static BookingStatusHistoryResponse MapToHistoryResponse(BookingStatusHistory history)
    {
        return new BookingStatusHistoryResponse
        {
            Id = history.Id,
            BookingId = history.BookingId,
            OldStatus = history.OldStatus,
            NewStatus = history.NewStatus,
            ChangedByAdminUserId = history.ChangedByAdminUserId ?? Guid.Empty,
            Notes = history.Notes,
            ChangedAt = history.ChangedAt
        };
    }
}
