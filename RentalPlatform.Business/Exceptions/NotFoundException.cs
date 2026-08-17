namespace RentalPlatform.Business.Exceptions;

public class NotFoundException : Exception, IBusinessErrorCode
{
    public string? Code { get; }

    public NotFoundException() { }

    public NotFoundException(string message) : base(message) { }

    public NotFoundException(string message, Exception innerException) : base(message, innerException) { }

    public NotFoundException(string message, string code) : base(message)
    {
        Code = code;
    }
}
