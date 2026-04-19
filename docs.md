# GCP Commande CLI pour deployer avec autoscale et HA en utilisant GKE

> **N.B :**
> Il faut avoir un compte Google Cloud Plateform (GCP), installer les SDK, [outils GCP](https://docs.cloud.google.com/sdk/docs/install-sdk#linux "Télécharger Gcloud cli") et [Kubectl](https://kubernetes.io/releases/download/ "Télécharger Kubectl cli").

## Initialisation CLI
1.	Vérifier que gcloud est installé
```bash
gcloud --version
```
2.  Initialiser gcloud
```bash
gcloud init
```
La commande va :

- ouvrir un navigateur
- te faire te connecter à ton compte Google
- te proposer de choisir un projet
- configurer la région par défaut

3.  Se connecter manuellement (si besoin)
```bash
gcloud auth login
```
Et pour voir le compte actif
```bash
gcloud auth list
```
4.  Selectionner le projet (***ID_DU_PROJET se trouve dans sur GCP avec compte connecté***)
```bash
gcloud config set project ID_DU_PROJET
```
Exemple : `gcloud config set project project-xxxxxxxx-xxxx-xxxx-xxxx`

5.  Configurer la région par défaut (Voir dans GCP la liste des regions)
```bash
gcloud config set run/region europe-west1
```
6. Activer les APIs nécessaires
```bash
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  compute.googleapis.com
```
7. Vérifier la config
```bash
gcloud config list
```
### Autre commande Utile
Lister les Projets
```bash
gcloud projects list
```
---

## Pusher les images docker vers Artifact Registry
___
1.Préparer le projet
___

*Active au minimum les APIs GKE et Artifact Registry. C’est requis par la doc officielle GKE pour déployer une app sur un cluster.*

>(Cette étape peut etre sauter si c'est déjà fait en haut)

```gcloud
gcloud config set project ID_DU_PROJET

gcloud services enable \
  container.googleapis.com \
  artifactregistry.googleapis.com \
  compute.googleapis.com
```
___
2.  Créer le dépôt Artifact Registry
___

```gcloud
gcloud artifacts repositories create NOM_DU_REPO \
  --repository-format=docker \
  --location=europe-west1 \
  --description="Commentaire"
```
Puis configure Docker pour pousser vers Artifact Registry :
>`europe-west1-docker.pkg.dev` est le repo pour la region `europe-west1`
```gcloud
gcloud auth configure-docker europe-west1-docker.pkg.dev
```
___
3. Build et Push les images
___

### Construction des images Docker

Il faut se placer à la racine du projet :

> Note : ce n’est pas obligatoire, mais cela évite de répéter les chemins dans chaque commande.

### Variables d’environnement

```bash
export PROJECT_ID=ID_DU_PROJET
export REGION=europe-west1
export REPO=NOM_DU_REPO
```

### Build d’une image

Remplace :

* `[image]` → nom de l’image (`backend`, `frontend`, etc.)
* `[tag]` → version (`latest`, `v1`, etc.)
* `[emplacement_dockerfile]` → dossier contenant le Dockerfile (`./backend`, `./frontend`, etc.)

```bash
docker build -t ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/[image]:[tag] [emplacement_dockerfile]
```

### Exemple concret

```bash
docker build -t ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/backend:latest ./backend
docker build -t ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/frontend:latest ./frontend
```
### Important

Cette commande **construit l’image localement uniquement**.

Pour l’envoyer sur Artifact Registry :

```bash
docker push ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/[image]:[tag]
```
