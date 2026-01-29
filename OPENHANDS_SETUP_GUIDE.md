# OpenHands AI — Server Setup Guide

Complete guide for installing and running OpenHands AI on your server.

---

## 1. Prerequisites

### System Requirements

- **OS**: Linux (Ubuntu 22.04+ recommended), macOS, or Windows (WSL2)
- **RAM**: Minimum 4 GB (8 GB+ recommended)
- **Docker**: Required for all installation methods
- **Python**: 3.12 or higher (for pip/uv install methods)

### Install Docker (Linux)

```bash
# Update packages
sudo apt update && sudo apt upgrade -y

# Install Docker
sudo apt install -y docker.io docker-compose

# Start and enable Docker
sudo systemctl start docker
sudo systemctl enable docker

# Add your user to the docker group (avoids needing sudo)
sudo usermod -aG docker $USER

# Log out and back in, then verify
docker --version
docker run hello-world
```

### Install Docker (macOS)

1. Download and install [Docker Desktop](https://www.docker.com/products/docker-desktop/)
2. Open Docker Desktop → Settings → Advanced
3. Enable **"Allow the default Docker socket to be used"**

### Install Docker (Windows / WSL2)

```powershell
# In PowerShell as Administrator
wsl --install -d Ubuntu
```

1. Restart your computer
2. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/)
3. In Docker Desktop → Settings → General: enable **"Use the WSL 2 based engine"**
4. In Settings → Resources → WSL Integration: enable **"Enable integration with my default WSL distro"**
5. Run all commands below from the **Ubuntu terminal**

---

## 2. Installation (Pick One Method)

### Method A — Using `uv` (Recommended)

`uv` is the recommended way because it isolates OpenHands from your system Python and is required for default MCP servers.

```bash
# Step 1: Install uv
curl -LsSf https://astral.sh/uv/install.sh | sh

# Reload your shell
source ~/.bashrc   # or ~/.zshrc

# Step 2: Install OpenHands
uv tool install openhands --python 3.12

# Step 3: Verify installation
openhands --version
```

**Upgrade later:**
```bash
uv tool upgrade openhands --python 3.12
```

### Method B — Using pip

```bash
# Make sure you have Python 3.12+
python3 --version

# Install OpenHands
pip install openhands-ai

# Verify
openhands --version
```

### Method C — Using Docker Directly

```bash
# Pull the latest stable image
docker pull docker.all-hands.dev/all-hands-ai/openhands:latest

# Run the container
docker run -it --rm \
  --pull=always \
  -e SANDBOX_RUNTIME_CONTAINER_IMAGE=docker.all-hands.dev/all-hands-ai/runtime:latest \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v ~/.openhands:/home/openhands/.openhands \
  -p 3000:3000 \
  docker.all-hands.dev/all-hands-ai/openhands:latest
```

> **Note**: For a specific version, replace `latest` with a version tag like `0.9`.

---

## 3. Running OpenHands

### If installed via uv or pip

```bash
# Launch the GUI server
openhands serve

# With GPU support (requires nvidia-docker)
openhands serve --gpu

# Mount current working directory into the agent's workspace
openhands serve --mount-cwd
```

### If running via Docker

Use the `docker run` command from Method C above. The server starts automatically.

### Access the GUI

Open your browser and go to:

```
http://localhost:3000
```

Or if running on a remote server:

```
http://<your-server-ip>:3000
```

---

## 4. Configuration

On first launch, OpenHands will show a settings popup. You need to configure:

### LLM Provider Setup

1. **Select your LLM provider**: Anthropic (Claude), OpenAI (GPT), Google (Gemini), or a local LLM
2. **Enter your API key** from your chosen provider
3. **Select a model** (e.g., `claude-sonnet-4-20250514`, `gpt-4o`, etc.)

Example API keys you'll need (pick one):

| Provider    | Get API Key From                        |
|-------------|----------------------------------------|
| Anthropic   | https://console.anthropic.com          |
| OpenAI      | https://platform.openai.com/api-keys   |
| Google      | https://aistudio.google.com/apikey     |

### Using a Local LLM (No API Key)

If you're running a local model (e.g., via Ollama or vLLM):

1. In Settings → Advanced Options, set your **Base URL** (e.g., `http://localhost:11434/v1` for Ollama)
2. Enter a dummy API key like `local-key`
3. Manually type in your model name

### Optional: Web Search

To enable the agent to search the web:

1. Get an API key from [tavily.com](https://tavily.com)
2. Go to Settings → LLM tab → **Search API Key (Tavily)**
3. Paste the key

---

## 5. Running on a Remote Server

### Basic: Run with nohup

```bash
# Run in background so it survives SSH disconnects
nohup openhands serve &> /var/log/openhands.log &

# Check if it's running
curl http://localhost:3000
```

### Better: Run as a systemd Service

Create a service file:

```bash
sudo tee /etc/systemd/system/openhands.service > /dev/null <<'EOF'
[Unit]
Description=OpenHands AI Server
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=your-username
ExecStart=/home/your-username/.local/bin/openhands serve
Restart=on-failure
RestartSec=10
Environment=HOME=/home/your-username

[Install]
WantedBy=multi-user.target
EOF
```

Then enable and start it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable openhands
sudo systemctl start openhands

# Check status
sudo systemctl status openhands

# View logs
journalctl -u openhands -f
```

### Using Nginx as Reverse Proxy (HTTPS)

```nginx
server {
    listen 80;
    server_name openhands.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name openhands.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/openhands.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/openhands.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Get a free SSL cert with:
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d openhands.yourdomain.com
```

---

## 6. Common Issues & Troubleshooting

### Docker socket permission denied

```
Error: permission denied while trying to connect to the Docker daemon socket
```

**Fix:**
```bash
sudo usermod -aG docker $USER
# Then log out and log back in
```

### Port 3000 already in use

```bash
# Find what's using port 3000
sudo lsof -i :3000

# Kill the process
sudo kill -9 <PID>

# Or run OpenHands on a different port (Docker method)
docker run ... -p 3001:3000 ...
```

### Container fails to start / sandbox errors

```bash
# Make sure Docker socket is mounted correctly
ls -la /var/run/docker.sock

# Ensure the Docker service is running
sudo systemctl status docker

# If Docker socket path differs, find it:
docker context inspect | grep Host
```

### OpenHands can't pull sandbox image

```bash
# Manually pull the runtime image first
docker pull docker.all-hands.dev/all-hands-ai/runtime:latest

# If behind a firewall/proxy, configure Docker proxy:
sudo mkdir -p /etc/systemd/system/docker.service.d
sudo tee /etc/systemd/system/docker.service.d/proxy.conf <<EOF
[Service]
Environment="HTTP_PROXY=http://proxy:port"
Environment="HTTPS_PROXY=http://proxy:port"
EOF
sudo systemctl daemon-reload
sudo systemctl restart docker
```

### Python version too old

```bash
# Check version
python3 --version

# If below 3.12, install a newer version
sudo add-apt-repository ppa:deadsnakes/ppa
sudo apt update
sudo apt install python3.12 python3.12-venv
```

### Agent runs out of memory

```bash
# Increase Docker memory limit
# Docker Desktop: Settings → Resources → Memory → set to 8GB+

# Linux: use --memory flag
docker run --memory=8g ...
```

### WebSocket connection drops (remote server)

If accessing from a remote browser and the connection keeps dropping, make sure your reverse proxy is configured to support WebSocket upgrades (see the Nginx config above — the `Upgrade` and `Connection` headers are critical).

---

## 7. Quick Reference

| Action                        | Command                                      |
|-------------------------------|----------------------------------------------|
| Install (uv)                  | `uv tool install openhands --python 3.12`    |
| Install (pip)                 | `pip install openhands-ai`                   |
| Start server                  | `openhands serve`                            |
| Start with GPU                | `openhands serve --gpu`                      |
| Mount workspace               | `openhands serve --mount-cwd`                |
| Upgrade                       | `uv tool upgrade openhands --python 3.12`    |
| Access GUI                    | `http://localhost:3000`                      |

---

## Sources

- [OpenHands Official Docs — Local Setup](https://docs.openhands.dev/openhands/usage/run-openhands/local-setup)
- [OpenHands GitHub Repository](https://github.com/OpenHands/OpenHands)
- [openhands-ai on PyPI](https://pypi.org/project/openhands-ai/)
