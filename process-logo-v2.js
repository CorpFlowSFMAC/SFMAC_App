const Jimp = require('jimp');
const tinycolor = require('tinycolor2');

async function processLogo() {
    try {
        console.log('Reading image...');
        const image = await Jimp.read('public/logo.jpg');

        console.log('Processing with enhancement...');

        const width = image.bitmap.width;
        const height = image.bitmap.height;

        image.scan(0, 0, width, height, function (x, y, idx) {
            const r = this.bitmap.data[idx + 0];
            const g = this.bitmap.data[idx + 1];
            const b = this.bitmap.data[idx + 2];
            const a = this.bitmap.data[idx + 3];

            const color = tinycolor({ r, g, b });
            const brightness = color.getBrightness();
            const isMonochrome = color.isMonochrome() || (Math.abs(r - g) < 20 && Math.abs(g - b) < 20);

            // 1. White Background -> Transparent
            if (r > 210 && g > 210 && b > 210) {
                this.bitmap.data[idx + 3] = 0;
            }
            // 2. Black/Dark Text/Lines -> Pure White & Sharpened
            else if (brightness < 100 && isMonochrome) {
                this.bitmap.data[idx + 0] = 255;
                this.bitmap.data[idx + 1] = 255;
                this.bitmap.data[idx + 2] = 255;
                this.bitmap.data[idx + 3] = 255; // Ensure solid opacity
            }
            // 3. Colors -> Saturate and Pop
            else {
                // It's a color (Green, Orange, Blue)
                // Boost saturation
                const saturated = color.saturate(30).toRgb(); // +30% saturation

                this.bitmap.data[idx + 0] = saturated.r;
                this.bitmap.data[idx + 1] = saturated.g;
                this.bitmap.data[idx + 2] = saturated.b;

                // Slight brightness boost if too dark
                if (brightness < 150) {
                    const brightened = tinycolor(saturated).lighten(10).toRgb();
                    this.bitmap.data[idx + 0] = brightened.r;
                    this.bitmap.data[idx + 1] = brightened.g;
                    this.bitmap.data[idx + 2] = brightened.b;
                }
            }
        });

        console.log('Applying slight blur/sharpen to smooth edges...');
        // A very subtle blur then sharpen can smooth pixelated edges from the JPG
        // image.blur(1); 
        // image.convolute([[-1, -1, -1], [-1, 9, -1], [-1, -1, -1]]); // Simple sharpen

        console.log('Saving super-refined logo...');
        await image.writeAsync('public/logo-super-refined.png');
        console.log('Done! Created public/logo-super-refined.png');

    } catch (err) {
        console.error('Error:', err);
    }
}

processLogo();
