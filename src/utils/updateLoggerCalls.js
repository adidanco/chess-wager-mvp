/**
 * Migration script to update logger calls across the codebase
 * 
 * This script:
 * 1. Changes logger.method(component, message, data) to either:
 *    - logger.method(message, data) 
 *    - componentLogger.method(message, data)
 * 
 * Run with: node src/utils/updateLoggerCalls.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Find TypeScript files with logger calls
const findFiles = () => {
  const result = execSync('grep -r --include="*.ts" --include="*.tsx" "logger\\." src/ | grep -v "logger.ts"')
    .toString()
    .trim()
    .split('\n');
  
  // Extract filenames
  const files = new Set();
  result.forEach(line => {
    const filePath = line.split(':')[0];
    files.add(filePath);
  });
  
  return Array.from(files);
};

// Process a single file
const processFile = (filePath) => {
  console.log(`Processing ${filePath}...`);
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Look for import statement
  const importRegex = /import\s+{\s*logger\s*}\s+from\s+['"](.+)['"]/;
  const importMatch = content.match(importRegex);
  
  if (!importMatch) {
    console.log(`  No logger import found in ${filePath}, skipping.`);
    return;
  }
  
  const importPath = importMatch[1];
  
  // Determine component name from file path
  let componentName = path.basename(filePath, path.extname(filePath));
  
  // Update import statement to include createLogger
  let updatedContent = content.replace(
    importRegex, 
    `import { logger, createLogger } from '${importPath}'`
  );
  
  // Add component logger creation after the import
  const loggerCreation = `\n// Create a component-specific logger\nconst ${componentName}Logger = createLogger('${componentName}');\n`;
  updatedContent = updatedContent.replace(
    importMatch[0],
    importMatch[0] + loggerCreation
  );
  
  // Replace old logger calls with new format
  // Pattern: logger.level('Component', 'message', {...})
  const loggerCallRegex = /logger\.(debug|info|warn|error)\s*\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*(?:,\s*(\{[^}]+\}))?\s*\)/g;
  
  updatedContent = updatedContent.replace(loggerCallRegex, (match, level, component, message, data) => {
    if (data) {
      return `${componentName}Logger.${level}('${message}', ${data})`;
    } else {
      return `${componentName}Logger.${level}('${message}')`;
    }
  });
  
  // Handle simpler logger calls without data
  const simpleLoggerCallRegex = /logger\.(debug|info|warn|error)\s*\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*\)/g;
  updatedContent = updatedContent.replace(simpleLoggerCallRegex, (match, level, component, message) => {
    return `${componentName}Logger.${level}('${message}')`;
  });
  
  // Write the updated content back to the file
  fs.writeFileSync(filePath, updatedContent, 'utf8');
  console.log(`  Updated ${filePath}`);
};

// Main function
const main = () => {
  try {
    const files = findFiles();
    console.log(`Found ${files.length} files with logger calls`);
    
    files.forEach(processFile);
    
    console.log('\nComplete! Run TypeScript check to verify changes.');
  } catch (error) {
    console.error('Error:', error.message);
  }
};

main(); 