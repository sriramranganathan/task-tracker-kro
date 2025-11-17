const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

// Configuration from environment variables
const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'task-tracker-tasks';
const AWS_REGION = process.env.AWS_REGION || 'us-west-2';

// Create DynamoDB client
// IRSA credentials are automatically discovered by the AWS SDK
// from the service account token mounted in the pod
const client = new DynamoDBClient({
  region: AWS_REGION
});

const docClient = DynamoDBDocumentClient.from(client);

/**
 * Test DynamoDB connection
 * Used by readiness probe
 */
async function testConnection() {
  try {
    // Attempt a simple scan with limit 1 to test connectivity
    const command = new ScanCommand({
      TableName: TABLE_NAME,
      Limit: 1
    });
    await docClient.send(command);
    return true;
  } catch (error) {
    throw new Error(`DynamoDB connection failed: ${error.message}`);
  }
}

/**
 * Create a new task in DynamoDB
 * @param {string} title - Task title
 * @param {string} description - Task description
 * @returns {Object} Created task object
 */
async function createTask(title, description) {
  const taskId = uuidv4();
  const createdAt = Date.now();
  
  const task = {
    taskId,
    createdAt,
    title,
    description,
    status: 'pending'
  };

  try {
    const command = new PutCommand({
      TableName: TABLE_NAME,
      Item: task
    });
    
    await docClient.send(command);
    
    return task;
  } catch (error) {
    throw new Error(`Failed to create task: ${error.message}`);
  }
}

/**
 * Get all tasks from DynamoDB
 * @returns {Array} Array of task objects
 */
async function getTasks() {
  try {
    const command = new ScanCommand({
      TableName: TABLE_NAME
    });
    
    const response = await docClient.send(command);
    
    // Sort by createdAt descending (newest first)
    const tasks = response.Items || [];
    tasks.sort((a, b) => b.createdAt - a.createdAt);
    
    return tasks;
  } catch (error) {
    throw new Error(`Failed to retrieve tasks: ${error.message}`);
  }
}

module.exports = {
  testConnection,
  createTask,
  getTasks
};
