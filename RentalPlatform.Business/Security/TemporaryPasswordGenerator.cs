using System.Security.Cryptography;

namespace RentalPlatform.Business.Security;

public static class TemporaryPasswordGenerator
{
    private const string Alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

    public static string Generate()
    {
        Span<byte> bytes = stackalloc byte[12];
        RandomNumberGenerator.Fill(bytes);

        var chars = new char[14];
        var charIndex = 0;
        var byteIndex = 0;

        for (var group = 0; group < 3; group++)
        {
            if (group > 0)
                chars[charIndex++] = '-';

            for (var index = 0; index < 4; index++)
            {
                chars[charIndex++] = Alphabet[bytes[byteIndex++] % Alphabet.Length];
            }
        }

        return new string(chars);
    }
}
