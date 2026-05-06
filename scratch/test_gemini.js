require("dotenv").config({ path: __dirname + "/../.env" });

async function test() {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error?.message || 'Gemini API Error');
    }
    console.log("Models:", data.models.map(m => m.name));
  } catch (e) {
    console.error("Error:", e.message);
  }
}
test();
