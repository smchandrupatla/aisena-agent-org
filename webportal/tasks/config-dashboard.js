// Configuration Dashboard JavaScript
// Handles rendering and interaction for the configuration management UI

const API_BASE = window.API_BASE_OVERRIDE || '';
const CONFIG_ENDPOINT = `${API_BASE}/api/config`;

let configData = {};
let defaultConfigData = {}; // Store default config for resets

async function loadConfig() {
  try {
    const response = await fetch(CONFIG_ENDPOINT);
    if (!response.ok) throw new Error('Network response was not ok');
    const data = await response.json();
    configData = data;
    defaultConfigData = JSON.parse(JSON.stringify(data)); // Save defaults
    renderConfig();
  } catch (error) {
    console.error('Error loading config:', error);
    showNotification('Failed to load configuration', 'error');
  }
}

// Validation helper for numeric fields
function isPositiveInteger(value) {
  return value !== '' && value !== null && Number.isInteger(Number(value)) && Number(value) > 0;
}

// Reset a section to its default values
function resetSection(section) {
  // Reset General section
  if (section === 'general') {
    document.getElementById('appName')?.value = defaultConfigData.configurations[0]?.name || '';
    document.getElementById('appDescription')?.value = defaultConfigData.configurations[0]?.description || '';
  }
  // Reset Features section
  if (section === 'features') {
    document.getElementById('featureFlag')?.checked = defaultConfigData.configurations[0]?.settings?.featureFlag || false;
    document.getElementById('maxItems')?.value = defaultConfigData.configurations[0]?.settings?.maxItems || '';
    document.getElementById('timeoutSeconds')?.value = defaultConfigData.configurations[0]?.settings?.timeoutSeconds || '';
  }
  // Reset Performance section
  if (section === 'performance') {
    document.getElementById('maxConcurrent')?.value = defaultConfigData.configurations[1]?.settings?.maxItems || '';
    document.getElementById('cacheTTL')?.value = defaultConfigData.configurations[1]?.settings?.timeoutSeconds || '';
  }
  // Reset Security section
  if (section === 'security') {
    document.getElementById('requireAuth')?.checked = defaultConfigData.configurations[1]?.settings?.featureFlag || false;
    document.getElementById('rateLimit')?.value = defaultConfigData.configurations[1]?.settings?.maxItems || '';
  }
}

// Render each configuration section
function renderConfig() {
  // Populate navigation tabs
  const navItems = document.querySelectorAll('.config-nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      navItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      const sectionId = item.getAttribute('data-section');
      document.querySelectorAll('.config-section').forEach(section => {
        section.classList.remove('active');
        if (section.id === `${sectionId}-section`) {
          section.classList.add('active');
        }
      });
    });
  });

  // Render each configuration section
  const sections = ['general', 'features', 'performance', 'security'];
  const sectionMap = {
    general: 'General Settings',
    features: 'Feature Flags',
    performance: 'Performance',
    security: 'Security'
  };

  sections.forEach(section => {
    const sectionEl = document.getElementById(`${section}-section`);
    if (!sectionEl) return;

    const title = sectionMap[section] || section;
    sectionEl.innerHTML = `<h2>${title}</h2>`;

    const cardGrid = document.createElement('div');
    cardGrid.className = 'config-card-grid';

    // Create config cards based on section
    switch (section) {
      case 'general':
        createGeneralCard(cardGrid);
        break;
      case 'features':
        createFeaturesCard(cardGrid);
        break;
      case 'performance':
        createPerformanceCard(cardGrid);
        break;
      case 'security':
        createSecurityCard(cardGrid);
        break;
    }

    sectionEl.appendChild(cardGrid);
  });

  // Add Export & Import buttons to the nav container
  const navButtonsContainer = document.getElementById('configNavButtons');
  if (navButtonsContainer) {
    // Export button
    const exportButton = document.createElement('button');
    exportButton.id = 'export-config';
    exportButton.className = 'config-button';
    exportButton.textContent = 'Export Configuration';
    exportButton.addEventListener('click', exportProfiles);
    navButtonsContainer.appendChild(exportButton);

    // Import button
    const importButton = document.createElement('button');
    importButton.id = 'import-config';
    importButton.className = 'config-button';
    importButton.textContent = 'Import Configuration';
    importButton.addEventListener('click', () => {
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = '.json';
      fileInput.onchange = (event) => importProfiles(event);
      fileInput.click();
    });
    navButtonsContainer.appendChild(importButton);
  }
}

// Button click handlers for bulk operations
function exportProfiles() {
  const json = JSON.stringify(configData, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'config-export.json';
  a.click();
  URL.revokeObjectURL(url);
}

function importProfiles(event) {
  const input = event.target;
  if (!input.files || input.files.length === 0) return;
  const file = input.files[0];
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const imported = JSON.parse(e.target.result);
      if (imported && imported.configurations) {
        configData = imported;
        defaultConfigData = JSON.parse(JSON.stringify(imported));
        renderConfig();
        showNotification('Configuration imported successfully', 'success');
      } else {
        showNotification('Invalid configuration format', 'error');
      }
    } catch (err) {
      showNotification('Failed to parse JSON', 'error');
    }
  };
  reader.readAsText(file);
}

// Create a general configuration card with Save and Reset buttons
function createGeneralCard(container) {
  const card = document.createElement('div');
  card.className = 'config-metric-card';
  card.innerHTML = `
    <h4>Application Info</h4>
    <div class="config-form-group">
      <label class="config-form-label">Application Name</label>
      <input type="text" class="config-form-input" id="appName" value="${configData.configurations[0]?.name || ''}">
    </div>
    <div class="config-form-group">
      <label class="config-form-label">Description</label>
      <input type="text" class="config-form-input" id="appDescription" value="${configData.configurations[0]?.description || ''}">
    </div>
  `;
  container.appendChild(card);

  // Add Save and Reset buttons
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'config-button-container';
  const saveButton = document.createElement('button');
  saveButton.className = 'config-button config-button-secondary';
  saveButton.textContent = 'Save';
  saveButton.dataset.section = 'general';
  saveButton.addEventListener('click', (e) => {
    e.stopPropagation();
    if (validateSection('general')) saveConfig('general');
  });
  const resetButton = document.createElement('button');
  resetButton.className = 'config-button config-button-secondary';
  resetButton.textContent = 'Reset';
  resetButton.dataset.section = 'general';
  resetButton.addEventListener('click', (e) => {
    e.stopPropagation();
    resetSection('general');
  });
  buttonContainer.appendChild(saveButton);
  buttonContainer.appendChild(resetButton);
  card.appendChild(buttonContainer);
}

// Create a features configuration card with Save and Reset buttons
function createFeaturesCard(container) {
  const card = document.createElement('div');
  card.className = 'config-metric-card';
  card.innerHTML = `
    <h4>Feature Controls</h4>
    <div class="config-form-group">
      <label class="config-form-label">Enable Feature Flag</label>
      <input type="checkbox" class="config-form-input" id="featureFlag" ${configData.configurations[0]?.settings?.featureFlag ? 'checked' : ''}>
    </div>
    <div class="config-form-group">
      <label class="config-form-label">Max Items</label>
      <input type="number" class="config-form-input" id="maxItems" value="${configData.configurations[0]?.settings?.maxItems || ''}">
    </div>
    <div class="config-form-group">
      <label class="config-form-label">Timeout (seconds)</label>
      <input type="number" class="config-form-input" id="timeoutSeconds" value="${configData.configurations[0]?.settings?.timeoutSeconds || ''}">
    </div>
  `;
  container.appendChild(card);

  // Add Save and Reset buttons
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'config-button-container';
  const saveButton = document.createElement('button');
  saveButton.className = 'config-button config-button-secondary';
  saveButton.textContent = 'Save';
  saveButton.dataset.section = 'features';
  saveButton.addEventListener('click', (e) => {
    e.stopPropagation();
    if (validateSection('features')) saveConfig('features');
  });
  const resetButton = document.createElement('button');
  resetButton.className = 'config-button config-button-secondary';
  resetButton.textContent = 'Reset';
  resetButton.dataset.section = 'features';
  resetButton.addEventListener('click', (e) => {
    e.stopPropagation();
    resetSection('features');
  });
  buttonContainer.appendChild(saveButton);
  buttonContainer.appendChild(resetButton);
  card.appendChild(buttonContainer);
}

// Create a performance configuration card with Save and Reset buttons
function createPerformanceCard(container) {
  const card = document.createElement('div');
  card.className = 'config-metric-card';
  card.innerHTML = `
    <h4>Performance Settings</h4>
    <div class="config-form-group">
      <label class="config-form-label">Max Concurrent Requests</label>
      <input type="number" class="config-form-input" id="maxConcurrent" value="${configData.configurations[1]?.settings?.maxItems || ''}">
    </div>
    <div class="config-form-group">
      <label class="config-form-label">Response Cache TTL (seconds)</label>
      <input type="number" class="config-form-input" id="cacheTTL" value="${configData.configurations[1]?.settings?.timeoutSeconds || ''}">
    </div>
  `;
  container.appendChild(card);

  // Add Save and Reset buttons
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'config-button-container';
  const saveButton = document.createElement('button');
  saveButton.className = 'config-button config-button-secondary';
  saveButton.textContent = 'Save';
  saveButton.dataset.section = 'performance';
  saveButton.addEventListener('click', (e) => {
    e.stopPropagation();
    if (validateSection('performance')) saveConfig('performance');
  });
  const resetButton = document.createElement('button');
  resetButton.className = 'config-button config-button-secondary';
  resetButton.textContent = 'Reset';
  resetButton.dataset.section = 'performance';
  resetButton.addEventListener('click', (e) => {
    e.stopPropagation();
    resetSection('performance');
  });
  buttonContainer.appendChild(saveButton);
  buttonContainer.appendChild(resetButton);
  card.appendChild(buttonContainer);
}

// Create a security configuration card with Save and Reset buttons
function createSecurityCard(container) {
  const card = document.createElement('div');
  card.className = 'config-metric-card';
  card.innerHTML = `
    <h4>Security Settings</h4>
    <div class="config-form-group">
      <label class="config-form-label">Require Authentication</label>
      <input type="checkbox" class="config-form-input" id="requireAuth" ${configData.configurations[1]?.settings?.featureFlag ? 'checked' : ''}>
    </div>
    <div class="config-form-group">
      <label class="config-form-label">Rate Limit (requests/minute)</label>
      <input type="number" class="config-form-input" id="rateLimit" value="${configData.configurations[1]?.settings?.maxItems || ''}">
    </div>
  `;
  container.appendChild(card);

  // Add Save and Reset buttons
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'config-button-container';
  const saveButton = document.createElement('button');
  saveButton.className = 'config-button config-button-secondary';
  saveButton.textContent = 'Save';
  saveButton.dataset.section = 'security';
  saveButton.addEventListener('click', (e) => {
    e.stopPropagation();
    if (validateSection('security')) saveConfig('security');
  });
  const resetButton = document.createElement('button');
  resetButton.className = 'config-button config-button-secondary';
  resetButton.textContent = 'Reset';
  resetButton.dataset.section = 'security';
  resetButton.addEventListener('click', (e) => {
    e.stopPropagation();
    resetSection('security');
  });
  buttonContainer.appendChild(saveButton);
  buttonContainer.appendChild(resetButton);
  card.appendChild(buttonContainer);
}

// Validate numeric inputs for a given section before saving
function validateSection(section) {
  // Validate maxItems, timeoutSeconds, etc. based on section
  const errors = [];

  if (section === 'features' || section === 'performance' || section === 'security') {
    const maxItems = document.getElementById('maxItems')?.value;
    if (!isPositiveInteger(maxItems)) errors.push('Max Items must be a positive integer');
    const timeoutSeconds = document.getElementById('timeoutSeconds')?.value;
    if (!isPositiveInteger(timeoutSeconds)) errors.push('Timeout must be a positive integer');
    if (section === 'performance') {
      const maxConcurrent = document.getElementById('maxConcurrent')?.value;
      if (!isPositiveInteger(maxConcurrent)) errors.push('Max Concurrent Requests must be a positive integer');
    }
    if (section === 'security') {
      const rateLimit = document.getElementById('rateLimit')?.value;
      if (!isPositiveInteger(rateLimit)) errors.push('Rate Limit must be a positive integer');
    }
  }

  if (errors.length > 0) {
    showNotification(errors.join(' • '), 'error');
    return false;
  }
  return true;
}

// Save configuration for a specific section
function saveConfig(section) {
  // Gather updated values from inputs
  const formData = new FormData();
  const inputs = document.querySelectorAll('.config-form-input');
  inputs.forEach(input => {
    const id = input.id;
    const value = input.type === 'checkbox' ? input.checked : input.value;
    formData.set(id, value);
  });

  // Construct updated config payload
  const updatedConfig = {
    configurations: [
      {
        ...configData.configurations[0],
        name: document.getElementById('appName')?.value || configData.configurations[0]?.name,
        description: document.getElementById('appDescription')?.value || configData.configurations[0]?.description,
        settings: {
          ...configData.configurations[0]?.settings,
          featureFlag: document.getElementById('featureFlag')?.checked,
          maxItems: parseInt(document.getElementById('maxItems')?.value || '10'),
          timeoutSeconds: parseInt(document.getElementById('timeoutSeconds')?.value || '30')
        }
      },
      {
        ...configData.configurations[1],
        settings: {
          ...configData.configurations[1]?.settings,
          maxItems: parseInt(document.getElementById('maxItems')?.value || '5'),
          timeoutSeconds: parseInt(document.getElementById('timeoutSeconds')?.value || '60')
        }
      }
    ]
  };

  // Send update request
  fetch(CONFIG_ENDPOINT, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updatedConfig)
  })
  .then(response => {
    if (!response.ok) throw new Error('Failed to save configuration');
    return response.json();
  })
  .then(() => {
    showNotification('Configuration saved successfully', 'success');
  })
  .catch(err => {
    console.error('Save config error:', err);
    showNotification('Failed to save configuration', 'error');
  });
}

// Notification helper (assumes existing showNotification function)
function showNotification(message, type) {
  // Implementation would go here if not provided by environment
  console.log(`${type}: ${message}`);
}

// Initialize the GUI
document.addEventListener('DOMContentLoaded', () => {
  loadConfig();
  
  // Add save event listeners
  const saveButtons = document.querySelectorAll('.config-save-button');
  saveButtons.forEach(button => {
    button.addEventListener('click', () => {
      const section = button.getAttribute('data-section');
      if (validateSection(section)) saveConfig(section);
    });
  });
});