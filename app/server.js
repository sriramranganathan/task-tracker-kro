const express = require('express');
const path = require('path');

// Import DynamoDB client (will be implemented in next task)
let dynamoDBClient;
try {
  dynamoDBClient = require('./dynamodb-client');
} catch (err) {
  // DynamoDB client not yet implemented
  dynamoDBClient = null;
}

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Structured logging helper
const log = (level, message, meta = {}) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta
  };
  console.log(JSON.stringify(logEntry));
};

// Health check endpoint - returns 200 if server is running
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Readiness check endpoint - returns 200 if DynamoDB is accessible
app.get('/ready', async (req, res) => {
  try {
    if (!dynamoDBClient) {
      return res.status(503).json({ 
        status: 'not ready', 
        reason: 'DynamoDB client not initialized',
        timestamp: new Date().toISOString() 
      });
    }
    
    // Test DynamoDB connectivity
    await dynamoDBClient.testConnection();
    res.status(200).json({ status: 'ready', timestamp: new Date().toISOString() });
  } catch (error) {
    log('ERROR', 'Readiness check failed', { error: error.message });
    res.status(503).json({ 
      status: 'not ready', 
      reason: error.message,
      timestamp: new Date().toISOString() 
    });
  }
});

// API Routes

// GET /api/tasks - Retrieve all tasks
app.get('/api/tasks', async (req, res) => {
  try {
    if (!dynamoDBClient) {
      return res.status(500).json({ error: 'DynamoDB client not initialized' });
    }
    
    const tasks = await dynamoDBClient.getTasks();
    log('INFO', 'Tasks retrieved', { count: tasks.length });
    res.json({ tasks });
  } catch (error) {
    log('ERROR', 'Failed to retrieve tasks', { error: error.message });
    res.status(500).json({ error: 'Failed to retrieve tasks', message: error.message });
  }
});

// POST /api/tasks - Create a new task
app.post('/api/tasks', async (req, res) => {
  try {
    if (!dynamoDBClient) {
      return res.status(500).json({ error: 'DynamoDB client not initialized' });
    }
    
    const { title, description } = req.body;
    
    // Validation
    if (!title || typeof title !== 'string') {
      return res.status(400).json({ error: 'Title is required and must be a string' });
    }
    
    if (title.length > 100) {
      return res.status(400).json({ error: 'Title must be 100 characters or less' });
    }
    
    if (description && typeof description !== 'string') {
      return res.status(400).json({ error: 'Description must be a string' });
    }
    
    if (description && description.length > 500) {
      return res.status(400).json({ error: 'Description must be 500 characters or less' });
    }
    
    const task = await dynamoDBClient.createTask(title.trim(), description ? description.trim() : '');
    log('INFO', 'Task created', { taskId: task.taskId, title: task.title });
    res.status(201).json({ task });
  } catch (error) {
    log('ERROR', 'Failed to create task', { error: error.message });
    res.status(500).json({ error: 'Failed to create task', message: error.message });
  }
});

// GET /api/config - Return configuration for dynamic UI updates
app.get('/api/config', (req, res) => {
  const config = {
    appTitle: process.env.APP_TITLE || 'Task Tracker',
    themeColor: process.env.APP_THEME_COLOR || '#0066cc',
    awsRegion: process.env.AWS_REGION || 'us-west-2'
  };
  res.json(config);
});

// Start server
app.listen(PORT, () => {
  log('INFO', 'Server started', { 
    port: PORT,
    nodeVersion: process.version,
    environment: process.env.NODE_ENV || 'development'
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  log('INFO', 'SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  log('INFO', 'SIGINT received, shutting down gracefully');
  process.exit(0);
});

module.exports = app;
