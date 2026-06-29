using RentalPlatform.Data.Entities;

namespace RentalPlatform.Business.Models;

public sealed record GuestBookingResult(Client Client, Booking Booking);
