const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

async function testSDK() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  
  console.log("--- Testing gemini-flash-lite-latest ---");
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-flash-lite-latest" });
    const result = await model.generateContent("test");
    console.log("SUCCESS! Response:", result.response.text());
  } catch (err) {
    console.error("FAILED:", err.message);
  }
}
testSDK();
