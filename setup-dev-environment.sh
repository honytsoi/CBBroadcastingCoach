#!/bin/bash

# Update package lists
sudo apt update

# Install essential tools
sudo apt install -y ffmpeg python3-pip qrencode libgtk-3-dev libnotify-dev libgconf-2-4 libnss3 libxss1 libasound2 git-lfs libgstreamer-plugins-bad1.0-0 libavif16

# Install nvm (Node Version Manager)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Load nvm
export NVM_DIR="$([ -z "${XDG_CONFIG_HOME-}" ] &amp;&amp; echo "$HOME" || echo "${XDG_CONFIG_HOME}")/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] &amp;&amp; \. "$NVM_DIR/nvm.sh"  # This loads nvm

# Install Node.js (latest stable version)
nvm install --lts

# Use the latest LTS version
nvm use --lts

# Install npm packages globally
npm install -g wrangler @cloudflare/wrangler@latest @executeautomation/playwright-mcp-server

# Install playwright
playwright install

# Install uv
pip install uv

echo "Development environment setup complete!"