const Jimp = require('jimp');

async function removeBackground() {
    try {
        console.log('Reading image...');
        const image = await Jimp.read('public/logo.jpg');

        console.log('Processing...');

        // Iterate over all pixels
        const width = image.bitmap.width;
        const height = image.bitmap.height;

        for (let x = 0; x < width; x++) {
            for (let y = 0; y < height; y++) {
                const color = image.getPixelColor(x, y);
                const rgba = Jimp.intToRGBA(color);

                // Check if pixel is close to white
                if (rgba.r > 200 && rgba.g > 200 && rgba.b > 200) {
                    // Set to transparent
                    image.setPixelColor(0x00000000, x, y);
                }
            }
        }

        console.log('Saving as PNG...');
        await image.writeAsync('public/logo.png');
        console.log('Done! Created public/logo.png');
    } catch (err) {
        console.error('Error:', err);
    }
}

removeBackground();
