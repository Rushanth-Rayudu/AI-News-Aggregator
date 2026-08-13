require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { GoogleGenAI } = require('@google/genai');

const key = process.env.GEMINI_API_KEY;
console.log('Key present:', !!key);
console.log('Key prefix:', key ? key.slice(0, 6) : 'NONE');

const ai = new GoogleGenAI({ apiKey: key });

ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: 'Say "Gemini API connected successfully" and nothing else.',
}).then(res => {
    console.log('Gemini response:', res.text);
    process.exit(0);
}).catch(err => {
    console.error('Gemini ERROR:', err.message || err);
    process.exit(1);
});
