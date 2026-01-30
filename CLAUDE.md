# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Creative Compass is an AI-powered creative strategy and idea generation platform for marketing/advertising agencies. It helps strategists research clients, analyze competitors, generate content ideas, and create visual concepts.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **UI**: React 19 with Radix UI components
- **Styling**: Tailwind CSS with custom IBM Plex Sans Thai font
- **Database**: Supabase (PostgreSQL)
- **AI Integration**: n8n webhooks for idea generation
- **State Management**: React hooks with client-side session management

## Development Commands

```bash
# Development server (default port 3000)
npm run dev

# Production build
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

## Architecture

### App Structure

This is a Next.js App Router application with the following key directories:

- `app/` - Next.js pages and API routes
  - `app/page.tsx` - Main idea generation interface
  - `app/configure/page.tsx` - Client configuration and research dashboard
  - `app/images/page.tsx` - Image gallery and generation
  - `app/new-client/page.tsx` - Client onboarding
  - `app/api/` - API route handlers
- `components/` - React components (both UI primitives and feature components)
- `lib/` - Shared utilities, data fetching, and business logic
  - `lib/data/` - Database query functions
  - `lib/supabase/` - Supabase client configuration
  - `lib/utils/` - Utility functions including caching

### Database Architecture (Supabase)

The application uses several key tables:

- **Clients** - Client profiles with business information (clientName, productFocus, websiteUrl, etc.)
- **Competitor** - Competitor analysis data (services, pricing, strengths, weaknesses)
- **research_market** - Market research and insights data
- **idea_generation_tasks** - Async task tracking for AI-generated ideas
- **saved_ideas** - User-saved content ideas
- **feedback** - User feedback on generated ideas
- **ads_details** - Facebook ads performance data

### Data Fetching Pattern

The application uses a **server-side caching layer** to optimize database queries:

1. All data fetching happens in `lib/data/*.ts` files
2. Queries are wrapped with `cachedQuery()` from `lib/utils/server-cache.ts`
3. Cache invalidation happens via `invalidateCache()` in server actions
4. Default cache TTL is 2 minutes (120,000ms)

Example:
```typescript
export async function getClients(): Promise<ClientListItem[]> {
  return cachedQuery("clients:list", async () => {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from("Clients")
      .select("id, clientName")
      .order("clientName")
    // ... error handling
    return data
  }, 60 * 1000) // 1 minute cache
}
```

### Client-Side Session Management

The app uses a singleton `SessionManager` (lib/session-manager.ts) for:
- Browser-based session tracking via localStorage
- Client-side data caching with TTL
- Debounced session saving (1 second delay)

### Async Task Pattern

AI idea generation uses an async webhook pattern:

1. `POST /api/generate-ideas` - Creates task record, fires n8n webhook, returns taskId
2. n8n processes in background
3. `POST /api/generate-ideas/callback` - Webhook callback updates task status
4. `GET /api/generate-ideas/status?taskId=X` - Client polls for results

### URL Navigation Pattern

The application heavily uses URL search params for state management:
- `?clientId=` - Active client ID
- `?clientName=` - Active client name (takes priority over clientId)
- `?productFocus=` - Selected product/service focus
- `?serviceFilter=` - Filter by service category
- `?page=` - Pagination

When updating navigation, always use Next.js router with search params rather than internal state.

### Component Organization

- **UI Components** (`components/ui/`) - Radix UI primitives (button, dialog, select, etc.)
- **Feature Components** (`components/`) - Business logic components
  - Form components: `business-profile-form.tsx`, `feedback-form.tsx`, `facebook-ads-form.tsx`
  - Display components: `competitor-table.tsx`, `research-insights-section.tsx`, `saved-ideas.tsx`
  - Layout: `main-sidebar.tsx`, `configure-sidebar.tsx`

### Styling Conventions

- Uses Tailwind CSS with custom design tokens defined in `tailwind.config.ts`
- Color system uses CSS variables (HSL values): `hsl(var(--primary))`, `hsl(var(--accent))`, etc.
- IBM Plex Sans Thai is the primary font family
- Responsive design uses Tailwind breakpoints

## Environment Variables

Required environment variables (from `.env`):

```bash
NEXT_PUBLIC_SUPABASE_URL=       # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=  # Supabase anon/public key
NEXT_PUBLIC_BASE_URL=           # Application base URL (optional, for webhooks)
```

The n8n webhook URL is hardcoded in `app/api/generate-ideas/route.ts`.

## Configuration Notes

- **TypeScript**: Build errors are ignored (`ignoreBuildErrors: true` in next.config.mjs)
- **Images**: Image optimization is disabled (`unoptimized: true`)
- **Console Logs**: Removed in production builds
- **Caching**: Pages use `revalidate = 60` and `dynamic = 'force-dynamic'` for fresh data

## Path Aliases

The project uses `@/*` to reference the root directory:
```typescript
import { Button } from "@/components/ui/button"
import { getSupabase } from "@/lib/supabase/server"
```

## Key Workflows

### Adding a New Client
1. User navigates to `/new-client`
2. Submits Facebook URL via form
3. Server action `createClients()` in `app/actions.ts` creates Clients record
4. Redirects to `/configure` with new clientId

### Generating Ideas
1. User selects client + product focus on main page
2. Submits form with optional custom prompt
3. Frontend calls `/api/generate-ideas`
4. Receives taskId, polls `/api/generate-ideas/status`
5. Results display in modal with feedback options

### Competitor Research
1. Navigate to `/configure?clientId=X`
2. View competitor table populated from `Competitor` table
3. Add new competitors via `AddCompetitorModal`
4. Edit inline using `CompetitorTable` component
5. Changes saved via `updateCompetitor()` server action

## Performance Considerations

- Server-side caching reduces database load (2-minute default TTL)
- Client-side SessionManager caches API responses
- React components use `memo()` for expensive renders
- Supabase queries are optimized with specific column selection
- Image optimization is disabled (consider enabling for production)
