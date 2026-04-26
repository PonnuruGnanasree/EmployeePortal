const axios = require('axios');

async function test() {
  const baseUrl = 'http://localhost:3000/api';
  
  console.log('Testing Signup with invalid domain...');
  try {
    const res = await axios.post(`${baseUrl}/auth/signup`, {
      fullname: 'Test User',
      email: 'test@gmail.com',
      password: 'Password12!@'
    });
    console.log('FAIL: Signup should have failed', res.data);
  } catch (err) {
    console.log('PASS: Signup failed as expected:', err.response.data);
  }

  console.log('\nTesting Signup with valid domain...');
  try {
    const res = await axios.post(`${baseUrl}/auth/signup`, {
      fullname: 'Valid User',
      email: `valid${Date.now()}@gantecusa.com`,
      password: 'Password12!@'
    });
    console.log('PASS: Signup succeeded:', res.data);
  } catch (err) {
    console.log('FAIL: Signup should have succeeded', err.response ? err.response.data : err.message);
  }
}

test();
