namespace RentalPlatform.Business.Exceptions;

public interface IBusinessErrorCode
{
    string? Code { get; }
}

public interface IBusinessErrorMetadata
{
    IReadOnlyDictionary<string, object?>? Metadata { get; }
}
