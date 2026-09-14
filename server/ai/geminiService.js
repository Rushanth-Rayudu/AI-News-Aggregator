const { GoogleGenAI } = require('@google/genai');
const { inferCategory } = require('../services/taxonomy');

const { AnalysisCache } = require('./analysisCache');
const { createHash } = require('crypto');
const analysisCache = new AnalysisCache();
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
    const key = createHash('sha256').update(JSON.stringify([title, description, sourceTier, url])).digest('hex');
    const cached = analysisCache.get(key);
    if (cached) return cached;
    const aiClient = getAIClient();
    
    // Default fallback if AI is not configured or fails
    const fallback = {
        isAiRelated: /\b(ai|artificial intelligence|machine learning|llm|gpt|claude|gemini|neural|robotics|agentic|deep learning|model training|inference)\b/i.test(title+' '+description),
        category: inferCategory(title, description),
        hasHype: false,
        summary: {
            whatHappened: description ? description.slice(0, 300) + '...' : 'No description available.',
            whyItMatters: "AI summarization unavailable.",
            keyPoints: ["Read original article for details."]
        },
        importanceScore: 40,
        confidenceLabel: 'Low'
    };

    if (!aiClient || analysisCache.paused) {
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
        if(typeof result.isAiRelated!=='boolean' || !result.summary || typeof result.summary.whatHappened!=='string') return fallback;
        result.category=CATEGORIES.includes(result.category) && result.category !== 'Other' ? result.category : inferCategory(title, description);
        result.importanceScore=Math.max(0,Math.min(100,Number(result.importanceScore)||0));
        result.confidenceLabel=['High','Medium','Low'].includes(result.confidenceLabel)?result.confidenceLabel:'Low';
        result.summary.whyItMatters=String(result.summary.whyItMatters||'');
        result.summary.keyPoints=Array.isArray(result.summary.keyPoints)?result.summary.keyPoints.filter(p=>typeof p==='string'):[];
        analysisCache.set(key, result);
        return result;
    } catch (error) {
        if (Number(error.status || error.code) === 429 || /429|RESOURCE_EXHAUSTED/i.test(error.message || '')) analysisCache.pause();
        console.error('Gemini analysis unavailable; using fallback.');
        return fallback;
    }
}

async function generateDailyDigest(events) {
    const aiClient = getAIClient();
    if (!aiClient || analysisCache.paused || !events || events.length === 0) {
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
        if (Number(error.status || error.code) === 429 || /429|RESOURCE_EXHAUSTED/i.test(error.message || '')) analysisCache.pause();
        console.error('Gemini digest generation unavailable.');
        return "Summary generation failed.";
    }
}

module.exports = {
    processArticle,
    generateDailyDigest
};
