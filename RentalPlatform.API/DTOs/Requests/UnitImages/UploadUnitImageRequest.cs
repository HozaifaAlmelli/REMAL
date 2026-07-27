using Microsoft.AspNetCore.Http;

namespace RentalPlatform.API.DTOs.Requests.UnitImages;

public class UploadUnitImageRequest
{
    public IFormFile File { get; set; } = default!;
    public bool IsCover { get; set; }
    public int? DisplayOrder { get; set; }
}
