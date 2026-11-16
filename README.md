# Smart Gardening System

A decoupled Model–View–Controller (MVC) Smart Gardening application suite.

## Architecture
- **Frontend**: Vue 3 SPA (Vite, Pinia, Vue Router, Axios)
- **Backend**: Node.js + Fastify (CommonJS, JWT, RBAC)
- **Database**: MariaDB 10.11 via Docker / Sequelize ORM (dual-dialect support with SQLite for testing)

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration
Copy `.env.example` to `.env` and configure your credentials:
```bash
cp .env.example .env
```

### 3. Run Development Servers
- Backend:
  ```bash
  npm run dev:backend
  ```
- Frontend:
  ```bash
  npm run dev:frontend
  ```

For detailed specifications and feature inventory, refer to [PROJECT.md](PROJECT.md).
