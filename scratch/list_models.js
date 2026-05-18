require('dotenv').config();

const apiKey = process.env.GEMINI_API_KEY;
const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

fetch(url)
  .then(res => res.json())
  .then(data => {
    if (data.models) {
      console.log("Supported models for this key:");
      data.models.forEach(m => {
        console.log(`- ${m.name} (${m.displayName})`);
      });
    } else {
      console.log("Response:", JSON.stringify(data, null, 2));
    }
  })
  .catch(err => console.error("Error:", err.message));
