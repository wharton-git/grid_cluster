# Déployer une application sur GKE

## 1. Objectif



Ce document constitue le **guide principal** de déploiement sur Google Kubernetes Engine (GKE).

Le contenu détaillé est réparti dans plusieurs sous-guides afin de séparer clairement :

- le choix du type de cluster GKE
- la méthode de déploiement Kubernetes
- les opérations de vérification, de diagnostic et de mise à jour

Le guide reste **générique**, mais les exemples marqués *Exemple pour ce projet* sont dérivés du dépôt réel.

---

## 2. Sous-guides disponibles

- [GKE Autopilot](./gke-autopilot.md)
  Création et préparation d'un cluster Autopilot.
- [GKE Standard](./gke-standard.md)
  Création et préparation d'un cluster Standard, régional ou zonal.
- [Déployer avec Kustomize](./kubectl-kustomize.md)
  Cas d'un projet contenant déjà un dossier `k8s/` et un `kustomization.yaml`.
- [Déployer avec des YAML sans Kustomize](./kubectl-yaml.md)
  Cas d'un projet contenant déjà des manifests YAML sans couche Kustomize.
- [Créer les manifests et déployer depuis zéro](./kubernetes-from-scratch.md)
  Cas sans manifests préconfigurés.
- [Vérification, debug et opérations](./verification-debug-gke.md)
  Vérification des ressources, probes, exposition, tests réseau, tests de charge, HPA et rollouts.

---

## 3. Référentiel technique du projet réel

Les éléments suivants ont été vérifiés dans le dépôt.

| Élément | Valeur réelle dans le projet |
| --- | --- |
| Namespace Kubernetes | `cloud-scaling-demo` |
| Kustomize | présent via `k8s/kustomization.yaml` |
| Backend Deployment | `backend` |
| Backend Service | `backend-service` |
| Backend Service type | `ClusterIP` |
| Backend port pod / service | `6543` / `6543` |
| Backend probes | `readiness: /api/ready`, `liveness: /api/health` |
| Backend endpoints principaux | `/api/health`, `/api/ready`, `/api/info`, `/api/status` |
| Frontend Deployment | `frontend` |
| Frontend Service | `frontend-service` |
| Frontend Service type | `LoadBalancer` |
| Frontend port pod / service | `80` / `80` |
| Frontend probes | `readiness: /healthz`, `liveness: /healthz` |
| Proxy frontend en développement | Vite proxy `/api` vers `http://localhost:6543` |
| Proxy frontend en conteneur | Nginx proxy `/api/` vers `NGINX_BACKEND_UPSTREAM` |
| DNS interne backend en Kubernetes | `http://backend-service.cloud-scaling-demo.svc.cluster.local:6543` |
| Ingress | fichier d'exemple `k8s/ingress-example.yaml`, non inclus dans `kustomization.yaml` |

Clarification importante :

- en local avec `docker compose`, le frontend est publié sur `http://localhost:8080`
- en développement avec Vite, le frontend écoute par défaut sur `http://localhost:5173`
- en Kubernetes, le backend reste **interne** au cluster et n'est pas exposé publiquement par défaut

---

## 4. Distinction entre local, Docker, Kubernetes et GKE

La documentation est organisée pour éviter les mélanges entre contextes d'exécution.

| Contexte | Frontend | Backend | Remarque |
| --- | --- | --- | --- |
| Développement Vite | `5173` | `6543` | Vite proxy `/api` vers le backend local |
| Preview Vite | `4173` | `6543` | usage local uniquement |
| Docker Compose | `8080` publié vers le conteneur `80` | `6543` publié vers `6543` | Nginx proxy `/api/` vers le service Docker `backend:6543` |
| Kubernetes | `frontend-service:80` | `backend-service:6543` | frontend exposé, backend interne |
| GKE | `LoadBalancer` sur `frontend-service` | `ClusterIP` sur `backend-service` | exposition externe du frontend, pas du backend |

---

## 5. Prérequis communs

Les éléments suivants sont nécessaires dans la plupart des cas :

- un projet Google Cloud avec facturation active
- `gcloud`
- `kubectl`
- Docker
- des `Dockerfile` valides
- au moins une méthode de déploiement Kubernetes

Vérification rapide :

```bash
gcloud --version
kubectl version --client
docker --version
```

Variables d'environnement recommandées :

```bash
export PROJECT_ID="my-gcp-project"
export REGION="europe-west1"
export ZONE="europe-west1-b"
export CLUSTER_NAME="my-gke-cluster"
export REPO="my-app"
export NAMESPACE="my-app"
```

Exemple pour ce projet :

```bash
export PROJECT_ID="ton-project-id"
export REGION="europe-west1"
export CLUSTER_NAME="cloud-scaling-demo"
export REPO="cloud-scaling-demo"
export NAMESPACE="cloud-scaling-demo"
```

Initialisation GCP :

```bash
gcloud init
gcloud config set project "${PROJECT_ID}"
gcloud config set compute/region "${REGION}"
```

Activation des APIs :

```bash
gcloud services enable \
  container.googleapis.com \
  artifactregistry.googleapis.com \
  compute.googleapis.com
```

Création du dépôt Artifact Registry :

```bash
gcloud artifacts repositories create "${REPO}" \
  --repository-format=docker \
  --location="${REGION}" \
  --description="Docker repository for Kubernetes deployments"
```

Configuration de Docker :

```bash
gcloud auth configure-docker "${REGION}-docker.pkg.dev"
```

---

## 6. Notes IAM et permissions minimales

Les rôles exacts dépendent de l'organisation et des politiques IAM en place.

Dans un flux CLI classique, les besoins suivants apparaissent fréquemment :

- activation des APIs : `Service Usage Admin` (`roles/serviceusage.serviceUsageAdmin`)
- création et administration du cluster : `Kubernetes Engine Admin` (`roles/container.admin`)
- push des images vers Artifact Registry : `Artifact Registry Writer` (`roles/artifactregistry.writer`)
- pull des images par le runtime GKE : `Artifact Registry Reader` (`roles/artifactregistry.reader`) si la configuration par défaut ne suffit pas ou si les images sont dans un autre projet

En cas d'erreur de type `ImagePullBackOff` ou `ErrImagePull`, les vérifications prioritaires sont :

- le chemin exact de l'image
- le tag
- le projet GCP cible
- les permissions du compte utilisé pour pousser l'image
- les permissions du runtime GKE pour tirer l'image

---

## 7. Construction et publication des images

Exemple générique :

```bash
docker build -t "${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/backend:v1" ./path-to-backend
docker build -t "${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/frontend:v1" ./path-to-frontend

docker push "${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/backend:v1"
docker push "${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/frontend:v1"
```

Exemple pour ce projet :

```bash
docker build -t "${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/backend:v1" ./backend
docker build -t "${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/frontend:v1" ./frontend

docker push "${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/backend:v1"
docker push "${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/frontend:v1"
```

Recommandation :

- privilégier des tags versionnés
- éviter `latest` pour les déploiements reproductibles
- éviter de documenter une commande de build qui dépend d'un script non aligné sur l'arborescence réelle

---

## 8. Parcours recommandés

### Cas 1. Projet déjà structuré avec `k8s/` et `kustomization.yaml`

Parcours recommandé :

1. [GKE Autopilot](./gke-autopilot.md) ou [GKE Standard](./gke-standard.md)
2. [Déployer avec Kustomize](./kubectl-kustomize.md)
3. [Vérification, debug et opérations](./verification-debug-gke.md)

### Cas 2. Projet déjà structuré avec des YAML, mais sans Kustomize

Parcours recommandé :

1. [GKE Autopilot](./gke-autopilot.md) ou [GKE Standard](./gke-standard.md)
2. [Déployer avec des YAML sans Kustomize](./kubectl-yaml.md)
3. [Vérification, debug et opérations](./verification-debug-gke.md)

### Cas 3. Projet sans manifests Kubernetes

Parcours recommandé :

1. [GKE Autopilot](./gke-autopilot.md) ou [GKE Standard](./gke-standard.md)
2. [Créer les manifests et déployer depuis zéro](./kubernetes-from-scratch.md)
3. [Vérification, debug et opérations](./verification-debug-gke.md)

---

## 9. Parcours recommandé pour ce projet

Le parcours le plus naturel pour ce dépôt est le suivant :

1. construire et pousser les images à partir de `./backend` et `./frontend`
2. créer un cluster GKE avec [GKE Autopilot](./gke-autopilot.md) ou [GKE Standard](./gke-standard.md)
3. adapter si nécessaire les références d'image dans les manifests Kubernetes
4. appliquer les manifests avec [Déployer avec Kustomize](./kubectl-kustomize.md)
5. vérifier l'exposition réseau, les probes, la communication interne et l'HPA avec [Vérification, debug et opérations](./verification-debug-gke.md)

Point de vigilance spécifique au projet :

- `k8s/backend-deployment.yaml` et `k8s/frontend-deployment.yaml` référencent actuellement des images `europe-west1-docker.pkg.dev/project-45a76f06-067f-40f7-9a4/cloud-scaling-demo/...:latest`
- pour un déploiement dans un autre projet GCP, ces références doivent être remplacées avant `kubectl apply -k k8s/`

---

## 10. Références officielles

Documentation Google Cloud officielle :

- Create an Autopilot cluster:
  https://cloud.google.com/kubernetes-engine/docs/how-to/creating-an-autopilot-cluster
- gcloud container clusters create:
  https://cloud.google.com/sdk/gcloud/reference/container/clusters/create
- Quickstart: Deploy an app to a GKE cluster:
  https://cloud.google.com/kubernetes-engine/docs/deploy-app-cluster
- Artifact Registry, push and pull images:
  https://cloud.google.com/artifact-registry/docs/docker/pushing-and-pulling
- GKE Autopilot security measures:
  https://cloud.google.com/kubernetes-engine/docs/concepts/autopilot-security

---

## 11. Conclusion

Le document principal joue le rôle de point d'entrée.

Les détails opérationnels sont volontairement distribués dans des guides spécialisés afin de :

- limiter les ambiguïtés entre GKE, Kubernetes, Docker et local
- réutiliser les parties génériques
- conserver des exemples concrets fidèles au dépôt réel
- centraliser les références officielles dans un seul document
