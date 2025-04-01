# Chess Wager MVP - JavaScript Version

This is the stable JavaScript branch of the Chess Wager MVP project. This branch maintains the original JavaScript implementation of the project.

## Branch Information

- **Current Branch**: `stable-javascript` (JavaScript-only version)
- **TypeScript Version**: Available in the `stable-typescript` branch

## Project Overview

Chess Wager is a platform where users can play chess with wagers. Key features include:
- User authentication
- Balance management and wagers
- Real-time chess gameplay
- Time controls

## Development Setup

1. **Install dependencies**:
   ```
   npm install
   ```

2. **Run development server**:
   ```
   npm run dev
   ```

3. **Build for production**:
   ```
   npm run build
   ```

## Branch Organization

- `stable-javascript` (this branch): Stable JavaScript version
- `stable-typescript`: Stable TypeScript version with enhanced type safety
- `main`: Default branch (TypeScript version)

## Switching to TypeScript

If you want to work with the TypeScript version of this project, checkout the `stable-typescript` branch:
```
git checkout stable-typescript
```

## Deployment

The application is deployed to Firebase Hosting. The TypeScript version (`stable-typescript` branch) is used for production deployments.

## Contributing

When contributing to this project, please consider the following:

1. For JavaScript-specific fixes, make pull requests to this branch
2. For new features or enhancements, prefer the TypeScript branch
