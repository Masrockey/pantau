# Pantau

> **Pantau** is an open-source dealership performance monitoring and Google Business Profile (GBP) reputation intelligence platform. Built with Laravel, Inertia.js, React, and an automated Playwright review extraction microservice, it empowers automotive dealer networks to monitor customer feedback, accelerate owner response times, analyze sentiment, and improve local search ratings.

---

## Highlights

- **Executive GBP Dashboard**: Centralized operational KPIs including overall rating average, monthly review volumes, owner response rates, sentiment word-cloud analysis, and real-time review feeds.
- **Monitoring Feedback**: In-depth dealer feedback tracker with Lead Time (LT in days), percentage of feedback completed (%ACH), growth comparisons (M vs M-1), customizable date-range filters, multi-select dealer type filters, and CSV data export.
- **Dealer Overview**: Granular showroom performance matrix tracking rating distributions (1★ through 5★), low-rating contribution percentages (%CONT 1-3★), positive rating contributions (%CONT 4-5★), multi-select dealer type filtering, and aggregate summary metrics.
- **GMB Cluster Analysis**: Four-quadrant matrix segmenting showrooms into *Excellent Zone*, *Volume Zone*, *Quality Zone*, and *Opportunity Zone* based on review volume and star ratings.
- **Rating Simulator**: Interactive planning calculator that projects the required 5-star reviews needed for a showroom to hit specific rating targets.
- **Automated Review Extraction Engine (`gbpscrap`)**: Embedded Node.js/Fastify microservice utilizing Crawlee and Playwright with Google Maps batch RPC interception, proxy auto-rotation, and scheduled background synchronization jobs.
- **Social Media Tracking**: Campaign posting and creator profile tracker across platforms (Instagram, TikTok, Facebook) with engagement metrics.
- **Multi-Tenant Role-Based Access Control**:
  - `Super Admin`: Complete platform access, scrapers, user management, and system configurations.
  - `Main Dealer`: Regional operational visibility across all affiliated network showrooms.
  - `Dealer`: Scoped access strictly limited to the user's assigned showroom.

---

## Tech Stack

- **Backend**: [Laravel 12](https://laravel.com/) (PHP 8.4), [Laravel Fortify](https://laravel.com/docs/fortify) (Authentication), [Laravel Wayfinder](https://github.com/laravel/wayfinder) (TypeScript route/action generation).
- **Frontend**: [Inertia.js v3](https://inertiajs.com/), [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Tailwind CSS v4](https://tailwindcss.com/), [Ant Design](https://ant.design/), [Lucide Icons](https://lucide.dev/), [Leaflet](https://leafletjs.com/).
- **Scraper Microservice**: [Fastify](https://fastify.dev/), [Crawlee](https://crawlee.dev/), [Playwright](https://playwright.dev/) (`gbpscrap/`).
- **Database & Queue**: MySQL 8.0+ / SQLite, database queue worker, and scheduled task runner.
- **Testing & Tooling**: [Pest v5](https://pestphp.com/), [PHPStan / Larastan](https://github.com/larastan/larastan), [Laravel Pint](https://laravel.com/docs/pint).

---

## Project Structure

```text
pantau/
├── app/
│   ├── Enums/                 # User roles and application enums
│   ├── Http/Controllers/      # REST & Inertia controllers (Dashboard, Overview, Reviews, Dealers)
│   ├── Models/                # Eloquent models (Dealer, Review, ScrapingSchedule, etc.)
│   └── Services/              # Business logic services (Excel imports/exports, scrapers)
├── gbpscrap/                  # Dedicated Google Maps review scraper microservice
│   ├── src/                   # Fastify server, crawler handlers, proxy validation
│   └── Dockerfile             # Container configuration for standalone scraper deployment
├── resources/
│   ├── js/
│   │   ├── components/        # Reusable UI widgets and dashboard modules
│   │   ├── pages/             # Inertia.js view pages (Dashboard, Overview, Monitoring, etc.)
│   │   └── types/             # Shared TypeScript definitions
│   └── css/                   # Global Tailwind CSS configurations
├── routes/                    # Web and authentication routes
└── tests/
    └── Feature/               # Pest feature tests covering all application modules
```

---

## Getting Started

### Prerequisites

Ensure you have the following installed on your environment:

- **PHP** >= 8.3 (with `pdo`, `mbstring`, `openssl`, `curl`, `xml` extensions enabled)
- **Composer** >= 2.5
- **Node.js** >= 20.x & **npm**
- **MySQL** >= 8.0 or **SQLite** >= 3.35
- **Chromium / Playwright dependencies** (for review scraping)

### Installation Steps

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/pantau.git
   cd pantau
   ```

2. **Install PHP and Node dependencies**:
   ```bash
   composer install
   npm install
   ```

3. **Configure the environment**:
   ```bash
   cp .env.example .env
   php artisan key:generate
   ```
   Open `.env` and set your database connection:
   ```env
   DB_CONNECTION=mysql
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_DATABASE=pantau
   DB_USERNAME=root
   DB_PASSWORD=your_password
   ```

4. **Run migrations and seed the database**:
   ```bash
   php artisan migrate --seed
   ```

5. **Install Playwright browser binaries (for scraper)**:
   ```bash
   npx playwright install chromium
   ```

6. **Build frontend assets**:
   ```bash
   npm run build
   ```

---

## Running the Application

### Development Mode

Run the complete multi-process development environment (web server, queue listener, schedule worker, and Vite dev server) using:

```bash
composer run dev
```

By default, the web interface is available at: `http://localhost:8016` (or `http://localhost:8000`).

### Running the Scraper Microservice (Optional / Standalone)

To run the background scraper service independently:

```bash
# Development mode with hot-reload
npm run scraper:dev

# Or build and start for production
npm run scraper:build
npm run scraper:start
```

The scraper service will listen on `http://localhost:3016` with interactive OpenAPI documentation available at `http://localhost:3016/docs`.

---

## Default Demo Accounts

When seeded via `php artisan db:seed` (or `php artisan migrate --seed`), the following test accounts are provisioned:

| Role | Email | Password | Access Scope |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `superadmin@pantau.com` | `SuperAdmin123@` | Full system control, sync schedules, user management |
| **Main Dealer** | `maindealer@pantau.com` | `Password123@` | Regional overview, all dealerships across network |
| **Dealer** | `dealer@pantau.com` | `Password123@` | Scoped strictly to assigned dealership |

---

## Code Quality & Testing

Pantau adheres to modern Laravel and React code hygiene standards:

- **Run Feature & Unit Tests**:
  ```bash
  php artisan config:clear
  php artisan test --compact
  ```
- **Run PHP Code Styling (Pint)**:
  ```bash
  vendor/bin/pint --dirty --format agent
  ```
- **Run Static Analysis (Larastan / PHPStan)**:
  ```bash
  vendor/bin/phpstan analyse
  ```
- **Run TypeScript Verification**:
  ```bash
  npm run types:check
  ```

---

## Contributing

Contributions, bug reports, and pull requests from the community are warmly welcome!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/amazing-feature`)
3. Commit your Changes (`git commit -m "Add amazing feature"`)
4. Verify tests pass (`php artisan test --compact && npm run types:check`)
5. Push to the Branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

---

## License

Pantau is an open-source software project licensed under the [MIT License](https://opensource.org/licenses/MIT). You are free to inspect, modify, and distribute it in accordance with the license conditions.
