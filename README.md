# Chess Wager MVP - TypeScript Version

This is the stable TypeScript branch of the Chess Wager MVP project. This branch contains the TypeScript implementation with enhanced type safety, real money transactions, player ratings, and comprehensive admin capabilities.

## Branch Information

- **Current Branch**: `stable-typescript` (TypeScript-only version)
- **JavaScript Version**: Available in the `stable-javascript` branch

## Project Overview

Chess Wager is a platform where users can play chess with real or virtual wagers. Key features include:

- User authentication with email verification and OTP
- Real money balance management and secure transactions
- Glicko-2 rating system for skill-based matchmaking
- Real-time chess gameplay with standard rules
- Secure wagering and payout systems
- Administrative dashboard for transaction management
- Comprehensive user profiles and statistics

## Recent Updates

- **Real Money Transactions**: Implemented deposit and withdrawal flows using UPI for Indian users
- **Glicko-2 Rating System**: Added sophisticated player rating system for fair matchmaking
- **Firebase Cloud Functions**: Implemented secure backend processes for handling transactions
- **Admin Dashboard**: Added comprehensive admin tools for managing withdrawals and user data
- **Enhanced Security**: Implemented Firestore security rules to protect financial transactions
- **User Stats**: Added detailed player statistics and rating history
- **Error Handling System**: Added comprehensive error handling utilities with categorization and context tracking
- **Validation System**: Implemented validation utilities for payment and withdrawal data
- **Logging System**: Created structured logging capabilities with component-specific loggers
- **Testing Utilities**: Added mock data generation and test helpers for development

## Deployment

The application is deployed to Firebase Hosting. The current live version can be accessed at:
[https://chess-wager-mvp.web.app](https://chess-wager-mvp.web.app)

## Technical Features

### Rating System
- Implemented Glicko-2 rating algorithm
- Rating history tracking
- Performance-based matchmaking

### Transaction System
- Secure deposit and withdrawal using UPI
- Transaction logs and history
- Admin approval system for withdrawals
- Platform fee structure for monetization

### Firebase Features
- Firestore for data storage
- Cloud Functions for secure transaction processing
- Authentication with email verification
- Hosting for frontend deployment
- Security rules for data protection

## Utility Systems

The application includes several new utility systems to enhance reliability and code quality:

### Error Handling
- Categorized error handling with consistent UI feedback
- Specialized handlers for different error types (payment, transaction, auth, etc.)
- Context-aware error logging for easier debugging
- Built-in toast notifications

### Validation
- Rule-based validation for form inputs
- Payment amount and UPI ID validation
- Reusable validation rules for different data types

### Logging
- Component-specific loggers to simplify debugging
- Multiple log levels (DEBUG, INFO, WARN, ERROR)
- Context data inclusion with structured formatting
- Remote logging capability for production

### Testing
- Network delay simulation
- Random error simulation
- Mock transaction generation
- Development-only safeguards

See [UTILITIES.md](./UTILITIES.md) for detailed documentation of these systems.

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

5. **Deploy to Firebase**:
   ```
   firebase deploy
   ```

## Branch Organization

- `stable-typescript` (this branch): Stable TypeScript version with enhanced type safety
- `stable-javascript`: Original JavaScript version for reference
- `main`: Default branch (TypeScript version)

## Future Plans

- **Payment Gateway Integration**: Plans to integrate Cashfree for seamless deposits and withdrawals
- **Enhanced Analytics**: Improved user and game statistics
- **Tournament Structure**: Support for tournament play with prize pools
- **Mobile Application**: Development of mobile versions for iOS and Android

## Contributing

When contributing to this project, please consider the following:

1. Ensure all new code adheres to TypeScript standards
2. Add appropriate type definitions for new features
3. Run type checking before submitting changes
4. Update tests when modifying existing functionality
5. Follow security best practices for financial features
