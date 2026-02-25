#!/usr/bin/env node
/**
 * Generates PNG icon files at the four sizes Chrome requires from the
 * single source SVG at src/assets/icons/icon.svg.
 *
 * Usage:
 *   npm run icons
 *
 * Prerequisites:
 *   npm install --save-dev sharp
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SIZES = [16, 32, 48, 128];
const INPUT_SVG = path.join(__dirname, '../src/assets/icons/icon.svg');
const OUTPUT_DIR = path.join(__dirname, '../src/assets/icons');

async function main() {
  if (!fs.existsSync(INPUT_SVG)) {
    console.error(`Source SVG not found: ${INPUT_SVG}`);
    process.exit(1);
  }

  const svgBuffer = fs.readFileSync(INPUT_SVG);

  for (const size of SIZES) {
    const outputPath = path.join(OUTPUT_DIR, `icon-${size}.png`);
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(outputPath);
    console.log(`  generated icon-${size}.png (${size}x${size})`);
  }

  console.log(`\nAll ${SIZES.length} icons written to src/assets/icons/`);
}

main().catch(err => {
  console.error('Icon generation failed:', err.message);
  process.exit(1);
});
