using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RentalPlatform.API.DTOs.Requests.UnitImages;
using RentalPlatform.API.DTOs.Responses.UnitImages;
using RentalPlatform.API.Models;
using RentalPlatform.API.Authorization;
using RentalPlatform.API.Services.Images;
using RentalPlatform.Business.Interfaces;
using RentalPlatform.Data.Entities;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace RentalPlatform.API.Controllers;

[ApiController]
public class UnitImagesController : ControllerBase
{
    private readonly IUnitImageService _unitImageService;
    private readonly IUnitImageUploadService _unitImageUploadService;
    private readonly IUnitService _unitService;

    public UnitImagesController(
        IUnitImageService unitImageService,
        IUnitImageUploadService unitImageUploadService,
        IUnitService unitService)
    {
        _unitImageService = unitImageService;
        _unitImageUploadService = unitImageUploadService;
        _unitService = unitService;
    }

    // 1. GET /api/units/{unitId}/images (Public + Admin fallback)
    [HttpGet("api/units/{unitId}/images")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<UnitImageResponse>>>> GetImagesByUnitId(Guid unitId)
    {
        var unit = await _unitService.GetByIdAsync(unitId);
        
        if (unit == null)
            return NotFound(ApiResponse.CreateFailure("Unit not found."));

        // Check if unauthenticated/non-admin public caller is trying to access
        // a unit outside the public marketing catalog.
        bool isAdmin = User.HasClaim("subjectType", "admin");
        if ((!unit.IsActive || !unit.IsVisibleInPortfolio) && !isAdmin)
            return NotFound(ApiResponse.CreateFailure("Unit not found."));

        var images = await _unitImageService.GetByUnitIdAsync(unitId);
        var response = images.Select(MapToResponse).ToList();
        
        return Ok(ApiResponse<IReadOnlyList<UnitImageResponse>>.CreateSuccess(response));
    }

    // 2. POST /api/internal/units/{unitId}/images (Internal)
    [HttpPost("api/internal/units/{unitId}/images")]
    [Authorize(Policy = PermissionKeys.UnitsManage)]
    public async Task<ActionResult<ApiResponse<UnitImageResponse>>> AddImage(Guid unitId, AddUnitImageRequest request)
    {
        var image = await _unitImageService.AddAsync(
            unitId, 
            request.FileKey, 
            request.IsCover, 
            request.DisplayOrder
        );
        
        return Ok(ApiResponse<UnitImageResponse>.CreateSuccess(MapToResponse(image), "Image added successfully."));
    }

    // 3. POST /api/internal/units/{unitId}/images/upload (Internal, multipart)
    [HttpPost("api/internal/units/{unitId}/images/upload")]
    [Authorize(Policy = PermissionKeys.UnitsManage)]
    [RequestSizeLimit(6 * 1024 * 1024)]
    [RequestFormLimits(MultipartBodyLengthLimit = 6 * 1024 * 1024)]
    public async Task<ActionResult<ApiResponse<UnitImageResponse>>> UploadImage(
        Guid unitId,
        [FromForm] UploadUnitImageRequest request,
        CancellationToken cancellationToken)
    {
        var image = await _unitImageUploadService.UploadAsync(
            unitId,
            request.File,
            request.IsCover,
            request.DisplayOrder,
            cancellationToken);

        return Ok(ApiResponse<UnitImageResponse>.CreateSuccess(
            MapToResponse(image),
            "Image uploaded successfully."));
    }

    // 4. PUT /api/internal/units/{unitId}/images/reorder (Internal)
    [HttpPut("api/internal/units/{unitId}/images/reorder")]
    [Authorize(Policy = PermissionKeys.UnitsManage)]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<UnitImageResponse>>>> ReorderImages(Guid unitId, ReorderUnitImagesRequest request)
    {
        var ordering = request.Items.Select(x => (x.ImageId, x.DisplayOrder)).ToList();
        await _unitImageService.ReorderAsync(unitId, ordering);
        
        var images = await _unitImageService.GetByUnitIdAsync(unitId);
        var response = images.Select(MapToResponse).ToList();
        
        return Ok(ApiResponse<IReadOnlyList<UnitImageResponse>>.CreateSuccess(response, "Images reordered successfully."));
    }

    // 5. PATCH /api/internal/units/{unitId}/images/{imageId}/cover (Internal)
    [HttpPatch("api/internal/units/{unitId}/images/{imageId}/cover")]
    [Authorize(Policy = PermissionKeys.UnitsManage)]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<UnitImageResponse>>>> SetCoverImage(Guid unitId, Guid imageId)
    {
        await _unitImageService.SetCoverAsync(unitId, imageId);
        
        var images = await _unitImageService.GetByUnitIdAsync(unitId);
        var response = images.Select(MapToResponse).ToList();
        
        return Ok(ApiResponse<IReadOnlyList<UnitImageResponse>>.CreateSuccess(response, "Cover image updated successfully."));
    }

    // 6. DELETE /api/internal/units/{unitId}/images/{imageId} (Internal)
    [HttpDelete("api/internal/units/{unitId}/images/{imageId}")]
    [Authorize(Policy = PermissionKeys.UnitsManage)]
    public async Task<ActionResult<ApiResponse>> RemoveImage(Guid unitId, Guid imageId)
    {
        await _unitImageService.RemoveAsync(unitId, imageId);
        return Ok(ApiResponse.CreateSuccess(null, "Image removed successfully."));
    }

    private static UnitImageResponse MapToResponse(UnitImage image)
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
}
