#!/usr/bin/env bash

set -euo pipefail

kubectl apply -k k8s
kubectl rollout status deployment/backend -n cloud-scaling-demo
kubectl rollout status deployment/frontend -n cloud-scaling-demo
