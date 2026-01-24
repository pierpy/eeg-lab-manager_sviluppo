# EEG Lab Manager - AI Coding Agent Instructions

## Project Overview
EEG Lab Manager is a React/TypeScript web application for managing EEG research experiments, sessions, and team members. It's built with Vite, integrates with Supabase for data persistence, and uses Google Gemini AI for research protocol suggestions.

**Key Stack:** React 19, TypeScript, Vite, Supabase, Google Gemini AI, Tailwind CSS

---

## Architecture & Data Flow

### Component Structure
- **App.tsx**: Main component managing all state (user auth, experiments, sessions, views)
- **Layout.tsx**: Responsive header/nav with role-based controls (Admins see user management)
- **Single-Page Pattern**: Navigation via `currentView` state (LOGIN → REGISTER → DASHBOARD → detailed views)

### Service Layer
1. **dataService.ts**: Supabase ORM-like abstraction with methods for Users, Experiments, Sessions, Invites
2. **geminiService.ts**: Google Gemini wrapper with two functions:
   - `summarizeSessionData()`: Creates research report summaries
   - `suggestProtocols()`: Proposes EEG recording protocols from experiment description
3. **supabaseClient.ts**: Supabase client initialization using env vars `SUPABASE_URL` and `SUPABASE_ANON_KEY`

### Data Model
```typescript
User: { id, name, email, role: 'Admin' | 'Researcher' }
Experiment: { id, userId, title, description, startDate, status, sessions[] }
Session: { id, experimentId, subjectId, date, durationMinutes, samplingRate, channelCount, notes, technicianName }
ExperimentStatus: PLANNING | ONGOING | COMPLETED | ARCHIVED
```

---

## Critical Patterns & Conventions

### State Management
- All state lives in App.tsx component (no Redux/Context)
- Form states are separate (expTitle, expDesc, etc.) - consolidate into objects when adding complexity
- `selectedExperimentId` and `selectedSessionId` track UI context for detail views

### Database Operations
- **Naming Convention**: Snake_case in Supabase, camelCase in TypeScript types
  - Field mapping: `user_id` ↔ `userId`, `start_date` ↔ `startDate`, `channel_count` ↔ `channelCount`
- **Error Handling**: Errors thrown from dataService are caught in UI handlers; check for specific error codes (e.g., `error.code === 'PGRST116'` for "not found")
- **Invite System**: Master code `'LAB-2025'` persists; single-use codes auto-deleted after validation

### AI Integration
- API key injected via Vite config: `process.env.API_KEY` and `process.env.GEMINI_API_KEY` (both set)
- Gemini model used: `gemini-3-flash-preview` (fast, suitable for real-time suggestions)
- Always access response via `.text` property per Google GenAI SDK

### Authentication
- No OAuth; email-based with invite codes
- Active user persisted in localStorage as `'eeg_lab_active_user'` JSON
- Admins generated via invite code `'LAB-2025'`; Researchers via single-use codes

---

## Development Workflows

### Build & Run
```bash
npm install          # Install dependencies
npm run dev          # Start dev server on port 3000 (Vite HMR enabled)
npm run build        # Production build to dist/
npm run preview      # Preview production build locally
```

### Environment Setup
Required `.env.local` file:
```
GEMINI_API_KEY=<your-gemini-key>
SUPABASE_URL=<your-supabase-url>
SUPABASE_ANON_KEY=<your-supabase-anon-key>
```

### Testing Gaps
- No unit tests configured (opportunities: vitest for services, React Testing Library for components)
- Manual QA workflow via browser on localhost:3000

---

## Integrations & External Dependencies

### Supabase Tables Expected
- `users` (id, name, email, role, created_at)
- `experiments` (id, user_id, title, description, status, start_date, created_at)
- `sessions` (id, experiment_id, subject_id, date, duration_minutes, sampling_rate, channel_count, notes, technician_name)
- `invites` (code, role, used_at, created_at) - master code `LAB-2025` for Admins

### Google Gemini API
- Single endpoint: `models.generateContent()` with `gemini-3-flash-preview`
- Input: prompt strings from experiment/session metadata
- Output: `.text` property with AI-generated suggestions

### UI Framework
- **No component library**: Tailwind CSS + inline styles
- **Responsive Design**: Mobile-first with `sm:` breakpoints; fixed bottom nav (mobile) vs sidebar (desktop)
- **Accessibility**: ARIA labels absent; icons via Heroicons SVG pattern

---

## Common Tasks & Implementation Notes

### Adding a New View
1. Add view name to `View` type in types.ts
2. Add form state variables in App.tsx
3. Implement handler function (e.g., `handleCreateExperiment`)
4. Add rendering logic in JSX (switch on `currentView`)
5. Update Layout nav buttons if needed

### Extending Experiments/Sessions
1. Update `Experiment` or `Session` interface in types.ts
2. Update dataService methods (insert/update/upsert calls)
3. Update Form state variables
4. Ensure snake_case mapping in Supabase operations

### Adding AI Features
1. Create function in geminiService.ts following `summarizeSessionData()` pattern
2. Instantiate fresh `GoogleGenAI` client via `getAiClient()`
3. Use `ai.models.generateContent()` with `gemini-3-flash-preview` model
4. Handle errors gracefully (return fallback string)
5. Call from App.tsx, set loading state, update UI on completion

### Debugging
- Check browser DevTools Network tab for Supabase/Gemini requests
- Verify localStorage for active user: `JSON.parse(localStorage.getItem('eeg_lab_active_user'))`
- Supabase errors visible in console with error codes for filtering
