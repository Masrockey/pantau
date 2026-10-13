#!/bin/bash
set -e

# Ensure Laravel storage and cache directories exist
mkdir -p /var/www/html/storage/framework/cache
mkdir -p /var/www/html/storage/framework/sessions
mkdir -p /var/www/html/storage/framework/views
mkdir -p /var/www/html/storage/logs
mkdir -p /var/www/html/bootstrap/cache

# Set permissions for web server
chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache
chmod -R 775 /var/www/html/storage /var/www/html/bootstrap/cache

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
