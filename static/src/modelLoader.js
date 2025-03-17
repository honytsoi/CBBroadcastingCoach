// Model loader functionality for fetching and populating model selection

import { configState } from './config.js';

/**
 * Fetch models from the backend API and populate the select dropdown
 */
export async function loadModels() {
  const select = document.getElementById('aiModel');
  
  try {
    // Fetch models from the backend
    const response = await fetch('/api/get-models');
    if (!response.ok) throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);
    
    const models = await response.json();
    
    // Clear loading option
    select.innerHTML = '';
    
    // Populate with models
    models.forEach(model => {
      const option = document.createElement('option');
      option.value = model.id;
      option.textContent = `${model.name} (${model.description})`;
      select.appendChild(option);
    });
    
    // Store models for future reference
    window.availableAIModels = models;
    
    // Set default model (first in the list if no other specified)
    const defaultModel = models.length > 0 ? models[0].id : null;
    
    // Set selection based on saved config or default
    const savedModel = configState.config.aiModel || defaultModel;
    
    // If the saved model is in the list, select it
    const modelExists = Array.from(select.options).some(option => option.value === savedModel);
    select.value = modelExists ? savedModel : defaultModel;
    
    // Update config if model doesn't exist
    if (!modelExists && savedModel !== defaultModel) {
      configState.config.aiModel = defaultModel;
      localStorage.setItem('chatCoachConfig', JSON.stringify(configState.config));
    }
    
    return models;
  } catch (error) {
    console.error('Error loading models:', error);
    
    // Show error in select
    select.innerHTML = '<option value="error">Error loading models</option>';
    
    // Fallback to first model if available
    if (select.options.length > 0) {
      select.innerHTML = '<option value="error">Error loading models - using fallback</option>';
      configState.config.aiModel = '@cf/meta/llama-3.2-1b-instruct'; // Hardcoded fallback
    }
    
    return null;
  }
}
