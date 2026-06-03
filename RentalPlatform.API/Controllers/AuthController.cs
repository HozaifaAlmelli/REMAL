using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Hosting;
using RentalPlatform.API.DTOs.Requests.Auth;
using RentalPlatform.API.DTOs.Responses.Auth;
using RentalPlatform.API.DTOs.Responses.Clients;
using RentalPlatform.API.Models;
using RentalPlatform.API.Services;
using RentalPlatform.Business.Interfaces;
using RentalPlatform.Business.Models;
using System.Security.Claims;
using System.Threading.Tasks;
using RentalPlatform.Data;
using System;

namespace RentalPlatform.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly IClientService _clientService;
    private readonly ITokenService _tokenService;
    private readonly IWebHostEnvironment _environment;
    private readonly IUnitOfWork _unitOfWork;

    public AuthController(
        IAuthService authService,
        IClientService clientService,
        ITokenService tokenService,
        IWebHostEnvironment environment,
        IUnitOfWork unitOfWork)
    {
        _authService = authService;
        _clientService = clientService;
        _tokenService = tokenService;
        _environment = environment;
        _unitOfWork = unitOfWork;
    }

    [HttpPost("client/register")]
    public async Task<ActionResult<ApiResponse<ClientDetailsResponse>>> Register(ClientRegisterRequest request)
    {
        var client = await _clientService.CreateAsync(request.Name, request.Phone, request.Email, request.Password);
        
        var response = new ClientDetailsResponse(
            client.Id,
            client.Name,
            client.Phone,
            client.Email,
            client.IsActive,
            client.CreatedAt,
            client.UpdatedAt
        );

        return Ok(ApiResponse<ClientDetailsResponse>.CreateSuccess(response, "Registration successful. Please login."));
    }

    [HttpPost("client/login")]
    public async Task<ActionResult<ApiResponse<AuthResponse>>> LoginClient(ClientLoginRequest request)
    {
        var subject = await _authService.ValidateClientCredentialsAsync(request.Phone, request.Password);
        if (subject == null)
            return Unauthorized(ApiResponse.CreateFailure("Invalid phone or password."));

        return GenerateAuthResponse(subject);
    }

    [HttpPost("admin/login")]
    public async Task<ActionResult<ApiResponse<AuthResponse>>> LoginAdmin(AdminLoginRequest request)
    {
        var subject = await _authService.ValidateAdminCredentialsAsync(request.Email, request.Password);
        if (subject == null)
            return Unauthorized(ApiResponse.CreateFailure("Invalid email or password."));

        return GenerateAuthResponse(subject);
    }

    [HttpPost("owner/login")]
    public async Task<ActionResult<ApiResponse<AuthResponse>>> LoginOwner(OwnerLoginRequest request)
    {
        var subject = await _authService.ValidateOwnerCredentialsAsync(request.Phone, request.Password);
        if (subject == null)
            return Unauthorized(ApiResponse.CreateFailure("Invalid phone or password."));

        return GenerateAuthResponse(subject);
    }

    [HttpPost("refresh")]
    public async Task<ActionResult<ApiResponse<AuthResponse>>> Refresh()
    {
        var refreshToken = Request.Cookies["refresh_token"];
        if (string.IsNullOrEmpty(refreshToken))
            return Unauthorized(ApiResponse.CreateFailure("Refresh token missing."));

        var principal = _tokenService.GetPrincipalFromToken(refreshToken);
        if (principal == null)
            return Unauthorized(ApiResponse.CreateFailure("Invalid refresh token."));

        var tokenTypeClaim = principal.FindFirst("tokenType")?.Value;
        if (tokenTypeClaim != "refresh_token")
            return Unauthorized(ApiResponse.CreateFailure("Invalid token type. Only refresh tokens are allowed."));

        var subClaim = principal.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var subjectTypeClaim = principal.FindFirst("subjectType")?.Value;
        var roleClaim = principal.FindFirst(ClaimTypes.Role)?.Value;

        if (string.IsNullOrEmpty(subClaim) || string.IsNullOrEmpty(subjectTypeClaim))
            return Unauthorized(ApiResponse.CreateFailure("Invalid token claims."));

        // Normalize subjectType claim (JWT stores lowercase) back to PascalCase for the response body
        var normalizedSubjectType = char.ToUpper(subjectTypeClaim[0]) + subjectTypeClaim.Substring(1);
        var userId = Guid.Parse(subClaim);

        string? identifier = subClaim;
        string? name = null;

        if (normalizedSubjectType == "Client")
        {
            var client = await _unitOfWork.Clients.GetByIdAsync(userId);
            if (client != null)
            {
                identifier = client.Phone;
                name = client.Name;
            }
        }
        else if (normalizedSubjectType == "Owner")
        {
            var owner = await _unitOfWork.Owners.GetByIdAsync(userId);
            if (owner != null)
            {
                identifier = owner.Phone;
                name = owner.Name;
            }
        }
        else if (normalizedSubjectType == "Admin")
        {
            var admin = await _unitOfWork.AdminUsers.GetByIdAsync(userId);
            if (admin != null)
            {
                identifier = admin.Email;
                name = admin.Name;
            }
        }

        var subject = new AuthenticatedSubject
        {
            UserId = userId,
            SubjectType = normalizedSubjectType,
            Identifier = identifier,
            Name = name,
            AdminRole = string.IsNullOrEmpty(roleClaim) ? null : Enum.Parse<Shared.Enums.AdminRole>(roleClaim)
        };

        return GenerateAuthResponse(subject);
    }

    [HttpPost("logout")]
    public ActionResult<ApiResponse> Logout()
    {
        Response.Cookies.Delete("refresh_token");
        return Ok(ApiResponse.CreateSuccess(null, "Logged out successfully."));
    }

    private ActionResult<ApiResponse<AuthResponse>> GenerateAuthResponse(AuthenticatedSubject subject)
    {
        var accessToken = _tokenService.GenerateAccessToken(subject);
        var refreshToken = _tokenService.GenerateRefreshToken(subject);

        SetRefreshTokenCookie(refreshToken);

        var authResponse = new AuthResponse(
            AccessToken: accessToken,
            ExpiresInSeconds: 15 * 60,
            SubjectType: subject.SubjectType,
            AdminRole: subject.AdminRole?.ToString(),
            User: new AuthenticatedUserResponse(
                UserId: subject.UserId,
                Identifier: subject.Identifier ?? subject.UserId.ToString(),
                SubjectType: subject.SubjectType,
                AdminRole: subject.AdminRole?.ToString(),
                Name: subject.Name
            )
        );

        return Ok(ApiResponse<AuthResponse>.CreateSuccess(authResponse));
    }

    private void SetRefreshTokenCookie(string refreshToken)
    {
        var cookieOptions = new CookieOptions
        {
            HttpOnly = true,
            Secure = !_environment.IsDevelopment(),
            SameSite = SameSiteMode.Strict,
            Expires = DateTime.UtcNow.AddDays(7)
        };

        Response.Cookies.Append("refresh_token", refreshToken, cookieOptions);
    }
}
