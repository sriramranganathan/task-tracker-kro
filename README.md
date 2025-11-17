# Task Tracker - KRO-Based Implementation

A demonstration application showcasing **Kubernetes Resource Orchestrator (KRO)** to deploy a full-stack task tracking application with AWS services orchestrated as a single cohesive unit through GitOps.

## Overview

This project demonstrates how KRO simplifies complex Kubernetes deployments by wrapping multiple AWS and Kubernetes resources into a single `ResourceGraphDefinition`. Instead of managing dozens of individual manifests, you define one custom resource that orchestrates:

- **AWS Resources** (via ACK): IAM policies, IAM roles, DynamoDB tables
- **Kubernetes Resources**: ServiceAccounts, ConfigMaps, Deployments, Services
- **Resource Dependencies**: Automatic ordering and dependency management
- **GitOps Integration**: Continuous deployment via ArgoCD
- **Dynamic Configuration**: Zero-downtime updates with automatic pod restarts

### Architecture

```
GitHub Repository (this repo)
        ↓
    ArgoCD (GitOps)
        ↓
    KRO Controller
        ↓
    ┌─────────────────────────────────────┐
    │  AWS Resources (via ACK)            │
    │  • IAM Policy (DynamoDB permissions)│
    │  • IAM Role (IRSA trust policy)     │
    │  • DynamoDB Table (task storage)    │
    └─────────────────────────────────────┘
        ↓
    ┌─────────────────────────────────────┐
    │  Kubernetes Resources               │
    │  • ServiceAccount (with IRSA)       │
    │  • ConfigMap (app configuration)    │
    │  • Deployment (2+ replicas)         │
    │  • Service (LoadBalancer)           │
    └─────────────────────────────────────┘
        ↓
    Task Tracker Application
```

## Prerequisites

### Fully Managed (No Installation Required)

These controllers are fully managed and run as managed services in your cluster:

- ✅ **KRO (Kubernetes Resource Orchestrator)** - Fully managed
- ✅ **ACK Controllers** (IAM, DynamoDB) - Fully managed
- ✅ **ArgoCD** - Fully managed

### Required Installation

- **Reloader Controller** - Required for automatic pod restarts on ConfigMap changes

```bash
kubectl apply -f https://raw.githubusercontent.com/stakater/Reloader/master/deployments/kubernetes/reloader.yaml
```

Verify installation:
```bash
kubectl get deployment -n reloader
```

### Existing Infrastructure

- EKS cluster with OIDC provider configured
- ECR repository with task-tracker image
- AWS permissions for ACK to create IAM and DynamoDB resources

## Parameter Reference

The `TaskTrackerApp` custom resource accepts the following parameters:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `namespace` | string | Yes | - | Target namespace for all resources |
| `appName` | string | Yes | - | Application name prefix for resource naming |
| `appTitle` | string | No | "Task Tracker" | Display title shown in the UI |
| `themeColor` | string | No | "#0066cc" | UI theme color (hex format) |
| `awsRegion` | string | Yes | - | AWS region for resource creation |
| `awsAccountId` | string | Yes | - | AWS account ID |
| `oidcProviderArn` | string | Yes | - | OIDC provider ARN for IRSA |
| `ecrImageUri` | string | Yes | - | ECR repository URI (without tag) |
| `imageTag` | string | No | "latest" | Container image tag |
| `replicas` | integer | No | 2 | Number of pod replicas |

## Obtaining Required Values

### AWS Account ID

```bash
aws sts get-caller-identity --query Account --output text
```

### AWS Region

```bash
aws configure get region
```

Or check your EKS cluster region:
```bash
aws eks describe-cluster --name <cluster-name> --query cluster.arn --output text
# Extract region from ARN: arn:aws:eks:REGION:ACCOUNT:cluster/NAME
```

### OIDC Provider ARN

1. Get the OIDC issuer URL:
```bash
aws eks describe-cluster --name <cluster-name> --query "cluster.identity.oidc.issuer" --output text
```

2. Construct the ARN:
```
arn:aws:iam::<ACCOUNT_ID>:oidc-provider/<OIDC_ISSUER_WITHOUT_HTTPS>
```

Example:
- If issuer is: `https://oidc.eks.ap-northeast-2.amazonaws.com/id/6CA0FD26118846C82AF2ABD7F3550661`
- Then ARN is: `arn:aws:iam::408202761791:oidc-provider/oidc.eks.ap-northeast-2.amazonaws.com/id/6CA0FD26118846C82AF2ABD7F3550661`

### ECR Image URI

```bash
aws ecr describe-repositories --repository-names task-tracker --query 'repositories[0].repositoryUri' --output text
```

List available image tags:
```bash
aws ecr list-images --repository-name task-tracker --query 'imageIds[*].imageTag' --output table
```

## Deployment Instructions

### Step 1: Clone and Configure

1. Clone this repository:
```bash
git clone https://github.com/YOUR_USERNAME/task-tracker-kro
cd task-tracker-kro
```

2. Update `manifests/task-tracker-instance.yaml` with your values:
   - `awsRegion`
   - `awsAccountId`
   - `oidcProviderArn`
   - `ecrImageUri`
   - Optionally: `appTitle`, `themeColor`, `imageTag`, `replicas`

3. Update `argocd/application.yaml`:
   - `spec.source.repoURL`: Your GitHub repository URL
   - `spec.destination.server`: Your EKS cluster ARN

### Step 2: Deploy via ArgoCD

1. Apply the ArgoCD Application:
```bash
kubectl apply -f argocd/application.yaml
```

2. Monitor the sync status:
```bash
# Using ArgoCD CLI
argocd app get task-tracker-kro

# Or using kubectl
kubectl get application task-tracker-kro -n argocd -w
```

3. Wait for all resources to be created (typically 2-3 minutes):
```bash
kubectl get tasktrackerapp task-tracker-demo -n task-tracker -w
```

### Step 3: Verify Deployment

Check all resources were created:

```bash
# Check the TaskTrackerApp custom resource
kubectl get tasktrackerapp -n task-tracker

# Check ACK resources
kubectl get policy,role.iam,table -n task-tracker

# Check Kubernetes resources
kubectl get deployment,service,configmap,serviceaccount -n task-tracker

# Check pod status
kubectl get pods -n task-tracker
```

### Step 4: Access the Application

Get the LoadBalancer URL:
```bash
kubectl get svc task-tracker -n task-tracker -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'
```

Open the URL in your browser to access the Task Tracker application.

## KRO vs Original Implementation

| Aspect | Original Implementation | KRO-Based Implementation |
|--------|------------------------|--------------------------|
| **Resource Management** | 8 separate manifest files | 1 ResourceGraphDefinition + 1 Instance |
| **Deployment Method** | Manual `kubectl apply` | ArgoCD GitOps |
| **Dependency Management** | ArgoCD sync-waves | KRO `dependsOn` declarations |
| **Configuration Updates** | Manual pod restart required | Automatic via Reloader |
| **Replicas** | 1 (single pod) | 2+ (high availability) |
| **Parameterization** | Hardcoded values in manifests | Schema-based parameters |
| **Resource Visibility** | Individual resources | Single custom resource |
| **Complexity** | Higher (manage 8 files) | Lower (manage 2 files) |

### Benefits of KRO Approach

1. **Simplified Management**: One custom resource instead of many manifests
2. **Guaranteed Ordering**: KRO ensures dependencies are created in correct order
3. **Atomic Operations**: All resources created/updated/deleted as a unit
4. **Reusability**: Same RGD can be instantiated multiple times with different parameters
5. **GitOps Native**: Perfect integration with ArgoCD for continuous deployment
6. **Self-Documenting**: Schema defines all available parameters with descriptions

## Demo Workflow: Dynamic Configuration Updates

This section demonstrates KRO's power combined with Reloader for zero-downtime configuration updates.

### Initial State

1. Access the application and note the current theme color and title
2. Check current pod names:
```bash
kubectl get pods -n task-tracker
```

### Update Configuration

1. Edit the instance manifest in your Git repository:
```bash
# Edit manifests/task-tracker-instance.yaml
# Change themeColor from "#0066cc" to "#ff6600"
# Change appTitle from "Task Tracker" to "My Tasks"
```

2. Commit and push changes:
```bash
git add manifests/task-tracker-instance.yaml
git commit -m "Update theme color and title"
git push
```

### Observe Automatic Updates

1. ArgoCD detects the change and syncs (within 3 minutes, or trigger manually):
```bash
argocd app sync task-tracker-kro
```

2. KRO updates the ConfigMap:
```bash
kubectl get configmap task-tracker-config -n task-tracker -o yaml
```

3. Reloader detects ConfigMap change and triggers rolling restart:
```bash
# Watch pods being recreated
kubectl get pods -n task-tracker -w
```

4. Verify zero downtime by continuously polling the application:
```bash
# In a separate terminal, run continuous health checks
while true; do 
  curl -s http://<loadbalancer-url>/health && echo " - $(date)"
  sleep 1
done
```

5. Refresh the application in your browser - new theme color and title appear!

### Key Observations

- ✅ No manual intervention required
- ✅ Rolling restart ensures zero downtime
- ✅ Multiple replicas maintain availability during update
- ✅ Complete GitOps workflow from commit to production
- ✅ All changes tracked in Git history

## Verification Commands

### Check Resource Creation

```bash
# View the ResourceGraphDefinition
kubectl get rgd task-tracker-app -o yaml

# View the TaskTrackerApp instance
kubectl describe tasktrackerapp task-tracker-demo -n task-tracker

# Check ACK resource status
kubectl get policy task-tracker-dynamodb-policy -n task-tracker -o yaml
kubectl get role.iam task-tracker-role -n task-tracker -o yaml
kubectl get table task-tracker-table -n task-tracker -o yaml

# Verify IAM role ARN annotation on ServiceAccount
kubectl get sa task-tracker-sa -n task-tracker -o jsonpath='{.metadata.annotations.eks\.amazonaws\.com/role-arn}'
```

### Test Application Functionality

```bash
# Get LoadBalancer URL
LB_URL=$(kubectl get svc task-tracker -n task-tracker -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')

# Test health endpoint
curl http://$LB_URL/health

# Test readiness endpoint
curl http://$LB_URL/ready

# Access the application
echo "Application URL: http://$LB_URL"
```

### Monitor ArgoCD Sync

```bash
# Check sync status
argocd app get task-tracker-kro

# View sync history
argocd app history task-tracker-kro

# Watch for changes
argocd app watch task-tracker-kro
```

## Troubleshooting

### Issue: TaskTrackerApp resource not created

**Symptoms**: `kubectl get tasktrackerapp` shows no resources

**Possible Causes**:
- KRO controller not running
- ResourceGraphDefinition not applied

**Resolution**:
```bash
# Verify KRO CRD exists
kubectl get crd resourcegraphdefinitions.kro.run

# Check if RGD is created
kubectl get rgd task-tracker-app

# If missing, ArgoCD may not have synced yet
argocd app sync task-tracker-kro
```

### Issue: ACK resources failing to create

**Symptoms**: IAM Policy, Role, or DynamoDB Table stuck in pending state

**Possible Causes**:
- ACK controllers not installed
- Insufficient AWS permissions
- Resource name conflicts

**Resolution**:
```bash
# Check ACK CRDs exist
kubectl get crd policies.iam.services.k8s.aws
kubectl get crd roles.iam.services.k8s.aws
kubectl get crd tables.dynamodb.services.k8s.aws

# Check ACK controller logs
kubectl logs -n ack-system -l k8s-app=ack-iam-controller
kubectl logs -n ack-system -l k8s-app=ack-dynamodb-controller

# Describe the failing resource for details
kubectl describe policy task-tracker-dynamodb-policy -n task-tracker
```

### Issue: Pods cannot access DynamoDB

**Symptoms**: Application logs show AWS authentication errors

**Possible Causes**:
- IRSA not configured correctly
- IAM role ARN annotation missing
- OIDC provider ARN incorrect

**Resolution**:
```bash
# Verify ServiceAccount has IAM role annotation
kubectl get sa task-tracker-sa -n task-tracker -o yaml | grep eks.amazonaws.com/role-arn

# Check pod environment variables
kubectl exec -n task-tracker deployment/task-tracker -- env | grep AWS

# Verify OIDC provider exists in AWS
aws iam list-open-id-connect-providers

# Check IAM role trust policy
aws iam get-role --role-name task-tracker-role --query 'Role.AssumeRolePolicyDocument'
```

### Issue: ConfigMap updates not triggering pod restart

**Symptoms**: ConfigMap updated but pods still running with old configuration

**Possible Causes**:
- Reloader controller not installed
- Reloader annotation missing from Deployment

**Resolution**:
```bash
# Verify Reloader is running
kubectl get deployment -n reloader

# Check Reloader logs
kubectl logs -n reloader -l app=reloader

# Verify Deployment has Reloader annotation
kubectl get deployment task-tracker -n task-tracker -o yaml | grep reloader.stakater.com/auto

# Manual restart if needed
kubectl rollout restart deployment/task-tracker -n task-tracker
```

### Issue: ArgoCD sync fails with CRD not found

**Symptoms**: ArgoCD shows "CRD not found" error

**Possible Causes**:
- RGD applied before KRO CRD exists
- Sync wave ordering incorrect

**Resolution**:
```bash
# Verify sync-wave annotations
kubectl get -f manifests/task-tracker-instance.yaml -o yaml | grep sync-wave

# Manually apply RGD first
kubectl apply -f manifests/task-tracker-rgd.yaml

# Wait a moment, then sync instance
kubectl apply -f manifests/task-tracker-instance.yaml

# Or use ArgoCD sync with retry
argocd app sync task-tracker-kro --retry-limit 5
```

### Issue: LoadBalancer service stuck in pending

**Symptoms**: Service shows `<pending>` for EXTERNAL-IP

**Possible Causes**:
- AWS Load Balancer Controller not installed
- Insufficient AWS permissions
- VPC/subnet configuration issues

**Resolution**:
```bash
# Check service status
kubectl describe svc task-tracker -n task-tracker

# Check AWS Load Balancer Controller logs
kubectl logs -n kube-system -l app.kubernetes.io/name=aws-load-balancer-controller

# Verify service annotations
kubectl get svc task-tracker -n task-tracker -o yaml
```

## Project Structure

```
task-tracker-kro/
├── app/                          # Application code (Node.js)
│   ├── server.js                 # Express server
│   ├── dynamodb-client.js        # DynamoDB SDK client
│   ├── package.json              # Node.js dependencies
│   ├── Dockerfile                # Container image definition
│   └── public/                   # Frontend assets
│       ├── index.html
│       ├── app.js
│       └── styles.css
├── manifests/                    # KRO manifests
│   ├── task-tracker-rgd.yaml    # ResourceGraphDefinition
│   └── task-tracker-instance.yaml # Instance manifest
├── argocd/                       # ArgoCD configuration
│   └── application.yaml          # ArgoCD Application
├── .gitignore                    # Git ignore rules
└── README.md                     # This file
```

## Additional Resources

- [KRO Documentation](https://kro.run/docs)
- [AWS Controllers for Kubernetes (ACK)](https://aws-controllers-k8s.github.io/community/)
- [ArgoCD Documentation](https://argo-cd.readthedocs.io/)
- [Reloader Documentation](https://github.com/stakater/Reloader)
- [IRSA Documentation](https://docs.aws.amazon.com/eks/latest/userguide/iam-roles-for-service-accounts.html)

## License

This project is provided as-is for demonstration purposes.
