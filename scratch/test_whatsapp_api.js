const fs = require('fs');
const path = require('path');

// Extract id_secreto from .env.local
const envLocalPath = path.join(__dirname, '../.env.local');
const envContent = fs.readFileSync(envLocalPath, 'utf8');

let id_secreto = '';
for (const line of envContent.split('\n')) {
    if (line.startsWith('id_secreto=')) {
        id_secreto = line.split('=')[1].trim();
        break;
    }
}

console.log(`Using id_secreto: '${id_secreto}'`);

const testPayload = {
    phone: '+51999999999', // dummy phone
    message: 'Prueba de API desde script de validación (Ignorar este mensaje si lo recibe)'
};

async function testAPI() {
    try {
        console.log('Sending request to http://87.99.137.96:3001/send...');
        const response = await fetch('http://87.99.137.96:3001/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': id_secreto,
                'Authorization': `Bearer ${id_secreto}`
            },
            body: JSON.stringify(testPayload)
        });

        console.log(`HTTP Status: ${response.status} ${response.statusText}`);
        const responseText = await response.text();
        console.log(`Response Body: ${responseText}`);
        
        if (response.ok) {
            console.log('✅ SUCCESS! Authentication works and payload was accepted.');
        } else {
            console.log('❌ FAILED! Endpoint returned error.');
        }
    } catch (err) {
        console.error('Fetch error:', err);
    }
}

testAPI();
