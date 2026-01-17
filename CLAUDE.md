# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Enterprise Annual Party Lucky Draw System (年会受控抽奖系统) - A full-screen lottery/raffle tool with black-gold tech aesthetic. Features "controlled drawing" (guaranteed winners, banned lists, weighted probabilities) and offline operation with localStorage persistence.

## Development Commands

```bash
pnpm install          # Install dependencies
pnpm dev              # Start dev server (http://localhost:5173)
pnpm build            # TypeScript compile + Vite build (outputs single HTML file)
pnpm lint             # ESLint validation
pnpm preview          # Preview production build
pnpm test             # Run Vitest tests
```

## Architecture

**Stack**: React 19 + TypeScript + Tailwind CSS + Vite

**Routing**: Hash-based via Wouter for offline file:// protocol support
- `/` - Display page (lottery animation)
- `/admin` - Admin console (password-protected)

**State Management**: Zustand with localStorage persistence
- Store: `src/store/useStore.ts`
- Persistence key: `'lucky-draw-storage'`
- Multi-window sync via polling (Display: 500ms, Admin: 1000ms)

**Core Business Logic**: `src/lib/lottery-logic.ts`
- Weighted random selection algorithm
- Must-win candidate prioritization
- Banned list filtering

**Key Components**:
- `src/pages/DisplayPage.tsx` - Main lottery display with real-time sync
- `src/pages/AdminPage.tsx` - Control panel (prize/participant management)
- `src/components/RollingBoard.tsx` - Lottery animation (welcome/rolling modes)

**UI**: Shadcn/ui components in `src/components/ui/`

## Code Conventions

- Path aliases: Use `@/` prefix for imports (maps to `src/`)
- UI components: Import from `@/components/ui`
- Business logic: Place in `@/lib`
- Custom hooks: Place in `@/hooks`
- Types/interfaces: Define in `@/lib/types.ts`

## Build Output

Single-file HTML bundle in `/dist` - all CSS/JS/images inlined for offline USB distribution.

## Testing

Uses Vitest. Run with `pnpm test`.
