#!/bin/sh
set -e

mkdir -p /etc/nginx/ssl

# Check if real Let's Encrypt certificates are mounted from the host (production VM)
if [ -f "/etc/letsencrypt/live/164.152.62.48.nip.io/fullchain.pem" ] && [ -f "/etc/letsencrypt/live/164.152.62.48.nip.io/privkey.pem" ]; then
    echo "[TeamCode] Found Let's Encrypt certificates. Loading for production SSL..."
    cp -L /etc/letsencrypt/live/164.152.62.48.nip.io/fullchain.pem /etc/nginx/ssl/fullchain.pem
    cp -L /etc/letsencrypt/live/164.152.62.48.nip.io/privkey.pem /etc/nginx/ssl/privkey.pem
else
    echo "[TeamCode] Let's Encrypt volume not found. Using local fallback SSL certificates..."
    cp /tmp/ssl/fullchain.pem /etc/nginx/ssl/fullchain.pem
    cp /tmp/ssl/privkey.pem /etc/nginx/ssl/privkey.pem
fi

exec nginx -g "daemon off;"
