
const fs = require('fs');
const path = require('path');

/**
 * Automatically converts a TTF font file into a base64 encoded TypeScript file
 * for embedding in jsPDF.
 */
function generateFontData() {
  const fontName = 'NotoSansDevanagari-Regular.ttf';
  const fontPath = path.join(process.cwd(), 'public', 'fonts', fontName);
  const outputDir = path.join(process.cwd(), 'src', 'lib', 'fonts');
  const outputPath = path.join(outputDir, 'noto-sans-devanagari-regular.ts');

  console.log(`Checking for font file at: ${fontPath}`);

  if (!fs.existsSync(fontPath)) {
    console.error(`ERROR: Font file not found. Please ensure your font is at: ${fontPath}`);
    return;
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  try {
    const fontBuffer = fs.readFileSync(fontPath);
    const base64 = fontBuffer.toString('base64');

    const tsContent = `
/**
 * AUTO-GENERATED FOND DATA
 * This file contains the base64 encoded Noto Sans Devanagari font.
 * Do not edit manually. Run 'npm run build:fonts' to update.
 */
export const notoParams = {
  fontName: 'NotoSansDevanagari',
  fontStyle: 'normal',
  fileName: '${fontName}',
  base64: '${base64}'
};
`;

    fs.writeFileSync(outputPath, tsContent);
    console.log(`SUCCESS: Generated jsPDF font data at: ${outputPath}`);
  } catch (error) {
    console.error('ERROR: Failed to generate font data:', error);
  }
}

generateFontData();
