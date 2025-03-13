#!/bin/bash

# Navigate to the backend directory
cd "$(dirname "$0")"

# Install nvm if not already installed
if ! command -v nvm &> /dev/null; then
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.5/install.sh | bash
  export NVM_DIR="$([ -z "${XDG_CONFIG_HOME-}" ] && printf %s "${HOME}/.nvm" || printf %s "${XDG_CONFIG_HOME}/nvm")"
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
fi

# Install Node.js LTS
nvm install --lts
nvm use --lts

# Install Wrangler CLI
npm install -g wrangler

# Authenticate Wrangler
wrangler login

# Initialize Wrangler project
wrangler init

# Create necessary files
cat <<EOF > wrangler.toml
name = "cb-coach-backend"
main = "src/index.js"
compatibility_date = "2023-03-13"
EOF

mkdir -p src/middleware

cat <<EOF > src/index.js
// src/index.js
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/generate-prompt' && request.method === 'POST') {
      try {
        const body = await request.json();
        const context = body.context;
        const broadcaster = body.broadcaster;
        const preferences = body.preferences;

        const prompt = await generateCoachingPrompt(context, broadcaster, preferences);

        return new Response(JSON.stringify({
          prompt: prompt,
          model: "Cloudflare AI @cf/meta/llama-3-70b-instruct"
        }), {
          headers: { "Content-Type": "application/json" },
          status: 200
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          headers: { "Content-Type": "application/json" },
          status: 500
        });
      }
    }

    return new Response("Not Found", { status: 404 });
  }
};

async function generateCoachingPrompt(context, broadcaster, preferences) {
  return \`Engage with your audience, \${broadcaster}!\`;
}
EOF

cat <<EOF > src/ai.js
// src/ai.js
export async function generatePromptWithAI(context, broadcaster, preferences) {
  return \`Engage with your audience, \${broadcaster}!\`;
}
EOF

cat <<EOF > src/middleware/auth.js
// src/middleware/auth.js
export function authenticateRequest(request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response("Unauthorized", { status: 401 });
  }

  const token = authHeader.split(" ")[1];
  if (token !== "your-secret-token") {
    return new Response("Forbidden", { status: 403 });
  }

  return null;
}
EOF

# Install dependencies
npm install

echo "Setup complete! Run 'wrangler dev' to test locally or 'wrangler publish' to deploy."
