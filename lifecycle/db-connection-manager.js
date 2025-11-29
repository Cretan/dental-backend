// Database connection tester with retry logic
const { Client } = require('pg');

/**
 * Test database connection with retries
 * @param {Object} config - Database configuration
 * @param {number} maxRetries - Maximum number of retry attempts
 * @param {number} retryDelay - Delay between retries in ms
 */
async function testConnection(config, maxRetries = 3, retryDelay = 2000) {
  let attempt = 0;
  
  while (attempt < maxRetries) {
    attempt++;
    const client = new Client(config);
    
    try {
      console.log(`Connection attempt ${attempt}/${maxRetries}...`);
      await client.connect();
      
      // Test with a simple query
      await client.query('SELECT NOW()');
      
      console.log('✅ Database connection successful!');
      await client.end();
      return true;
    } catch (err) {
      console.error(`❌ Attempt ${attempt} failed:`, err.message);
      await client.end().catch(() => {});
      
      if (attempt < maxRetries) {
        console.log(`Retrying in ${retryDelay/1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }
  
  console.error(`Failed to connect after ${maxRetries} attempts`);
  return false;
}

/**
 * Keep database connection alive with periodic pings
 * @param {Object} config - Database configuration
 * @param {number} pingInterval - Interval between pings in ms
 */
async function keepAlive(config, pingInterval = 30000) {
  const client = new Client(config);
  
  try {
    await client.connect();
    console.log('✅ Keep-alive connection established');
    
    // Ping database periodically
    const intervalId = setInterval(async () => {
      try {
        await client.query('SELECT 1');
        console.log('✅ Keep-alive ping successful');
      } catch (err) {
        console.error('❌ Keep-alive ping failed:', err.message);
        clearInterval(intervalId);
        await client.end();
        
        // Try to reconnect
        console.log('Attempting to reconnect...');
        await keepAlive(config, pingInterval);
      }
    }, pingInterval);
    
    // Handle cleanup on exit
    process.on('SIGINT', async () => {
      clearInterval(intervalId);
      await client.end();
      process.exit(0);
    });
    
  } catch (err) {
    console.error('❌ Failed to establish keep-alive connection:', err.message);
    
    // Retry after delay
    setTimeout(() => {
      console.log('Retrying keep-alive connection...');
      keepAlive(config, pingInterval);
    }, 5000);
  }
}

module.exports = { testConnection, keepAlive };
