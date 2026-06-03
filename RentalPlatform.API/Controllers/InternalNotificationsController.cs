using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RentalPlatform.API.DTOs.Requests.Notifications;
using RentalPlatform.API.DTOs.Responses.Notifications;
using RentalPlatform.API.Models;
using RentalPlatform.Business.Interfaces;
using RentalPlatform.Data.Entities;

namespace RentalPlatform.API.Controllers;

[ApiController]
[Route("api/internal/notifications")]
[Authorize(Policy = "AdminAuthenticated")]
public class InternalNotificationsController : ControllerBase
{
    private readonly INotificationService _notificationService;
    private readonly IAdminUserService _adminUserService;

    public InternalNotificationsController(
        INotificationService notificationService,
        IAdminUserService adminUserService)
    {
        _notificationService = notificationService;
        _adminUserService = adminUserService;
    }

    // POST /api/internal/notifications/admins/{adminUserId}
    [HttpPost("admins/{adminUserId}")]
    public async Task<ActionResult<ApiResponse<NotificationResponse>>> CreateForAdmin(
        Guid adminUserId,
        [FromBody] CreateAdminNotificationRequest request,
        CancellationToken cancellationToken)
    {
        var adminUser = await _adminUserService.GetByIdAsync(adminUserId, cancellationToken);
        if (adminUser == null)
        {
            return BadRequest(new ApiResponse<NotificationResponse>
            {
                Success = false,
                Errors = new[] { "The specified Admin User target identifier does not exist." }
            });
        }
        if (!adminUser.IsActive)
        {
            return BadRequest(new ApiResponse<NotificationResponse>
            {
                Success = false,
                Errors = new[] { "The specified Admin User is not active." }
            });
        }

        var notification = await _notificationService.CreateForAdminAsync(
            templateCode: request.TemplateCode,
            channel: request.Channel,
            adminUserId: adminUserId,
            variables: request.Variables,
            scheduledAt: request.ScheduledAt,
            cancellationToken: cancellationToken);

        return Ok(ApiResponse<NotificationResponse>.CreateSuccess(
            MapToResponse(notification), "Notification created successfully."));
    }

    // POST /api/internal/notifications/clients/{clientId}
    [HttpPost("clients/{clientId}")]
    public async Task<ActionResult<ApiResponse<NotificationResponse>>> CreateForClient(
        Guid clientId,
        [FromBody] CreateClientNotificationRequest request,
        CancellationToken cancellationToken)
    {
        var notification = await _notificationService.CreateForClientAsync(
            templateCode: request.TemplateCode,
            channel: request.Channel,
            clientId: clientId,
            variables: request.Variables,
            scheduledAt: request.ScheduledAt,
            cancellationToken: cancellationToken);

        return Ok(ApiResponse<NotificationResponse>.CreateSuccess(
            MapToResponse(notification), "Notification created successfully."));
    }

    // POST /api/internal/notifications/owners/{ownerId}
    [HttpPost("owners/{ownerId}")]
    public async Task<ActionResult<ApiResponse<NotificationResponse>>> CreateForOwner(
        Guid ownerId,
        [FromBody] CreateOwnerNotificationRequest request,
        CancellationToken cancellationToken)
    {
        var notification = await _notificationService.CreateForOwnerAsync(
            templateCode: request.TemplateCode,
            channel: request.Channel,
            ownerId: ownerId,
            variables: request.Variables,
            scheduledAt: request.ScheduledAt,
            cancellationToken: cancellationToken);

        return Ok(ApiResponse<NotificationResponse>.CreateSuccess(
            MapToResponse(notification), "Notification created successfully."));
    }

    // GET /api/internal/notifications/{notificationId}
    [HttpGet("{notificationId}")]
    public async Task<ActionResult<ApiResponse<NotificationResponse>>> GetById(
        Guid notificationId,
        CancellationToken cancellationToken)
    {
        var notification = await _notificationService.GetByIdAsync(notificationId, cancellationToken);

        if (notification == null)
            return NotFound(ApiResponse<NotificationResponse>.CreateFailure("Notification not found."));

        return Ok(ApiResponse<NotificationResponse>.CreateSuccess(MapToResponse(notification)));
    }

    // GET /api/internal/notifications
    [HttpGet]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<NotificationResponse>>>> GetAll(
        [FromQuery] GetNotificationsRequest request,
        CancellationToken cancellationToken)
    {
        var notifications = await _notificationService.GetAllAsync(
            notificationStatus: request.NotificationStatus,
            channel: request.Channel,
            templateId: request.TemplateId,
            cancellationToken: cancellationToken);

        var totalCount = notifications.Count;
        var totalPages = (int)Math.Ceiling(totalCount / (double)request.PageSize);

        var paged = notifications
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(MapToResponse)
            .ToList();

        var pagination = new PaginationMeta(totalCount, request.Page, request.PageSize, totalPages);

        return Ok(ApiResponse<IReadOnlyList<NotificationResponse>>.CreateSuccess(paged, pagination: pagination));
    }

    // -------------------------------------------------------------------------
    // Mapping
    // -------------------------------------------------------------------------

    private static NotificationResponse MapToResponse(Notification n) => new(
        Id: n.Id,
        TemplateId: n.TemplateId,
        AdminUserId: n.AdminUserId,
        ClientId: n.ClientId,
        OwnerId: n.OwnerId,
        Channel: n.Channel,
        NotificationStatus: n.NotificationStatus,
        Subject: n.Subject,
        Body: n.Body,
        ScheduledAt: n.ScheduledAt,
        SentAt: n.SentAt,
        ReadAt: n.ReadAt,
        CreatedAt: n.CreatedAt,
        UpdatedAt: n.UpdatedAt
    );
}
