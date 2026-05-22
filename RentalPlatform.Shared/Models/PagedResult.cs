using System.Collections.Generic;

namespace RentalPlatform.Shared.Models;

/// <summary>
/// Wraps a page of items together with the total number of matching records.
/// Used by service methods that perform database-level pagination.
/// </summary>
/// <typeparam name="T">Entity/model type.</typeparam>
public sealed record PagedResult<T>(IReadOnlyList<T> Items, int Total);
