# Ario Tech - Phone Shop Management System

## Overview

A production-ready phone shop management system with Apple Store-inspired interface. Built for daily shop use with role-based access control, staff management, activity tracking, and comprehensive business analytics.

**Branding:** Ario Tech - Premium Device Solutions

## Current Setup

The project contains a Flask/Python application with full business management features.

### Running the App
Location: `phone_shop_system/`
To run: `cd phone_shop_system && python main.py`
Or use: `python run_flask.py` from root directory

### Demo Accounts
| Username | Password | PIN | Role |
|----------|----------|-----|------|
| owner | owner123 | 1234 | Owner (full access) |
| manager | manager123 | 5678 | Manager |
| staff | staff123 | 0000 | Sales Staff |

## How to Switch Workflow

To run the Flask app, update the workflow command:
1. Open the **Workflows** panel
2. Edit "Start application"
3. Change command to: `cd phone_shop_system && python main.py`
4. Save and restart

## Features

### Role-Based Access Control
Three-tier permission system:
- **Owner**: Full access (all data, profits, staff management, settings, delete records)
- **Manager**: View all leads/deliveries, assign leads, cannot delete or see profits
- **Sales Staff**: Add/update own leads only, create sales, limited visibility

### Authentication
- Username + Password login
- Quick PIN login (4-digit) for shop floor use
- Session persistence (7-day sessions)
- Secure logout
- Werkzeug password hashing (PBKDF2-SHA256)

### Staff Management (Owner only)
- Create staff accounts with role assignment
- Activate/deactivate staff accounts
- View last activity timestamps
- Role-based permission indicators

### Activity Tracking
Every action logged with:
- Who created/updated/closed records
- Timestamps
- IP addresses
- Action details

### Owner Dashboard
- Sales per staff (today)
- Revenue and profit tracking
- Lead conversion rates by staff
- Overdue follow-ups count
- Pending/failed deliveries
- Recent activity feed

### Core Modules
- **Leads**: Customer lead management with follow-up tracking
- **Sales**: POS with multiple payment methods (Cash, Card, M-Pesa)
- **Trade-In**: Device evaluation with condition scoring
- **Repairs**: Repair request tracking with status workflow
- **Deliveries**: Delivery scheduling and tracking

### Pages
- `/login` - Sign in (password or PIN)
- `/dashboard` - Role-appropriate overview
- `/leads` - Lead management
- `/sales` - New sale form
- `/tradein` - Trade-in wizard
- `/repairs` - Repair request form
- `/owner/dashboard` - Owner analytics (owner only)
- `/staff` - Staff management (owner only)
- `/admin/models` - Phone model management (owner only)
- `/receipt/<id>` - Printable receipt

### API Endpoints
- `GET /api/brands` - List brands
- `GET /api/models?brand_id=X` - Models for brand
- `GET /api/storages?model_id=X` - Storage options
- `POST /api/tradein` - Submit trade-in
- `POST /api/sale` - Record sale
- `POST /api/repair` - Submit repair
- `GET /api/dashboard-stats` - Dashboard metrics
- `GET /api/staff-performance` - Staff metrics (owner)
- `GET /api/activity-log` - Activity log (owner)

### Database Models
- User (with role, PIN, activity tracking)
- Lead (customer leads with assignment)
- Sale (with profit tracking)
- TradeIn (device valuations)
- Repair (service requests)
- Delivery (fulfillment)
- ActivityLog (audit trail)
- Brand, Model, StorageOption (device catalog)

## Design Style

Apple Store-inspired interface:
- Clean white backgrounds
- SF Pro Display font family
- Rounded corners (18px cards, 12px inputs)
- Blue accent (#0071e3)
- Subtle shadows
- Glassmorphism navbar
- Mobile-first responsive design
- Large tap targets for one-hand use

## Security Features

- Werkzeug PBKDF2-SHA256 password hashing
- Role-based decorators for route protection
- Session management with timeout
- Activity logging for audit trails
- Input validation on all forms

## User Preferences

- Interface: Apple Store style
- Branding: "Ario Tech"
- Language: Simple, everyday language
- Mobile-first design

## Dependencies

### Python
- flask
- flask-sqlalchemy
- psycopg2-binary
- werkzeug (for security)

## Recent Changes

- 2024-12-17: Implemented comprehensive staff login system
- 2024-12-17: Added 3-tier role-based access control
- 2024-12-17: Created owner dashboard with staff performance
- 2024-12-17: Added activity tracking for all actions
- 2024-12-17: Mobile-first responsive design improvements
- 2024-12-17: Upgraded to Werkzeug secure password hashing
