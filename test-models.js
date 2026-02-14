const { GoogleGenerativeAI } = require("@google/generative-ai");

async function listModels() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.log("No API Key");
        return;
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    try {
        // There is no direct listModels in the SDK for JS in the same way as Python usually, 
        // but we can try to fetch the models endpoint directly or use the SDK's internal methods if exposed.
        // Actually, let's just try several model names and see which one doesn't 404.
        const modelsToTry = [
            "gemini-1.5-flash",
            "gemini-1.5-flash-latest",
            "gemini-1.5-flash-001",
            "gemini-1.5-flash-002",
            "gemini-1.5-pro",
            "gemini-1.5-pro-latest",
            "gemini-pro"
        ];

        for (const modelName of modelsToTry) {
            try {
                const model = genAI.getGenerativeModel({ model: modelName });
                const result = await model.generateContent("test");
                console.log(`SUCCESS: ${modelName}`);
                return;
            } catch (e) {
                console.log(`FAILED: ${modelName} - ${e.message}`);
            }
        }
    } catch (error) {
        console.error("General error:", error);
    }
}

listModels();
