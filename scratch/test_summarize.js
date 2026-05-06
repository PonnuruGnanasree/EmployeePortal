const http = require('http');

const payload = JSON.stringify({
  folder: 'AI',
  filename: '1288e6b9-85d2-44ce-99f3-b9355771f89a.bin',
  originalName: 'ai_research.pdf'
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/summarize',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', data);
  });
});
req.on('error', err => console.error('Error:', err.message));
req.write(payload);
req.end();
