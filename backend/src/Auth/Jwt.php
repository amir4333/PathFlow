<?php

declare(strict_types=1);

namespace PathFlow\Auth;

use PathFlow\Config\Config;

/**
 * Lightweight HS256 (HMAC-SHA256) JSON Web Token (JWT) generator and verifier.
 * Strictly compliant with RFC 7519 and the PathFlow Node.js backend contract.
 */
class Jwt
{
    /**
     * Base64URL encode string without '=' padding.
     */
    public static function base64UrlEncode(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    /**
     * Base64URL decode string with automatic padding restoration.
     */
    public static function base64UrlDecode(string $data): string|false
    {
        $remainder = strlen($data) % 4;
        if ($remainder) {
            $data .= str_repeat('=', 4 - $remainder);
        }
        return base64_decode(strtr($data, '-_', '+/'), true);
    }

    /**
     * Generate an HMAC-SHA256 signed JWT.
     *
     * @param array $payload Key-value claims (e.g. userId, email, role)
     * @param string|null $secret Secret key (defaults to Config AUTH_SECRET)
     * @param int $expiresInHours Token expiration window in hours (default: 72)
     * @return string Serialized JWT token (header.payload.signature)
     */
    public static function encode(array $payload, ?string $secret = null, int $expiresInHours = 72): string
    {
        $signingKey = $secret ?? (string)Config::get('AUTH_SECRET', 'pathflow_default_secret_key');

        $header = [
            'alg' => 'HS256',
            'typ' => 'JWT',
        ];

        // Attach exp timestamp if not explicitly defined
        if (!isset($payload['exp'])) {
            $payload['exp'] = time() + ($expiresInHours * 3600);
        }

        $headerJson = json_encode($header, JSON_UNESCAPED_SLASHES);
        $payloadJson = json_encode($payload, JSON_UNESCAPED_SLASHES);

        $headerEncoded = self::base64UrlEncode($headerJson);
        $payloadEncoded = self::base64UrlEncode($payloadJson);

        $dataToSign = "{$headerEncoded}.{$payloadEncoded}";
        $signatureRaw = hash_hmac('sha256', $dataToSign, $signingKey, true);
        $signatureEncoded = self::base64UrlEncode($signatureRaw);

        return "{$dataToSign}.{$signatureEncoded}";
    }

    /**
     * Validate and decode an HMAC-SHA256 signed JWT.
     *
     * @param string $token The JWT token string
     * @param string|null $secret Secret key (defaults to Config AUTH_SECRET)
     * @return array|null Returns parsed payload array on success, or null on failure/expiration.
     */
    public static function decode(string $token, ?string $secret = null): ?array
    {
        $token = trim($token);
        if ($token === '') {
            return null;
        }

        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            return null;
        }

        [$headerEncoded, $payloadEncoded, $signatureEncoded] = $parts;

        // Verify header
        $headerJson = self::base64UrlDecode($headerEncoded);
        if ($headerJson === false) {
            return null;
        }
        $header = json_decode($headerJson, true);
        if (!is_array($header) || ($header['alg'] ?? null) !== 'HS256') {
            return null;
        }

        // Verify signature using constant-time comparison
        $signingKey = $secret ?? (string)Config::get('AUTH_SECRET', 'pathflow_default_secret_key');
        $dataToSign = "{$headerEncoded}.{$payloadEncoded}";
        $expectedSignatureRaw = hash_hmac('sha256', $dataToSign, $signingKey, true);
        $expectedSignatureEncoded = self::base64UrlEncode($expectedSignatureRaw);

        if (!hash_equals($expectedSignatureEncoded, $signatureEncoded)) {
            return null;
        }

        // Decode payload
        $payloadJson = self::base64UrlDecode($payloadEncoded);
        if ($payloadJson === false) {
            return null;
        }
        $payload = json_decode($payloadJson, true);
        if (!is_array($payload)) {
            return null;
        }

        // Verify expiration
        $exp = $payload['exp'] ?? null;
        if (!is_numeric($exp)) {
            return null;
        }

        if ((int)$exp < time()) {
            return null; // Expired
        }

        return $payload;
    }
}
