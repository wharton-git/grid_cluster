#!/usr/bin/env bash

set -euo pipefail

REGISTRY_PREFIX="${1:-cloud-scaling-demo}"
TAG="${2:-latest}"

docker build -t "${REGISTRY_PREFIX}/backend:${TAG}" ./fractal-engine
docker build -t "${REGISTRY_PREFIX}/frontend:${TAG}" ./collaborative-fractal
