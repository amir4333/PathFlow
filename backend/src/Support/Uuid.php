<?php

declare(strict_types=1);

namespace PathFlow\Support;

/**
 * Standard RFC 4122 compliant UUID v4 generator.
 */
class Uuid
{
    public static function v4(): string
    {
        $data = random_bytes(16);
        $data[6] = chr((ord($data[6]) & 0x0f) | 0x40); // 4 bits for version 4
        $data[8] = chr((ord($data[8]) & 0x3f) | 0x80); // 2 bits for variant RFC 4122
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }

    public static function isValid(string $uuid): bool
    {
        return (bool)preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $uuid);
    }
}
