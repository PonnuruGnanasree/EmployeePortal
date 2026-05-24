const https = require('https');
require('dotenv').config();

const url = `${process.env.SUPABASE_URL}/rest/v1/`;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

const options = {
  headers: {
    'apikey': key,
    'Authorization': `Bearer ${key}`
  }
};

https.get(url, options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    try {
      const doc = JSON.parse(body);
      console.log("Paths in schema:", Object.keys(doc.paths).filter(p => p.includes('gantec') || p.includes('notification')));
      
      const postDef = doc.definitions['gantec_idea_hub_posts'];
      console.log("\ngantec_idea_hub_posts columns:");
      if (postDef) {
        console.log(Object.keys(postDef.properties));
      } else {
        console.log("No definition for gantec_idea_hub_posts");
      }

      const notifDef = doc.definitions['reportee_notifications'];
      console.log("\nreportee_notifications columns:");
      if (notifDef) {
        console.log(Object.keys(notifDef.properties));
      } else {
        console.log("No definition for reportee_notifications");
      }
    } catch (e) {
      console.error("Failed to parse OpenAPI doc:", e.message);
      console.log("Raw body:", body.substring(0, 500));
    }
  });
}).on('error', (e) => {
  console.error("HTTP error:", e.message);
});
