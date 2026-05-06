const http = require('http');

const body = JSON.stringify({
  folder: 'AI',
  filename: 'AI.ytlink',
  originalName: 'AI.ytlink'
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/folders',
  method: 'GET'
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    const parsed = JSON.parse(data);
    console.log('Folders:', JSON.stringify(parsed, null, 2));
  });
});
req.on('error', err => console.error('Error:', err.message));
req.end();
