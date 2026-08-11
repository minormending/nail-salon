# syntax=docker/dockerfile:1.7
#
# Nail Salon is a plain static site (no build step) — this image just serves
# the files with Caddy on port 80. The shared gateway Caddy handles TLS, the
# /nail-salon/ prefix stripping, and security headers; this image only serves
# /srv.
FROM caddy:2.8-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY index.html /srv/index.html
COPY css /srv/css
COPY js /srv/js
COPY fonts /srv/fonts
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --spider -q -T 3 http://127.0.0.1/ || exit 1
