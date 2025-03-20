#!/bin/bash

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"  # This loads nvm

# Update package lists
sudo apt update


# Install essential tools
sudo apt install -y ffmpeg python3-pip qrencode libgtk-3-dev libnotify-dev libgconf-2-4 libnss3 libxss1 libasound2 git-lfs libgstreamer-plugins-bad1.0-0
# Install nvm (Node Version Manager)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Load nvm
export NVM_DIR="$([ -z "${XDG_CONFIG_HOME-}" ] && echo "$HOME" || echo "${XDG_CONFIG_HOME}")/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"  # This loads nvm

# Install Node.js (latest stable version)
nvm install --lts

# Use the latest LTS version
nvm use --lts

# Install npm packages globally
npm install -g --force wrangler @executeautomation/playwright-mcp-server
npm install wrangler --save-dev

# Install playwright
# playwright install
# Install uv
pip install uv

echo "Development environment setup complete!"

echo "Testing if it works: wrangler dev"
wrangler dev
