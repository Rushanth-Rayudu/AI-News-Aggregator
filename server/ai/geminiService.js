const { GoogleGenAI } = require('@google/genai');

let ai = null;

function getAIClient() {
    if (!ai && process.env.GEMINI_API_KEY) {
        ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }
    return ai;
}

const CATEGORIES = [
    "Model Release", "AI Research", "Open Source AI", "AI Agents", "Generative AI",
    "Robotics", "Computer Vision", "Multimodal AI", "AI Coding", "AI Infrastructure",
    "AI Chips / Hardware", "AI Safety", "AI Security", "AI Regulation / Policy",
    "AI Companies", "AI Startups", "AI Products", "AI Applications", "Scientific AI",
    "Healthcare AI", "Education AI", "Business / Enterprise AI", "Other"
];

const SYSTEM_PROMPT = `
You are an expert AI news analyst. Evaluate the following article content.
Your task is to determine:
1. Is this actually related to AI?
2. What is the single most accurate category from this list: ${CATEGORIES.join(', ')}
3. Does it contain extreme hype or sensationalism?
4. A concise summary including:
   - What happened (2-4 sentences)
   - Why it matters (1-3 sentences)
   - Key points (3-5 bullet points)
5. Importance score (0-100). Higher for major releases/research, lower for minor opinions/hype.
6. Confidence level based on the text: High, Medium, or Low.

Respond ONLY with a valid JSON object of this exact structure:
{
    "isAiRelated": boolean,
    "category": "string",
    "hasHype": boolean,
    "summary": {
        "whatHappened": "string",
        "whyItMatters": "string",
        "keyPoints": ["string", "string"]
    },
    "importanceScore": number,
    "confidenceLabel": "High" | "Medium" | "Low"
}
`;

async function processArticle(title, description, sourceTier, url) {
    const aiClient = getAIClient();
    
    // Default fallback if AI is not configured or fails
    const fallback = {
        isAiRelated: true,
        category: "Other",
        hasHype: false,
        summary: {
            whatHappened: description ? description.slice(0, 300) + '...' : 'No description available.',
            whyItMatters: "AI summarization unavailable.",
            keyPoints: ["Read original article for details."]
        },
        importanceScore: sourceTier === 1 ? 80 : 50,
        confidenceLabel: sourceTier === 1 ? 'High' : 'Medium'
    };

    if (!aiClient) {
        return fallback;
    }

    try {
        const response = await aiClient.models.generateContent({
            model: 'gemini-3.6-flash',
            contents: `Title: ${title}\nURL: ${url}\nContent/Description: ${description}`,
            config: {
                systemInstruction: SYSTEM_PROMPT,
                responseMimeType: "application/json",
            }
        });

        const resultText = response.text;
        const result = JSON.parse(resultText);
        return result;
    } catch (error) {
        console.error("Gemini API error:", error.message);
        return fallback;
    }
}

async function generateDailyDigest(events) {
    const aiClient = getAIClient();
    if (!aiClient || !events || events.length === 0) {
        return "No AI summary available today or no new events.";
    }

    const eventsPrompt = events.map(e => `- ${e.title}: ${e.summary}`).join('\n');
    
    try {
        const response = await aiClient.models.generateContent({
            model: 'gemini-3.6-flash',
            contents: `Summarize the following top AI events of the day in a brief executive overview paragraph (3-4 sentences):\n${eventsPrompt}`,
        });
        return response.text;
    } catch (error) {
        console.error("Gemini Daily Digest error:", error.message);
        return "Summary generation failed.";
    }
}

module.exports = {
    processArticle,
    generateDailyDigest
};
