namespace RentalPlatform.Business.Exceptions;

public class ConflictException : Exception, IBusinessErrorCode, IBusinessErrorMetadata
{
    public string? Code { get; }
    public IReadOnlyDictionary<string, object?>? Metadata { get; }

    public ConflictException() { }

    public ConflictException(string message) : base(message) { }

    public ConflictException(string message, Exception innerException) : base(message, innerException) { }

    public ConflictException(
        string message,
        string code,
        IReadOnlyDictionary<string, object?>? metadata = null) : base(message)
    {
        Code = code;
        Metadata = metadata;
    }
}
