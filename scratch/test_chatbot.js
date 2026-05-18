const fs = require('fs');
const path = require('path');
require('dotenv').config();

const apiKey = process.env.GEMINI_API_KEY;
console.log('Gemini API Key:', apiKey);

let knowledgeBase = '';
try {
  const kbPath = path.join(__dirname, '..', 'data', 'knowledge_base.txt');
  if (fs.existsSync(kbPath)) {
    knowledgeBase = fs.readFileSync(kbPath, 'utf8');
  }
} catch (kbErr) {
  console.error('KB Error:', kbErr.message);
}

const message = 'when is next holiday';

const prompt = `You are the Gantec HR Assistant. 
STRICT RULES:
- BE EXTREMELY CONCISE. 
- NO long introductions like "I'd be happy to help". Just give the answer.
- Use bullet points for lists.
- Maximum 3 sentences for general text.
- If you don't know the answer based on the knowledge base, ask the user to contact HR at dl-hr@gantecusa.com.

Platform Navigation:
- Training Resources: Sidebar menu -> Training Resources.
- Document Locker: Sidebar menu.
- Company Culture/Certifications/Contact HR: Sidebar menu.

Gantec Knowledge Base:
${knowledgeBase}

Question: ${message}`;

const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;

fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contents: [{
      parts: [{
        text: prompt
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
