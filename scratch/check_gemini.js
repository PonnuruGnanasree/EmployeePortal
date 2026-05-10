const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

async function list() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  try {
    // Note: The SDK doesn't have a direct listModels method on the client usually, 
    // it's often a manual fetch to the discovery service or similar.
    // But we can try a simple generation with 'gemini-pro' to see if that works.
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const result = await model.generateContent("test");
    console.log("Gemini Pro test successful");
  } catch (err) {
    console.error("Gemini Pro test failed:", err.message);
  }
}
list();
