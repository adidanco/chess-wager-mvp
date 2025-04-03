/**
 * Simple utility function to update the logger calls in a single file
 * 
 * This function:
 * 1. Updates the import statement to include createLogger
 * 2. Adds a component-specific logger instance
 * 3. Updates all logger calls to use the component-specific logger
 * 
 * Example usage:
 * ```
 * import { updateLoggerCalls } from '../utils/updateSingleFileLogger';
 * 
 * // Run this function in the browser console or in a test file
 * updateLoggerCalls('src/components/Home.tsx', 'Home');
 * ```
 */

/**
 * Updates the logger calls in a single file
 * @param fileContent The content of the file to update
 * @param componentName The name of the component (used for the logger instance)
 * @returns The updated file content
 */
export function updateLoggerCalls(fileContent: string, componentName: string): string {
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

/**
 * Updates the specified file with new logger calls
 * @param filePath Path to the file relative to the project root
 * @param componentName The name of the component (defaults to the filename without extension)
 */
export async function updateFile(filePath: string, componentName?: string): Promise<void> {
  try {
    // This would be implemented in a Node.js environment
    // For browser environment, this is just a placeholder
    console.log(`Would update ${filePath} with component name ${componentName || 'derived from filename'}`);
  } catch (error) {
    console.error('Error updating file:', error);
  }
} 