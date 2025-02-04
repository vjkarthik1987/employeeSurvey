require("dotenv").config();
const axios = require("axios");

async function summarizeText(text) {
    if (!text || text.length === 0) return "No responses available.";

    // Ensure API key is properly loaded
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        console.error("❌ OpenAI API Key is missing! Make sure it's set in .env");
        return "API key missing, cannot generate summary.";
    }

    try {
        const response = await axios.post("https://api.openai.com/v1/chat/completions", {
            model: "gpt-3.5-turbo", // Switch to a cheaper model
            messages: [
                { role: "system", content: "Summarize the following feedback in 2-3 sentences." },
                { role: "user", content: text }
            ],
            max_tokens: 100,
            temperature: 0.7,
        }, {
            headers: { Authorization: `Bearer ${apiKey}` }
        });

        return response.data.choices[0].message.content.trim();
    } catch (error) {
        console.error("❌ Error in AI summarization:", error.response?.data || error.message);
        return "Summary generation failed.";
    }
}

module.exports = summarizeText;
