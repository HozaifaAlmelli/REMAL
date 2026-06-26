using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RentalPlatform.API.DTOs.Requests.Owners;
using RentalPlatform.API.DTOs.Responses.Owners;
using RentalPlatform.API.Models;
using RentalPlatform.API.Authorization;
using RentalPlatform.Business.Interfaces;
using RentalPlatform.Data.Entities;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace RentalPlatform.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class OwnersController : ControllerBase
{
    private readonly IOwnerService _ownerService;
    private readonly IUnitService _unitService;

    public OwnersController(IOwnerService ownerService, IUnitService unitService)
    {
        _ownerService = ownerService;
        _unitService = unitService;
    }

    [HttpGet]
    [Authorize(Policy = PermissionKeys.OwnersRead)]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<OwnerListItemResponse>>>> GetAll(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] bool includeInactive = true,
        [FromQuery] string? search = null)
    {
        var owners = await _ownerService.GetAllAsync(includeInactive, search);
        
        var totalCount = owners.Count;
        var totalPages = (int)Math.Ceiling(totalCount / (double)pageSize);
        
        var pagedOwners = owners
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(MapToListItemResponse)
            .ToList();

        var pagination = new PaginationMeta(totalCount, page, pageSize, totalPages);
        
        return Ok(ApiResponse<IReadOnlyList<OwnerListItemResponse>>.CreateSuccess(pagedOwners, pagination: pagination));
    }

    [HttpGet("{id}")]
    [Authorize(Policy = PermissionKeys.OwnersRead)]
    public async Task<ActionResult<ApiResponse<OwnerDetailsResponse>>> GetById(Guid id)
    {
        var owner = await _ownerService.GetByIdAsync(id);
        
        if (owner == null)
            return NotFound(ApiResponse.CreateFailure("Owner not found."));

        return Ok(ApiResponse<OwnerDetailsResponse>.CreateSuccess(MapToDetailsResponse(owner)));
    }

    [HttpPost]
    [Authorize(Policy = PermissionKeys.OwnersManage)]
    public async Task<ActionResult<ApiResponse<OwnerDetailsResponse>>> Create(CreateOwnerRequest request)
    {
        var owner = await _ownerService.CreateAsync(
            request.Name,
            request.Phone,
            request.EmergencyPhone,
            request.Email,
            request.DetailedAddress,
            request.CommissionRate,
            request.Notes,
            request.Status,
            request.Password
        );

        return Ok(ApiResponse<OwnerDetailsResponse>.CreateSuccess(MapToDetailsResponse(owner), "Owner created successfully."));
    }

    [HttpPut("{id}")]
    [Authorize(Policy = PermissionKeys.OwnersManage)]
    public async Task<ActionResult<ApiResponse<OwnerDetailsResponse>>> Update(Guid id, UpdateOwnerRequest request)
    {
        var owner = await _ownerService.UpdateAsync(
            id,
            request.Name,
            request.Phone,
            request.EmergencyPhone,
            request.Email,
            request.DetailedAddress,
            request.CommissionRate,
            request.Notes,
            request.Status
        );

        return Ok(ApiResponse<OwnerDetailsResponse>.CreateSuccess(MapToDetailsResponse(owner), "Owner updated successfully."));
    }

    [HttpPatch("{id}/status")]
    [Authorize(Policy = PermissionKeys.OwnersManage)]
    public async Task<ActionResult<ApiResponse<OwnerDetailsResponse>>> UpdateStatus(Guid id, UpdateOwnerStatusRequest request)
    {
        var owner = await _ownerService.GetByIdAsync(id);
        if (owner == null)
            return NotFound(ApiResponse.CreateFailure("Owner not found."));

        // Use UpdateAsync to change only the status
        var updatedOwner = await _ownerService.UpdateAsync(
            id,
            owner.Name,
            owner.Phone,
            owner.EmergencyPhone,
            owner.Email,
            owner.DetailedAddress,
            owner.CommissionRate,
            owner.Notes,
            request.Status
        );

        return Ok(ApiResponse<OwnerDetailsResponse>.CreateSuccess(MapToDetailsResponse(updatedOwner), $"Owner status updated to {request.Status}."));
    }

    [HttpGet("{id}/units")]
    [Authorize(Policy = PermissionKeys.OwnersRead)]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<OwnerUnitResponse>>>> GetOwnerUnits(
        Guid id,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] bool includeInactive = true)
    {
        // Verify owner exists
        var owner = await _ownerService.GetByIdAsync(id);
        if (owner == null)
            return NotFound(ApiResponse.CreateFailure("Owner not found."));

        // Get units filtered by owner
        var units = await _unitService.GetAllAsync(includeInactive: includeInactive, ownerId: id);
        
        var totalCount = units.Count;
        var totalPages = (int)Math.Ceiling(totalCount / (double)pageSize);
        if (totalPages == 0) totalPages = 1;
        
        var pagedUnits = units
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(MapToOwnerUnitResponse)
            .ToList();

        var pagination = new PaginationMeta(totalCount, page, pageSize, totalPages);
        
        return Ok(ApiResponse<IReadOnlyList<OwnerUnitResponse>>.CreateSuccess(pagedUnits, pagination: pagination));
    }

    private static OwnerListItemResponse MapToListItemResponse(Owner owner)
    {
        return new OwnerListItemResponse(
            owner.Id,
            owner.Name,
            owner.Phone,
            owner.Email,
            owner.CommissionRate,
            owner.Status,
            owner.CreatedAt
        );
    }

    private static OwnerDetailsResponse MapToDetailsResponse(Owner owner)
    {
        return new OwnerDetailsResponse(
            owner.Id,
            owner.Name,
            owner.Phone,
            owner.EmergencyPhone,
            owner.Email,
            owner.DetailedAddress,
            owner.CommissionRate,
            owner.Notes,
            owner.Status,
            owner.CreatedAt,
            owner.UpdatedAt
        );
    }

    private static OwnerUnitResponse MapToOwnerUnitResponse(Unit unit)
    {
        return new OwnerUnitResponse(
            unit.Id,
            unit.Name,
            unit.UnitType,
            unit.ProjectId,
            unit.Bedrooms,
            unit.Bathrooms,
            unit.MaxGuests,
            unit.BasePricePerNight,
            unit.IsActive,
            unit.CreatedAt
        );
    }
}
