using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RentalPlatform.API.Authorization;
using RentalPlatform.API.DTOs.Responses.Notifications;
using RentalPlatform.API.Models;
using RentalPlatform.Business.Interfaces;

namespace RentalPlatform.API.Controllers;

[ApiController]
[Route("api/internal/notifications/recipients")]
[Authorize(Policy = PermissionCatalog.AdminAuthenticated)]
public class NotificationRecipientsController : ControllerBase
{
    private readonly IAdminUserService _adminUserService;
    private readonly IClientService _clientService;
    private readonly IOwnerService _ownerService;

    public NotificationRecipientsController(
        IAdminUserService adminUserService,
        IClientService clientService,
        IOwnerService ownerService)
    {
        _adminUserService = adminUserService;
        _clientService = clientService;
        _ownerService = ownerService;
    }

    [HttpGet("{subjectType}")]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<NotificationRecipientResponse>>>> GetRecipients(
        string subjectType,
        CancellationToken cancellationToken)
    {
        IReadOnlyList<NotificationRecipientResponse> recipients;
        if (string.Equals(subjectType, "Admin", StringComparison.OrdinalIgnoreCase))
        {
            var admins = await _adminUserService.GetAllAsync(false, cancellationToken);
            recipients = admins
                .Select(admin => new NotificationRecipientResponse(
                    admin.Id,
                    admin.Name,
                    admin.Email,
                    "Admin"))
                .ToArray();
        }
        else if (string.Equals(subjectType, "Client", StringComparison.OrdinalIgnoreCase))
        {
            var clients = await _clientService.GetAllAsync(false, cancellationToken: cancellationToken);
            recipients = clients
                .Select(client => new NotificationRecipientResponse(
                    client.Id,
                    client.Name,
                    client.Phone,
                    "Client"))
                .ToArray();
        }
        else if (string.Equals(subjectType, "Owner", StringComparison.OrdinalIgnoreCase))
        {
            var owners = await _ownerService.GetAllAsync(
                includeInactive: false,
                cancellationToken: cancellationToken);
            recipients = owners
                .Where(owner => owner.Status == "active")
                .Select(owner => new NotificationRecipientResponse(
                    owner.Id,
                    owner.Name,
                    owner.Phone,
                    "Owner"))
                .ToArray();
        }
        else
        {
            return BadRequest(ApiResponse.CreateFailure(
                "Subject type must be Admin, Client, or Owner."));
        }

        return Ok(ApiResponse<IReadOnlyList<NotificationRecipientResponse>>.CreateSuccess(
            recipients.OrderBy(recipient => recipient.DisplayName).ToArray()));
    }
}
