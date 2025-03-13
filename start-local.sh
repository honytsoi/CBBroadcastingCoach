#!/bin/bash

echo "=== Starting Broadcasting Coach Worker ==="

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

# Run the worker locally
echo "Starting local development server..."
echo "The application will be available at http://localhost:8787"
echo "Static files are being served from the ./static directory"
wrangler dev
