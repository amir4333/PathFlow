<?php

declare(strict_types=1);

namespace PathFlow\Support;

/**
 * PSR-4 compliant lightweight autoloader for PathFlow backend.
 * Avoids hard composer dependency for shared hosting / cPanel portability.
 */
class Autoloader
{
    private static bool $registered = false;

    public static function register(): void
    {
        if (self::$registered) {
            return;
        }

        spl_autoload_register(function (string $class) {
            $prefix = 'PathFlow\\';
            $baseDir = dirname(__DIR__) . '/';

            $len = strlen($prefix);
            if (strncmp($prefix, $class, $len) !== 0) {
                return;
            }

            $relativeClass = substr($class, $len);
            $file = $baseDir . str_replace('\\', '/', $relativeClass) . '.php';

            if (file_exists($file)) {
                require_once $file;
            }
        });

        self::$registered = true;
    }
}
