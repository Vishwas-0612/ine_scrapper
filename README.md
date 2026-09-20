# INE Product Price Tracker Application

A robust, decoupled full-stack Product Price Tracker monorepo application built for the **INE Internship Assignment**.

Target Store: `https://demo.inelabteamdev.com/`

---

## Key Features & Architecture
- **Backend API & Scraper Engine (`server/`)**: Express REST endpoints, Playwright anti-trap Web Scraper, Supabase PostgreSQL persistence, exponential retry handling, fail-safe guardrails.
- **Frontend Dashboard (`client/`)**: React 18, Vite, Tailwind CSS, Recharts historical price trend graphs, live debounced search, dark/light theme switcher, execution audit log table.
- **Scraper Resilience**:
  - Auto-dismisses dynamic popup modals (`button.close`, `.modal-close`, `[aria-label="Close"]`).
  - Triggers "Reveal Price" actions with dynamic DOM render waiting (1500ms).
  - Strikethrough price filtering (ignores `.old-price`, `<del>`, `<s>`, `line-through` styles).
  - Headed mode Playwright visual inspection support (`npm run scrape:headed`).
  - Strict database query compliance using `timestamp` column (preventing PostgreSQL error 42703).

---

## Monorepo Layout

```
ine_scrapper/
├── client/                     # Frontend Application (React + Vite + Tailwind CSS)
│   ├── src/
│   │   ├── api/
│   │   │   └── trackerApi.js   # Centralized Axios client
│   │   ├── components/
│   │   │   ├── Navbar.jsx      # Header navigation & theme toggle
│   │   │   ├── ProductSearch.jsx # Live debounced search & custom URL input
│   │   │   ├── TrackedProductsList.jsx # Tracked product grid with stock status badges
│   │   │   ├── PriceHistoryChart.jsx # Recharts Area/Line chart visualization
│   │   │   ├── ScrapeLogTable.jsx # Execution audit log table (SUCCESS/RETRIED/FAILED)
│   │   │   └── ProductDetailModal.jsx # Product detail drawer with history & logs
│   │   ├── App.jsx             # Main dashboard container & state manager
│   │   ├── main.jsx
│   │   └── index.css           # Tailwind CSS styles
│   ├── index.html
│   ├── vite.config.js          # Vite configuration with proxy to http://localhost:5000
│   ├── package.json
│   └── .env.example
│
├── server/                     # Backend API & Scraper Engine (Node.js + Express)
│   ├── config/
│   │   └── supabase.js         # Supabase client setup
│   ├── services/
│   │   └── scraper.js          # Playwright scraper with retry logic & DOM anti-trap handling
│   ├── routes/
│   │   └── tracker.js          # REST endpoints & external cron webhook route
│   ├── scripts/
│   │   └── test-headed.js      # CLI runner for Playwright in headed mode (headless: false)
│   ├── server.js               # Express entrypoint
│   ├── package.json
│   └── .env.example
│
├── Design_Note.md              # Architectural decisions, trade-offs, and initial AI corrections note
└── README.md                   # Environment setup & run instructions
```

---

## 1. Prerequisites

- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **Playwright Chromium**: Automatically installed via npm script.

---

## 2. Supabase SQL Schema Setup

If using Supabase, run the following SQL statements in your Supabase SQL Editor:

```sql
-- 1. Create tracked_products table
CREATE TABLE IF NOT EXISTS tracked_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name TEXT NOT NULL,
  product_url TEXT UNIQUE NOT NULL,
  image_url TEXT,
  current_price NUMERIC(10, 2),
  in_stock BOOLEAN DEFAULT true,
  last_scraped_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create price_history table (MUST use timestamp column)
CREATE TABLE IF NOT EXISTS price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES tracked_products(id) ON DELETE CASCADE,
  price NUMERIC(10, 2) NOT NULL,
  in_stock BOOLEAN DEFAULT true,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create scrape_logs table (MUST use timestamp column)
CREATE TABLE IF NOT EXISTS scrape_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES tracked_products(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('SUCCESS', 'RETRIED', 'FAILED')),
  attempt_count INT DEFAULT 1,
  error_message TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 3. Environment Setup

### Backend Setup (`server/.env`):
Create `server/.env` based on `server/.env.example`:
```env
PORT=5000
SUPABASE_URL=https://your-supabase-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
CRON_SECRET_KEY=ine_scrapper_secret_cron_token_2026
```

### Frontend Setup (`client/.env`):
Create `client/.env` based on `client/.env.example`:
```env
VITE_API_BASE_URL=http://localhost:5000
```

---

## 4. Installation & Running Locally

### Step 1: Install Dependencies

```bash
# Install server dependencies & Playwright browser binaries
cd server
npm install
npx playwright install chromium

# Install client dependencies
cd ../client
npm install
```

### Step 2: Start Backend API & Scraper Engine

```bash
cd server
npm run dev
```
Backend will start at: `http://localhost:5000`

### Step 3: Start Frontend Client Dashboard

In a separate terminal:
```bash
cd client
npm run dev
```
Frontend will start at: `http://localhost:3000`

---

## 5. Running Playwright Headed Mode CLI Test

To visually watch Playwright launch Chromium, dismiss popups, click price reveal buttons, filter strikethroughs, and extract price in headed mode (`headless: false`):

```bash
cd server
npm run scrape:headed
```

Or pass a specific product URL:
```bash
node scripts/test-headed.js https://demo.inelabteamdev.com/products/wireless-headphones
```

---

## 6. REST API Endpoints Overview

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/search?q=query` | Live catalog search against INE store |
| `GET` | `/api/products` | Returns all tracked products with latest price & stock |
| `POST` | `/api/products/track` | Adds product and executes immediate Playwright scrape |
| `GET` | `/api/products/:id/history` | Historical price points ordered by `timestamp ASC` |
| `GET` | `/api/products/:id/logs` | Execution logs ordered by `timestamp DESC` |
| `DELETE`| `/api/products/:id` | Deletes product and associated records |
| `POST` | `/api/cron/scrape-all` | Protected cron webhook (`X-Cron-Secret` header) |
