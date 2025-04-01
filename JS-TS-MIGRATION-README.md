# JavaScript to TypeScript Migration

This project has been migrated from JavaScript to TypeScript. The original JavaScript files have been backed up and scripts are provided to manage the migration process.

## Current Status

- All core files have been converted to TypeScript
- Both JS and TS files exist in the repository
- The app is currently configured to use the TypeScript versions

## Backup Information

- Original JavaScript files are backed up in the `js-backup` directory
- A Git branch named `typescript-js-backup` contains the complete state with both JS and TS files
- A Git branch named `javascript-backup` contains the original JavaScript-only state

## Available Scripts

### `./remove-js-files.sh`

This script will remove all `.js` and `.jsx` files from the `src` directory. It will:
1. Verify that backups exist in the `js-backup` directory
2. Count how many files will be removed
3. Ask for confirmation before proceeding
4. Remove the files
5. Display a summary

### `./restore-js-files.sh`

This script will restore all JavaScript files from the backup:
1. Copy all files from `js-backup` back to the `src` directory
2. Maintain the original directory structure
3. Display each file as it's restored

## How to Switch Versions

### To use TypeScript (current setup):
- No action needed, the app is already configured to use TypeScript

### To temporarily switch back to JavaScript:
1. Run `./restore-js-files.sh` to restore the JavaScript files
2. Move `vite.config.ts` to `vite.config.ts.temp`
3. Move `vite.config.js.old` to `vite.config.js`
4. Edit `index.html` to point to `main.jsx` instead of `main.tsx`
5. Restart the development server with `npm run dev`

### To permanently revert to JavaScript:
1. `git checkout javascript-backup`
2. Follow your normal workflow from there

## Testing Procedures

After any version switch, thoroughly test:
1. User authentication flows
2. Game creation and joining
3. Gameplay functionality
4. Balance management

## Notes

- Keep both versions until confident that TypeScript is working correctly
- The TypeScript version has improved type safety and better error checking 