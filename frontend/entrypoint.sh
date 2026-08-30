#!/bin/sh
set -e

mkdir -p /etc/nginx/ssl

# Detect real Let's Encrypt certificates mounted from the host
REAL_CERT=""
if [ -f "/etc/letsencrypt/live/teamcode.duckdns.org/fullchain.pem" ] && [ -f "/etc/letsencrypt/live/teamcode.duckdns.org/privkey.pem" ]; then
    REAL_CERT="/etc/letsencrypt/live/teamcode.duckdns.org"
elif [ -f "/etc/letsencrypt/live/164.152.62.48.nip.io/fullchain.pem" ] && [ -f "/etc/letsencrypt/live/164.152.62.48.nip.io/privkey.pem" ]; then
    REAL_CERT="/etc/letsencrypt/live/164.152.62.48.nip.io"
else
    # Find any available live certificate
    for dir in /etc/letsencrypt/live/*; do
        if [ -d "$dir" ] && [ -f "$dir/fullchain.pem" ] && [ -f "$dir/privkey.pem" ]; then
            REAL_CERT="$dir"
            break
        fi
    done
fi

if [ -n "$REAL_CERT" ]; then
    echo "[CodeSync] Found Let's Encrypt certificates at '$REAL_CERT'. Loading for production SSL..."
    cp -L "$REAL_CERT/fullchain.pem" /etc/nginx/ssl/fullchain.pem
    cp -L "$REAL_CERT/privkey.pem" /etc/nginx/ssl/privkey.pem
else
    echo "[CodeSync] Let's Encrypt volume not found. Using local fallback SSL certificates..."
    cp /tmp/ssl/fullchain.pem /etc/nginx/ssl/fullchain.pem
    cp /tmp/ssl/privkey.pem /etc/nginx/ssl/privkey.pem
fi

exec nginx -g "daemon off;"
