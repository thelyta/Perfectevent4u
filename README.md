# Perfectevent4u

The site now runs on Next.js 16 with PostgreSQL and Drizzle. The existing public HTML, CSS, and browser scripts are preserved and served by the Next app, including the photo filters, service sections, FAQ, and chatbot. The `/admin` page keeps its legacy interface and now uses the database-backed APIs.

## Local development

Requirements: Node.js 20.9 or newer and pnpm.

1. Install dependencies with `pnpm install`.
2. Copy `.env.example` to `.env` and set `DATABASE_URL`, `ADMIN_PASSWORD`, and `SESSION_SECRET`.
3. Configure Cloudinary variables if uploads should be stored remotely.
4. Apply schema migrations with `pnpm db:migrate`.
5. Start Next.js with `pnpm dev` and open `http://localhost:3001`.

The public pages are `/`, `/portfolio.html`, `/services.html`, `/about.html`, and `/contact.html`. The admin interface is at `/admin`.

## Production

Railway is configured by `railway.toml` to build Next.js, apply Drizzle migrations, start `pnpm start`, and health-check `/api/health`. The start command listens on Railway's `PORT` (3001 locally when unset). Configure `DATABASE_URL`, `ADMIN_PASSWORD`, and a stable, long random `SESSION_SECRET`; use HTTPS. The legacy Express app is retained for rollback and can still be started with `pnpm legacy:start`.

## Data

Railway already contains the migrated 9 portfolio items and 3 services. `pnpm db:migrate` applies future schema migrations during Railway predeploy; do not rerun the one-time JSON import against the populated database.

## Image storage

Set `CLOUDINARY_URL` or the `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` variables to use Cloudinary. Without those settings, uploads are written to `public/uploads`, or to `UPLOAD_DIR` when configured. Persist that directory across deployments if using local storage.

The admin portal stores new Cloudinary URLs and public IDs in PostgreSQL under the `PerfectEvent4U` folder. All nine existing portfolio images have already been migrated to that folder.
