namespace RentalPlatform.API.Options;

public class ImageUploadOptions
{
    public const string SectionName = "ImageUpload";

    /// <summary>
    /// Null or empty means ContentRootPath/uploads. This must match the static
    /// /uploads file root configured in Program.cs.
    /// </summary>
    public string? RootPath { get; set; }

    public long MaxBytes { get; set; } = 5_242_880;

    public string[] AllowedContentTypes { get; set; } =
    {
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/avif"
    };
}
