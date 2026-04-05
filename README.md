# Harvest Tracker

A Next.js 14 application for tracking harvest cycles, room rotations, and yield data with real-time collaboration powered by Supabase.

## Tech Stack

- **Next.js 14** — App Router with server and client components
- **TypeScript** — Full type safety
- **Tailwind CSS** — Utility-first styling
- **Supabase** — Auth, PostgreSQL database, Row Level Security, Realtime

## Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project

## Setup

### 1. Clone and install dependencies

```bash
npm install
```

### 2. Create your Supabase project

Go to [supabase.com](https://supabase.com) and create a new project.

### 3. Run the database schema

Open the Supabase SQL Editor and run the contents of `supabase/schema.sql`. This creates:

- `profiles` table with auto-creation trigger
- `harvest_records` table with RLS policies
- `facility_config` table with default configuration
- Row Level Security policies for admin/worker roles
- Realtime enabled on `harvest_records`

### 4. Configure environment variables

```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your Supabase project URL and anon key (found in Settings > API).

### 5. Create users

In the Supabase Dashboard:

1. Go to **Authentication > Users** and create users with email/password
2. The `profiles` table auto-populates via a trigger (default role: `worker`)
3. To make a user an admin, update their role in the `profiles` table:
   ```sql
   UPDATE profiles SET role = 'admin' WHERE email = 'admin@example.com';
   ```

### 6. Generate harvest records

1. Log in as an admin
2. Go to **Config** in the nav bar
3. Adjust rotation settings and room sequence as needed
4. Click **Generate Records** to create harvest records for all cycles

### 7. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Roles

| Role   | Permissions |
|--------|-------------|
| Admin  | Full access: read/write all tables, configure facility settings, generate records |
| Worker | Read all harvest records, create and edit harvest records |

## Real-time

When any user updates a harvest record, all connected users see the change instantly. Updated rows flash with a yellow highlight and a pulsing indicator.

## Deployment

Deploy to Vercel:

1. Push to a Git repository
2. Import the project in [Vercel](https://vercel.com)
3. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` as environment variables
4. Deploy — no additional configuration needed

## Project Structure

```
src/
├── app/
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Redirects to /dashboard
│   ├── login/page.tsx      # Login page
│   ├── dashboard/
│   │   ├── layout.tsx      # Auth-protected layout with navbar
│   │   ├── page.tsx        # Main harvest table
│   │   └── record/[id]/    # Edit single record
│   ├── admin/
│   │   ├── layout.tsx      # Admin-only layout
│   │   └── config/page.tsx # Facility configuration
│   └── api/auth/callback/  # Supabase auth callback
├── components/
│   ├── auth/               # Login form
│   ├── dashboard/          # Harvest table, record form
│   ├── admin/              # Config form
│   └── ui/                 # Navbar, shared UI
├── lib/
│   ├── constants.ts        # Business logic, defaults
│   ├── types.ts            # TypeScript interfaces
│   └── supabase/           # Client, server, middleware helpers
└── middleware.ts            # Auth redirect middleware
```
