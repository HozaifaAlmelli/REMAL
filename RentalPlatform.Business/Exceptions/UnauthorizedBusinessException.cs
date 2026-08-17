namespace RentalPlatform.Business.Exceptions;

public class UnauthorizedBusinessException : Exception, IBusinessErrorCode
{
    public string? Code { get; }

    public UnauthorizedBusinessException() { }

    public UnauthorizedBusinessException(string message) : base(message) { }

    public UnauthorizedBusinessException(string message, Exception innerException) : base(message, innerException) { }

    public UnauthorizedBusinessException(string message, string code) : base(message)
    {
        Code = code;
    }
}
