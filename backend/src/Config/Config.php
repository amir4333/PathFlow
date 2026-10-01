<?php

declare(strict_types=1);

namespace PathFlow\Config;

/**
 * Lightweight environment and configuration manager.
 * Reads environment variables from system env, $_ENV, or .env file.
 */
class Config
{
    private static array $config = [];
    private static bool $loaded = false;

    /**
     * Load environment variables from file if present.
     */
    public static function load(?string $envFilePath = null): void
    {
        if (self::$loaded && $envFilePath === null) {
            return;
        }

        $filePath = $envFilePath ?? dirname(__DIR__, 2) . '/.env';
        if (!file_exists($filePath)) {
            $rootEnv = dirname(__DIR__, 3) . '/.env';
            if (file_exists($rootEnv)) {
                $filePath = $rootEnv;
            }
        }

        if (file_exists($filePath) && is_readable($filePath)) {
            $lines = file($filePath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            foreach ($lines as $line) {
                $line = trim($line);
                if ($line === '' || str_starts_with($line, '#')) {
                    continue;
                }
                // Strip leading export if present
                if (str_starts_with($line, 'export ')) {
                    $line = trim(substr($line, 7));
                }
                if (str_contains($line, '=')) {
                    [$key, $value] = explode('=', $line, 2);
                    $key = trim($key);
                    $value = trim($value);
                    // Remove enclosing quotes if present
                    if ((str_starts_with($value, '"') && str_ends_with($value, '"')) ||
                        (str_starts_with($value, "'") && str_ends_with($value, "'"))) {
                        $value = substr($value, 1, -1);
                    }
                    self::$config[$key] = $value;
                    if (!isset($_ENV[$key])) {
                        $_ENV[$key] = $value;
                    }
                }
            }
        }

        self::$loaded = true;
    }

    /**
     * Get a configuration value with optional default.
     */
    public static function get(string $key, mixed $default = null): mixed
    {
        if (!self::$loaded) {
            self::load();
        }

        if (array_key_exists($key, self::$config)) {
            return self::$config[$key];
        }

        $val = getenv($key);
        if ($val !== false) {
            return $val;
        }

        if (isset($_ENV[$key])) {
            return $_ENV[$key];
        }

        if (isset($_SERVER[$key])) {
            return $_SERVER[$key];
        }

        return $default;
    }

    /**
     * Get boolean config value.
     */
    public static function getBool(string $key, bool $default = false): bool
    {
        $val = self::get($key, $default);
        if (is_bool($val)) {
            return $val;
        }
        $val = strtolower((string)$val);
        return in_array($val, ['1', 'true', 'on', 'yes'], true);
    }

    /**
     * Get integer config value.
     */
    public static function getInt(string $key, int $default = 0): int
    {
        $val = self::get($key, $default);
        return is_numeric($val) ? (int)$val : $default;
    }

    /**
     * For testing/overriding config in memory.
     */
    public static function set(string $key, mixed $value): void
    {
        self::$config[$key] = $value;
    }

    /**
     * Reset loaded configuration.
     */
    public static function reset(): void
    {
        self::$config = [];
        self::$loaded = false;
    }
}
