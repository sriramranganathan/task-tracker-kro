# Deployment Verification Checklist

This document provides a comprehensive step-by-step checklist to verify the successful deployment of the KRO-based Task Tracker application.

## Environment Configuration

This deployment uses the following environment-specific values:

| Parameter | Value |
|-----------|-------|
| **AWS Account ID** | `408202761791` |
| **AWS Region** | `ap-northeast-2` |
| **OIDC Provider ARN** | `arn:aws:iam::408202761791:oidc-provider/oidc.eks.ap-northeast-2.amazonaws.com/id/6CA0FD26118846C82AF2ABD7F3550661` |
| **OIDC Provider URL** | `oidc.eks.ap-northeast-2.amazonaws.com/id/6CA0FD26118846C82AF2ABD7F3550661` |
| **ECR Repository** | `408202761791.dkr.ecr.ap-northeast-2.amazonaws.com/task-tracker` |
| **Image Tag** | `latest` |
| **Namespace** | `task-tracker` |
| **App Name** | `task-tracker` |
| **ServiceAccount Name** | `task-tracker-sa` |
| **IAM Role Name** | `task-tracker-role` |
| **IAM Role ARN** | `arn:aws:iam::408202761791:role/task-tracker-role` |
| **IAM Policy Name** | `task-tracker-dynamodb-policy` |
| **DynamoDB Table Name** | `task-tracker-tasks` |
| **Replicas** | `2` |

All commands in this document use these actual values - no placeholders to replace.

## Prerequisites Verification

Before deploying, verify all prerequisites are in place:

```bash
# 1. Verify KRO is installed (fully managed - no visible resources)
kubectl get crd resourcegraphdefinitions.kro.run
# Expected: CRD should exist

# 2. Verify ACK IAM Controller is installed (fully managed)
kubectl get crd roles.iam.services.k8s.aws
kubectl get crd policies.iam.services.k8s.aws
# Expected: CRDs should exist

# 3. Verify ACK DynamoDB Controller is installed (fully managed)
kubectl get crd tables.dynamodb.services.k8s.aws
# Expected: CRD should exist

# 4. Verify Reloader Controller is installed
kubectl get deployment -n reloader
# Expected: reloader deployment should be running

# 5. Verify ArgoCD is installed (fully managed)
kubectl get namespace argocd
# Expected: argocd namespace should exist
```

## Step 1: Verify ResourceGraphDefinition (RGD) Creation

```bash
# Apply the RGD manifest (if not using ArgoCD)
kubectl apply -f manifests/task-tracker-rgd.yaml

# Verify RGD is created
kubectl get rgd task-tracker-app
# Expected output:
# NAME               AGE
# task-tracker-app   <time>

# Check RGD details and status
kubectl describe rgd task-tracker-app

# Verify no validation errors in the status section
kubectl get rgd task-tracker-app -o jsonpath='{.status.conditions}' | jq
```

**✓ Checkpoint**: RGD should be created without errors and show as ready.

## Step 2: Verify Instance Creation

```bash
# Apply the instance manifest (if not using ArgoCD)
kubectl apply -f manifests/task-tracker-instance.yaml

# Verify TaskTrackerApp instance is created
kubectl get tasktrackerapp -n task-tracker
# Expected output:
# NAME                 AGE
# task-tracker-demo    <time>

# Check instance status
kubectl describe tasktrackerapp task-tracker-demo -n task-tracker

# Watch the instance status (wait for all resources to be created)
kubectl get tasktrackerapp task-tracker-demo -n task-tracker -o jsonpath='{.status.conditions}' | jq

# Wait for the instance to be ready (timeout: 5 minutes)
kubectl wait --for=condition=Ready tasktrackerapp/task-tracker-demo -n task-tracker --timeout=300s
```

**✓ Checkpoint**: TaskTrackerApp instance should show as Ready with all resources created.

## Step 3: Verify ACK Resource Creation

### 3.1 Verify IAM Policy

```bash
# Check ACK IAM Policy resource
kubectl get policy -n task-tracker
# Expected: task-tracker-dynamodb-policy

# Get policy details
kubectl describe policy task-tracker-dynamodb-policy -n task-tracker

# Get the AWS Policy ARN
kubectl get policy task-tracker-dynamodb-policy -n task-tracker -o jsonpath='{.status.ackResourceMetadata.arn}'
# Expected: arn:aws:iam::408202761791:policy/task-tracker-dynamodb-policy

# Verify in AWS (optional)
POLICY_ARN=$(kubectl get policy task-tracker-dynamodb-policy -n task-tracker -o jsonpath='{.status.ackResourceMetadata.arn}')
aws iam get-policy --policy-arn $POLICY_ARN
```

### 3.2 Verify IAM Role

```bash
# Check ACK IAM Role resource
kubectl get role.iam -n task-tracker
# Expected: task-tracker-role

# Get role details
kubectl describe role.iam task-tracker-role -n task-tracker

# Get the AWS Role ARN
kubectl get role.iam task-tracker-role -n task-tracker -o jsonpath='{.status.ackResourceMetadata.arn}'
# Expected: arn:aws:iam::408202761791:role/task-tracker-role

# Verify in AWS (optional)
aws iam get-role --role-name task-tracker-role
```

### 3.3 Verify Role Policy Attachment

```bash
# Check ACK RolePolicyAttachment resource
kubectl get rolepolicyattachment -n task-tracker
# Expected: task-tracker-policy-attachment

# Get attachment details
kubectl describe rolepolicyattachment task-tracker-policy-attachment -n task-tracker
```

### 3.4 Verify DynamoDB Table

```bash
# Check ACK DynamoDB Table resource
kubectl get table -n task-tracker
# Expected: task-tracker-tasks

# Get table details
kubectl describe table task-tracker-tasks -n task-tracker

# Get table status
kubectl get table task-tracker-tasks -n task-tracker -o jsonpath='{.status.tableStatus}'
# Expected: ACTIVE

# Get table ARN
kubectl get table task-tracker-tasks -n task-tracker -o jsonpath='{.status.ackResourceMetadata.arn}'
# Expected: arn:aws:dynamodb:ap-northeast-2:408202761791:table/task-tracker-tasks

# Verify in AWS (optional)
aws dynamodb describe-table --table-name task-tracker-tasks --region ap-northeast-2
```

**✓ Checkpoint**: All ACK resources should be created successfully and show as synced/active.

## Step 4: Verify Kubernetes Resource Creation

### 4.1 Verify ServiceAccount

```bash
# Check ServiceAccount
kubectl get serviceaccount task-tracker-sa -n task-tracker

# Verify IRSA annotation
kubectl get serviceaccount task-tracker-sa -n task-tracker -o jsonpath='{.metadata.annotations.eks\.amazonaws\.com/role-arn}'
# Expected: arn:aws:iam::408202761791:role/task-tracker-role
```

### 4.2 Verify ConfigMap

```bash
# Check ConfigMap
kubectl get configmap task-tracker-config -n task-tracker

# View ConfigMap contents
kubectl get configmap task-tracker-config -n task-tracker -o yaml

# Verify configuration values
kubectl get configmap task-tracker-config -n task-tracker -o jsonpath='{.data}'
# Expected: DYNAMODB_TABLE_NAME, AWS_REGION, APP_TITLE, APP_THEME_COLOR
```

### 4.3 Verify Deployment

```bash
# Check Deployment
kubectl get deployment task-tracker -n task-tracker

# Verify replica count
kubectl get deployment task-tracker -n task-tracker -o jsonpath='{.spec.replicas}'
# Expected: 2

# Check deployment status
kubectl rollout status deployment/task-tracker -n task-tracker

# Verify Reloader annotation
kubectl get deployment task-tracker -n task-tracker -o jsonpath='{.metadata.annotations.reloader\.stakater\.com/auto}'
# Expected: "true"

# Check pods are running
kubectl get pods -n task-tracker -l app=task-tracker
# Expected: 2 pods in Running state

# Check pod logs
kubectl logs -n task-tracker -l app=task-tracker --tail=50
```

### 4.4 Verify Service

```bash
# Check Service
kubectl get service task-tracker -n task-tracker

# Verify service type
kubectl get service task-tracker -n task-tracker -o jsonpath='{.spec.type}'
# Expected: LoadBalancer

# Check service endpoints
kubectl get endpoints task-tracker -n task-tracker
# Expected: Should show 2 endpoints (matching pod count)
```

**✓ Checkpoint**: All Kubernetes resources should be created and pods should be running.

## Step 5: Get LoadBalancer URL

```bash
# Get LoadBalancer hostname
kubectl get service task-tracker -n task-tracker -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'

# Or get the full service details
kubectl get service task-tracker -n task-tracker

# Wait for LoadBalancer to be provisioned (if EXTERNAL-IP shows <pending>)
kubectl wait --for=jsonpath='{.status.loadBalancer.ingress[0].hostname}' service/task-tracker -n task-tracker --timeout=300s

# Store the URL for testing
export LB_URL=$(kubectl get service task-tracker -n task-tracker -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
echo "Application URL: http://$LB_URL"
```

**✓ Checkpoint**: LoadBalancer should have an external hostname/IP assigned.

## Step 6: Test Application Functionality

### 6.1 Health Check

```bash
# Test health endpoint
curl -s http://$LB_URL/health
# Expected: {"status":"healthy"}

# Test readiness endpoint
curl -s http://$LB_URL/ready
# Expected: {"status":"ready"}
```

### 6.2 Web Interface

```bash
# Open application in browser
echo "Open this URL in your browser: http://$LB_URL"

# Or use curl to verify the page loads
curl -s http://$LB_URL | grep -i "task tracker"
# Expected: Should find "Task Tracker" in the HTML
```

### 6.3 CRUD Operations

Perform these operations in the web browser:

1. **Create Task**:
   - Click "Add Task" button
   - Enter task title and description
   - Click "Save"
   - ✓ Task should appear in the list

2. **View Tasks**:
   - Verify the task list displays
   - ✓ All tasks should be visible

3. **Update Task**:
   - Click on a task to edit
   - Change the status or description
   - Click "Update"
   - ✓ Changes should be reflected immediately

4. **Delete Task**:
   - Click "Delete" on a task
   - Confirm deletion
   - ✓ Task should be removed from the list

### 6.4 API Testing (Optional)

```bash
# List all tasks
curl -s http://$LB_URL/api/tasks | jq

# Create a task via API
curl -X POST http://$LB_URL/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Task","description":"Testing API","status":"pending"}'

# Verify task was created
curl -s http://$LB_URL/api/tasks | jq
```

**✓ Checkpoint**: All CRUD operations should work correctly.

## Step 7: Test ConfigMap Update and Automatic Restart

### 7.1 Record Current State

```bash
# Get current pod names
kubectl get pods -n task-tracker -l app=task-tracker
# Note the pod names and ages

# Get current ConfigMap values
kubectl get configmap task-tracker-config -n task-tracker -o jsonpath='{.data.APP_THEME_COLOR}'
# Note the current theme color

# Verify current theme in browser
echo "Current theme color: $(kubectl get configmap task-tracker-config -n task-tracker -o jsonpath='{.data.APP_THEME_COLOR}')"
```

### 7.2 Update ConfigMap

```bash
# Update the theme color
kubectl patch configmap task-tracker-config -n task-tracker \
  --type merge \
  -p '{"data":{"APP_THEME_COLOR":"#ff6600"}}'

# Or update the app title
kubectl patch configmap task-tracker-config -n task-tracker \
  --type merge \
  -p '{"data":{"APP_TITLE":"My Task Tracker"}}'

# Verify ConfigMap was updated
kubectl get configmap task-tracker-config -n task-tracker -o jsonpath='{.data}'
```

### 7.3 Verify Automatic Restart

```bash
# Watch pods for automatic restart (wait 30-60 seconds)
kubectl get pods -n task-tracker -l app=task-tracker -w

# After restart, verify new pod names
kubectl get pods -n task-tracker -l app=task-tracker
# Expected: New pods with different names and recent creation times

# Check Reloader logs to confirm it triggered the restart
kubectl logs -n reloader -l app=reloader --tail=20 | grep task-tracker
```

### 7.4 Verify New Configuration

```bash
# Refresh the application in browser
echo "Refresh the browser and verify the new theme color or title"

# Or check via curl
curl -s http://$LB_URL | grep -i "theme\|title"
```

**✓ Checkpoint**: Pods should restart automatically within 60 seconds of ConfigMap update, and new configuration should be visible.

## Step 8: Verify Zero-Downtime During Updates

### 8.1 Start Continuous Health Checks

```bash
# In one terminal, start continuous health checks
while true; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://$LB_URL/health)
  if [ "$STATUS" != "200" ]; then
    echo "$(date): FAILED - HTTP $STATUS"
  else
    echo "$(date): OK"
  fi
  sleep 1
done
```

### 8.2 Trigger ConfigMap Update

```bash
# In another terminal, update ConfigMap
kubectl patch configmap task-tracker-config -n task-tracker \
  --type merge \
  -p '{"data":{"APP_THEME_COLOR":"#00cc66"}}'

# Watch the rolling restart
kubectl rollout status deployment/task-tracker -n task-tracker
```

### 8.3 Verify Results

```bash
# Check the continuous health check terminal
# Expected: All requests should return "OK" with no failures

# Verify deployment strategy
kubectl get deployment task-tracker -n task-tracker -o jsonpath='{.spec.strategy}'
# Expected: RollingUpdate strategy

# Check rollout history
kubectl rollout history deployment/task-tracker -n task-tracker
```

**✓ Checkpoint**: No downtime should occur during the rolling restart. All health checks should pass.

## Step 9: Check ArgoCD Sync Status

### 9.1 Verify ArgoCD Application

```bash
# Check if ArgoCD application exists
kubectl get application task-tracker-kro -n argocd

# Get application status
kubectl get application task-tracker-kro -n argocd -o jsonpath='{.status.sync.status}'
# Expected: Synced

# Get health status
kubectl get application task-tracker-kro -n argocd -o jsonpath='{.status.health.status}'
# Expected: Healthy
```

### 9.2 Using ArgoCD CLI (if available)

```bash
# Login to ArgoCD (if not already logged in)
argocd login <argocd-server>

# Get application details
argocd app get task-tracker-kro

# Check sync status
argocd app sync task-tracker-kro --dry-run

# View application resources
argocd app resources task-tracker-kro
```

### 9.3 Using ArgoCD UI

```bash
# Get ArgoCD UI URL
kubectl get service argocd-server -n argocd

# Access the UI and verify:
# 1. Application shows as "Synced" and "Healthy"
# 2. All resources are green
# 3. Resource tree shows all expected resources
# 4. Sync waves are respected (RGD before instance)
```

### 9.4 Test GitOps Workflow

```bash
# Make a change to the instance manifest in Git
# For example, change appTitle or themeColor

# Commit and push the change
git add manifests/task-tracker-instance.yaml
git commit -m "Update app configuration"
git push

# Wait for ArgoCD to detect the change (or trigger manually)
argocd app sync task-tracker-kro

# Verify the sync
argocd app wait task-tracker-kro --health

# Verify the change was applied
kubectl get configmap task-tracker-config -n task-tracker -o jsonpath='{.data}'

# Verify pods restarted automatically
kubectl get pods -n task-tracker -l app=task-tracker
```

**✓ Checkpoint**: ArgoCD should show the application as Synced and Healthy. GitOps workflow should work end-to-end.

## Step 10: Final Verification Summary

Run this comprehensive check to verify everything is working:

```bash
#!/bin/bash
echo "=== KRO Task Tracker Deployment Verification ==="
echo ""

echo "1. RGD Status:"
kubectl get rgd task-tracker-app -o jsonpath='{.metadata.name}: {.status.conditions[0].status}' 2>/dev/null && echo "" || echo "NOT FOUND"
echo ""

echo "2. Instance Status:"
kubectl get tasktrackerapp task-tracker-demo -n task-tracker -o jsonpath='{.metadata.name}: {.status.conditions[0].status}' 2>/dev/null && echo "" || echo "NOT FOUND"
echo ""

echo "3. ACK Resources:"
echo "   IAM Policy: $(kubectl get policy -n task-tracker -o name 2>/dev/null | wc -l) found"
echo "   IAM Role: $(kubectl get role.iam -n task-tracker -o name 2>/dev/null | wc -l) found"
echo "   DynamoDB Table: $(kubectl get table -n task-tracker -o name 2>/dev/null | wc -l) found"
echo ""

echo "4. Kubernetes Resources:"
echo "   ServiceAccount: $(kubectl get sa task-tracker-sa -n task-tracker -o name 2>/dev/null | wc -l) found"
echo "   ConfigMap: $(kubectl get cm task-tracker-config -n task-tracker -o name 2>/dev/null | wc -l) found"
echo "   Deployment: $(kubectl get deployment task-tracker -n task-tracker -o name 2>/dev/null | wc -l) found"
echo "   Service: $(kubectl get svc task-tracker -n task-tracker -o name 2>/dev/null | wc -l) found"
echo ""

echo "5. Pod Status:"
kubectl get pods -n task-tracker -l app=task-tracker
echo ""

echo "6. LoadBalancer URL:"
LB_URL=$(kubectl get svc task-tracker -n task-tracker -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null)
if [ -n "$LB_URL" ]; then
  echo "   http://$LB_URL"
  echo "   Health Check: $(curl -s -o /dev/null -w "%{http_code}" http://$LB_URL/health 2>/dev/null)"
else
  echo "   NOT AVAILABLE"
fi
echo ""

echo "7. ArgoCD Application:"
kubectl get application task-tracker-kro -n argocd -o jsonpath='{.metadata.name}: Sync={.status.sync.status}, Health={.status.health.status}' 2>/dev/null && echo "" || echo "NOT FOUND"
echo ""

echo "=== Verification Complete ==="
```

Save this script as `verify-deployment.sh`, make it executable, and run it:

```bash
chmod +x verify-deployment.sh
./verify-deployment.sh
```

## Troubleshooting Common Issues

### Issue: RGD not creating resources

```bash
# Check KRO controller logs (if accessible)
kubectl logs -n kro-system -l app=kro-controller --tail=100

# Check RGD status for errors
kubectl describe rgd task-tracker-app
```

### Issue: ACK resources stuck in creating state

```bash
# Check ACK controller logs
kubectl logs -n ack-system -l app.kubernetes.io/name=iam-controller --tail=100
kubectl logs -n ack-system -l app.kubernetes.io/name=dynamodb-controller --tail=100

# Verify AWS credentials are configured
kubectl get configmap -n ack-system
kubectl get secret -n ack-system
```

### Issue: Pods not restarting on ConfigMap update

```bash
# Verify Reloader is running
kubectl get pods -n reloader

# Check Reloader logs
kubectl logs -n reloader -l app=reloader --tail=50

# Verify Deployment has Reloader annotation
kubectl get deployment task-tracker -n task-tracker -o jsonpath='{.metadata.annotations}'
```

### Issue: Application cannot access DynamoDB

```bash
# Verify IRSA configuration
kubectl get sa task-tracker-sa -n task-tracker -o yaml | grep eks.amazonaws.com/role-arn
# Expected: eks.amazonaws.com/role-arn: arn:aws:iam::408202761791:role/task-tracker-role

# Check pod environment variables
kubectl exec -n task-tracker -it $(kubectl get pod -n task-tracker -l app=task-tracker -o jsonpath='{.items[0].metadata.name}') -- env | grep AWS

# Check pod logs for AWS errors
kubectl logs -n task-tracker -l app=task-tracker --tail=100 | grep -i error
```

### Issue: ArgoCD not syncing

```bash
# Check ArgoCD application status
kubectl describe application task-tracker-kro -n argocd

# Manually trigger sync
argocd app sync task-tracker-kro

# Check ArgoCD application controller logs
kubectl logs -n argocd -l app.kubernetes.io/name=argocd-application-controller --tail=100
```

## Success Criteria

Your deployment is successful when:

- ✅ RGD is created and shows as ready
- ✅ TaskTrackerApp instance is created and shows as ready
- ✅ All ACK resources (IAM Policy, Role, DynamoDB Table) are created in AWS
- ✅ All Kubernetes resources (ServiceAccount, ConfigMap, Deployment, Service) are created
- ✅ 2 pods are running and healthy
- ✅ LoadBalancer has an external URL assigned
- ✅ Application is accessible via LoadBalancer URL
- ✅ All CRUD operations work correctly
- ✅ ConfigMap updates trigger automatic pod restarts within 60 seconds
- ✅ Zero downtime during rolling updates
- ✅ ArgoCD shows application as Synced and Healthy
- ✅ GitOps workflow works end-to-end

## Next Steps

After successful verification:

1. Document any environment-specific configurations
2. Set up monitoring and alerting for the application
3. Configure backup strategies for DynamoDB table
4. Implement CI/CD pipeline for application updates
5. Consider multi-environment deployments (dev, staging, prod)
