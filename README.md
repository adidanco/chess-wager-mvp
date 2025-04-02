# Chess Wager MVP

Welcome to the Chess Wager MVP repository. This project allows users to play chess with wagers in a real-time environment.

## Repository Organization

This repository is organized into multiple branches to manage different versions and aspects of the codebase:

### Main Branches

- **`stable-typescript`**: *(Recommended for development)* Contains the TypeScript version of the application with enhanced type safety and developer experience.
- **`stable-javascript`**: Contains the original JavaScript implementation for reference.
- **`main`**: This branch (currently JavaScript) will be updated to point to the TypeScript version.

### Backup/Archive Branches

- **`typescript-migration`**: Contains the work-in-progress TypeScript migration.
- **`javascript-backup`**: Contains a backup of the JavaScript codebase.
- **`typescript-js-backup`**: Contains both JavaScript and TypeScript files before cleanup.

## Which Branch to Use

- **For Development**: Use `stable-typescript`. This branch contains the latest TypeScript version with all JavaScript files removed.
- **For JavaScript Reference**: Use `stable-javascript` if you need to reference the original JavaScript implementation.

## Project Overview

Chess Wager is a platform where users can play chess with wagers. Key features include:
- User authentication with Firebase
- Balance management and wagers
- Real-time chess gameplay
- Time controls
- TypeScript type safety (in the TypeScript version)

## Development Setup

1. **Clone the repository**:
   ```
   git clone https://github.com/adidanco/chess-wager-mvp.git
   cd chess-wager-mvp
   ```

2. **Switch to the TypeScript branch**:
   ```
   git checkout stable-typescript
   ```

3. **Install dependencies**:
   ```
   npm install
   ```

4. **Run development server**:
   ```
   npm run dev
   ```

5. **Build for production**:
   ```
   npm run build
   ```

## Deployment

The application is deployed to Firebase Hosting. The TypeScript version (`stable-typescript` branch) is used for production deployments.

## Migration Strategy

The project has been migrated from JavaScript to TypeScript. The migration process:
1. Added TypeScript configuration files
2. Created TypeScript versions of all components and utilities
3. Added type definitions for data structures
4. Enhanced error handling with proper type checking
5. Improved documentation

## Contributing

1. For new features and enhancements, please use the `stable-typescript` branch.
2. Ensure all new code adheres to TypeScript standards.
3. Add appropriate type definitions for new features.
4. Run type checking before submitting changes.
5. Update tests when modifying existing functionality.
