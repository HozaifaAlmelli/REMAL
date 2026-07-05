using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Options;
using RentalPlatform.API.Options;
using RentalPlatform.Business.Exceptions;
using RentalPlatform.Business.Interfaces;
using RentalPlatform.Data.Entities;

namespace RentalPlatform.API.Services.Images;

public class UnitImageUploadService : IUnitImageUploadService
{
    private static readonly IReadOnlyDictionary<string, string[]> ExtensionsByContentType =
        new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase)
        {
            ["image/jpeg"] = new[] { ".jpg", ".jpeg" },
            ["image/png"] = new[] { ".png" },
            ["image/webp"] = new[] { ".webp" },
            ["image/avif"] = new[] { ".avif" }
        };

    private readonly IUnitImageService _unitImageService;
    private readonly ImageUploadOptions _options;
    private readonly IWebHostEnvironment _environment;
    private readonly ILogger<UnitImageUploadService> _logger;

    public UnitImageUploadService(
        IUnitImageService unitImageService,
        IOptions<ImageUploadOptions> options,
        IWebHostEnvironment environment,
        ILogger<UnitImageUploadService> logger)
    {
        _unitImageService = unitImageService;
        _options = options.Value;
        _environment = environment;
        _logger = logger;
    }

    public async Task<UnitImage> UploadAsync(
        Guid unitId,
        IFormFile file,
        bool isCover,
        int? displayOrder,
        CancellationToken cancellationToken = default)
    {
        await ValidateFileAsync(file, cancellationToken);

        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        var fileKey = $"units/{unitId}/{DateTime.UtcNow:yyyyMMdd}/{Guid.NewGuid():N}{extension}";
        var root = GetUploadsRoot();
        var fullPath = Path.GetFullPath(Path.Combine(root, fileKey));
        var rootWithSeparator = root.EndsWith(Path.DirectorySeparatorChar)
            ? root
            : root + Path.DirectorySeparatorChar;

        if (!fullPath.StartsWith(rootWithSeparator, StringComparison.Ordinal))
        {
            throw new BusinessValidationException("Invalid upload path.");
        }

        Directory.CreateDirectory(Path.GetDirectoryName(fullPath)!);

        await using (var stream = new FileStream(
            fullPath,
            FileMode.CreateNew,
            FileAccess.Write,
            FileShare.None,
            bufferSize: 81920,
            useAsync: true))
        {
            await file.CopyToAsync(stream, cancellationToken);
        }

        try
        {
            var order = displayOrder ?? await GetNextDisplayOrderAsync(unitId, cancellationToken);
            return await _unitImageService.AddAsync(unitId, fileKey, isCover, order, cancellationToken);
        }
        catch
        {
            TryDeleteOrphan(fullPath);
            throw;
        }
    }

    private string GetUploadsRoot()
    {
        var rootPath = string.IsNullOrWhiteSpace(_options.RootPath)
            ? Path.Combine(_environment.ContentRootPath, "uploads")
            : _options.RootPath;

        return Path.GetFullPath(rootPath);
    }

    private async Task<int> GetNextDisplayOrderAsync(Guid unitId, CancellationToken cancellationToken)
    {
        var images = await _unitImageService.GetByUnitIdAsync(unitId, cancellationToken);
        return images.Count == 0 ? 0 : images.Max(image => image.DisplayOrder) + 1;
    }

    private async Task ValidateFileAsync(IFormFile file, CancellationToken cancellationToken)
    {
        if (file == null || file.Length == 0)
        {
            throw new BusinessValidationException("Image file is required.");
        }

        if (file.Length > _options.MaxBytes)
        {
            throw new BusinessValidationException("Image file exceeds the maximum allowed size.");
        }

        var contentType = NormalizeContentType(file.ContentType);
        var allowedContentTypes = _options.AllowedContentTypes
            .Select(NormalizeContentType)
            .Where(type => !string.IsNullOrWhiteSpace(type))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        if (!allowedContentTypes.Contains(contentType) ||
            !ExtensionsByContentType.TryGetValue(contentType, out var allowedExtensions))
        {
            throw new BusinessValidationException("Unsupported image content type.");
        }

        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!allowedExtensions.Contains(extension, StringComparer.OrdinalIgnoreCase))
        {
            throw new BusinessValidationException("Image extension does not match its content type.");
        }

        if (!await HasExpectedMagicBytesAsync(file, contentType, cancellationToken))
        {
            throw new BusinessValidationException("Image content does not match the declared file type.");
        }
    }

    private static string NormalizeContentType(string? contentType)
    {
        return (contentType ?? string.Empty)
            .Split(';', 2)[0]
            .Trim()
            .ToLowerInvariant();
    }

    private static async Task<bool> HasExpectedMagicBytesAsync(
        IFormFile file,
        string contentType,
        CancellationToken cancellationToken)
    {
        var header = new byte[12];
        await using var stream = file.OpenReadStream();
        var bytesRead = await stream.ReadAsync(header, cancellationToken);

        return contentType switch
        {
            "image/jpeg" => bytesRead >= 3 &&
                header[0] == 0xFF &&
                header[1] == 0xD8 &&
                header[2] == 0xFF,
            "image/png" => bytesRead >= 4 &&
                header[0] == 0x89 &&
                header[1] == 0x50 &&
                header[2] == 0x4E &&
                header[3] == 0x47,
            "image/webp" => bytesRead >= 12 &&
                header[0] == 0x52 &&
                header[1] == 0x49 &&
                header[2] == 0x46 &&
                header[3] == 0x46 &&
                header[8] == 0x57 &&
                header[9] == 0x45 &&
                header[10] == 0x42 &&
                header[11] == 0x50,
            "image/avif" => bytesRead >= 12 &&
                header[4] == 0x66 &&
                header[5] == 0x74 &&
                header[6] == 0x79 &&
                header[7] == 0x70 &&
                IsAvifBrand(header),
            _ => false
        };
    }

    private static bool IsAvifBrand(byte[] header)
    {
        return (header[8] == 0x61 &&
                header[9] == 0x76 &&
                header[10] == 0x69 &&
                header[11] == 0x66) ||
               (header[8] == 0x61 &&
                header[9] == 0x76 &&
                header[10] == 0x69 &&
                header[11] == 0x73);
    }

    private void TryDeleteOrphan(string fullPath)
    {
        try
        {
            File.Delete(fullPath);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Orphan cleanup failed for uploaded unit image.");
        }
    }
}
