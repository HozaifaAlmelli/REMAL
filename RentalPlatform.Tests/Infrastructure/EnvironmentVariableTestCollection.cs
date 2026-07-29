using Xunit;

namespace RentalPlatform.Tests.Infrastructure;

[CollectionDefinition(Name, DisableParallelization = true)]
public sealed class EnvironmentVariableTestCollection
{
    public const string Name = "Environment variable safety";
}
