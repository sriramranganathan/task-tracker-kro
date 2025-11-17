// ===================================
// State Management
// ===================================
const state = {
    tasks: [],
    config: {
        appTitle: 'Task Tracker',
        themeColor: '#0066cc',
        awsRegion: 'us-west-2'
    },
    loading: false,
    error: null
};

// ===================================
// DOM Elements
// ===================================
const elements = {
    taskForm: document.getElementById('task-form'),
    taskTitle: document.getElementById('task-title'),
    taskDescription: document.getElementById('task-description'),
    submitBtn: document.getElementById('submit-btn'),
    btnText: document.querySelector('.btn-text'),
    btnLoader: document.querySelector('.btn-loader'),
    taskList: document.getElementById('task-list'),
    loadingState: document.getElementById('loading-state'),
    emptyState: document.getElementById('empty-state'),
    errorMessage: document.getElementById('error-message'),
    taskCount: document.getElementById('task-count'),
    appTitle: document.getElementById('app-title'),
    pageTitle: document.getElementById('page-title'),
    regionBadge: document.getElementById('region-badge'),
    titleCharCount: document.getElementById('title-char-count'),
    descriptionCharCount: document.getElementById('description-char-count')
};

// ===================================
// API Functions
// ===================================

/**
 * Fetch all tasks from the API
 */
async function fetchTasks() {
    try {
        const response = await fetch('/api/tasks');
        if (!response.ok) {
            throw new Error(`Failed to fetch tasks: ${response.statusText}`);
        }
        const data = await response.json();
        return data.tasks || [];
    } catch (error) {
        console.error('Error fetching tasks:', error);
        throw error;
    }
}

/**
 * Create a new task
 */
async function createTask(title, description) {
    try {
        const response = await fetch('/api/tasks', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ title, description })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to create task');
        }
        
        const data = await response.json();
        return data.task;
    } catch (error) {
        console.error('Error creating task:', error);
        throw error;
    }
}

/**
 * Fetch configuration from the API
 * This enables dynamic UI updates via GitOps
 */
async function fetchConfig() {
    try {
        const response = await fetch('/api/config');
        if (!response.ok) {
            throw new Error('Failed to fetch config');
        }
        const config = await response.json();
        return config;
    } catch (error) {
        console.error('Error fetching config:', error);
        return null;
    }
}

// ===================================
// UI Rendering Functions
// ===================================

/**
 * Render all tasks to the DOM
 */
function renderTasks() {
    elements.taskList.innerHTML = '';
    
    if (state.tasks.length === 0) {
        elements.loadingState.style.display = 'none';
        elements.emptyState.style.display = 'block';
        elements.taskCount.textContent = '0 tasks';
        return;
    }
    
    elements.loadingState.style.display = 'none';
    elements.emptyState.style.display = 'none';
    elements.taskCount.textContent = `${state.tasks.length} task${state.tasks.length !== 1 ? 's' : ''}`;
    
    state.tasks.forEach(task => {
        const taskCard = createTaskCard(task);
        elements.taskList.appendChild(taskCard);
    });
}

/**
 * Create a task card element
 */
function createTaskCard(task) {
    const card = document.createElement('div');
    card.className = 'task-card';
    
    const createdDate = new Date(task.createdAt);
    const formattedDate = createdDate.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    card.innerHTML = `
        <div class="task-header">
            <h3 class="task-title">${escapeHtml(task.title)}</h3>
            <span class="task-status">${escapeHtml(task.status)}</span>
        </div>
        ${task.description ? `<p class="task-description">${escapeHtml(task.description)}</p>` : ''}
        <div class="task-meta">
            <span class="task-id">ID: ${escapeHtml(task.taskId.substring(0, 8))}</span>
            <span>•</span>
            <span>${formattedDate}</span>
        </div>
    `;
    
    return card;
}

/**
 * Apply configuration to the UI
 * This enables GitOps-driven UI changes
 */
function applyConfig(config) {
    if (!config) return;
    
    state.config = config;
    
    // Update app title
    if (config.appTitle) {
        elements.appTitle.textContent = config.appTitle;
        elements.pageTitle.textContent = config.appTitle;
    }
    
    // Update theme color
    if (config.themeColor) {
        document.documentElement.style.setProperty('--color-primary', config.themeColor);
        
        // Calculate darker shade for hover states
        const darkerColor = adjustColor(config.themeColor, -20);
        document.documentElement.style.setProperty('--color-primary-dark', darkerColor);
        
        // Calculate lighter shade
        const lighterColor = adjustColor(config.themeColor, 20);
        document.documentElement.style.setProperty('--color-primary-light', lighterColor);
    }
    
    // Update region badge
    if (config.awsRegion) {
        elements.regionBadge.textContent = `Region: ${config.awsRegion}`;
    }
}

/**
 * Show error message
 */
function showError(message) {
    elements.errorMessage.textContent = message;
    elements.errorMessage.style.display = 'block';
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        elements.errorMessage.style.display = 'none';
    }, 5000);
}

/**
 * Hide error message
 */
function hideError() {
    elements.errorMessage.style.display = 'none';
}

/**
 * Adjust color brightness
 * @param {string} color - Color in hex or named format
 * @param {number} amount - Amount to adjust (-100 to 100)
 * @returns {string} Adjusted color in hex format
 */
function adjustColor(color, amount) {
    try {
        // Convert named colors to hex using canvas
        const ctx = document.createElement('canvas').getContext('2d');
        ctx.fillStyle = color;
        const hexColor = ctx.fillStyle;
        
        // Parse hex color
        const hex = hexColor.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        
        // Adjust each component
        const newR = Math.max(0, Math.min(255, r + amount));
        const newG = Math.max(0, Math.min(255, g + amount));
        const newB = Math.max(0, Math.min(255, b + amount));
        
        // Convert back to hex
        return '#' + [newR, newG, newB].map(c => c.toString(16).padStart(2, '0')).join('');
    } catch (error) {
        console.error('Error adjusting color:', error);
        return color; // Return original color on error
    }
}

// ===================================
// Event Handlers
// ===================================

/**
 * Handle form submission
 */
async function handleFormSubmit(event) {
    event.preventDefault();
    hideError();
    
    const title = elements.taskTitle.value.trim();
    const description = elements.taskDescription.value.trim();
    
    if (!title) {
        showError('Title is required');
        return;
    }
    
    // Disable form during submission
    elements.submitBtn.disabled = true;
    elements.btnText.style.display = 'none';
    elements.btnLoader.style.display = 'inline-block';
    
    try {
        const newTask = await createTask(title, description);
        
        // Add to state and re-render
        state.tasks.unshift(newTask);
        renderTasks();
        
        // Reset form
        elements.taskForm.reset();
        updateCharCount();
        
    } catch (error) {
        showError(error.message);
    } finally {
        // Re-enable form
        elements.submitBtn.disabled = false;
        elements.btnText.style.display = 'inline-block';
        elements.btnLoader.style.display = 'none';
    }
}

/**
 * Update character count displays
 */
function updateCharCount() {
    const titleLength = elements.taskTitle.value.length;
    const descriptionLength = elements.taskDescription.value.length;
    
    elements.titleCharCount.textContent = `${titleLength}/100`;
    elements.descriptionCharCount.textContent = `${descriptionLength}/500`;
}

// ===================================
// Initialization
// ===================================

/**
 * Load initial data
 */
async function loadInitialData() {
    try {
        // Fetch tasks
        const tasks = await fetchTasks();
        state.tasks = tasks;
        renderTasks();
        
        // Fetch and apply config
        const config = await fetchConfig();
        if (config) {
            applyConfig(config);
        }
        
    } catch (error) {
        elements.loadingState.style.display = 'none';
        showError('Failed to load tasks. Please refresh the page.');
    }
}

/**
 * Poll for configuration changes
 * This enables GitOps reconciliation demo
 */
function startConfigPolling() {
    setInterval(async () => {
        const config = await fetchConfig();
        if (config) {
            applyConfig(config);
        }
    }, 3000); // Poll every 3 seconds
}

/**
 * Initialize the application
 */
function init() {
    // Set up event listeners
    elements.taskForm.addEventListener('submit', handleFormSubmit);
    elements.taskTitle.addEventListener('input', updateCharCount);
    elements.taskDescription.addEventListener('input', updateCharCount);
    
    // Load initial data
    loadInitialData();
    
    // Start polling for config changes
    startConfigPolling();
}

// ===================================
// Utility Functions
// ===================================

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Adjust color brightness
 */
function adjustColor(color, amount) {
    // Convert hex to RGB
    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    // Adjust brightness
    const newR = Math.max(0, Math.min(255, r + amount));
    const newG = Math.max(0, Math.min(255, g + amount));
    const newB = Math.max(0, Math.min(255, b + amount));
    
    // Convert back to hex
    return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
}

// ===================================
// Start the application
// ===================================
document.addEventListener('DOMContentLoaded', init);
