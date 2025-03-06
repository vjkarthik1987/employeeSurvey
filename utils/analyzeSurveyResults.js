require("dotenv").config();
const axios = require("axios");

async function analyzeSurveyResults(fieldName, uniqueValues, overallAverages, categoryWiseAverages, questionAverages) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        console.error("❌ OpenAI API Key is missing! Ensure it's set in .env");
        return "API key missing, cannot generate analysis.";
    }

    // 🔵 Step 1: Format data into a structured prompt for AI
    let prompt = `You are an expert in data analysis. Please analyze the following survey results for ${fieldName}. Identify trends, correlations, hidden patterns, and key insights.\n\n`;

    // 🔹 Add Overall Averages
    prompt += "### Overall Averages:\n";
    for (const value in overallAverages) {
        prompt += `- ${value}: ${overallAverages[value]}\n`;
    }

    // 🔹 Add Category-Wise Averages
    prompt += "\n### Category-Wise Averages:\n";
    for (const value of uniqueValues) {
        prompt += `**${value}**\n`;
        for (const category in categoryWiseAverages[value]) {
            prompt += `  - ${category}: ${categoryWiseAverages[value][category]}\n`;
        }
    }

    // 🔹 Add Question-Wise Averages
    prompt += "\n### Question-Wise Averages:\n";
    for (const question in questionAverages) {
        prompt += `**${question}**\n`;
        for (const value of uniqueValues) {
            prompt += `  - ${value}: ${questionAverages[question][value] || "N/A"}\n`;
        }
    }

    prompt += "\nNow, analyze the data. Provide key insights, trends, correlations, and any hidden factors.";


    try {
        // 🔵 Step 2: Call OpenAI API
        const response = await axios.post("https://api.openai.com/v1/chat/completions", {
            model: "gpt-4",
            messages: [{ role: "system", content: prompt }],
            max_tokens: 400
        }, {
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }
        });

        return response.data.choices[0].message.content.trim();
    } catch (error) {
        console.error("❌ Error in AI analysis:", error.response?.data || error.message);
        return "AI analysis failed.";
    }
}

module.exports = analyzeSurveyResults;