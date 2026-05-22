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

namespace RentalPlatform.Business.Services;

public class ReviewModerationService : IReviewModerationService
{
    private readonly IUnitOfWork _unitOfWork;

    public ReviewModerationService(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    // -------------------------------------------------------------------------
    // Publish: allowed from pending | hidden
    // -------------------------------------------------------------------------
    public async Task<Review> PublishAsync(
        Guid reviewId,
        Guid changedByAdminUserId,
        string? notes,
        CancellationToken cancellationToken = default)
    {
        var review = await GetReviewOrThrowAsync(reviewId, cancellationToken);
        await ValidateAdminAsync(changedByAdminUserId, cancellationToken);

        if (review.ReviewStatus != "pending" && review.ReviewStatus != "hidden")
            throw new ConflictException(
                $"Cannot publish review {reviewId}: current status '{review.ReviewStatus}' does not allow publishing. Allowed from: pending, hidden.");

        var oldStatus = review.ReviewStatus;
        var now = DateTime.UtcNow;

        review.ReviewStatus = "published";
        if (review.PublishedAt == null)
            review.PublishedAt = now;

        _unitOfWork.Reviews.Update(review);
        await AppendHistoryAsync(review.Id, oldStatus, "published", changedByAdminUserId, notes, now, cancellationToken);
        await RecomputeSummaryAsync(review.UnitId, cancellationToken);

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return review;
    }

    // -------------------------------------------------------------------------
    // Reject: allowed from pending only
    // -------------------------------------------------------------------------
    public async Task<Review> RejectAsync(
        Guid reviewId,
        Guid changedByAdminUserId,
        string? notes,
        CancellationToken cancellationToken = default)
    {
        var review = await GetReviewOrThrowAsync(reviewId, cancellationToken);
        await ValidateAdminAsync(changedByAdminUserId, cancellationToken);

        if (review.ReviewStatus != "pending")
            throw new ConflictException(
                $"Cannot reject review {reviewId}: current status '{review.ReviewStatus}' does not allow rejection. Allowed from: pending.");

        var oldStatus = review.ReviewStatus;
        var now = DateTime.UtcNow;

        review.ReviewStatus = "rejected";

        _unitOfWork.Reviews.Update(review);
        await AppendHistoryAsync(review.Id, oldStatus, "rejected", changedByAdminUserId, notes, now, cancellationToken);
        await RecomputeSummaryAsync(review.UnitId, cancellationToken);

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return review;
    }

    // -------------------------------------------------------------------------
    // Hide: allowed from published only; PublishedAt preserved
    // -------------------------------------------------------------------------
    public async Task<Review> HideAsync(
        Guid reviewId,
        Guid changedByAdminUserId,
        string? notes,
        CancellationToken cancellationToken = default)
    {
        var review = await GetReviewOrThrowAsync(reviewId, cancellationToken);
        await ValidateAdminAsync(changedByAdminUserId, cancellationToken);

        if (review.ReviewStatus != "published")
            throw new ConflictException(
                $"Cannot hide review {reviewId}: current status '{review.ReviewStatus}' does not allow hiding. Allowed from: published.");

        var oldStatus = review.ReviewStatus;
        var now = DateTime.UtcNow;

        review.ReviewStatus = "hidden";
        // PublishedAt is intentionally preserved — not changed on hide

        _unitOfWork.Reviews.Update(review);
        await AppendHistoryAsync(review.Id, oldStatus, "hidden", changedByAdminUserId, notes, now, cancellationToken);
        await RecomputeSummaryAsync(review.UnitId, cancellationToken);

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return review;
    }

    public async Task<IReadOnlyList<ReviewStatusHistory>> GetStatusHistoryAsync(
        Guid reviewId,
        CancellationToken cancellationToken = default)
    {
        await GetReviewOrThrowAsync(reviewId, cancellationToken);

        return await _unitOfWork.ReviewStatusHistories.Query()
            .Where(h => h.ReviewId == reviewId)
            .OrderByDescending(h => h.ChangedAt)
            .ThenByDescending(h => h.Id)
            .ToListAsync(cancellationToken);
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------
    private async Task<Review> GetReviewOrThrowAsync(Guid reviewId, CancellationToken cancellationToken)
    {
        var review = await _unitOfWork.Reviews.GetByIdAsync(reviewId, cancellationToken);
        if (review == null)
            throw new NotFoundException($"Review with ID {reviewId} not found");
        return review;
    }

    private async Task ValidateAdminAsync(Guid adminUserId, CancellationToken cancellationToken)
    {
        var adminExists = await _unitOfWork.AdminUsers.ExistsAsync(
            a => a.Id == adminUserId && a.IsActive, cancellationToken);
        if (!adminExists)
            throw new NotFoundException($"Active admin user with ID {adminUserId} not found");
    }

    private async Task AppendHistoryAsync(
        Guid reviewId,
        string oldStatus,
        string newStatus,
        Guid changedByAdminUserId,
        string? notes,
        DateTime changedAt,
        CancellationToken cancellationToken)
    {
        var historyRow = new ReviewStatusHistory
        {
            ReviewId             = reviewId,
            OldStatus            = oldStatus,
            NewStatus            = newStatus,
            ChangedByAdminUserId = changedByAdminUserId,
            Notes                = notes,
            ChangedAt            = changedAt
        };

        await _unitOfWork.ReviewStatusHistories.AddAsync(historyRow, cancellationToken);
    }

    // Recomputes the UnitReviewSummary snapshot from published reviews only.
    // Upserts the row (create if missing, update if exists).
    private async Task RecomputeSummaryAsync(Guid unitId, CancellationToken cancellationToken)
    {
        var stats = await _unitOfWork.Reviews.Query()
            .Where(r => r.UnitId == unitId && r.ReviewStatus == "published")
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Count = g.Count(),
                AverageRating = (double?)g.Average(r => r.Rating),
                LastPublishedAt = g.Max(r => r.PublishedAt)
            })
            .FirstOrDefaultAsync(cancellationToken);

        var count = stats?.Count ?? 0;
        var averageRating = stats?.AverageRating.HasValue == true
            ? Math.Round((decimal)stats.AverageRating.Value, 2)
            : 0.00m;
        var lastPublishedAt = stats?.LastPublishedAt;

        var existing = await _unitOfWork.UnitReviewSummaries.GetByIdAsync(unitId, cancellationToken);

        if (existing == null)
        {
            var summary = new UnitReviewSummary
            {
                UnitId                = unitId,
                PublishedReviewCount  = count,
                AverageRating         = averageRating,
                LastReviewPublishedAt = lastPublishedAt
                // UpdatedAt set by EF Core timestamp handler on save
            };

            await _unitOfWork.UnitReviewSummaries.AddAsync(summary, cancellationToken);
        }
        else
        {
            existing.PublishedReviewCount  = count;
            existing.AverageRating         = averageRating;
            existing.LastReviewPublishedAt = lastPublishedAt;

            _unitOfWork.UnitReviewSummaries.Update(existing);
        }
    }
}
