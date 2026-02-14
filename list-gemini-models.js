const https = require('https');

function listModels() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("No API key");
        return;
    }

    const url = `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`;

    https.get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            console.log(data);
        });
    }).on('error', (err) => {
        console.error("Error: " + err.message);
    });
}

listModels();
