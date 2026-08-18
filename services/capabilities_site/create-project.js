// Create New Project – Dynamic Stepper Logic
// This script handles:
/// - Type selection and dynamic configuration steps
/// - Form state persistence across steps
/// - Drag-and-drop file upload
/// - Simple AI Assistant integration
/// - Validation and review summarization

const STORAGE_KEY = 'aisena-create-project-state';

// Helper: Save form state to localStorage
function saveState() {
  const state = {
    type: window.selectedType,
    name: document.getElementById('project-name').value,
    description: document.getElementById('project-description').value,
    owner: document.getElementById('project-owner').value,
    visibility: document.getElementById('project-visibility').value,
    config: getConfigState(),
    enterprise: getEnterpriseState(),
    deployment: getDeploymentState(),
    uploadedFiles: Array.from(document.querySelectorAll('.upload-zone .chip')).map(c => c.textContent.trim()),
    chatHistory: getChatHistory()
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// Helper: Load form state from localStorage
function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return;
  const state = JSON.parse(saved);
  window.selectedType = state.type;
  if (state.type) {
    selectType(state.type);
  }
  // Populate basic fields
  document.getElementById('project-name').value = state.name || '';
  document.getElementById('project-description').value = state.description || '';
  document.getElementById('project-owner').value = state.owner || 'Current User';
  document.getElementById('project-visibility').value = state.visibility || 'Private';
  // Restore uploaded files
  const zone = document.getElementById('upload-zone');
  zone.innerHTML = '';
  state.uploadedFiles.forEach(fname => {
    const card = document.createElement('div');
    card.className = 'chip';
    card.textContent = fname;
    const remove = document.createElement('span');
    remove.textContent = '✕';
    remove.style.cursor = 'pointer';
    remove.addEventListener('click', () => {
      card.remove();
    });
    card.appendChild(remove);
    zone.appendChild(card);
  });
  // Restore chat history
  if (state.chatHistory) {
    const msgs = document.getElementById('chat-messages');
    msgs.innerHTML = '';
    state.chatHistory.forEach(m => {
      const li = document.createElement('li');
      li.textContent = m;
      msgs.appendChild(li);
    });
  }
}

// Helper: Update type selection UI
function selectType(type) {
  document.querySelectorAll('.card').forEach(c => {
    c.classList.remove('selected');
    if (c.dataset.type === type) c.classList.add('selected');
  });
  // Show appropriate configuration step
  showConfigForType(type);
}

// Helper: Show configuration fields based on type
function showConfigForType(type) {
  // Hide all config sections
  document.querySelectorAll('#config-choices > *').forEach(el => el.style.display = 'none');
  // Show the correct section
  switch (type) {
    case 'web_app':
      document.getElementById('config-webapp').style.display = 'block';
      break;
    case 'website':
      document.getElementById('config-website').style.display = 'block';
      break;
    case 'portal':
      document.getElementById('config-portal').style.display = 'block';
      break;
  }
}

// Helper: Gather config state
function getConfigState() {
  return {
    framework: document.getElementById('framework')?.value || '',
    authRequired: document.getElementById('auth-required')?.checked || false,
    authProvider: document.getElementById('auth-provider')?.value || '',
    dataLayer: document.getElementById('data-layer')?.value || '',
    template: document.getElementById('template')?.value || ''
  };
}

// Helper: Gather enterprise state
function getEnterpriseState() {
  return {
    databaseEnabled: document.getElementById('db-enable')?.value === 'On',
    databaseType: document.getElementById('db-type')?.value || '',
    databaseHosting: document.getElementById('db-hosting')?.value || '',
    searchEnabled: document.getElementById('search-enable')?.value === 'On',
    searchEngine: document.getElementById('search-engine')?.value || '',
    searchScope: document.getElementById('search-scope')?.value || [],
    features: {
      sso: document.getElementById('feature-sso')?.checked || false,
      rbac: document.getElementById('feature-rbac')?.checked || false,
      mfa: document.getElementById('feature-mfa')?.checked || false,
      backups: document.getElementById('feature-backups')?.checked || false
    }
  };
}

// Helper: Gather deployment state
function getDeploymentState() {
  return {
    targets: Array.from(document.querySelectorAll('.deployment-card.selected')).map(c => c.dataset.target),
    docker: getDockerConfig(),
    executable: getExecutableConfig(),
    cloud: getCloudConfig()
  };
}

// Helper: Docker config
function getDockerConfig() {
  return {
    baseImage: document.getElementById('docker-base-image')?.value || 'node:20-alpine',
    exposedPort: document.getElementById('docker-port')?.value || 3000,
    includeCompose: document.getElementById('docker-compose')?.checked || false,
    registry: document.getElementById('docker-registry')?.value || 'none'
  };
}

// Helper: Executable config
function getExecutableConfig() {
  return {
    targetOS: Array.from(document.querySelectorAll('input[name="executable-os"]:checked')).map(c => c.value),
    packagingTool: document.getElementById('executable-packaging')?.value || 'electron',
    autoUpdate: document.getElementById('executable-auto-update')?.checked || false,
    codeSigning: document.getElementById('executable-codesign')?.checked || false
  };
}

// Helper: Cloud config
function getCloudConfig() {
  return {
    provider: document.getElementById('cloud-provider')?.value || '',
    region: document.getElementById('cloud-region')?.value || '',
    environment: document.getElementById('cloud-env')?.value || 'development',
    autoDeploy: document.getElementById('cloud-autodeploy')?.checked || false
  };
}

// Helper: Chat history
function getChatHistory() {
  const msgs = document.querySelectorAll('#chat-messages li');
  return Array.from(msgs).map(li => li.textContent);
}

// Type card click handler
document.querySelectorAll('.card').forEach(card => {
  card.addEventListener('click', () => {
    // Remove selection from all cards
    document.querySelectorAll('.card').forEach(c => c.classList.remove('selected'));
    // Add selection to clicked card
    card.classList.add('selected');
    // Store selected type globally
    window.selectedType = card.dataset.type;
    // Persist state
    saveState();
    // Show next step
    showStep(1);
  });
});

// Back/Next button handlers with state persistence
document.querySelectorAll('.next').forEach(btn => {
  btn.addEventListener('click', () => {
    saveState(); // Save before moving forward
  });
});
document.querySelectorAll('.back').forEach(btn => {
  btn.addEventListener('click', () => {
    saveState(); // Save before moving back
  });
});

// File upload handlers (same as in HTML)
const uploadZone = document.getElementById('upload-zone');
const fileInput = document.getElementById('file-upload');
let uploadedFiles = [];

uploadZone.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
  const files = Array.from(e.target.files);
  handleFiles(files);
  fileInput.value = '';
});

uploadZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadZone.classList.add('highlight');
});
uploadZone.addEventListener('dragleave', (e) => {
  e.preventDefault();
  uploadZone.classList.remove('highlight');
});
uploadZone.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadZone.classList.remove('highlight');
  const files = Array.from(e.dataTransfer.files);
  handleFiles(files);
});

function handleFiles(files) {
  for (const file of files) {
    if (file.size > 25 * 1024 * 1024) {
      alert(`File ${file.name} exceeds the 25MB limit.`);
      continue;
    }
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'text/csv', '.png', '.jpg', '.jpeg'];
    const ext = file.name.toLowerCase().split('.').pop();
    if (!allowedTypes.includes(ext) && !allowedTypes.includes(file.type)) {
      alert(`File type ${file.type} is not supported.`);
      continue;
    }
    uploadedFiles.push(file);
    displayFileCard(file);
  }
}

function displayFileCard(file) {
  const card = document.createElement('div');
  card.className = 'chip';
  card.textContent = file.name;
  const remove = document.createElement('span');
  remove.textContent = '✕';
  remove.style.cursor = 'pointer';
  remove.addEventListener('click', () => {
    card.remove();
    uploadedFiles = uploadedFiles.filter(f => f !== file);
  });
  card.appendChild(remove);
  document.getElementById('upload-zone').appendChild(card);
}

// Chat assistant logic
const chatPanel = document.querySelector('.chat-panel');
const chatToggle = document.createElement('button');
chatToggle.textContent = '💬';
chatToggle.style.position = 'fixed';
chatToggle.style.bottom = '20px';
chatToggle.style.right = '20px';
chatToggle.style.padding = '10px';
chatToggle.style.background = '#4caf50';
chatToggle.style.color = 'white';
chatToggle.style.border = 'none';
chatToggle.style.borderRadius = '4px';
chatToggle.style.cursor = 'pointer';
document.body.appendChild(chatToggle);

chatToggle.addEventListener('click', () => {
  chatPanel.style.display = chatPanel.style.display === 'flex' ? 'none' : 'flex';
});

const messages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const chatSend = document.getElementById('chat-send');

chatSend.addEventListener('click', sendMessage);
chatInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendMessage();
});

function sendMessage() {
  const text = chatInput.value.trim();
  if (!text) return;
  const li = document.createElement('li');
  li.textContent = `You: ${text}`;
  messages.appendChild(li);
  chatInput.value = '';
  // Simulate assistant response
  setTimeout(() => {
    const resp = document.createElement('li');
    resp.innerHTML = `<strong>Assistant:</strong> Thank you for your message. For now, this is a mock assistant.`;
    messages.appendChild(resp);
  }, 500);
}

// Review & Create final submission
document.getElementById('create-btn').addEventListener('click', () => {
  // Gather final payload
  const payload = {
    type: window.selectedType,
    name: document.getElementById('project-name').value,
    description: document.getElementById('project-description').value,
    owner: document.getElementById('project-owner').value,
    visibility: document.getElementById('project-visibility').value,
    config: getConfigState(),
    enterprise: getEnterpriseState(),
    deployment: getDeploymentState(),
    uploadedFiles: uploadedFiles.map(f => ({ fileName: f.name, sizeBytes: 0, fileType: f.type, uploadStatus: 'ready' }))
  };
  // Persist payload
  localStorage.setItem('aisena-create-project-payload', JSON.stringify(payload));
  // Show confirmation
  alert('Project created! (mock)');
  // In a real app, you would POST to an API endpoint here.
});

// Load saved state on page load
window.addEventListener('load', () => {
  loadState();
});