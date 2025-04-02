# Chess Wager MVP - TypeScript Version

This is the stable TypeScript branch of the Chess Wager MVP project. This branch contains the TypeScript implementation with enhanced type safety and developer experience.

## Branch Information

- **Current Branch**: `stable-typescript` (TypeScript-only version)
- **JavaScript Version**: Available in the `stable-javascript` branch

## Project Overview

Chess Wager is a platform where users can play chess with wagers. Key features include:
- User authentication
- Balance management and wagers
- Real-time chess gameplay
- Time controls
- TypeScript type safety

## TypeScript Benefits

- **Type Safety**: Catch errors at compile time rather than runtime
- **Better Developer Experience**: Improved autocomplete and IntelliSense
- **Self-Documenting Code**: Types serve as documentation
- **Easier Refactoring**: TypeScript makes large-scale changes safer

## Development Setup

1. **Install dependencies**:
   ```
   npm install
   ```

2. **Run development server**:
   ```
   npm run dev
   ```

3. **Type checking**:
   ```
   npm run tsc
   ```

4. **Build for production**:
   ```
   npm run build
   ```

## Branch Organization

- `stable-typescript` (this branch): Stable TypeScript version with enhanced type safety
- `stable-javascript`: Original JavaScript version for reference
- `main`: Default branch (TypeScript version)

## Switching to JavaScript

If you need to reference the JavaScript version of this project, checkout the `stable-javascript` branch:
```
git checkout stable-javascript
```

## Deployment

The application is deployed to Firebase Hosting. This branch (`stable-typescript`) is used for production deployments.

## Contributing

When contributing to this project, please consider the following:

1. Ensure all new code adheres to TypeScript standards
2. Add appropriate type definitions for new features
3. Run type checking before submitting changes
4. Update tests when modifying existing functionality
