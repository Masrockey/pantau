#!/bin/bash
set -e

# If .env doesn't exist, copy from .env.example
if [ ! -f /var/www/html/.env ]; then
    if [ -f /var/www/html/.env.example ]; then
        cp /var/www/html/.env.example /var/www/html/.env
    else
        touch /var/www/html/.env
    fi
fi

# Ensure Laravel storage and cache directories exist
mkdir -p /var/www/html/storage/framework/cache
mkdir -p /var/www/html/storage/framework/sessions
mkdir -p /var/www/html/storage/framework/views
mkdir -p /var/www/html/storage/logs
mkdir -p /var/www/html/bootstrap/cache

touch /var/www/html/storage/logs/laravel.log

# Set permissions for web server (777 to allow write across Synology NAS host volume mounts)
chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache 2>/dev/null || true
chmod -R 777 /var/www/html/storage /var/www/html/bootstrap/cache 2>/dev/null || true

# Generate APP_KEY if empty or not set
if ! grep -q "^APP_KEY=base64:" /var/www/html/.env 2>/dev/null; then
    php artisan key:generate --force || true
fi

# Create storage link if not exists
if [ ! -L /var/www/html/public/storage ]; then
    php artisan storage:link --quiet || true
fi

# Run database migration gracefully if database is accessible
php artisan migrate --graceful --no-interaction || true

# Start queue worker in background to handle sync and review processing
php artisan queue:listen --tries=1 --timeout=0 > /var/www/html/storage/logs/queue.log 2>&1 &

echo "=========================================================="
echo "  PANTAU Laravel App is ready on http://localhost:8016"
echo "=========================================================="

# Start Apache in foreground
exec apache2-foreground
