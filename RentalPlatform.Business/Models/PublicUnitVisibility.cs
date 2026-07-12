using System.Linq.Expressions;
using RentalPlatform.Data.Entities;

namespace RentalPlatform.Business.Models;

public static class PublicUnitVisibility
{
    public static readonly Expression<Func<Unit, bool>> Predicate = unit =>
        unit.IsActive &&
        unit.IsVisibleInPortfolio &&
        unit.Project.IsActive;

    public static bool IsSatisfiedBy(Unit unit) =>
        unit.IsActive &&
        unit.IsVisibleInPortfolio &&
        unit.Project?.IsActive == true;
}
