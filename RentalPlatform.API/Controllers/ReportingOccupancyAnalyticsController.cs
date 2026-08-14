using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RentalPlatform.API.Authorization;
using RentalPlatform.API.DTOs.Requests.ReportsAnalytics;
using RentalPlatform.API.DTOs.Responses.ReportsAnalytics;
using RentalPlatform.API.Models;
using RentalPlatform.Business.Interfaces;
using RentalPlatform.Business.Models;

namespace RentalPlatform.API.Controllers;

[ApiController]
[Authorize(Policy = PermissionKeys.AnalyticsRead)]
public sealed class ReportingOccupancyAnalyticsController : ControllerBase
{
    private readonly IOccupancyAnalyticsService _service;

    public ReportingOccupancyAnalyticsController(IOccupancyAnalyticsService service)
    {
        _service = service;
    }

    [HttpGet("api/internal/reports/occupancy")]
    public async Task<ActionResult<ApiResponse<OccupancyAnalyticsResponse>>> Get(
        [FromQuery] GetOccupancyAnalyticsRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _service.GetAsync(request.From, request.ToExclusive, cancellationToken);
        return Ok(ApiResponse<OccupancyAnalyticsResponse>.CreateSuccess(Map(result)));
    }

    private static OccupancyAnalyticsResponse Map(OccupancyAnalyticsResult result) =>
        new()
        {
            From = result.From,
            ToExclusive = result.ToExclusive,
            OccupiedUnitNights = result.OccupiedUnitNights,
            AvailableUnitNights = result.AvailableUnitNights,
            OccupancyRate = result.OccupancyRate,
            AvailabilityCoverageComplete = result.AvailabilityCoverageComplete,
            CoverageStartDate = result.CoverageStartDate,
            UnavailableReason = result.UnavailableReason,
        };
}
