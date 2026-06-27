using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RentalPlatform.API.DTOs.Requests.DateBlocks;
using RentalPlatform.API.DTOs.Responses.DateBlocks;
using RentalPlatform.API.Models;
using RentalPlatform.API.Authorization;
using RentalPlatform.Business.Interfaces;
using RentalPlatform.Business.Models;
using RentalPlatform.Data.Entities;
using RentalPlatform.Shared.Enums;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;

namespace RentalPlatform.API.Controllers;

[ApiController]
public class DateBlocksController : ControllerBase
{
    private readonly IDateBlockService _dateBlockService;
    private readonly IDateBlockApprovalService _dateBlockApprovalService;

    public DateBlocksController(
        IDateBlockService dateBlockService,
        IDateBlockApprovalService dateBlockApprovalService)
    {
        _dateBlockService = dateBlockService;
        _dateBlockApprovalService = dateBlockApprovalService;
    }

    // 1. GET /api/internal/units/{unitId}/date-blocks
    [HttpGet("api/internal/units/{unitId}/date-blocks")]
    [Authorize(Policy = PermissionKeys.UnitsRead)]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<DateBlockResponse>>>> GetByUnitId(Guid unitId)
    {
        var blocks = await _dateBlockService.GetByUnitIdAsync(unitId);
        var response = blocks.Select(MapToResponse).ToList();
        
        return Ok(ApiResponse<IReadOnlyList<DateBlockResponse>>.CreateSuccess(response));
    }

    // 2. POST /api/internal/units/{unitId}/date-blocks
    [HttpPost("api/internal/units/{unitId}/date-blocks")]
    [Authorize(Policy = PermissionKeys.UnitsManage)]
    public async Task<ActionResult<ApiResponse<DateBlockResponse>>> Create(Guid unitId, CreateDateBlockRequest request)
    {
        var block = await _dateBlockService.CreateAsync(
            unitId,
            request.StartDate,
            request.EndDate,
            request.Reason,
            request.Notes
        );
        
        return Ok(ApiResponse<DateBlockResponse>.CreateSuccess(MapToResponse(block), "Date block created successfully."));
    }

    [HttpPost("api/owner/units/{unitId}/date-blocks")]
    [Authorize(Policy = "OwnerOnly")]
    public async Task<ActionResult<ApiResponse<DateBlockResponse>>> CreateOwnerBlock(Guid unitId, CreateDateBlockRequest request)
    {
        var ownerId = GetCurrentOwnerId();
        var block = await _dateBlockApprovalService.RequestOwnerBlockAsync(
            ownerId,
            unitId,
            request.StartDate,
            request.EndDate,
            request.Reason,
            request.Notes
        );

        var message = block.Status == DateBlockStatus.PendingApproval
            ? "Date-block request submitted for admin review."
            : "Date block created successfully.";

        return Ok(ApiResponse<DateBlockResponse>.CreateSuccess(MapToResponse(block), message));
    }

    [HttpPost("api/owner/units/{unitId}/date-blocks/preflight")]
    [Authorize(Policy = "OwnerOnly")]
    public async Task<ActionResult<ApiResponse<PreflightDateBlockResponse>>> PreflightOwnerBlock(
        Guid unitId,
        PreflightDateBlockRequest request)
    {
        var ownerId = GetCurrentOwnerId();
        var result = await _dateBlockApprovalService.EvaluateAsync(
            ownerId,
            unitId,
            request.StartDate,
            request.EndDate);

        return Ok(ApiResponse<PreflightDateBlockResponse>.CreateSuccess(MapToPreflightResponse(result)));
    }

    [HttpGet("api/owner/units/{unitId}/date-blocks")]
    [Authorize(Policy = "OwnerOnly")]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<DateBlockResponse>>>> GetOwnerBlocks(Guid unitId)
    {
        var ownerId = GetCurrentOwnerId();
        var blocks = await _dateBlockService.GetOwnerBlocksByUnitIdAsync(ownerId, unitId);
        var response = blocks.Select(MapToResponse).ToList();

        return Ok(ApiResponse<IReadOnlyList<DateBlockResponse>>.CreateSuccess(response));
    }

    // Owner re-opens dates they previously closed (approved block) or withdraws a
    // still-pending request. Owner-scoped; no admin sign-off needed to free dates.
    [HttpDelete("api/owner/units/{unitId}/date-blocks/{blockId}")]
    [Authorize(Policy = "OwnerOnly")]
    public async Task<ActionResult<ApiResponse>> WithdrawOwnerBlock(Guid unitId, Guid blockId)
    {
        var ownerId = GetCurrentOwnerId();
        await _dateBlockApprovalService.WithdrawOwnerBlockAsync(ownerId, unitId, blockId);

        return Ok(ApiResponse.CreateSuccess(null, "Dates re-opened successfully."));
    }

    [HttpGet("api/internal/date-blocks/approvals")]
    [Authorize(Policy = PermissionKeys.AvailabilityApprove)]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<DateBlockApprovalListItemResponse>>>> GetPendingApprovals()
    {
        var approvals = await _dateBlockApprovalService.GetPendingAsync();
        var response = approvals.Select(MapToApprovalResponse).ToList();

        return Ok(ApiResponse<IReadOnlyList<DateBlockApprovalListItemResponse>>.CreateSuccess(response));
    }

    [HttpPatch("api/internal/date-blocks/{id}/resolve")]
    [Authorize(Policy = PermissionKeys.AvailabilityApprove)]
    public async Task<ActionResult<ApiResponse<DateBlockResponse>>> ResolveApproval(
        Guid id,
        ResolveDateBlockRequest request)
    {
        var adminId = GetCurrentAdminId();
        var result = await _dateBlockApprovalService.ResolveAsync(
            id,
            request.Decision,
            adminId,
            request.Notes);

        return Ok(ApiResponse<DateBlockResponse>.CreateSuccess(
            MapToResponse(result.Block),
            "Date-block request resolved successfully."));
    }

    // 3. PUT /api/internal/date-blocks/{id}
    [HttpPut("api/internal/date-blocks/{id}")]
    [Authorize(Policy = PermissionKeys.UnitsManage)]
    public async Task<ActionResult<ApiResponse<DateBlockResponse>>> Update(Guid id, UpdateDateBlockRequest request)
    {
        var block = await _dateBlockService.UpdateAsync(
            id,
            request.StartDate,
            request.EndDate,
            request.Reason,
            request.Notes
        );
        
        return Ok(ApiResponse<DateBlockResponse>.CreateSuccess(MapToResponse(block), "Date block updated successfully."));
    }

    // 4. DELETE /api/internal/date-blocks/{id}
    [HttpDelete("api/internal/date-blocks/{id}")]
    [Authorize(Policy = PermissionKeys.UnitsManage)]
    public async Task<ActionResult<ApiResponse>> Delete(Guid id)
    {
        await _dateBlockService.DeleteAsync(id);
        return Ok(ApiResponse.CreateSuccess(null, "Date block deleted successfully."));
    }

    private static DateBlockResponse MapToResponse(DateBlock block)
    {
        return new DateBlockResponse
        {
            Id = block.Id,
            UnitId = block.UnitId,
            StartDate = block.StartDate,
            EndDate = block.EndDate,
            Reason = block.Reason,
            Notes = block.Notes,
            Status = MapStatus(block.Status),
            RequiresAdminSignoff = block.RequiresAdminSignoff,
            ConflictingLeadId = block.ConflictingLeadId,
            ConflictingBookingId = block.ConflictingBookingId,
            ResolvedAt = block.ResolvedAt,
            CreatedAt = block.CreatedAt,
            UpdatedAt = block.UpdatedAt
        };
    }

    private static PreflightDateBlockResponse MapToPreflightResponse(DateBlockPreflightResult result)
    {
        return new PreflightDateBlockResponse
        {
            Outcome = result.Outcome,
            ConflictType = result.ConflictType,
            ConflictDates = result.ConflictDates
        };
    }

    private static DateBlockApprovalListItemResponse MapToApprovalResponse(DateBlockApprovalListItem item)
    {
        return new DateBlockApprovalListItemResponse
        {
            Id = item.Id,
            UnitId = item.UnitId,
            UnitName = item.UnitName,
            OwnerId = item.OwnerId,
            OwnerName = item.OwnerName,
            StartDate = item.StartDate,
            EndDate = item.EndDate,
            Reason = item.Reason,
            Notes = item.Notes,
            ConflictingLeadId = item.ConflictingLeadId,
            ConflictingLeadStartDate = item.ConflictingLeadStartDate,
            ConflictingLeadEndDate = item.ConflictingLeadEndDate,
            ConflictingBookingId = item.ConflictingBookingId,
            ConflictingBookingCheckInDate = item.ConflictingBookingCheckInDate,
            ConflictingBookingCheckOutDate = item.ConflictingBookingCheckOutDate,
            ConflictCount = item.ConflictCount,
            CreatedAt = item.CreatedAt
        };
    }

    private static string MapStatus(DateBlockStatus status)
    {
        return status == DateBlockStatus.PendingApproval
            ? "pending_approval"
            : status.ToString().ToLowerInvariant();
    }

    private Guid GetCurrentOwnerId()
    {
        var subClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(subClaim) || !Guid.TryParse(subClaim, out var ownerId))
        {
            throw new UnauthorizedAccessException("Current owner ID not found in claims.");
        }

        return ownerId;
    }

    private Guid GetCurrentAdminId()
    {
        var subClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(subClaim) || !Guid.TryParse(subClaim, out var adminId))
        {
            throw new UnauthorizedAccessException("Current admin ID not found in claims.");
        }

        return adminId;
    }
}
