import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const yaronLogo = join(__dirname, '../src/assets/logo.png');
const easyflowLogo = join(__dirname, '../public/easyflow-logo.png');
const publicDir = join(__dirname, '../public');

// Ensure public directory exists
if (!existsSync(publicDir)) {
  mkdirSync(publicDir, { recursive: true });
}

async function generateIcons() {
  try {
    console.log('Generating PWA icons and favicon...');
    
    // Check if source logos exist
    if (!existsSync(yaronLogo)) {
      throw new Error(`Yaron logo not found at: ${yaronLogo}`);
    }
    if (!existsSync(easyflowLogo)) {
      throw new Error(`Easyflow logo not found at: ${easyflowLogo}`);
    }

    // Generate 192x192 icon from Yaron's logo (with white background)
    await sharp(yaronLogo)
      .resize(192, 192, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .png()
      .toFile(join(publicDir, 'icon-192x192.png'));
    
    console.log('✓ Generated icon-192x192.png (Yaron logo)');

    // Generate 512x512 icon from Yaron's logo (with white background)
    await sharp(yaronLogo)
      .resize(512, 512, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .png()
      .toFile(join(publicDir, 'icon-512x512.png'));
    
    console.log('✓ Generated icon-512x512.png (Yaron logo)');

    // Generate favicon from Easyflow logo (transparent, no white background)
    // Preserve aspect ratio and transparency - resize to max 128px while maintaining aspect ratio
    const easyflowMetadata = await sharp(easyflowLogo).metadata();
    const maxSize = 128;
    let width = maxSize;
    let height = maxSize;
    
    if (easyflowMetadata.width && easyflowMetadata.height) {
      const aspectRatio = easyflowMetadata.width / easyflowMetadata.height;
      if (aspectRatio > 1) {
        // Wider than tall
        height = Math.round(maxSize / aspectRatio);
      } else {
        // Taller than wide or square
        width = Math.round(maxSize * aspectRatio);
      }
    }
    
    await sharp(easyflowLogo)
      .resize(width, height, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 } // Transparent background
      })
      .png()
      .toFile(join(publicDir, 'favicon.ico'));
    
    console.log('✓ Generated favicon.ico (Easyflow logo, transparent)');
    console.log('\n✅ All icons generated successfully!');
    
  } catch (error) {
    console.error('Error generating icons:', error.message);
    process.exit(1);
  }
}

generateIcons();

