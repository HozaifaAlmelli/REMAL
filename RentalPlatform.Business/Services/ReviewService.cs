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
using RentalPlatform.Shared.Enums;

namespace RentalPlatform.Business.Services;

public class ReviewService : IReviewService
{
    private readonly IUnitOfWork _unitOfWork;

    public ReviewService(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<IReadOnlyList<Review>> GetAllAsync(
        string? reviewStatus = null,
        Guid? unitId = null,
        Guid? clientId = null,
        Guid? ownerId = null,
        CancellationToken cancellationToken = default)
    {
        var query = _unitOfWork.Reviews.Query();

        if (!string.IsNullOrWhiteSpace(reviewStatus))
        {
            var normalized = reviewStatus.Trim().ToLower();
            query = query.Where(r => r.ReviewStatus == normalized);
        }

        if (unitId.HasValue)
            query = query.Where(r => r.UnitId == unitId.Value);

        if (clientId.HasValue)
            query = query.Where(r => r.ClientId == clientId.Value);

        if (ownerId.HasValue)
            query = query.Where(r => r.OwnerId == ownerId.Value);

        return await query.ToListAsync(cancellationToken);
    }

    public async Task<Review?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return await _unitOfWork.Reviews.GetByIdAsync(id, cancellationToken);
    }

    public async Task<Review?> GetByBookingIdAsync(Guid bookingId, CancellationToken cancellationToken = default)
    {
        return await _unitOfWork.Reviews.FirstOrDefaultAsync(
            r => r.BookingId == bookingId, cancellationToken);
    }

    public async Task<Review> CreateAsync(
        Guid bookingId,
        Guid clientId,
        int rating,
        string? title,
        string? comment,
        CancellationToken cancellationToken = default)
    {
        // --- Input validation ---
        ValidateRating(rating);

        // --- Booking existence ---
        var booking = await _unitOfWork.Bookings.GetByIdAsync(bookingId, cancellationToken);
        if (booking == null)
            throw new NotFoundException($"Booking with ID {bookingId} not found");

        // --- Client existence (active, not deleted) ---
        var clientExists = await _unitOfWork.Clients.ExistsAsync(
            c => c.Id == clientId && c.IsActive && c.DeletedAt == null, cancellationToken);
        if (!clientExists)
            throw new NotFoundException($"Active client with ID {clientId} not found");

        // --- Booking belongs to client ---
        if (booking.ClientId != clientId)
            throw new ConflictException(
                $"Booking {bookingId} does not belong to client {clientId}");

        // --- Booking must be completed ---
        if (booking.BookingStatus != BookingStatus.Completed)
            throw new ConflictException(
                $"Cannot create a review for booking {bookingId}: status is '{booking.BookingStatus}'. Only completed bookings can be reviewed.");

        // --- One review per booking ---
        var alreadyReviewed = await _unitOfWork.Reviews.ExistsAsync(
            r => r.BookingId == bookingId, cancellationToken);
        if (alreadyReviewed)
            throw new ConflictException(
                $"A review already exists for booking {bookingId}");

        var now = DateTime.UtcNow;

        var review = new Review
        {
            BookingId    = bookingId,
            UnitId       = booking.UnitId,    // snapshot from booking — not caller input
            ClientId     = clientId,
            OwnerId      = booking.OwnerId,   // snapshot from booking — not caller input
            Rating       = rating,
            Title        = string.IsNullOrWhiteSpace(title)   ? null : title.Trim(),
            Comment      = string.IsNullOrWhiteSpace(comment) ? null : comment.Trim(),
            ReviewStatus = "pending",
            SubmittedAt  = now,
            PublishedAt  = null
        };

        await _unitOfWork.Reviews.AddAsync(review, cancellationToken);

        // --- Initial status history row (null → pending) ---
        var historyRow = new ReviewStatusHistory
        {
            ReviewId             = review.Id,
            OldStatus            = null,
            NewStatus            = "pending",
            ChangedByAdminUserId = null,
            Notes                = null,
            ChangedAt            = now
        };

        await _unitOfWork.ReviewStatusHistories.AddAsync(historyRow, cancellationToken);

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return review;
    }

    public async Task<Review> UpdatePendingAsync(
        Guid reviewId,
        Guid clientId,
        int rating,
        string? title,
        string? comment,
        CancellationToken cancellationToken = default)
    {
        ValidateRating(rating);

        var review = await _unitOfWork.Reviews.GetByIdAsync(reviewId, cancellationToken);
        if (review == null)
            throw new NotFoundException($"Review with ID {reviewId} not found");

        if (review.ClientId != clientId)
            throw new ConflictException(
                $"Review {reviewId} does not belong to client {clientId}");

        if (review.ReviewStatus != "pending")
            throw new ConflictException(
                $"Cannot update review {reviewId}: only pending reviews may be updated. Current status: '{review.ReviewStatus}'.");

        review.Rating  = rating;
        review.Title   = string.IsNullOrWhiteSpace(title)   ? null : title.Trim();
        review.Comment = string.IsNullOrWhiteSpace(comment) ? null : comment.Trim();

        _unitOfWork.Reviews.Update(review);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return review;
    }

    // -------------------------------------------------------------------------
    private static void ValidateRating(int rating)
    {
        if (rating < 1 || rating > 5)
            throw new BusinessValidationException(
                $"Rating must be between 1 and 5. Provided: {rating}");
    }
}
