# GCP CLI pour deployer sur GKE

> [!IMPORTANT] Pré-requis
Il faut avoir un compte Google Cloud Plateform (GCP), installer les SDK, [outils GCP](https://docs.cloud.google.com/sdk/docs/install-sdk#linux "Télécharger Gcloud cli") et [Kubectl](https://kubernetes.io/releases/download/ "Télécharger Kubectl cli").

## 1. Initialisation CLI
### Vérifier que gcloud est installé
```bash
gcloud --version
```
### Initialiser gcloud
```bash
gcloud init
```
La commande va :

- ouvrir un navigateur
- te faire te connecter à ton compte Google
- te proposer de choisir un projet
- configurer la région par défaut

### Se connecter manuellement (si besoin)
```bash
gcloud auth login
```
Et pour voir le compte actif
```bash
gcloud auth list
```
### Selectionner le projet (***ID_DU_PROJET se trouve dans GCP avec compte connecté***)
```bash
gcloud config set project ID_DU_PROJET
```
Exemple : `gcloud config set project project-xxxxxxxx-xxxx-xxxx-xxxx`

### Configurer la région par défaut (Voir dans GCP la liste des regions)
```bash
gcloud config set run/region europe-west1
```
### Activer les APIs nécessaires
```bash
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  compute.googleapis.com
```
### Vérifier la config
```bash
gcloud config list
```
### Autre commande Utile
Lister les Projets
```bash
gcloud projects list
```

## 2. Pusher les images docker vers Artifact Registry

### Préparer le projet

> [!NOTE] Info 
*Active les APIs GKE et Artifact Registry. C’est requis par la doc officielle GKE pour déployer une app sur un cluster.*

>(Cette étape peut etre sauter si c'est déjà fait en haut)

```bash
gcloud config set project ID_DU_PROJET

gcloud services enable \
  container.googleapis.com \
  artifactregistry.googleapis.com \
  compute.googleapis.com
```

### Créer le dépôt Artifact Registry

```bash
gcloud artifacts repositories create NOM_DU_REPO \
  --repository-format=docker \
  --location=europe-west1 \
  --description="Commentaire"
```
Puis configure Docker pour pousser vers Artifact Registry :
>`europe-west1-docker.pkg.dev` est le repo pour la region `europe-west1`

```bash
gcloud auth configure-docker europe-west1-docker.pkg.dev
```

3. Build et Push les images


## 3. Construction des images Docker

Il faut se placer à la racine du projet :

> Note : ce n’est pas obligatoire, mais cela évite de répéter les chemins dans chaque commande.

### Définir des Variables d’environnement

```bash
export PROJECT_ID=<Id_Du_Projet>
export REGION=europe-west1
export REPO=<Nom_Du_Repo>
export CLUSTER_NAME=<Nom_Du_Cluster>
```

### Build et tag l'image localement

```bash
docker build -t ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/<image>:<tag> <emplacement_dockerfile>
```
Remplace :

* `<image>` → nom de l’image (`backend`, `frontend`, etc.)
* `<tag>` → version (`latest`, `v1`, etc.)
* `<emplacement_dockerfile>` → dossier contenant le Dockerfile (`./backend`, `./frontend`, etc.)

### Exemple concret

```bash
docker build -t ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/backend:latest ./backend
docker build -t ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/frontend:latest ./frontend
```

> [!IMPORTANT]
Les commandes ci-dessus **construit l’image localement uniquement**.

## 4. Envoyer de l'image sur Artifact Registry :

```bash
docker push ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/[image]:[tag]
```
## 5. Création du cluster

Pour cree un cluster, on 2 alternatives : 

- GKE Autopilot (*Pour aller vite et laisser google gerer les noeuds et infra sous-jacente*)
- [GKE Standard](./gke-standard.md) (*Configurer tout manuellement*)

### GKE Autopilot

#### a. Créer le Cluster 

> L'execution de cette commande peut prendre du temps

```bash
gcloud container clusters create-auto ${CLUSTER_NAME} --region ${REGION}
```
#### b. Récupérer les credentials Kubernetese
> Google recommande gcloud container clusters get-credentials pour connecter kubectl au cluster
```bash
gcloud container clusters get-credentials ${CLUSTER_NAME} --region ${REGION}
```
La sortie devrait etre comme ceci : `Fetching cluster endpoint and auth data.
kubeconfig entry generated for cloud-scaling-demo-cluster.`


## 6. Déployer le Projet avec `kubectl`

Pour deployer le projet, on a 3 cas :
- Déployer avec `Kustomize` (*Projet déjà structuré avec des YAML dans `k8s/` et `kustomization.yaml`*)
- [Déployer sans `Kustomize`](./kubectl-yaml.md) (*Projet déjà structuré avec des YAML, mais sans `kustomization.yaml`*)
- [Créer les manifests et déployer depuis zéro](./kubernetes-from-scratch.md) (*Projet sans manifests Kubernetes*)

> [!NOTE] Info
> Rôle de `kustomization.yaml`
>
>Kustomize permet de :
> - déclarer une liste de ressources
> - injecter un namespace commun
> - structurer proprement un déploiement versionné

### Cas 1 : Déployer avec `Kustomize`

Ce cas s'applique si le projet contient déjà :

- un dossier `k8s/`
- un fichier `kustomization.yaml`
- des manifests prêts à être appliqués

```bash
kubectl apply -k k8s/
```
> [!TIP] Alternative 
> Si cette commande échoue avec une erreur liée à l'absence de `kustomization.yaml`, consulter [déployer avec des YAML sans Kustomize.](./kubectl-yaml.md)
### Cas 2 : Déployer sans `Kustomize`

Ce cas s'applique si :

- des manifests Kubernetes existent déjà
- aucun `kustomization.yaml` n'est utilisé

> [!NOTE] Docs
Consulter [déployer avec des YAML sans Kustomize.](./kubectl-yaml.md)

### Cas 3 : Créer les manifests et déployer depuis zéro

Ce cas s'applique lorsqu'aucun manifest Kubernetes n'existe encore.

> [!NOTE] Docs
Consulter [Créer les manifests et déployer depuis zéro](./kubernetes-from-scratch.md)

## 7. Verification et Debug

Pour verifier et debuguer, veuiller consulter [ce documentation.](./verification-debug-gke.md)