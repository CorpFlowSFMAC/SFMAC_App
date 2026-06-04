const fs = require('fs');
const path = require('path');

function loadEnvFile(fileName) {
  const filePath = path.join(__dirname, '..', fileName);
  if (!fs.existsSync(filePath)) {
    console.log(`${fileName} does not exist`);
    return;
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  console.log(`\n--- Content of ${fileName} ---`);
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      console.log(trimmed);
    }
  });
}

loadEnvFile('.env');
loadEnvFile('.env.local');
