using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RentalPlatform.API.DTOs.Requests.Availability;
using RentalPlatform.API.DTOs.Responses.Availability;
using RentalPlatform.API.Models;
using RentalPlatform.Business.Interfaces;
using RentalPlatform.Business.Models;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace RentalPlatform.API.Controllers;

/// <summary>
/// Handles operational availability and pricing projection checks.
/// Note: These endpoints represent operational boundaries (blocks, schedules, pricing)
/// and do not reflect final checkout accuracy, discounts, or booking mechanics.
/// </summary>
[ApiController]
public class UnitAvailabilityController : ControllerBase
{
    private readonly IUnitAvailabilityService _availabilityService;
    private readonly IUnitService _unitService;

    public UnitAvailabilityController(IUnitAvailabilityService availabilityService, IUnitService unitService)
    {
        _availabilityService = availabilityService;
        _unitService = unitService;
    }

    // 1. POST /api/units/{unitId}/availability/operational-check
    [HttpPost("api/units/{unitId}/availability/operational-check")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<OperationalAvailabilityResponse>>> CheckOperationalAvailability(Guid unitId, CheckOperationalAvailabilityRequest request)
    {
        var unit = await _unitService.GetByIdAsync(unitId);
        if (unit == null)
            return NotFound(ApiResponse.CreateFailure("Unit not found."));

        bool isAdmin = User.HasClaim("subjectType", "admin");
        if ((!unit.IsActive || !unit.IsVisibleInPortfolio) && !isAdmin)
            return NotFound(ApiResponse.CreateFailure("Unit not found."));

        var result = await _availabilityService.CheckOperationalAvailabilityAsync(
            unitId, 
            request.StartDate, 
            request.EndDate
        );

        return Ok(ApiResponse<OperationalAvailabilityResponse>.CreateSuccess(MapToOperationalAvailabilityResponse(result)));
    }

    // 2. POST /api/units/{unitId}/pricing/calculate
    [HttpPost("api/units/{unitId}/pricing/calculate")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<UnitPricingResponse>>> CalculatePricing(Guid unitId, CheckOperationalAvailabilityRequest request)
    {
        var unit = await _unitService.GetByIdAsync(unitId);
        if (unit == null)
            return NotFound(ApiResponse.CreateFailure("Unit not found."));

        bool isAdmin = User.HasClaim("subjectType", "admin");
        if ((!unit.IsActive || !unit.IsVisibleInPortfolio) && !isAdmin)
            return NotFound(ApiResponse.CreateFailure("Unit not found."));

        var result = await _availabilityService.CalculatePricingAsync(
            unitId,
            request.StartDate,
            request.EndDate
        );

        return Ok(ApiResponse<UnitPricingResponse>.CreateSuccess(MapToUnitPricingResponse(result)));
    }

    private static OperationalAvailabilityResponse MapToOperationalAvailabilityResponse(UnitAvailabilityResult result)
    {
        return new OperationalAvailabilityResponse
        {
            UnitId = result.UnitId,
            StartDate = result.StartDate,
            EndDate = result.EndDate,
            IsAvailable = result.IsAvailable,
            Reason = result.Reason,
            BlockedDates = result.BlockedDates.ToList(),
            HeldDates = result.HeldDates.ToList()
        };
    }

    private static UnitPricingResponse MapToUnitPricingResponse(UnitPricingResult result)
    {
        return new UnitPricingResponse
        {
            UnitId = result.UnitId,
            StartDate = result.StartDate,
            EndDate = result.EndDate,
            TotalPrice = result.TotalPrice,
            Nights = result.Nights.Select(n => new NightlyPriceItem
            {
                Date = n.Date,
                PricePerNight = n.PricePerNight,
                PriceSource = n.PriceSource
            }).ToList()
        };
    }
}
