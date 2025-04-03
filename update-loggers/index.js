const fs = require('fs');
const path = require('path');

function updateLoggerCalls(fileContent, componentName) {
  // Check if file already has the new logger pattern
  if (fileContent.includes(`const ${componentName}Logger = createLogger(`)) {
    console.log(`File already has ${componentName}Logger, skipping`);
    return fileContent;
  }

  // Update import statement to include createLogger
  let updatedContent = fileContent.replace(
    /import\s+{\s*logger\s*}\s+from\s+['"](.+)['"]/,
    `import { logger, createLogger } from '$1'`
  );

  // If import was updated, add component logger creation
  if (updatedContent !== fileContent) {
    // Add component logger creation after the import
    const importStatement = updatedContent.match(/import\s+{\s*logger,\s*createLogger\s*}\s+from\s+['"](.+)['"]/);
    if (importStatement) {
      const loggerCreation = `\n// Create a component-specific logger\nconst ${componentName}Logger = createLogger('${componentName}');\n`;
      updatedContent = updatedContent.replace(
        importStatement[0],
        importStatement[0] + loggerCreation
      );
    }
  }

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

  // Handle logger calls with just strings (no objects)
  const stringOnlyLoggerCallRegex = /logger\.(debug|info|warn|error)\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  updatedContent = updatedContent.replace(stringOnlyLoggerCallRegex, (match, level, message) => {
    return `${componentName}Logger.${level}('${message}')`;
  });

  return updatedContent;
}

// Process command line arguments
const [,, ...filesList] = process.argv;

if (filesList.length === 0) {
  console.error('No files provided to process');
  process.exit(1);
}

// Process each file
let successCount = 0;
let errorCount = 0;

filesList.forEach(filePath => {
  try {
    console.log(`Processing ${filePath}...`);
    
    // Read the file
    const fileContent = fs.readFileSync(filePath, 'utf8');
    
    // Extract component name from file path
    const componentName = path.basename(filePath, path.extname(filePath));
    
    // Update logger calls
    const updatedContent = updateLoggerCalls(fileContent, componentName);
    
    // Write the updated content back to the file
    if (updatedContent !== fileContent) {
      fs.writeFileSync(filePath, updatedContent, 'utf8');
      console.log(`  Updated ${filePath}`);
      successCount++;
    } else {
      console.log(`  No changes needed for ${filePath}`);
    }
  } catch (error) {
    console.error(`  Error processing ${filePath}: ${error.message}`);
    errorCount++;
  }
});

console.log(`\nLogger migration completed. Updated ${successCount} files with ${errorCount} errors.`);
