#!/usr/bin/env node

import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Fix useChessGame.ts
console.log('Fixing src/hooks/useChessGame.ts...');
let fileContent = fs.readFileSync('src/hooks/useChessGame.ts', 'utf8');

// Replace the problematic line
fileContent = fileContent.replace(
  /logger\.debug\('useChessGame', `Starting clock for side: \${side}`\);/,
  "useChessGameLogger.debug(`Starting clock for side: ${side}`);"
);

fs.writeFileSync('src/hooks/useChessGame.ts', fileContent);
console.log('  Fixed src/hooks/useChessGame.ts');

// Fix ratingService.ts
console.log('Fixing src/services/ratingService.ts...');
fileContent = fs.readFileSync('src/services/ratingService.ts', 'utf8');

// Replace the problematic line
fileContent = fileContent.replace(
  /logger\.info\('RatingService', 'Ratings updated successfully', {/,
  "ratingServiceLogger.info('Ratings updated successfully', {"
);

fs.writeFileSync('src/services/ratingService.ts', fileContent);
console.log('  Fixed src/services/ratingService.ts');

console.log('All fixes completed. Run TypeScript check to verify:');
console.log('npx tsc --noEmit'); 