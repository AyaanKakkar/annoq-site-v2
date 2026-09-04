#!/bin/bash
#
# Deploy the built site to the nginx document root, keeping a timestamped backup
# of the version it replaces.
#
# Adapted from the annoq-site (v1) script of the same name. Two differences
# matter: v1 committed its dist/ directory, and v1 destroyed the live site
# before checking that a replacement existed.
#
# Usage:
#   npm ci && npm run build && sudo scripts/update_site_nginx.sh
#
# Paths can be overridden from the environment:
#   SITE_ROOT=/var/www/annoq-site-v2 BACKUP_ROOT=/var/www/backup ./scripts/update_site_nginx.sh

set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
SITE_ROOT="${SITE_ROOT:-/var/www/annoq-site-v2}"
BACKUP_ROOT="${BACKUP_ROOT:-/var/www/backup}"
BUILD_DIR="$PROJECT_DIR/dist"
WEB_USER="${WEB_USER:-www-data}"

# Verify the build BEFORE touching the live site. v1 moved the live directory
# out of the way first, so a missing or failed build took the site down and left
# nothing to put back.
if [[ ! -f "$BUILD_DIR/index.html" ]]; then
  echo "error: no build found at $BUILD_DIR/index.html" >&2
  echo "       run 'npm ci && npm run build' first" >&2
  exit 1
fi

# Second precision, not just the date: two deploys on one day would otherwise
# collide, and v1 handled that by deleting the earlier backup -- which is the
# one you want when the second deploy is the bad one.
timestamp=$(date +'%Y-%m-%d-%H%M%S')
backup_dir="$BACKUP_ROOT/site-v2-$timestamp"
staging_dir="$SITE_ROOT.incoming"

mkdir -p "$BACKUP_ROOT"

# Stage the new build alongside the target first, so the swap below is two
# renames on the same filesystem rather than a copy the site has to wait for.
rm -rf "$staging_dir"
cp -a "$BUILD_DIR" "$staging_dir"

if id -u "$WEB_USER" >/dev/null 2>&1; then
  chown -R "$WEB_USER:$WEB_USER" "$staging_dir"
fi
find "$staging_dir" -type d -exec chmod 755 {} +
find "$staging_dir" -type f -exec chmod 644 {} +

backed_up=0
if [[ -d "$SITE_ROOT" ]]; then
  mv "$SITE_ROOT" "$backup_dir"
  backed_up=1
  echo "backed up previous site to $backup_dir"
fi
mv "$staging_dir" "$SITE_ROOT"

echo "deployed $BUILD_DIR to $SITE_ROOT"

# Static files only -- no reload is needed for nginx to pick them up. Reload
# only after editing the nginx configuration itself.
if [[ "$backed_up" == 1 ]]; then
  echo
  echo "To roll back:"
  echo "  rm -rf $SITE_ROOT && mv $backup_dir $SITE_ROOT"
fi
