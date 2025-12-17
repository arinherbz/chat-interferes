# Ario Tech - Phone Shop Management System

## Overview

A premium phone shop management system with an Apple Store-inspired interface. The system provides complete business operations management including POS, trade-ins, repairs, and admin oversight.

**Branding:** Ario Tech - Premium Device Solutions

## Current Setup

There are two app implementations in this project:

### 1. Flask/Python App (Ario Tech - NEW)
Location: `phone_shop_system/`
- Apple Store-style interface (clean, minimal, white design)
- Flask with SQLAlchemy + PostgreSQL
- Full CRUD operations
- Role-based permissions (admin/staff)

To run: `cd phone_shop_system && python main.py`

Demo accounts:
- admin / admin123
- staff / staff123

### 2. Node.js/React App (Original)
Location: Root directory (`server/`, `client/`)
- React frontend with Vite
- Express backend with Drizzle ORM

Currently running via: `npm run dev`

## How to Switch to Flask App

To run the Ario Tech Flask app instead of the Node.js app:

1. Open the **Workflows** panel (or find it in settings)
2. Edit the "Start application" workflow
3. Change the command from `npm run dev` to:
   ```
   cd phone_shop_system && python main.py
   ```
4. Save and restart the workflow

Alternatively, modify the `.replit` file:
```
run = "cd phone_shop_system && python main.py"
```

## Flask App Features

### Pages
- `/login` - Sign in page
- `/dashboard` - Overview with stats, charts, pending items
- `/sales` - New sale form
- `/tradein` - Trade-in wizard with cascading dropdowns
- `/repairs` - Repair request form
- `/admin/models` - Manage phone models (admin only)
- `/admin/staff` - Staff management (admin only)
- `/receipt/<id>` - Printable receipt

### API Endpoints
- `GET /api/brands` - List all brands
- `GET /api/models?brand_id=X` - Models for a brand
- `GET /api/storages?model_id=X` - Storage options for a model
- `POST /api/tradein` - Submit trade-in
- `POST /api/sale` - Submit sale
- `POST /api/repair` - Submit repair
- `GET /api/dashboard-stats` - Dashboard statistics

### Database Models
- Brand, Model, StorageOption (normalized phone data)
- Product, Device, Customer
- Sale, TradeIn, Repair
- User, AuditLog

## Design Style

The Flask app uses an Apple Store-inspired design:
- Clean, minimal white backgrounds
- SF Pro Display font family
- Rounded corners (18px for cards, 12px for inputs)
- Blue accent color (#0071e3)
- Subtle shadows and glassmorphism navbar
- Responsive layout with sticky sidebars

## User Preferences

- Preferred interface: Apple Store style
- Branding: "Ario Tech" (not TechPost or Phone Shop)
- Language: Simple, everyday language

## Dependencies

### Python (Flask App)
- flask
- flask-sqlalchemy
- psycopg2-binary

### Node.js (Original App)
- See package.json for full list
