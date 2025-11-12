#!/usr/bin/env node

// Test script to simulate frontend login request using built-in modules
const https = require('https');
const http = require('http');

function makeRequest(options, data) {
  return new Promise((resolve, reject) => {
    const client = options.protocol === 'https:' ? https : http;
    
    const req = client.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data: body, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function testFrontendLogin() {
  try {
    console.log('Testing frontend-like login request...');
    
    const payload = JSON.stringify({
      username: 'admin@appsking.com',
      password: 'admin123'
    });

    const options = {
      hostname: 'localhost',
      port: 5001,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:3000',
        'Referer': 'http://localhost:3000/login',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const response = await makeRequest(options, payload);

    console.log('✅ Login successful!');
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.log('❌ Login failed!');
    console.log('Error:', error.message);
  }
}

testFrontendLogin();