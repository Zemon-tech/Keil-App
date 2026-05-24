# AWS Lightsail Backend Deployment Guide

This guide provides a comprehensive, step-by-step walkthrough to deploy the **Keil-App Express/TypeScript backend** on **AWS Lightsail**. 

Since the project already includes a multi-stage `Dockerfile` and utilizes external cloud services (Supabase PostgreSQL, Sevalla S3, etc.), AWS Lightsail is an excellent, cost-effective hosting choice.

---

## 📋 Architectural Overview

The backend is lightweight, stateless (except for WebSocket connections), and relies on external databases and storage. 

```mermaid
graph TD
    Client[Web/Mobile Client] -->|HTTPS / WSS| Lightsail[AWS Lightsail Backend Node.js]
    Lightsail -->|PostgreSQL Pooler| Supabase[(Supabase DB)]
    Lightsail -->|OAuth & Calendar API| Google[Google Cloud API]
    Lightsail -->|Audio Uploads / S3 SDK| Sevalla[Sevalla S3 Storage]
    Lightsail -->|LLM Completion| OpenRouter[OpenRouter / Gemini ADK]
```

### Deployment Paths
We outline **two standard deployment options** based on your operational preferences and budget:

1. **Path A: AWS Lightsail Container Services (Highly Recommended & Easiest)**
   * **Pros:** Fully managed, handles SSL (HTTPS) automatically, zero OS maintenance, easy rolling updates, scaling is a single slider.
   * **Cons:** Slightly more expensive (starts at $7/mo), requires building and pushing a Docker image using AWS CLI.
2. **Path B: AWS Lightsail Linux Instance (Traditional VPS)**
   * **Pros:** Most cost-effective (starts at $3.50/mo or $5/mo), full root access, can host multiple services on one VM.
   * **Cons:** Requires manual server setup (Node.js, PM2, Nginx, Certbot/SSL), OS security patches, and log rotation.

---

## 🛠️ Pre-Deployment Verification

Before executing any deployment steps, verify your application configuration:

### 1. Port and Binding Check
* **Port**: The application reads `PORT` from the environment. Ensure this is configured inside Lightsail (e.g., matching standard port `5000` or `80`).
* **Interface**: The server listens on `0.0.0.0` (configured in [src/index.ts](file:///s:/1-Project/Quild/Keil-App/backend/src/index.ts#L20)) which ensures that incoming requests from the container gateway or Nginx are correctly accepted.

### 2. Database Migrations
Since your database is hosted on **Supabase**, migrate the database *before* pointing your new backend instance to it.
From your local `backend` directory, run:
```bash
node run-migration.js
```
Make sure your local `.env` has the correct `DATABASE_URL` pointing to the Supabase pooler instance.

---

## 🚀 Path A: AWS Lightsail Container Services (Recommended)

This approach leverages the existing production [Dockerfile](file:///s:/1-Project/Quild/Keil-App/backend/Dockerfile).

### Step 1: Install Prerequisites
You will need three tools installed on your local machine to push the Docker image to AWS:
1. **Docker Desktop** (to build the image locally).
2. **AWS CLI** (v2.x) - [Download AWS CLI](https://aws.amazon.com/cli/).
3. **Lightsail Control Plugin (`lightsailctl`)**:
   * **macOS (Homebrew)**: `brew install aws/tap/lightsailctl`
   * **Windows (PowerShell as Admin)**:
     ```powershell
     # Download the plugin
     Invoke-WebRequest -Uri "https://s3.us-west-2.amazonaws.com/lightsailctl/lightsailctl-windows-amd64.exe" -OutFile "$env:ProgramFiles\Amazon\AWSCLIV2\lightsailctl.exe"
     ```
   * **Linux**: Download and place `lightsailctl` in your path (typically `/usr/local/bin`).

Ensure the plugin is working by running:
```bash
aws lightsail push-container-image --help
```

### Step 2: Create the Container Service in AWS
1. Log in to the [AWS Lightsail Console](https://lightsail.aws.amazon.com/).
2. Click the **Containers** tab, then click **Create container service**.
3. Choose the **Region** closest to your target users (e.g., `ap-south-1` or `us-east-1`).
4. Select the **Capacity (Power)**:
   * **Nano** ($7/mo, 512 MB RAM, 0.25 vCPUs) is perfectly sufficient for the Keil-App MVP.
5. Select a **Scale** of `1` (increases redundancy/nodes if you scale up).
6. Provide a **Service Name** (e.g., `keil-backend-service`).
7. Click **Create container service**.

### Step 3: Build & Push the Docker Image
Open your terminal in the `backend` root folder:

1. **Build the container locally**:
   ```bash
   docker build -t keil-backend:latest .
   ```
2. **Push the image directly to Lightsail**:
   Replace `<Region>` and `<ContainerServiceName>` with your actual deployment values:
   ```bash
   aws lightsail push-container-image \
     --region <Region> \
     --service-name <ContainerServiceName> \
     --label keil-backend-v1 \
     --image keil-backend:latest
   ```
   *Upon successful upload, the CLI will output a string similar to:*
   `:keil-backend-service.keil-backend-v1.1`
   > [!IMPORTANT]
   > Copy this image string! You will need it in the next step.

### Step 4: Configure & Deploy the Container
1. Go to your **Lightsail Container Service** in the AWS Console.
2. Click **Create your first deployment** (or **Set up deployment**).
3. Under **Containers**, click **Add container**:
   * **Container name**: `keil-backend`
   * **Image**: Paste the exact image string copied from Step 3 (e.g., `:keil-backend-service.keil-backend-v1.1`).
   * **Open Ports**: Add port **`5000`** and set protocol to **HTTP**.
4. Under **Environment variables**, click **Add variable** and insert your environment settings (see [Environment Configuration](#-environment-configuration) below).
5. Under **Public endpoint**:
   * Select `keil-backend` as your target.
   * **Health check path**: Change from `/` to `/api/health`.
   * **Interval**: 30 seconds (default).
6. Click **Save and Deploy**.

AWS will spin up the container, perform health checks on `/api/health`, configure a secure HTTPS load balancer automatically, and transition the state to **Running**.
You can grab the auto-generated **Public Domain** (e.g., `https://keil-backend-service.xxxxxx.lightsailcontainers.com`) from the header of the page!

---

## 🚀 Path B: AWS Lightsail Linux Instance (Traditional VPS)

This path runs the app on an Ubuntu instance using PM2 to manage the process and Nginx as the reverse proxy.

### Step 1: Spin up the Instance
1. In the **AWS Lightsail Console**, click the **Instances** tab, and click **Create instance**.
2. Select **Linux/Unix** platform.
3. Select **OS Only** -> **Ubuntu 22.04 LTS**.
4. Choose an Instance Plan:
   * **$5/mo plan** (1 GB RAM, 1 vCPU, 40 GB SSD) is recommended for compiling TypeScript code comfortably.
5. Identify your instance (e.g., `keil-backend-vps`) and click **Create Instance**.

### Step 2: Configure Static IP and Firewalls
1. **Attach a Static IP**: Go to the **Networking** tab of your new instance, click **Create static IP**, select your instance, and create. This prevents your server IP from changing when it restarts.
2. **Update Firewall ports**:
   * Scroll down to **IPv4 Firewall**.
   * Add the following rules if they are not present:
     * **HTTP** (TCP Port 80)
     * **HTTPS** (TCP Port 443)
     * **Custom** (TCP Port 5000 - Optional, for direct debugging, though Nginx will handle reverse proxying on 80/443).

### Step 3: Connect and Set Up the Server Runtime
Connect via SSH (using the browser-based SSH terminal or your local terminal with the AWS SSH key). Run the following commands:

```bash
# Update OS packages
sudo apt update && sudo apt upgrade -y

# Install Node.js (v20) & Git
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git

# Verify installations
node -v
npm -v

# Install PM2 globally to keep the server alive
sudo npm install -g pm2
```

### Step 4: Clone Code and Build the App
1. Clone your repository into the VPS:
   ```bash
   git clone <your-git-repo-url> /var/www/keil-app
   cd /var/www/keil-app/backend
   ```
2. Create your `.env` configuration:
   ```bash
   nano .env
   ```
   Paste all your configuration keys (see [Environment Configuration](#-environment-configuration)), setting `PORT=5000` and `NODE_ENV=production`. Save and exit (`Ctrl+O`, `Enter`, `Ctrl+X`).
3. Install dependencies and compile:
   ```bash
   npm ci
   npm run build
   ```

### Step 5: Start with PM2
Launch the app with PM2:
```bash
pm2 start dist/index.js --name "keil-backend"
```
Ensure the process automatically starts on system reboot:
```bash
pm2 startup
# Copy and execute the command generated by the output of the above command

pm2 save
```

### Step 6: Configure Nginx Reverse Proxy & SSL
To allow users to access the app via HTTPS on standard web ports:

1. **Install Nginx & Certbot**:
   ```bash
   sudo apt install nginx certbot python3-certbot-nginx -y
   ```
2. **Configure Nginx Site**:
   Create a new block config:
   ```bash
   sudo nano /etc/nginx/sites-available/keil-backend
   ```
   Paste the following config (replace `api.yourdomain.com` with your actual subdomain pointing to the Static IP of your instance):
   ```nginx
   server {
       listen 80;
       server_name api.yourdomain.com;

       location / {
           proxy_pass http://127.0.0.1:5000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```
   Save and close.
3. **Enable Config and Restart**:
   ```bash
   sudo ln -s /etc/nginx/sites-available/keil-backend /etc/nginx/sites-enabled/
   sudo rm /etc/nginx/sites-enabled/default # Remove default Nginx page
   sudo nginx -t # Test configuration
   sudo systemctl restart nginx
   ```
4. **Obtain SSL Certificate via Certbot**:
   Ensure your custom domain DNS `A record` is pointing to the static IP.
   ```bash
   sudo certbot --nginx -d api.yourdomain.com
   ```
   Follow the prompts to configure automatic HTTPS redirection.

---

## 🔑 Environment Configuration

Ensure the following variables are configured in the Lightsail environment (or `.env` file for Path B).

> [!WARNING]
> Never commit production secrets to Git. Always pass them via the AWS Lightsail Console UI (for Containers) or set them in the server's local `.env` file (for VPS).

| Variable Name | Required | Description | Example / Recommendations |
| :--- | :--- | :--- | :--- |
| `PORT` | Yes | Port the app listens on | `5000` (must match the exposed port) |
| `NODE_ENV` | Yes | Deployment environment type | `production` |
| `DATABASE_URL` | Yes | Supabase PostgreSQL Connection String | Use the pooler transaction connection string (`port 5432`) |
| `JWT_SECRET` | Yes | Secret for signing user JWTs | Make this a long, secure random string |
| `FRONTEND_URL` | Yes | Domain of the frontend app (for CORS validation) | `https://keilhq.nameste-kayo.workers.dev` (or production URL) |
| `BACKEND_URL` | Yes | The URL of this newly deployed backend service | `https://api.yourdomain.com` |
| `SUPABASE_URL` | Yes | Supabase Project URL | From your Supabase settings dashboard |
| `SUPABASE_PUBLISHABLE_KEY`| Yes | Supabase Publishable/Anon Key | From your Supabase API dashboard |
| `SUPABASE_SECRET_KEY` | Yes | Supabase Service Role Key (secret) | From your Supabase API dashboard (keep private!) |
| `GOOGLE_CLIENT_ID` | Yes | Google Client ID for OAuth | Used in your calendar integration |
| `GOOGLE_CLIENT_SECRET` | Yes | Google Client Secret for OAuth | Used in your calendar integration |
| `GOOGLE_REDIRECT_URI` | Yes | Redirect target for Google OAuth | `https://<backend-domain>/api/v1/integrations/google/callback` |
| `GOOGLE_OAUTH_STATE_SECRET`| Yes | CSRF state secret for Google OAuth | Long secure random string |
| `SARVAM_API_KEY` | Yes | API key for Sarvam AI | Kept secure |
| `SEVALLA_S3_ENDPOINT` | Yes | Cloudflare R2 / S3 Endpoint | From Sevalla dashboard |
| `SEVALLA_S3_ACCESS_KEY_ID`| Yes | S3 Access Key | From Sevalla dashboard |
| `SEVALLA_S3_SECRET_ACCESS_KEY`| Yes | S3 Secret Access Key | From Sevalla dashboard |
| `SEVALLA_S3_BUCKET_NAME` | Yes | S3 Storage Bucket name | `audio-storage-5d8o0` |
| `SEVALLA_S3_REGION` | Yes | S3 Region | `auto` |
| `OPENROUTER_API_KEY` | Yes | OpenRouter API Key | Kept secure |
| `GOOGLE_ADK_API_KEY` | Yes | Google Gemini ADK API Key | Kept secure |
| `GOOGLE_ADK_MODEL` | Yes | Gemini Model version | `gemini-3.5-flash` |

---

## ⚡ Post-Deployment Verifications

Once deployed, run these checks to ensure everything is functioning correctly:

1. **Service Health Check**:
   Send a request to `<backend_url>/api/health`:
   * **Expected Status**: `200 OK`
   * **Expected JSON Body**: `{ "success": true, "data": { ... } }` and validation that PostgreSQL queries work.
2. **CORS Validation**:
   * Open the browser console on your frontend.
   * Attempt a API request to the backend. Make sure no CORS errors appear.
3. **Google Calendar OAuth Verification**:
   * Ensure `GOOGLE_REDIRECT_URI` is added inside the **Google Cloud Console (Credentials -> Authorized redirect URIs)**. It must match your backend URL path `/api/v1/integrations/google/callback`.
   * Test the connection flow inside the Keil-App dashboard to verify the integration successfully completes.
4. **WebSocket/Socket.io Check**:
   * Ensure that real-time notifications or chat works. 
   * *If using multiple Container scale nodes (> 1), make sure **Session Affinity** is enabled in the Lightsail Container Service settings to keep WebSocket connections pinned to the same container instance.*

---

## 🤖 Continuous Deployment via GitHub Actions (VPS)

If you chose **Path B (Linux VPS Instance)**, manually logging in via SSH and running git commands every time you push code is slow and error-prone. Instead, you can automate this using **GitHub Actions**.

### How It Works
```mermaid
sequenceDiagram
    participant Dev as Developer
    participant GH as GitHub Repository
    participant GHA as GitHub Actions Runner
    participant VPS as Lightsail VPS Instance

    Dev->>GH: Push changes to `main` branch
    GH->>GHA: Trigger deployment workflow
    GHA->>GHA: Checkout code & Validate
    GHA->>VPS: Connect via SSH (using Private Key)
    GHA->>VPS: Execute deployment commands:
    Note over VPS: 1. Pull latest code<br/>2. Install production dependencies<br/>3. Compile TypeScript to JS<br/>4. Restart PM2 process
    VPS-->>GHA: Deployment complete / Success
```

---

### Step 1: Give VPS Access to Your Private GitHub Repo
If your repository is **private**, your VPS will need permission to pull code from GitHub. The most secure way is to use a **GitHub Deploy Key**:

1. **Generate an SSH key on your VPS**:
   Log in to your VPS via SSH and run:
   ```bash
   ssh-keygen -t ed25519 -C "lightsail-vps-deploy-key"
   # Press Enter to save in the default location (/home/ubuntu/.ssh/id_ed25519)
   # Leave passphrase empty
   ```
2. **Get the Public Key**:
   Print and copy the generated public key:
   ```bash
   cat ~/.ssh/id_ed25519.pub
   ```
3. **Add Deploy Key in GitHub**:
   * In your GitHub Repository, go to **Settings > Deploy keys**.
   * Click **Add deploy key**.
   * Title it `Lightsail VPS Deploy Key`.
   * Paste the public key you copied.
   * *Do not check "Allow write access"* (read-only is safer).
   * Click **Add key**.
4. **Test the Connection**:
   On your VPS, run:
   ```bash
   ssh -T git@github.com
   ```
   *Accept the fingerprint prompt (`yes`). You should see: "Hi <username>/<repo>! You've successfully authenticated..."*

---

### Step 2: Configure GitHub Repository Secrets
Store your server credentials securely inside GitHub. Go to your GitHub repository **Settings > Secrets and variables > Actions** and add three new **Repository secrets**:

1. `SSH_HOST`: The **Static IP** of your Lightsail instance.
2. `SSH_USERNAME`: Your login username (typically `ubuntu` for Ubuntu OS).
3. `SSH_KEY`: The entire content of the **private key** used to SSH into your instance.
   * If you are using AWS's default key pair, copy the content of your `.pem` file.
   * If you want to use the key generated in Step 1, copy `cat ~/.ssh/id_ed25519` from the VPS.
   * *Make sure to include the `-----BEGIN OPENSSH PRIVATE KEY-----` and `-----END OPENSSH PRIVATE KEY-----` lines.*

---

### Step 3: Create the Workflow File
Create a new file in your local repository at `.github/workflows/deploy-backend.yml` and add the following content:

```yaml
name: Deploy Backend to Lightsail

on:
  push:
    branches:
      - main  # Change to your default branch if it is different (e.g., 'master' or 'production')
    paths:
      - 'backend/**' # Only trigger if files under the backend folder change
      - '.github/workflows/deploy-backend.yml'

jobs:
  deploy:
    name: Deploy to Lightsail VPS
    runs-on: ubuntu-latest

    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Execute Remote SSH Commands
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.SSH_HOST }}
          username: ${{ secrets.SSH_USERNAME }}
          key: ${{ secrets.SSH_KEY }}
          port: 22
          timeout: 40s
          script: |
            echo "🚀 Connecting to Lightsail VPS..."
            
            # 1. Navigate to backend project directory
            cd /var/www/keil-app/backend || { echo "Directory not found!"; exit 1; }
            
            # 2. Reset any local changes and pull latest main branch
            echo "📥 Fetching latest code from GitHub..."
            git fetch --all
            git reset --hard origin/main
            
            # 3. Install dependencies
            echo "📦 Installing npm dependencies..."
            npm ci
            
            # 4. Compile TypeScript source code
            echo "🔨 Compiling TypeScript code..."
            npm run build
            
            # 5. Restart application process under PM2
            echo "🔄 Restarting Express server with PM2..."
            pm2 restart keil-backend || pm2 start dist/index.js --name "keil-backend"
            
            echo "✅ Deployment completed successfully!"
```

---

### Step 4: Secure Folder Permissions on the VPS
To ensure the GitHub Actions runner doesn't fail due to `Permission denied` when pulling code or compiling, make sure your SSH user (`ubuntu`) owns the application directory:

```bash
# Transfer ownership of the directory to the ubuntu user
sudo chown -R ubuntu:ubuntu /var/www/keil-app
```

Now, every time you run `git push origin main`, GitHub will build, connect to your Lightsail VPS, pull down the fresh updates, re-compile the TS files, and cleanly restart your Express API!

