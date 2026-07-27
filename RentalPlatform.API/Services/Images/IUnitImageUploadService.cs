using RentalPlatform.Data.Entities;

namespace RentalPlatform.API.Services.Images;

public interface IUnitImageUploadService
{
    Task<UnitImage> UploadAsync(
        Guid unitId,
        IFormFile file,
        bool isCover,
        int? displayOrder,
        CancellationToken cancellationToken = default);
}
