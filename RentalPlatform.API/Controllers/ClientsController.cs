using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RentalPlatform.API.DTOs.Requests.Clients;
using RentalPlatform.API.DTOs.Responses.Clients;
using RentalPlatform.API.Models;
using RentalPlatform.API.Authorization;
using RentalPlatform.Business.Interfaces;
using RentalPlatform.Business.Exceptions;
using RentalPlatform.Business.Security;
using RentalPlatform.Data.Entities;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;

namespace RentalPlatform.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ClientsController : ControllerBase
{
    private readonly IClientService _clientService;

    public ClientsController(IClientService clientService)
    {
        _clientService = clientService;
    }

    [HttpPost]
    [Authorize(Policy = PermissionKeys.ClientsWrite)]
    public async Task<ActionResult<ApiResponse<CreateClientResponse>>> Create(
        [FromBody] CreateClientRequest request,
        CancellationToken cancellationToken)
    {
        var tempPassword = TemporaryPasswordGenerator.Generate();
        var client = await _clientService.CreateAsync(
            request.Name, request.Phone, request.Email, tempPassword, cancellationToken);

        var response = new CreateClientResponse(
            client.Id,
            client.Name,
            client.Phone,
            client.Email,
            client.IsActive,
            client.CreatedAt,
            client.UpdatedAt,
            tempPassword);

        return Ok(ApiResponse<CreateClientResponse>.CreateSuccess(
            response,
            "Client created successfully."));
    }

    [HttpGet]
    [Authorize(Policy = PermissionKeys.ClientsRead)]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<ClientListItemResponse>>>> GetAll(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] bool includeInactive = false,
        [FromQuery] string? search = null)
    {
        var clients = await _clientService.GetAllAsync(includeInactive, search);
        
        var totalCount = clients.Count;
        var totalPages = (int)Math.Ceiling(totalCount / (double)pageSize);
        
        var pagedClients = clients
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(MapToListItemResponse)
            .ToList();

        var pagination = new PaginationMeta(totalCount, page, pageSize, totalPages);
        
        return Ok(ApiResponse<IReadOnlyList<ClientListItemResponse>>.CreateSuccess(pagedClients, pagination: pagination));
    }

    [HttpGet("{id}")]
    [Authorize(Policy = PermissionKeys.ClientsRead)]
    public async Task<ActionResult<ApiResponse<ClientDetailsResponse>>> GetById(Guid id)
    {
        var client = await _clientService.GetByIdAsync(id);
        
        if (client == null)
            return NotFound(ApiResponse.CreateFailure("Client not found."));

        return Ok(ApiResponse<ClientDetailsResponse>.CreateSuccess(MapToDetailsResponse(client)));
    }

    [HttpPatch("{id}/status")]
    [Authorize(Policy = PermissionKeys.ClientsWrite)]
    public async Task<ActionResult<ApiResponse<ClientDetailsResponse>>> UpdateStatus(Guid id, UpdateClientStatusRequest request)
    {
        var client = await _clientService.UpdateStatusAsync(id, request.IsActive);

        return Ok(ApiResponse<ClientDetailsResponse>.CreateSuccess(
            MapToDetailsResponse(client),
            client.IsActive ? "Client reactivated successfully." : "Client deactivated successfully."));
    }

    [HttpPatch("{id}/password")]
    [Authorize(Policy = PermissionKeys.ClientsResetPassword)]
    public async Task<ActionResult<ApiResponse<ClientDetailsResponse>>> ResetPassword(Guid id, ResetClientPasswordRequest request)
    {
        var actorClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!Guid.TryParse(actorClaim, out var actorAdminUserId))
            throw new UnauthorizedBusinessException("Current admin ID not found in claims.");

        var client = await _clientService.ResetPasswordAsync(
            id,
            request.NewPassword,
            actorAdminUserId);

        return Ok(ApiResponse<ClientDetailsResponse>.CreateSuccess(
            MapToDetailsResponse(client),
            "Client password reset successfully."));
    }

    private static ClientListItemResponse MapToListItemResponse(Client client)
    {
        return new ClientListItemResponse(
            client.Id,
            client.Name,
            client.Phone,
            client.Email,
            client.IsActive,
            client.CreatedAt
        );
    }

    private static ClientDetailsResponse MapToDetailsResponse(Client client)
    {
        return new ClientDetailsResponse(
            client.Id,
            client.Name,
            client.Phone,
            client.Email,
            client.IsActive,
            client.CreatedAt,
            client.UpdatedAt
        );
    }
}
