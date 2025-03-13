// Simple Express server for development
const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = 8787;

// Serve static files from the root directory
app.use(express.static('./'));

// API endpoints
app.post('/api/get-session-key', (req, res) => {
  // A mocked version of the sessionKey API for local development
  const { username, broadcaster } = req.body;
  
  if (!username || !broadcaster) {
    return res.status(400).json({ error: 'Missing username or broadcaster name' });
  }
  
  // Generate a mock session key
  const sessionKey = `mock-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours from now
  
  res.json({
    sessionKey,
    expiresAt
  });
});

app.post('/api/generate-prompt', (req, res) => {
  // A mocked version of the AI prompt API for local development
  const { context, broadcaster, preferences } = req.body;
  
  if (!Array.isArray(context) || context.length === 0) {
    return res.status(400).json({ error: 'Invalid or missing context' });
  }
  
  if (!broadcaster) {
    return res.status(400).json({ error: 'Invalid or missing broadcaster' });
  }
  
  // Mock AI response
  const mockResponses = [
    { action: 'say', content: 'Thanks for the tip! What would you like to see next?' },
    { action: 'say', content: 'Tell me more about yourself, what brings you here today?' },
    { action: 'do', content: 'Show viewers your outfit with a quick spin' },
    { action: 'say', content: 'I appreciate all of you being here with me today!' }
  ];
  
  // Pick a random response
  const randomResponse = mockResponses[Math.floor(Math.random() * mockResponses.length)];
  
  // Generate a mock session key
  const sessionKey = `mock-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours from now
  
  res.json({
    ...randomResponse,
    sessionKey,
    expiresAt
  });
});

// Handle HTML5 history API for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
  console.log(`Open your browser to view the application`);
});
