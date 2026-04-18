# Cloud Scaling Demo App

Application de demonstration cloud-native pour Kubernetes et Google Kubernetes Engine.

Le projet montre comment un frontend React moderne et un backend Go stateless se comportent sur GKE lorsque l on teste :

- l autoscaling horizontal
- la haute disponibilite
- la repartition des requetes entre pods
- la continuite de service pendant la perte d un pod
- l observabilite minimale utile pendant une demo

## Architecture

```text
.
|-- collaborative-fractal/   # Frontend React + Vite + TypeScript + Tailwind + DaisyUI
|-- fractal-engine/          # Backend Go stateless
|-- k8s/                     # Manifests Kubernetes / GKE
|-- scripts/                 # Scripts utilitaires de build et de deploiement
`-- docker-compose.yml       # Lancement local avec frontend + backend
```

### Backend Go

Le backend expose les endpoints suivants :

- `GET /api/health`
- `GET /api/ready`
- `GET /api/info`
- `GET /api/status`
- `GET /api/load/cpu?duration=5000&intensity=medium`
- `GET /api/load/latency?delay=3000`
- `GET /api/load/mixed?duration=4000&delay=1000&intensity=medium`

Chaque reponse ajoute :

- le header `X-Pod-Name`
- le header `X-App-Version`
- le header `X-Request-ID`

Le backend est volontairement :

- stateless
- sans session serveur
- sans stockage local obligatoire
- prete pour etre replique sur plusieurs pods

### Frontend

Le frontend est oriente demonstration GKE :

- hero expliquant l objectif de l app
- panneau de controle pour lancer les tests
- journal recent des appels
- zone des pods observes
- section pedagogique haute disponibilite
- exemples de commandes Apache Bench copiables

Le style reste proche de l existant :

- DaisyUI conserve
- palette noir / blanc / gris preservee
- interface plus moderne et plus structuree

## Lancement local

### Option recommande : Docker Compose

```bash
docker compose up --build
```

Points d acces :

- frontend : `http://localhost:8080`
- backend direct : `http://localhost:6543`

### Option manuelle

Backend :

```bash
cd fractal-engine
GOCACHE=/tmp/go-build-cache go run .
```

Frontend :

```bash
cd collaborative-fractal
corepack enable
pnpm install
pnpm dev
```

Le serveur Vite proxy automatiquement `/api` vers `http://localhost:6543`.

## Build Docker

### Build manuel

```bash
docker build -t cloud-scaling-demo/backend:local ./fractal-engine
docker build -t cloud-scaling-demo/frontend:local ./collaborative-fractal
```

### Script utilitaire

```bash
./scripts/build-images.sh cloud-scaling-demo local
```

## Kubernetes

Les manifests sont dans `k8s/` :

- `namespace.yaml`
- `backend-configmap.yaml`
- `backend-deployment.yaml`
- `backend-service.yaml`
- `backend-hpa.yaml`
- `backend-pdb.yaml`
- `frontend-configmap.yaml`
- `frontend-deployment.yaml`
- `frontend-service.yaml`
- `ingress-example.yaml`
- `kustomization.yaml`

### Points importants

- backend avec `replicas: 2`
- frontend avec `replicas: 2`
- readiness probe backend sur `/api/ready`
- liveness probe backend sur `/api/health`
- autoscaling backend par HPA CPU
- PodDisruptionBudget pour le backend
- frontend exposant un `LoadBalancer`
- proxy Nginx frontend vers le service backend interne

### Deploiement Kubernetes

Avant d appliquer les manifests :

1. remplace `PROJECT_ID` dans :
   - `k8s/backend-deployment.yaml`
   - `k8s/frontend-deployment.yaml`
2. ajuste eventuellement la region dans `k8s/backend-configmap.yaml`
3. ajuste eventuellement le host de `k8s/ingress-example.yaml`

Puis :

```bash
kubectl apply -k k8s
```

Ou avec le script :

```bash
./scripts/apply-k8s.sh
```

## Deploiement sur GKE

Exemple de flux simple :

```bash
gcloud auth configure-docker europe-west1-docker.pkg.dev
docker build -t europe-west1-docker.pkg.dev/PROJECT_ID/cloud-scaling-demo/backend:v1 ./fractal-engine
docker build -t europe-west1-docker.pkg.dev/PROJECT_ID/cloud-scaling-demo/frontend:v1 ./collaborative-fractal
docker push europe-west1-docker.pkg.dev/PROJECT_ID/cloud-scaling-demo/backend:v1
docker push europe-west1-docker.pkg.dev/PROJECT_ID/cloud-scaling-demo/frontend:v1
```

Exemple de creation de cluster :

```bash
gcloud container clusters create cloud-scaling-demo \
  --region europe-west1 \
  --num-nodes 3 \
  --machine-type e2-standard-2
```

Puis :

```bash
gcloud container clusters get-credentials cloud-scaling-demo --region europe-west1
kubectl apply -k k8s
```

## Commandes Apache Bench conseillees

Test simple :

```bash
ab -n 100 -c 10 http://<BACKEND_URL>/api/health
```

Test concurrent :

```bash
ab -n 600 -c 40 "http://<BACKEND_URL>/api/load/latency?delay=1200"
```

Test agressif pour le HPA :

```bash
ab -n 1200 -c 120 "http://<BACKEND_URL>/api/load/cpu?duration=5000&intensity=high"
```

## Observer l autoscaling

Pendant le test de charge :

```bash
kubectl get pods -n cloud-scaling-demo -w
kubectl top pods -n cloud-scaling-demo
kubectl describe hpa backend-hpa -n cloud-scaling-demo
```

Ce que tu dois voir :

- plusieurs pods backend actifs
- une hausse CPU sur les pods soumis a la charge
- un scale-out du deployment backend si la cible CPU HPA est depassee

## Demontrer la haute disponibilite

1. Identifie un pod backend :

```bash
kubectl get pods -n cloud-scaling-demo -l app=backend
```

2. Supprime un pod :

```bash
kubectl delete pod -n cloud-scaling-demo <backend-pod-name>
```

3. Continue a lancer des requetes depuis :

- le frontend
- `curl`
- Apache Bench

4. Observe :

- le service reste joignable
- un autre pod repond aux requetes
- le deployment recree un pod
- l interface montre un changement de `podName`

## Observabilite minimale integree

### Backend

- logs de requetes lisibles
- mesure du temps de traitement
- compteurs en memoire par pod
- resume pod-local sur `/api/status`
- `X-Pod-Name` dans les headers

### Frontend

- journal recent des appels
- pod source affiche pour chaque reponse
- compteur de pods distincts observes
- messages d indisponibilite backend

## Choix techniques

- **Go + Gin** pour un backend leger, lisible et simple a conteneuriser
- **stateless backend** pour permettre la repartition entre replicas sans affinite
- **React + Vite + DaisyUI** pour une interface rapide a presenter et facile a maintenir
- **Nginx frontend proxy** pour garder un point d entree unique et simple sur Kubernetes
- **HPA CPU** pour une demonstration directe avec les endpoints de charge
- **PDB + probes** pour la resilience pendant les disruptions et les redemarrages

## Notes

- `k8s/ingress-example.yaml` est fourni comme base si tu preferes exposer le frontend via Ingress GKE plutot qu avec un `LoadBalancer`.
- pour observer le HPA sur GKE, il faut que les metrics soient disponibles dans le cluster.
- les manifests sont volontairement simples et pedagogiques pour une demo academique ou professionnelle.
