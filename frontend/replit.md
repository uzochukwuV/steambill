# streamRoll Marketplace

## Overview

streamRoll is a modern marketplace platform that enables users to buy and sell both physical goods and digital assets (NFTs). The application supports multiple item types including physical products, ERC721 NFTs, and ERC1155 tokens. Built with a React frontend and Express backend, it provides a complete e-commerce experience with shopping cart functionality, transaction management, and a responsive dark-themed interface.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite for build tooling
- **Routing**: Wouter for client-side routing with pages for home, listing creation, dashboard, cart, and item details
- **State Management**: TanStack React Query for server state management and caching
- **UI Components**: Shadcn/ui component library with Radix UI primitives for accessible components
- **Styling**: Tailwind CSS with a custom dark theme and orange accent colors
- **Forms**: React Hook Form with Zod validation for type-safe form handling
- **Animations**: Framer Motion for smooth interactions and page transitions

### Backend Architecture
- **Framework**: Express.js with TypeScript running on Node.js
- **API Design**: RESTful API with routes for listings, cart management, and transactions
- **Data Storage**: In-memory storage with interfaces designed for easy database integration
- **Validation**: Zod schemas for request/response validation
- **Development**: Hot reload with Vite middleware integration

### Database Schema Design
- **Users**: User profiles with wallet addresses for crypto integration
- **Listings**: Support for physical items, ERC721, and ERC1155 tokens with metadata
- **Cart Items**: Shopping cart functionality with quantity management
- **Transactions**: Order history with fee breakdown (marketplace and protocol fees)

### Data Storage Strategy
- **Current Implementation**: In-memory storage for development/demo purposes
- **Production Ready**: Drizzle ORM configured for PostgreSQL with migration support
- **Schema Location**: Shared schema definitions between frontend and backend

### Authentication & Authorization
- **Wallet Integration**: MetaMask wallet connection with Base network support
- **Session Management**: Connect-pg-simple for PostgreSQL session storage
- **User Management**: User profiles linked to wallet addresses
- **Network Management**: Automatic network switching to Base mainnet

### Web3 Integration
- **Smart Contract Integration**: Ready for marketplace and payment protocol contracts
- **USDC Payments**: Support for USDC stablecoin transactions on Base
- **Wallet Connection**: Seamless wallet connection with network detection
- **Transaction Management**: Gas-optimized transactions with error handling

## External Dependencies

### Blockchain & Web3
- **Ethers.js**: Ethereum and Base network interactions
- **MetaMask**: Wallet connection and transaction signing
- **Base Network**: Layer 2 blockchain for USDC transactions
- **Smart Contracts**: Custom marketplace and payment protocol contracts

### Database Services
- **PostgreSQL**: Primary database (configured via Drizzle but not currently connected)
- **Neon Database**: Serverless PostgreSQL provider support

### UI & Styling
- **Radix UI**: Comprehensive primitive components for accessibility
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Icon library for consistent iconography
- **React Icons**: Additional icon sets for social media and branding

### Development Tools
- **Vite**: Fast build tool with HMR and plugin ecosystem
- **TypeScript**: Type safety across the entire stack
- **ESBuild**: Fast JavaScript bundler for production builds
- **Replit Integration**: Development environment optimizations

### Form & Validation
- **React Hook Form**: Performant form library with minimal re-renders
- **Zod**: Schema validation for runtime type safety
- **Hookform Resolvers**: Integration between React Hook Form and Zod

### Animation & Interaction
- **Framer Motion**: Animation library for smooth user interactions
- **Embla Carousel**: Touch-friendly carousel component

### Date & Time
- **date-fns**: Modern date utility library for formatting and manipulation