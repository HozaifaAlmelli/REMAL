namespace RentalPlatform.Business.Exceptions;

public class BusinessValidationException : Exception, IBusinessErrorCode
{
    public string? Code { get; }

    public BusinessValidationException() { }
    
    public BusinessValidationException(string message) : base(message) { }
    
    public BusinessValidationException(string message, Exception innerException) : base(message, innerException) { }

    public BusinessValidationException(string message, string code) : base(message)
    {
        Code = code;
    }
}
