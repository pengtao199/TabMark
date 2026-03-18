#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_NAME="$(basename "$ROOT_DIR")"
PARENT_DIR="$(dirname "$ROOT_DIR")"
BACKUP_DIR="${PARENT_DIR}/${PROJECT_NAME}-backups"

timestamp="$(date +%Y%m%d-%H%M%S)"
archive_path="${BACKUP_DIR}/${PROJECT_NAME}-${timestamp}.tgz"

mkdir -p "$BACKUP_DIR"
tar --exclude='./node_modules' --exclude='./.git' -czf "$archive_path" -C "$PARENT_DIR" "$PROJECT_NAME"

echo "Backup created:"
echo "$archive_path"
