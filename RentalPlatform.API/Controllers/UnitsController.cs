using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RentalPlatform.API.DTOs.Requests.Units;
using RentalPlatform.API.DTOs.Responses.UnitImages;
using RentalPlatform.API.DTOs.Responses.Units;
using RentalPlatform.API.Models;
using RentalPlatform.Business.Interfaces;
using RentalPlatform.Business.Models;
using RentalPlatform.Data.Entities;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace RentalPlatform.API.Controllers;

[ApiController]
public class UnitsController : ControllerBase
{
    private readonly IUnitService _unitService;

    public UnitsController(IUnitService unitService)
    {
        _unitService = unitService;
    }

    // 1. GET /api/units (Public)
    [HttpGet("api/units")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<UnitListItemResponse>>>> GetPublicUnits([FromQuery] PublicUnitCatalogRequest request)
    {
        if (!TryParseAmenityIds(request.AmenityIds, out var amenityIds, out var amenityError))
            return BadRequest(ApiResponse.CreateFailure("Invalid amenityIds query parameter.", new[] { amenityError! }));

        var page = Math.Max(request.Page, 1);
        var pageSize = Math.Clamp(request.PageSize, 1, 100);
        var result = await _unitService.GetPublicCatalogAsync(new PublicUnitCatalogFilter(
            page,
            pageSize,
            request.AreaId,
            request.UnitType,
            request.MinGuests,
            request.MinPrice,
            request.MaxPrice,
            request.Search,
            request.SortBy,
            amenityIds));

        int totalPages = (int)Math.Ceiling(result.Total / (double)pageSize);
        if (totalPages == 0) totalPages = 1;

        var response = result.Items.Select(MapToListItemResponse).ToList();
        var pagination = new PaginationMeta(result.Total, page, pageSize, totalPages);
        
        return Ok(ApiResponse<IReadOnlyList<UnitListItemResponse>>.CreateSuccess(response, null, pagination));
    }

    // 2. GET /api/units/{id} (Public)
    [HttpGet("api/units/{id}")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<UnitDetailsResponse>>> GetPublicUnitById(Guid id)
    {
        var unit = await _unitService.GetByIdAsync(id);
        
        if (unit == null || !unit.IsActive)
            return NotFound(ApiResponse.CreateFailure("Active unit not found."));

        return Ok(ApiResponse<UnitDetailsResponse>.CreateSuccess(MapToDetailsResponse(unit)));
    }

    // 3. GET /api/internal/units (Internal)
    [HttpGet("api/internal/units")]
    [Authorize(Policy = "InternalUnitsRead")]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<UnitListItemResponse>>>> GetInternalUnits(
        [FromQuery] int page = 1, 
        [FromQuery] int pageSize = 20, 
        [FromQuery] bool includeInactive = true,
        [FromQuery] Guid? ownerId = null,
        [FromQuery] Guid? areaId = null,
        [FromQuery] string? unitType = null,
        [FromQuery] bool? isActive = null,
        [FromQuery] string? search = null,
        [FromQuery] DateOnly? availableFrom = null,
        [FromQuery] DateOnly? availableTo = null)
    {
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var result = await _unitService.GetInternalCatalogAsync(
            page,
            pageSize,
            includeInactive,
            ownerId,
            areaId,
            unitType,
            isActive,
            search,
            availableFrom,
            availableTo);

        int total = result.Total;
        int totalPages = (int)Math.Ceiling(total / (double)pageSize);
        if (totalPages == 0) totalPages = 1;

        var response = result.Items.Select(MapToListItemResponse).ToList();
        var pagination = new PaginationMeta(total, page, pageSize, totalPages);
        
        return Ok(ApiResponse<IReadOnlyList<UnitListItemResponse>>.CreateSuccess(response, null, pagination));
    }

    // 4. GET /api/internal/units/{id} (Internal)
    [HttpGet("api/internal/units/{id}")]
    [Authorize(Policy = "InternalUnitsRead")]
    public async Task<ActionResult<ApiResponse<UnitDetailsResponse>>> GetInternalUnitById(Guid id)
    {
        var unit = await _unitService.GetByIdAsync(id);
        
        if (unit == null)
            return NotFound(ApiResponse.CreateFailure("Unit not found."));

        return Ok(ApiResponse<UnitDetailsResponse>.CreateSuccess(MapToDetailsResponse(unit)));
    }

    // 5. POST /api/internal/units
    [HttpPost("api/internal/units")]
    [Authorize(Policy = "SuperAdminOnly")]
    public async Task<ActionResult<ApiResponse<UnitDetailsResponse>>> CreateUnit(CreateUnitRequest request)
    {
        var unit = await _unitService.CreateAsync(
            request.OwnerId,
            request.AreaId,
            request.Name,
            request.Description,
            request.Address,
            request.UnitType,
            request.Bedrooms,
            request.Bathrooms,
            request.MaxGuests,
            request.BasePricePerNight,
            request.IsActive
        );
        
        return Ok(ApiResponse<UnitDetailsResponse>.CreateSuccess(MapToDetailsResponse(unit), "Unit created successfully."));
    }

    // 6. PUT /api/internal/units/{id}
    [HttpPut("api/internal/units/{id}")]
    [Authorize(Policy = "SuperAdminOnly")]
    public async Task<ActionResult<ApiResponse<UnitDetailsResponse>>> UpdateUnit(Guid id, UpdateUnitRequest request)
    {
        var unit = await _unitService.UpdateAsync(
            id,
            request.OwnerId,
            request.AreaId,
            request.Name,
            request.Description,
            request.Address,
            request.UnitType,
            request.Bedrooms,
            request.Bathrooms,
            request.MaxGuests,
            request.BasePricePerNight,
            request.IsActive
        );
        
        return Ok(ApiResponse<UnitDetailsResponse>.CreateSuccess(MapToDetailsResponse(unit), "Unit updated successfully."));
    }

    // 7. PATCH /api/internal/units/{id}/status
    [HttpPatch("api/internal/units/{id}/status")]
    [Authorize(Policy = "SuperAdminOnly")]
    public async Task<ActionResult<ApiResponse<UnitDetailsResponse>>> UpdateUnitStatus(Guid id, UpdateUnitStatusRequest request)
    {
        await _unitService.SetActiveAsync(id, request.IsActive);
        
        var unit = await _unitService.GetByIdAsync(id);
        if (unit == null)
            return NotFound(ApiResponse.CreateFailure("Unit not found after status update."));

        return Ok(ApiResponse<UnitDetailsResponse>.CreateSuccess(MapToDetailsResponse(unit), $"Unit status updated to {(request.IsActive ? "active" : "inactive")}."));
    }

    // 8. DELETE /api/internal/units/{id}
    [HttpDelete("api/internal/units/{id}")]
    [Authorize(Policy = "SuperAdminOnly")]
    public async Task<ActionResult<ApiResponse>> DeleteUnit(Guid id)
    {
        await _unitService.SoftDeleteAsync(id);
        return Ok(ApiResponse.CreateSuccess(null, "Unit soft-deleted successfully."));
    }


    private static UnitListItemResponse MapToListItemResponse(Unit unit)
    {
        return new UnitListItemResponse
        {
            Id = unit.Id,
            OwnerId = unit.OwnerId,
            OwnerName = unit.Owner?.Name ?? "[Unassigned Owner]",
            AreaId = unit.AreaId,
            AreaName = unit.Area?.Name ?? "[Unassigned Area]",
            Name = unit.Name,
            UnitType = unit.UnitType,
            Bedrooms = unit.Bedrooms,
            Bathrooms = unit.Bathrooms,
            MaxGuests = unit.MaxGuests,
            BasePricePerNight = unit.BasePricePerNight,
            IsActive = unit.IsActive,
            CreatedAt = unit.CreatedAt,
            Images = unit.UnitImages
                .OrderByDescending(image => image.IsCover)
                .ThenBy(image => image.DisplayOrder)
                .Select(MapToImageResponse)
                .ToList()
        };
    }

    private static bool TryParseAmenityIds(IEnumerable<string> rawAmenityIds, out IReadOnlyList<Guid> amenityIds, out string? error)
    {
        var parsed = new List<Guid>();

        foreach (var rawValue in rawAmenityIds)
        {
            if (string.IsNullOrWhiteSpace(rawValue))
                continue;

            foreach (var part in rawValue.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            {
                if (!Guid.TryParse(part, out var amenityId))
                {
                    amenityIds = Array.Empty<Guid>();
                    error = $"'{part}' is not a valid amenity id.";
                    return false;
                }

                parsed.Add(amenityId);
            }
        }

        amenityIds = parsed.Distinct().ToList();
        error = null;
        return true;
    }

    private static UnitImageResponse MapToImageResponse(UnitImage image)
    {
        return new UnitImageResponse
        {
            Id = image.Id,
            UnitId = image.UnitId,
            FileKey = image.FileKey,
            IsCover = image.IsCover,
            DisplayOrder = image.DisplayOrder,
            CreatedAt = image.CreatedAt
        };
    }

    private static UnitDetailsResponse MapToDetailsResponse(Unit unit)
    {
        return new UnitDetailsResponse
        {
            Id = unit.Id,
            OwnerId = unit.OwnerId,
            OwnerName = unit.Owner?.Name ?? "[Unassigned Owner]",
            AreaId = unit.AreaId,
            AreaName = unit.Area?.Name ?? "[Unassigned Area]",
            Name = unit.Name,
            Description = unit.Description,
            Address = unit.Address,
            UnitType = unit.UnitType,
            Bedrooms = unit.Bedrooms,
            Bathrooms = unit.Bathrooms,
            MaxGuests = unit.MaxGuests,
            BasePricePerNight = unit.BasePricePerNight,
            IsActive = unit.IsActive,
            CreatedAt = unit.CreatedAt,
            UpdatedAt = unit.UpdatedAt
        };
    }
}
