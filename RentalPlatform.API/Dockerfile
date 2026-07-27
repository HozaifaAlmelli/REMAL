# ── Build stage ──
FROM mcr.microsoft.com/dotnet/sdk:10.0-preview AS build
WORKDIR /src

# Copy project files first (better layer caching)
COPY RentalPlatform.Shared/RentalPlatform.Shared.csproj RentalPlatform.Shared/
COPY RentalPlatform.Data/RentalPlatform.Data.csproj RentalPlatform.Data/
COPY RentalPlatform.Business/RentalPlatform.Business.csproj RentalPlatform.Business/
COPY RentalPlatform.API/RentalPlatform.API.csproj RentalPlatform.API/

RUN dotnet restore RentalPlatform.API/RentalPlatform.API.csproj

# Copy everything else and publish
COPY . .
RUN dotnet publish RentalPlatform.API/RentalPlatform.API.csproj \
    -c Release -o /app/publish --no-restore

# ── Runtime stage ──
FROM mcr.microsoft.com/dotnet/aspnet:10.0-preview AS runtime
WORKDIR /app

USER root
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgssapi-krb5-2 ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/publish .

EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Development

ENTRYPOINT ["dotnet", "RentalPlatform.API.dll"]
