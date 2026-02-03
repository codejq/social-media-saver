const fs = require('fs');
const path = require('path');

// Simple PNG generator - creates a solid color square with rounded corners effect
// This creates a minimal valid PNG file

function createPNG(size, r, g, b) {
  // PNG signature
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0); // width
  ihdrData.writeUInt32BE(size, 4); // height
  ihdrData.writeUInt8(8, 8);  // bit depth
  ihdrData.writeUInt8(2, 9);  // color type (RGB)
  ihdrData.writeUInt8(0, 10); // compression
  ihdrData.writeUInt8(0, 11); // filter
  ihdrData.writeUInt8(0, 12); // interlace

  const ihdrChunk = createChunk('IHDR', ihdrData);

  // IDAT chunk (image data)
  // Create raw pixel data with filter byte at start of each row
  const rawData = [];
  const cornerRadius = Math.floor(size * 0.15);

  for (let y = 0; y < size; y++) {
    rawData.push(0); // Filter byte (none)
    for (let x = 0; x < size; x++) {
      // Check if pixel should be visible (simple rounded corner check)
      const inCorner = isInCorner(x, y, size, cornerRadius);
      if (inCorner) {
        // Transparent (but we're using RGB, so just use background)
        rawData.push(255, 255, 255); // White for corners
      } else {
        rawData.push(r, g, b);
      }
    }
  }

  // Compress with zlib
  const zlib = require('zlib');
  const compressed = zlib.deflateSync(Buffer.from(rawData));
  const idatChunk = createChunk('IDAT', compressed);

  // IEND chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function isInCorner(x, y, size, radius) {
  // Check all four corners
  const corners = [
    [0, 0],
    [size - 1, 0],
    [0, size - 1],
    [size - 1, size - 1]
  ];

  for (const [cx, cy] of corners) {
    const dx = Math.abs(x - cx);
    const dy = Math.abs(y - cy);
    if (dx < radius && dy < radius) {
      const dist = Math.sqrt((radius - dx) ** 2 + (radius - dy) ** 2);
      if (dist > radius) {
        return true;
      }
    }
  }
  return false;
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);

  const typeBuffer = Buffer.from(type);
  const crcData = Buffer.concat([typeBuffer, data]);
  const crc = crc32(crcData);

  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc >>> 0);

  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

// CRC32 lookup table
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c;
}

function crc32(data) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc = crcTable[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  }
  return crc ^ 0xFFFFFFFF;
}

// Generate icons
const sizes = [16, 32, 48, 128];
const iconsDir = path.join(__dirname, '..', 'src', 'assets', 'icons');

// Create directory if it doesn't exist
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Primary blue color (matching Tailwind primary-600: #0284C7)
const r = 2, g = 132, b = 199;

for (const size of sizes) {
  const png = createPNG(size, r, g, b);
  const filename = path.join(iconsDir, `icon-${size}.png`);
  fs.writeFileSync(filename, png);
  console.log(`Created ${filename}`);
}

console.log('Done!');
