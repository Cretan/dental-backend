/**
 * Check if test user exists in database
 */
const axios = require('axios');

const STRAPI_URL = 'http://localhost:1337';

async function checkUser() {
  try {
    // Try to login
    console.log('Testing login with test@test.com...');
    const response = await axios.post(`${STRAPI_URL}/api/auth/local`, {
      identifier: 'test@test.com',
      password: 'Test123!@#'
    });
    
    console.log('✅ Login successful!');
    console.log('JWT Token:', response.data.jwt);
    console.log('User:', response.data.user);
  } catch (error) {
    console.log('❌ Login failed:');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.log('Error:', error.message);
    }
  }
}

checkUser();
