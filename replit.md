# Phone Shop Management System

## Overview

A production-ready, multi-tenant SaaS Phone Shop Management System designed for phone retailers. The system provides complete business operations management including POS, daily closures, inventory tracking, repairs, trade-ins, and comprehensive owner oversight with role-based access control.

Key capabilities:
- Full CRUD operations on all business entities
- Role-based permissions (Owner, Supervisor, Staff)
- Real-time daily closure and financial reporting
- Device trade-in assessment with IMEI validation
- Repair workflow management
- Mobile-first responsive design for staff iPhones
- Desktop dashboards for owner oversight

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight client-side routing)
- **State Management**: TanStack React Query for server state, React Context for auth/app state
- **Styling**: Tailwind CSS v4 with shadcn/ui component library (New York style)
- **Build Tool**: Vite with custom plugins for Replit integration
- **Forms**: React Hook Form with Zod validation

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript (ESM modules)
- **API Style**: RESTful JSON endpoints under `/api/`
- **Database ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Validation**: Zod with drizzle-zod integration

### Data Layer
- **Database**: PostgreSQL (configured via DATABASE_URL environment variable)
- **Migrations**: Drizzle Kit for schema management
- **Schema Location**: `shared/schema.ts` (shared between client and server)

### Key Design Patterns
- **Monorepo Structure**: Client, server, and shared code in single repository
- **Shared Types**: Schema definitions used by both frontend and backend
- **Storage Interface**: Abstract storage layer (`IStorage`) for data access
- **Path Aliases**: `@/` for client, `@shared/` for shared modules

### Authentication & Authorization
- Role-based access: Owner (full access), Supervisor (review/approve), Staff (submit only)
- Backend enforces permissions (not frontend-only)
- Session-based authentication ready for production implementation

### Build & Deployment
- Development: Vite dev server with HMR
- Production: esbuild bundles server, Vite builds client to `dist/`
- Single entry point: `server/index.ts`

## External Dependencies

### Database
- **PostgreSQL**: Primary database (requires DATABASE_URL env var)
- **Drizzle ORM**: Database queries and schema management
- **connect-pg-simple**: PostgreSQL session store (ready for sessions)

### UI Components
- **Radix UI**: Headless accessible components (dialogs, menus, forms)
- **shadcn/ui**: Pre-styled component library
- **Lucide React**: Icon library
- **Recharts**: Dashboard charts and visualizations
- **html5-qrcode**: Barcode/IMEI scanning capability

### Utilities
- **date-fns**: Date formatting and manipulation
- **Zod**: Runtime schema validation
- **class-variance-authority**: Component variant styling

### Development Tools
- **Vite**: Frontend build and dev server
- **esbuild**: Server bundling for production
- **TypeScript**: Type checking across all code
- **Drizzle Kit**: Database migrations (`npm run db:push`)