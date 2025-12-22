import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sourceLogo = join(__dirname, '../src/assets/logo.png');
const publicDir = join(__dirname, '../public');

// Ensure public directory exists
if (!existsSync(publicDir)) {
  mkdirSync(publicDir, { recursive: true });
}

async function generateIcons() {
  try {
    console.log('Generating PWA icons from logo...');
    
    // Check if source logo exists
    if (!existsSync(sourceLogo)) {
      throw new Error(`Source logo not found at: ${sourceLogo}`);
    }

    // Generate 192x192 icon
    await sharp(sourceLogo)
      .resize(192, 192, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .png()
      .toFile(join(publicDir, 'icon-192x192.png'));
    
    console.log('✓ Generated icon-192x192.png');

    // Generate 512x512 icon
    await sharp(sourceLogo)
      .resize(512, 512, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .png()
      .toFile(join(publicDir, 'icon-512x512.png'));
    
    console.log('✓ Generated icon-512x512.png');

    // Generate favicon (32x32)
    await sharp(sourceLogo)
      .resize(32, 32, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .png()
      .toFile(join(publicDir, 'favicon.ico'));
    
    console.log('✓ Generated favicon.ico');
    console.log('\n✅ All PWA icons generated successfully!');
    
  } catch (error) {
    console.error('Error generating icons:', error.message);
    process.exit(1);
  }
}

generateIcons();

