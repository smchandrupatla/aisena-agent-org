// Configuration Dashboard JavaScript
// Handles rendering and interaction for the configuration management UI

const API_BASE = window.API_BASE_OVERRIDE || '';
const CONFIG_ENDPOINT = `${API_BASE}/api/config`;

let configData = {};

async function loadConfig() {
  try {
    const response = await fetch(CONFIG_ENDPOINT);
    if (!response.ok) throw new Error('Network response was not ok');
    const data = await response.json();
    configData = data;
    renderConfig();
  } catch (error) {
    console.error('Error loading config:', error);
    showNotification('Failed to load configuration', 'error');
  }
}

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
}

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
}

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
}

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
}

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
}

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

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  loadConfig();
  
  // Add save event listeners
  const saveButtons = document.querySelectorAll('.config-save-button');
  saveButtons.forEach(button => {
    button.addEventListener('click', () => {
      const section = button.getAttribute('data-section');
      saveConfig(section);
    });
  });
});