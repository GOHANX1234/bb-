# Overview

HITORI MODX is a comprehensive license management system designed for game hack resellers. The platform provides robust key generation, administration, and tracking capabilities with role-based access control. It supports multiple games (PUBG Mobile, Last Island of Survival, Free Fire) and offers features like dynamic key generation, device tracking, real-time notifications via WebSocket, and online update management.

The application serves two primary user roles:
- **Admins**: Full system control including reseller management, token generation, key oversight, and online update management
- **Resellers**: Self-service key generation and management within their credit allocation

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture

The client is built with React and TypeScript using a modern component-based architecture:

- **Routing**: Wouter for lightweight client-side routing with role-based protected routes
- **State Management**: TanStack Query (React Query) for server state, caching, and automatic refetching
- **UI Framework**: shadcn/ui components built on Radix UI primitives with TailwindCSS styling
- **Form Handling**: React Hook Form with Zod schemas for type-safe validation
- **Authentication**: Context-based auth provider with session management via cookies
- **Build Tool**: Vite for fast development and optimized production builds
- **Theme**: Forced dark mode with purple accent colors and animations

The UI implements responsive design with mobile-first considerations, using custom mobile dialog components and the `useIsMobile` hook for device-specific rendering. Protected routes ensure proper role-based access control.

## Backend Architecture

The server uses Express.js with MongoDB as the database:

- **Framework**: Express.js for REST API endpoints
- **Database**: MongoDB Atlas with Mongoose ODM for data modeling
- **Authentication**: Passport.js with local strategy for credential-based auth
- **Session Management**: Express-session with memory store (cookie-based sessions)
- **Real-time Communication**: WebSocket server for push notifications to resellers
- **Password Security**: bcrypt for password hashing (12 salt rounds)

### Data Models

Six primary MongoDB collections via Mongoose schemas:

1. **Admins**: System administrators with encrypted passwords
2. **Resellers**: Users who generate keys, tracked by credits and active status
3. **Tokens**: Registration tokens for reseller onboarding with credit allocation
4. **Keys**: Generated license keys with game type, expiry, device limits, and revocation status
5. **Devices**: Device tracking per key with unique device IDs
6. **OnlineUpdates**: Admin-managed announcements pushed to reseller dashboards

Each model includes auto-incrementing numeric IDs, timestamps, and appropriate indexes for query optimization.

### API Structure

RESTful endpoints organized by role:

- `/api/auth/*`: Login, logout, registration, session management
- `/api/admin/*`: Admin-only endpoints for reseller/token/key/update management
- `/api/reseller/*`: Reseller endpoints for profile, key generation, and key management
- `/api/verify`: Public key verification endpoint for game clients
- `/api/online-updates`: Public endpoint for fetching active updates
- `/ws`: WebSocket endpoint for real-time reseller notifications

CORS is configured with stricter policies for admin endpoints in production, supporting credential-based requests.

### Storage Layer

The `MongoDBStorage` class implements the `IStorage` interface, providing abstraction over MongoDB operations. Auto-incrementing IDs are managed in-memory with initialization from database state. All database operations are promise-based with proper error handling.

## External Dependencies

### Database
- **MongoDB Atlas**: Cloud-hosted MongoDB database accessed via `MONGODB_URI` environment variable
- **Mongoose**: ODM for schema validation, middleware hooks (password hashing), and query building

### Third-Party Libraries

**Backend:**
- `express`: Web server framework
- `passport` + `passport-local`: Authentication middleware
- `express-session`: Session management
- `bcryptjs`: Password hashing
- `ws`: WebSocket server implementation
- `nanoid`: Unique ID generation for tokens
- `cors`: Cross-origin resource sharing

**Frontend:**
- `@tanstack/react-query`: Server state management
- `wouter`: Client-side routing
- `react-hook-form`: Form state and validation
- `zod`: Schema validation
- `@radix-ui/*`: Headless UI components
- `tailwindcss`: Utility-first CSS
- `next-themes`: Theme management (forced dark mode)

### Build & Development Tools
- `vite`: Frontend build tool and dev server
- `esbuild`: Server bundling
- `typescript`: Type checking
- `drizzle-kit`: Database migrations (configured but not actively used with MongoDB)

### Deployment Configuration

The application is configured for deployment on Render with:
- Port 5000 configuration
- Trust proxy settings for secure cookies behind load balancers
- Environment-based CORS origin configuration
- Persistent disk mounting at `/data` (though MongoDB handles persistence)
- Build script combining Vite client build and esbuild server bundling