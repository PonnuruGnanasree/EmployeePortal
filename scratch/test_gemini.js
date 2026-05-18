require('dotenv').config();

const apiKey = process.env.GEMINI_API_KEY;
console.log('Gemini API Key:', apiKey);

const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;

fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contents: [{
      parts: [{
        text: 'Hello, what is today?'
      }]
    }]
  })
})
.then(res => res.json().then(data => ({ status: res.status, data })))
.then(res => {
  console.log('Status:', res.status);
  console.log('Response:', JSON.stringify(res.data, null, 2));
})
.catch(err => {
  console.error('Error:', err.message);
});
