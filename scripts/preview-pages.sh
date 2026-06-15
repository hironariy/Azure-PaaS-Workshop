#!/bin/bash
# =============================================================================
# Faithful Local Preview for the GitHub Pages Learner Portal
# =============================================================================
# Purpose: Build and serve materials/docs locally with the same github-pages
#          stack used by GitHub Pages.
#
# Requirements: Docker Desktop running.
#
# Usage:
#   ./scripts/preview-pages.sh           # build + serve at http://localhost:4000
#   ./scripts/preview-pages.sh start     # same as above
#   ./scripts/preview-pages.sh build     # one-off build only
#   ./scripts/preview-pages.sh stop      # stop and remove preview container
#   ./scripts/preview-pages.sh clean     # stop and drop cached gem volume
# =============================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOCS_DIR="${REPO_ROOT}/materials/docs"
IMAGE="ruby:3.1"
CONTAINER="paas-preview"
GEM_VOLUME="paas-pages-gems"
PORT="${PORT:-4000}"
GEMFILE_BODY='source "https://rubygems.org"\ngem "github-pages", group: :jekyll_plugins\ngem "webrick"\n'

require_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    echo "ERROR: Docker is not installed or not on PATH." >&2
    exit 1
  fi
  if ! docker info >/dev/null 2>&1; then
    echo "ERROR: Docker daemon is not running. Start Docker Desktop and retry." >&2
    exit 1
  fi
}

ensure_volume() {
  docker volume inspect "${GEM_VOLUME}" >/dev/null 2>&1 || docker volume create "${GEM_VOLUME}" >/dev/null
}

stop_preview() {
  docker rm -f "${CONTAINER}" >/dev/null 2>&1 || true
  echo "Preview container '${CONTAINER}' stopped and removed."
}

cmd_build() {
  require_docker
  ensure_volume
  echo "Building materials/docs with the github-pages gem..."
  docker run --rm \
    -v "${DOCS_DIR}":/srv/jekyll \
    -v "${GEM_VOLUME}":/usr/local/bundle \
    -w /srv/jekyll "${IMAGE}" bash -c "
      printf '${GEMFILE_BODY}' > /tmp/Gemfile
      export BUNDLE_GEMFILE=/tmp/Gemfile
      bundle install
      bundle exec jekyll build -d /tmp/site
    "
  echo "Build OK."
}

cmd_start() {
  require_docker
  ensure_volume
  stop_preview
  echo "Starting preview at http://localhost:${PORT} ..."
  docker run -d --name "${CONTAINER}" -p "${PORT}:4000" \
    -v "${DOCS_DIR}":/srv/jekyll \
    -v "${GEM_VOLUME}":/usr/local/bundle \
    -w /srv/jekyll "${IMAGE}" bash -c "
      printf '${GEMFILE_BODY}' > /tmp/Gemfile
      export BUNDLE_GEMFILE=/tmp/Gemfile
      bundle install
      exec bundle exec jekyll serve -d /tmp/site --host 0.0.0.0 --force_polling
    " >/dev/null

  printf "Waiting for the site to build"
  for _ in $(seq 1 90); do
    if curl -s -o /dev/null "http://localhost:${PORT}/"; then
      echo ""
      echo "Ready: http://localhost:${PORT}"
      echo "Stop with: ./scripts/preview-pages.sh stop"
      return 0
    fi
    if ! docker ps --filter "name=${CONTAINER}" --format '{{.Names}}' | grep -q "${CONTAINER}"; then
      echo ""
      echo "ERROR: preview container exited during startup. Recent logs:" >&2
      docker logs "${CONTAINER}" 2>&1 | tail -20 >&2
      exit 1
    fi
    printf "."
    sleep 4
  done

  echo ""
  echo "ERROR: site did not respond in time. Recent logs:" >&2
  docker logs "${CONTAINER}" 2>&1 | tail -20 >&2
  exit 1
}

cmd_clean() {
  stop_preview
  docker volume rm "${GEM_VOLUME}" >/dev/null 2>&1 || true
  echo "Cached gem volume '${GEM_VOLUME}' removed."
}

case "${1:-start}" in
  start) cmd_start ;;
  build) cmd_build ;;
  stop)  stop_preview ;;
  clean) cmd_clean ;;
  *)
    echo "Usage: $0 [start|build|stop|clean]" >&2
    exit 2
    ;;
esac
