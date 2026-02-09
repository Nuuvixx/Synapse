# Synapse Frontend

A professional-grade infinite canvas for knowledge workers. Semantic AI organizes information automatically.

## Features

- **Landing Page** - Professional landing with product preview
- **Authentication** - Login/Register with JWT token management
- **Dashboard** - Workspace management interface
- **Canvas Workspace** - Infinite canvas with:
  - Pan & zoom navigation
  - Item cards (notes, links, code)
  - Semantic clustering visualization
  - Floating toolbar
  - Item detail panel

## Tech Stack

- **React 18** with TypeScript
- **Vite** for fast development
- **Tailwind CSS** for styling
- **shadcn/ui** for components
- **Framer Motion** for animations
- **Lucide React** for icons
- **React Query** for data fetching

## Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm

### Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start development server
npm run dev
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL | `http://localhost:8000` |

## Project Structure

```
src/
├── components/
│   ├── ui/          # shadcn/ui components
│   ├── Navbar.tsx
│   ├── HeroSection.tsx
│   ├── FeaturesSection.tsx
│   ├── DemoSection.tsx
│   └── Footer.tsx
├── pages/
│   ├── Index.tsx     # Landing page
│   ├── Login.tsx     # Login page
│   ├── Register.tsx  # Register page
│   ├── Dashboard.tsx # Workspace dashboard
│   ├── Workspace.tsx # Canvas workspace
│   └── NotFound.tsx  # 404 page
├── hooks/
│   └── use-*.ts
├── lib/
│   └── utils.ts
├── App.tsx           # Routes configuration
└── main.tsx          # Entry point
```

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run test` - Run tests

## Backend Integration

This frontend connects to the [Synapse Backend](../synapse-backend) API for:

- User authentication (JWT)
- Workspace CRUD operations
- Item management
- Cluster computation

Make sure the backend is running on the URL specified in `VITE_API_URL`.

## License

MIT
