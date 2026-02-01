const Jimp = require('jimp');

async function processLogo() {
    try {
        console.log('Reading logo.jpg...');
        const image = await Jimp.read('public/logo.jpg');

        console.log('Processing pixels...');

        image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
            const r = this.bitmap.data[idx + 0];
            const g = this.bitmap.data[idx + 1];
            const b = this.bitmap.data[idx + 2];

            // 1. Background Removal (White -> Transparent)
            // Strict threshold to catch the white box
            if (r > 200 && g > 200 && b > 200) {
                this.bitmap.data[idx + 3] = 0; // Alpha 0
            } else {
                // 2. Content Enhancement (Make it "BRILLANTE")
                // Check if it's the dark text/lines (low brightness)
                if (r < 100 && g < 100 && b < 100) {
                    // Force darks to Pure White to contrast with Dark Background
                    this.bitmap.data[idx + 0] = 255;
                    this.bitmap.data[idx + 1] = 255;
                    this.bitmap.data[idx + 2] = 255;
                } else {
                    // It's color (Orange/Green/Blue) or lighter gray
                    // Boost saturation effectively by spreading RGB values
                    // Simple "pop" logic: increase dominant channel, decrease others
                    // This is a naive boost but works for simple logos
                    this.bitmap.data[idx + 0] = Math.min(255, r * 1.2);
                    this.bitmap.data[idx + 1] = Math.min(255, g * 1.2);
                    this.bitmap.data[idx + 2] = Math.min(255, b * 1.2);
                }
                // Ensure full opacity for non-background
                this.bitmap.data[idx + 3] = 255;
            }
        });

        console.log('Writing logo-final.png...');
        await image.writeAsync('public/logo-final.png');
        console.log('Success!');

    } catch (err) {
        console.error('Error processing image:', err);
    }
}

processLogo();
