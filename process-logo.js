const Jimp = require('jimp');

async function processLogo() {
    try {
        console.log('Reading image...');
        // Read the original high-res JPG
        const image = await Jimp.read('public/logo.jpg');

        console.log('Processing...');

        const width = image.bitmap.width;
        const height = image.bitmap.height;

        image.scan(0, 0, width, height, function (x, y, idx) {
            const r = this.bitmap.data[idx + 0];
            const g = this.bitmap.data[idx + 1];
            const b = this.bitmap.data[idx + 2];
            const a = this.bitmap.data[idx + 3];

            // Calculate brightness/luminance
            // const brightness = (r + g + b) / 3;

            // 1. Detect Background (White-ish) -> Make Transparent
            if (r > 200 && g > 200 && b > 200) {
                this.bitmap.data[idx + 3] = 0; // Alpha 0
            }
            // 2. Detect Black/Dark (Text, Outlines) -> Make White
            // We check if it's dark AND not a color (saturation check simplified)
            // If R, G, and B are all low and close to each other, it's black/gray.
            else if (r < 100 && g < 100 && b < 100 && Math.abs(r - g) < 30 && Math.abs(g - b) < 30) {
                // Turn to White
                this.bitmap.data[idx + 0] = 255; // R
                this.bitmap.data[idx + 1] = 255; // G
                this.bitmap.data[idx + 2] = 255; // B
                this.bitmap.data[idx + 3] = 255; // Alpha Full
            }
            // 3. Colors (Green, Orange, Blue) -> Keep as is (or enhance?)
            // We leave them alone. They will pop against the dark background.
        });

        console.log('Saving refined logo...');
        await image.writeAsync('public/logo-refined.png');
        console.log('Done! Created public/logo-refined.png');

    } catch (err) {
        console.error('Error:', err);
    }
}

processLogo();
