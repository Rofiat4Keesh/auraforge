# AuraForge Store

**AURAFORGE WIDE TECHNOLOGIES LTD · RC No: 9920648**

A complete electronics e-commerce web application:
Next.js (App Router) + React + Tailwind CSS · Node.js API routes · MongoDB with Prisma · Paystack payments in Nigerian Naira (₦).

---

## Contents

1. [What you get](#1-what-you-get)
2. [How the pieces fit together](#2-how-the-pieces-fit-together)
3. [Install the tools (one time only)](#3-install-the-tools-one-time-only)
4. [Run the store on your computer — step by step](#4-run-the-store-on-your-computer--step-by-step)
5. [Make a test payment](#5-make-a-test-payment)
6. [Receive Paystack webhooks on your computer (optional)](#6-receive-paystack-webhooks-on-your-computer-optional)
7. [Go live on your own domain](#7-go-live-on-your-own-domain)
8. [Connect a wholesale supplier feed](#8-connect-a-wholesale-supplier-feed)
9. [Switch the display currency to USD](#9-switch-the-display-currency-to-usd)
10. [API reference](#10-api-reference)
11. [Folder map](#11-folder-map)
12. [Troubleshooting](#12-troubleshooting)
13. [Accounts, checkout sign-in and the Admin Portal](#13-accounts-checkout-sign-in-and-the-admin-portal)

---

## 1. What you get

| Area | Features |
| --- | --- |
| **Header** | Logo, Home, Shop, Search, Account, Cart icon with live item count, mobile slide-in menu. No legal text or addresses (those are only in the footer). |
| **Home** | Cyber-themed hero banner, category tiles, featured products, repair/service section. |
| **Catalog** (`/shop`) | Search, category, brand, price range (₦), in-stock and **specification filters** (RAM, Storage, Screen Size, Refresh Rate, Capacity, Connectivity…), sorting, pagination. Results update instantly without reloading the page, and the URL updates so filtered pages can be shared. |
| **Product page** | Image gallery (thumbnails, arrows, keyboard, hover zoom, full screen), variant selectors (e.g. memory + colour) that update price, stock and image, quantity, Add to cart, Buy now, full spec table, related products. |
| **Cart drawer** | Slides in from the right; change quantities, remove items, live subtotal / delivery / total, free-delivery progress bar. |
| **Checkout** | Delivery form with all 36 states + FCT, validation in the browser **and** on the server, then redirect to Paystack's secure page. |
| **Confirmation** | Verifies payment with Paystack, shows the order, re-checks automatically for slow bank transfers. |
| **Account** | Sign up / sign in, order history. Guests can also check out. |
| **Admin portal** (`/admin`) | Dashboard with sales and low-stock alerts, order management (fulfil, cancel, restock), product editor (prices in ₦, variants, stock, images, specs), categories, customers, one-click supplier sync. See section 13. |
| **Footer** | © AURAFORGE WIDE TECHNOLOGIES LTD, RC No: 9920648, policy links (Terms, Privacy, Returns & Warranty, Shipping), business address, contact details. |
| **Back end** | REST API, Paystack initialise + verify + signed webhook, stock deduction after payment, supplier-feed abstraction layer. |

> **Products:** the shop loads your Technocrat price list from `src/data/products.json` (12 items: HP and Alienware laptops, iPad Pro, Samsung accessories and spare parts), using your selling prices exactly as listed. See section 8.1. The original 18 fictional demo products are still available with `SUPPLIER_SOURCE="mock"`.

---

## 2. How the pieces fit together

```
 Browser (React pages)                     Server (Next.js API routes)                 Outside services
 ─────────────────────                     ──────────────────────────                  ────────────────
 Shop / Product / Cart  ── fetch ──▶  /api/products, /api/cart ...  ──▶  Prisma ──▶  MongoDB database
 Checkout form          ── POST  ──▶  /api/checkout/initialize      ──▶  Paystack: "create payment page"
        ◀──────────── redirect to Paystack's secure page ◀──────────────────────────────┘
 Paystack page  ── shopper pays ──▶  redirects to /checkout/success?reference=AF-...
 Success page           ── GET   ──▶  /api/checkout/verify          ──▶  Paystack: "did this succeed?"
 Paystack servers       ── POST  ──▶  /api/webhooks/paystack  (signed; confirms payment even if the tab was closed)
```

Key safety rules built into the code:

- **Prices are never trusted from the browser.** The server re-reads every price from the database when it creates an order.
- **Money is stored as whole numbers of kobo** (₦1 = 100 kobo), exactly what Paystack expects — no rounding errors.
- **Payment is confirmed only by Paystack** (verify API or signed webhook), and the amount paid must equal the order total.
- **Confirmation is idempotent** — if the success page and the webhook both arrive, stock is deducted only once.
- The **Paystack secret key** and **database password** only live on the server (`.env`), never in browser code.

---

## 3. Install the tools (one time only)

You need three free programs.

1. **Node.js 20 LTS (or newer)** — runs the app. Download the "LTS" installer from <https://nodejs.org> and click through it.
   Check it worked by opening a terminal and typing:
   ```bash
   node -v
   npm -v
   ```
   You should see version numbers such as `v20.x.x` and `10.x.x`.

   *How to open a terminal:* Windows → press Start, type **PowerShell**, press Enter. macOS → press ⌘ + Space, type **Terminal**, press Enter.

2. **A code editor** — Visual Studio Code from <https://code.visualstudio.com> is recommended.

3. **A Paystack account** — sign up free at <https://paystack.com>. You can use **test mode** immediately, before your business is verified.

---

## 4. Run the store on your computer — step by step

### Step 4.1 — Unzip the project

Unzip `auraforge-store.zip` somewhere easy, for example your Desktop. Then, in the terminal, move into the folder:

```bash
cd Desktop/auraforge-store
```

(On Windows the path may look like `cd C:\Users\YourName\Desktop\auraforge-store`.)

Open the same folder in VS Code: **File → Open Folder…**.

### Step 4.2 — Install the project's libraries

```bash
npm install
```

This downloads Next.js, React, Prisma, Tailwind and the other libraries listed in `package.json` into a `node_modules` folder. It takes 1–3 minutes. Warnings are normal; red **ERR!** lines are not (see Troubleshooting).

### Step 4.3 — Create a database

The store uses **MongoDB**. Pick **one** option.

**Option A — MongoDB Atlas (free, in the cloud — easiest for beginners)**

1. Go to <https://www.mongodb.com/cloud/atlas/register> and create a free account.
2. Create a **free (M0) cluster**. Any region works; choose one close to Nigeria (e.g. Europe) for speed.
3. **Database Access** → *Add New Database User* → choose a username and a password (letters and numbers only makes life easier). Give it "Read and write to any database".
4. **Network Access** → *Add IP Address* → *Allow Access from Anywhere* (`0.0.0.0/0`) for development.
5. **Database** → *Connect* → *Drivers* → copy the connection string. It looks like:
   ```
   mongodb+srv://myuser:<password>@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority
   ```
6. Replace `<password>` with your password and add the database name **`auraforge`** after `.net/`:
   ```
   mongodb+srv://myuser:MyPass123@cluster0.abcde.mongodb.net/auraforge?retryWrites=true&w=majority
   ```
   Keep this — it is your `DATABASE_URL`.

**Option B — Local MongoDB with Docker (if you already use Docker)**

```bash
docker compose up -d
```

This starts MongoDB in a container, configured as a "replica set", which Prisma requires. Your `DATABASE_URL` is then:

```
mongodb://localhost:27017/auraforge?replicaSet=rs0&directConnection=true
```

### Step 4.4 — Create your `.env` settings file

Copy the example file:

```bash
# macOS / Linux / Git Bash
cp .env.example .env

# Windows PowerShell
Copy-Item .env.example .env
```

Open `.env` in VS Code and fill in:

| Setting | What to put |
| --- | --- |
| `DATABASE_URL` | The connection string from Step 4.3. |
| `PAYSTACK_PUBLIC_KEY` / `PAYSTACK_SECRET_KEY` | Paystack Dashboard → **Settings → API Keys & Webhooks**. Use the **test** keys (`pk_test_…`, `sk_test_…`) for now. |
| `JWT_SECRET` | A long random string. Generate one with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` and paste the output. |
| `NEXT_PUBLIC_SITE_URL` | Leave as `http://localhost:3000` while developing. |
| `NEXT_PUBLIC_SUPPORT_EMAIL`, `NEXT_PUBLIC_SUPPORT_PHONE` | Your contact details. They appear in the footer. (`NEXT_PUBLIC_BUSINESS_ADDRESS` is optional and is not shown on the site.) |

Everything else can stay at its default. Save the file.

> ⚠️ Never share or upload your `.env` file. It is already listed in `.gitignore` so Git will not commit it.

### Step 4.5 — Set up the database tables and load the demo catalog

```bash
npm run setup
```

This runs three things in order:

1. `prisma generate` — builds the typed database client from `prisma/schema.prisma`.
2. `prisma db push` — creates the collections and unique indexes in MongoDB.
3. `prisma/seed.ts` — loads your price list (4 categories, 12 products), a demo customer and a demo admin account.

You should finish with:

```
✔ Catalog from "technocrat": 4 categories, 12 products created, 0 updated.
✔ Demo login → email: demo@auraforge.test  password: Demo12345!
✔ Demo ADMIN → email: admin@auraforge.test  password: Admin12345!  (open /admin)
✔ Seed finished.
```

### Step 4.6 — Start the store

```bash
npm run dev
```

Open <http://localhost:3000> in your browser. 🎉

Check the health endpoint any time: <http://localhost:3000/api/health> should show `"database": "connected"`.

To stop the server press **Ctrl + C** in the terminal. Next time you only need `npm run dev`.

---

## 5. Make a test payment

1. Add a product to the cart and click **Secure checkout**.
2. Fill in the delivery form and click **Pay ₦…**. You are taken to Paystack's page.
3. Use Paystack's test card:
   - Card number: `4084 0840 8408 4081`
   - Expiry: any future date (e.g. `12/30`) · CVV: `408`
   - If asked: PIN `0000`, OTP `123456`
4. Paystack sends you back to `/checkout/success`, which verifies the payment and shows **"Thank you — your order is in!"**.
5. The cart empties, product stock goes down, and the order appears in **Account → Order history** (when signed in) and in the Paystack dashboard under *Transactions*.

You can inspect the database visually with:

```bash
npm run db:studio
```

---

## 6. Receive Paystack webhooks on your computer (optional)

The success page already confirms payments. Webhooks are an extra safety net: Paystack's servers notify you directly, even if the shopper closes their browser before returning.

Paystack cannot reach `localhost`, so during development you need a tunnel:

1. Install ngrok from <https://ngrok.com> and run `ngrok http 3000`.
2. Copy the `https://….ngrok-free.app` address it prints.
3. Paystack Dashboard → **Settings → API Keys & Webhooks** → **Test Webhook URL** = `https://….ngrok-free.app/api/webhooks/paystack`.

Every webhook is checked against the `x-paystack-signature` header using your secret key; anything unsigned is rejected with HTTP 401.

---

## 7. Go live on your own domain

### 7.1 Build and test a production version locally

```bash
npm run build
npm run start
```

`npm run build` also type-checks every file. Note: the build downloads the Google Fonts used by the site, so it needs internet access.

### 7.2 Deploy

Any Node.js host works (Vercel, Railway, Render, a VPS). On the host:

1. Add every variable from your `.env` in the host's **Environment Variables** settings.
2. Change these for production:
   ```env
   NEXT_PUBLIC_SITE_URL="https://www.yourdomain.ng"
   APP_DOMAIN="yourdomain.ng"
   COOKIE_DOMAIN=".yourdomain.ng"
   PAYSTACK_PUBLIC_KEY="pk_live_..."
   PAYSTACK_SECRET_KEY="sk_live_..."
   ```
3. Build command: `npm run build` · Start command: `npm run start`.
4. Point your domain's DNS at the host (the host's dashboard tells you which `A` or `CNAME` record to add at your domain registrar).
5. Paystack Dashboard → **Live Webhook URL** = `https://www.yourdomain.ng/api/webhooks/paystack`.
6. In MongoDB Atlas → Network Access, replace "Allow from anywhere" with your host's outbound IP addresses if your host provides them.

### 7.3 Before launch checklist

- [ ] Real business address, email and phone in the `NEXT_PUBLIC_…` variables
- [ ] Policy text in `src/app/(store)/policies/[slug]/page.tsx` reviewed by your legal adviser
- [ ] Live Paystack keys (your Paystack business must be activated)
- [ ] Demo products replaced with your real catalog
- [ ] Demo accounts `demo@auraforge.test` and `admin@auraforge.test` deleted (via `npm run db:studio`), and your own admin created with `npm run seed:admin`

---

## 8. Connect a wholesale supplier feed

### 8.1 Import the full Technocrat catalog

The script `scripts/import-full-catalog.js` reads Technocrat Nigeria's public shop and saves every product it can reach into `src/data/products.json`, with your 6% markup applied.

**Step 1 — run the import** (on your own computer, in the `auraforge-store` folder):

```bash
node scripts/import-full-catalog.js
```

(or the shortcut `npm run catalog:import`). Leave the terminal open. You'll see progress lines like `… 450 of ~2,430 products saved · 1,210 queued · 9.6 min`. A full run takes roughly an hour, because the script waits a little over a second between pages so it doesn't overload Technocrat's website.

**Step 2 — read the summary** it prints at the end, for example:

```
✔ Saved 2,3xx products to src/data/products.json
  Shop's own total:   2,430
  With an image:      …
```

**Step 3 — load the products into your store:**

```bash
npm run supplier:sync
```

(or press **Sync now** in Admin → Supplier sync). Then open the shop.

**Good to know**

- **Stopping and resuming:** press `Ctrl + C` once; it saves its place. Run the same command again and it carries on. To start over, add `--fresh`.
- **Quick test first (optional):** `node scripts/import-full-catalog.js --limit 20` stops after 20 products so you can check the result. Then run it again without `--limit` for everything.
- **How products are found:** Technocrat's shop page only puts the first 24 products in the page; the rest load through `/api/` addresses that the site's `robots.txt` asks automated tools not to use (and `?page=2` returns an empty page). So the script never calls `/api/`. Instead it starts from the sitemap, the shop page and every brand/category view, then visits each product page and follows its "More in …" / "More from …" links until it stops finding new products. If a few products are only reachable through `/api/`, the summary tells you how many were missed.
- **Prices:** the price is read from each product page (crossed-out old prices are ignored). `costPriceNGN` is Technocrat's price, `sellingPriceNGN` is `costPriceNGN × 1.06`, rounded to the nearest naira. To use another markup: `CATALOG_MARKUP=1.10 node scripts/import-full-catalog.js`.
- **Images:** the script takes the image each product page actually shows (`src`, `data-src`, `data-lazy-src` or `srcset`). Technocrat's `/_next/image?url=…` links are turned into the original image file address, and relative paths become full `https://` links. The images stay on Technocrat's servers; if they ever block outside use, your shop shows "Image unavailable" instead of a broken box.
- **Categories:** Technocrat's many small categories ("Phone Case/Pouch", "UPS"…) are grouped into shop departments (Laptops & Computers, Accessories, Power & Backup, Networking…). The original category is kept as a "Type" filter.
- **Matching between imports:** products are matched by their Technocrat web address, so re-running the import updates existing products instead of creating duplicates. Stock counts you set in the admin are kept; an item only drops to 0 when Technocrat marks it out of stock.
- **Permission:** the script reads Technocrat's public pages politely and follows their `robots.txt`. Using their product photos and prices to sell is a business arrangement. Confirm with Technocrat that you're allowed to resell their stock and display their photos.
- **Safety:** if the script can't read any products (for example, no internet), it leaves your existing `products.json` unchanged.

### 8.1a Save product photos to your own website (automatic product images)

After the import, each product carries a link to its photo on Technocrat's image server. The script `scripts/cache-product-images.js` downloads those genuine photos and saves a copy inside your project, so your shop serves them from your own website. If Technocrat moves or blocks the photos later, your shop still shows them.

**Before you start: permission.** Only copy photos you are allowed to use. Ask Technocrat for written permission to use their product photos (or for a product/image feed, which is even better). The other common route is a manufacturer's reseller programme (for example Samsung, HP or Dell partner portals), which licenses official product photos to resellers. The hosts the script may download from are listed in your `.env` file:

```
IMAGE_SOURCE_HOSTS="technocratblessingcomputers.fra1.digitaloceanspaces.com,www.technocratng.com,technocratng.com"
```

Remove any host you don't have permission for. Set it to `""` to turn downloading off completely.

**Step 1 — make sure the full catalog is imported** (section 8.1). The original 12-item `products.json` has old `wp-content` photo links that no longer work, so the photos only download after a fresh import.

**Step 2 — check first, without downloading anything:**

```bash
node scripts/cache-product-images.js --dry-run
```

It prints how many photos it would download and how many links it would refuse.

**Step 3 — download and save the photos:**

```bash
npm run images:cache
```

You'll see a ✔ or ✖ line per product, then a summary:

```
Downloaded now:            2,1xx
Already saved (kept):      0
Refused (host not allowed): 0
Failed to download:        …
No photo link / no match:  …
```

The photos are saved as `public/images/products/<category>/<product>.jpg` (or `.png`/`.webp`, whichever the real file is).

**Step 4 — tell the shop to use them:**

```bash
npm run supplier:sync
```

(or press **Sync now** in Admin → Supplier sync). Refresh the shop. Product photos now load from `/images/products/...` on your own domain.

**Step 5 — fill any gaps.** Open `scripts/image-report.json`. Every product without a photo has a `saveYourOwnPhotoAs` line with the exact file name to use, for example:

```json
"saveYourOwnPhotoAs": "public/images/products/accessories/samsung-galaxy-q6-s-pen-case.jpg"
```

Save a genuine photo of that exact product there (your own photo, or one the brand or supplier gave you). Then run Steps 3 and 4 again. A photo you save by hand is never overwritten.

**What the script refuses to do, on purpose**

- **Download from unlisted hosts.** It won't download from sites that aren't in `IMAGE_SOURCE_HOSTS`, including when a link redirects somewhere else.
- **Save something that isn't a picture.** It checks the file's first bytes, so an error page saved as `.jpg` is rejected. Files over 8 MB are also rejected (`IMAGE_MAX_BYTES`).
- **Guess a photo.** A product with no working photo shows a neutral "IMAGE UNAVAILABLE" picture, never a look-alike product's photo.

**The phone-photo catalog (optional)**

The products typed in from your photos (`products-from-photos.json`) have no photo links. The script can find each one in the supplier feed and save its photo under that catalog's `image` path:

```bash
node scripts/cache-product-images.js --photo-catalog path/to/products-from-photos.json
```

A product only counts as a match when it has the same name, or the same model numbers plus mostly the same words plus the same price (within 2%). Anything less certain gets no photo and is listed in the report.

**Other options:** `--refresh` downloads again the photos this script saved before, `--delay 1000` waits 1 second between downloads (default 0.5 s), and `--feed other.json` reads a different feed file.

### 8.1b Your own product list and images

`src/data/photo-catalog.json` holds the products typed in from your photos: name, price (6% markup included), description, shop department and image. The shop loads this list **together with** `src/data/products.json`.

- **Images** live in `public/images/products/<department>/<product-name>.jpg`. A product whose image file is missing shows the neutral "IMAGE UNAVAILABLE" picture.
- **To add or replace an image:** save a `.jpg` with exactly that file name (the `imageUrl` value in `photo-catalog.json`, with `public` in front). Then run `npm run supplier:sync`.
- **To change a price or description:** edit the product in `photo-catalog.json`, then run `npm run supplier:sync`. You can also change it in **Admin → Products**.

### 8.2 A live supplier API

All product data flows through one interface, `ProductSource`, in `src/server/suppliers/types.ts`:

```ts
interface ProductSource {
  id: string;
  fetchCategories(): Promise<NormalizedCategory[]>;
  fetchProducts(): Promise<NormalizedProduct[]>;
}
```

- `MockProductSource` (`mock-source.ts`) serves the built-in demo catalog.
- `HttpSupplierSource` (`http-source.ts`) calls a supplier REST API, converts supplier cost prices into retail prices using `SUPPLIER_MARKUP_PERCENT` (rounded up to the nearest ₦100), and maps everything into the store's format.

To switch to your supplier:

1. In `.env` set:
   ```env
   SUPPLIER_SOURCE="http"
   SUPPLIER_API_URL="https://api.your-supplier.com/v1"
   SUPPLIER_API_KEY="your-key"
   SUPPLIER_MARKUP_PERCENT="18"
   ```
2. If your supplier's JSON is shaped differently from the `SupplierProductDTO` interface at the top of `http-source.ts`, edit only that interface and the `mapProduct()` / `mapCategory()` functions.
3. Run the sync:
   ```bash
   npm run supplier:sync
   ```
   It creates new products, updates prices and stock on existing ones, and **deactivates** (hides) products that disappeared from the feed — old orders keep working.
4. Schedule `npm run supplier:sync` to run regularly (for example hourly) with your host's cron/scheduler so stock stays accurate.

The storefront always reads from MongoDB, so no page or API route changes when you change supplier.

---

## 9. Switch the display currency to USD

All formatting goes through `src/lib/money.ts`.

```env
NEXT_PUBLIC_DISPLAY_CURRENCY="USD"
NEXT_PUBLIC_NGN_PER_USD="1550"
```

Prices are then **shown** in dollars (converted at your rate) while products are still stored and **charged** in Naira. Restart `npm run dev` after changing `.env`.
To charge in USD as well, your Paystack account must be approved for USD; then set `NEXT_PUBLIC_BASE_CURRENCY="USD"` and store product prices in cents.

---

## 10. API reference

All responses use the shape `{ "success": true, "data": … }` or `{ "success": false, "error": { "message": "…", "details": {…} } }`. Money values are integers in kobo.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/products` | Catalog. Query params: `q`, `category`, `brand` (repeatable), `min`, `max` (₦), `spec.<Key>` (repeatable, e.g. `spec.RAM=16GB`), `inStock=1`, `sort` (`featured`, `price-asc`, `price-desc`, `rating`, `newest`), `page`, `pageSize`. Returns products, totals and facets (available brands/specs/price range). |
| GET | `/api/products/:slug` | One product with variants, specs and related products. |
| GET | `/api/categories` | Categories with product counts. |
| GET | `/api/cart` | Current cart (identified by the `af_cart` cookie) with server-calculated totals. |
| DELETE | `/api/cart` | Empty the cart. |
| POST | `/api/cart/items` | Add `{ productId, variantSku, quantity }`. Checks stock. |
| PATCH | `/api/cart/items/:itemId` | Set `{ quantity }` (0 removes). |
| DELETE | `/api/cart/items/:itemId` | Remove a line. |
| POST | `/api/checkout/initialize` | **Signed-in only** (answers `401` with `details.code = "AUTH_REQUIRED"` otherwise). `{ email, fullName, phone, address, city, state, notes? }` → creates a PENDING order and returns `{ reference, authorizationUrl }`. |
| GET | `/api/checkout/verify?reference=…` | Verifies with Paystack, marks the order PAID, deducts stock, empties the cart. |
| POST | `/api/webhooks/paystack` | Paystack webhook (`charge.success`, `charge.failed`), signature-checked. |
| GET | `/api/orders` | Signed-in customer's orders. |
| GET | `/api/orders/:reference` | One order (address/phone only shown to its owner). |
| POST | `/api/auth/register` | `{ fullName, email, phone?, password }` |
| POST | `/api/auth/login` | `{ email, password }` |
| POST | `/api/auth/logout` | Sign out. |
| GET | `/api/auth/me` | Current user or `null`. Also refreshes the sign-in cookie if the account's role changed. |
| GET | `/api/health` | App + database status. |
| — | `/api/admin/*` | Admin-only endpoints used by the Admin Portal (stats, orders, products, transactions, categories, customers, sync). Guarded by `src/middleware.ts` (401/403) and re-checked in the database. `PATCH /api/admin/orders/:reference` takes `{ status: "PROCESSING" \| "SHIPPED" \| "DELIVERED" \| "CANCELLED", restock? }`. `GET /api/admin/transactions` takes `status`, `q`, `from`, `to` (YYYY-MM-DD) and `page`. `POST /api/admin/uploads` takes `multipart/form-data` with a `file` field (JPG/PNG/WebP/GIF, max 5 MB) and returns `{ url }`; uploaded images are served publicly at `GET /media/uploads/:id`. See section 13. |

Example:

```bash
curl "http://localhost:3000/api/products?category=laptops-computers&spec.RAM=32GB&sort=price-asc"
```

---

## 11. Folder map

```
auraforge-store/
├── .env.example                 ← copy to .env and fill in
├── docker-compose.yml           ← optional local MongoDB
├── prisma/
│   ├── schema.prisma            ← DATABASE SCHEMA: Users, Categories, Products, Carts, Orders, Paystack transactions
│   └── seed.ts                  ← loads demo catalog + demo user
├── scripts/
│   ├── load-env.ts              ← reads .env for command-line scripts
│   ├── cache-product-images.js  ← saves genuine product photos into public/images/products (section 8.1a)
│   ├── sync-supplier.ts         ← npm run supplier:sync
│   ├── make-admin.ts            ← npm run admin:create
│   └── seed-admin.ts            ← npm run seed:admin (first admin from .env)
└── src/
    ├── app/                     ← PAGES and API ROUTES (Next.js App Router)
    │   ├── layout.tsx           ← <html>/<body> shell and fonts only
    │   ├── (store)/             ← THE SHOP (the brackets keep "(store)" out of the web address)
    │   │   ├── layout.tsx       ← shop frame: Header, Footer, Cart drawer
    │   │   ├── page.tsx         ← home
    │   │   ├── shop/            ← catalog
    │   │   ├── product/[slug]/  ← product detail page
    │   │   ├── checkout/        ← checkout form + success screen
    │   │   ├── account/         ← sign in / order history
    │   │   └── policies/[slug]/ ← terms, privacy, returns, shipping
    │   ├── admin/               ← ADMIN PORTAL (own layout; no shop header/footer)
    │   ├── media/render/        ← generates the demo product images
    │   └── api/                 ← REST endpoints (thin files that call controllers); api/admin/* is admin-only
    ├── server/
    │   ├── controllers/         ← turn HTTP requests into service calls (Express-style controllers)
    │   ├── services/            ← business logic: catalog filters, cart, orders & payments, users
    │   └── suppliers/           ← RESELLER LAYER: mock catalog, HTTP supplier adapter, sync job
    ├── components/              ← React UI: layout, catalog, product, cart, checkout, account, auth (sign-in form, Unauthorized alert), admin
    ├── middleware.ts            ← blocks /admin and /api/admin for anyone who is not an ADMIN
    ├── lib/                     ← money (₦ formatting), Paystack client, auth, validation, config
    └── types/                   ← data shapes shared by server and browser
```

**Where to change things:**

| I want to… | Edit |
| --- | --- |
| Change company name, tagline, RC number | `src/lib/store-config.ts` |
| Change email / phone | `.env` (`NEXT_PUBLIC_…`) |
| Change delivery fee / free-delivery threshold | `.env` (`SHIPPING_FLAT_FEE_NGN`, `FREE_SHIPPING_THRESHOLD_NGN`) |
| Change colours and fonts | `tailwind.config.ts`, `src/app/globals.css`, `src/app/layout.tsx` |
| Refresh the Technocrat catalog | `node scripts/import-full-catalog.js`, then `npm run supplier:sync` (section 8.1) |
| Save product photos to your own site | `npm run images:cache`, then `npm run supplier:sync` (section 8.1a) |
| Edit policy wording | `src/app/(store)/policies/[slug]/page.tsx` |

---

## 12. Troubleshooting

| Problem | Fix |
| --- | --- |
| `npm` is not recognized | Node.js isn't installed or the terminal was open before installing. Close and reopen the terminal. |
| `Environment variable not found: DATABASE_URL` | You haven't created `.env` (Step 4.4) or you're running commands from a different folder. Run `cd` into `auraforge-store` first. |
| `Prisma needs to perform transactions, which requires your MongoDB server to be run as a replica set` | Use Atlas (always a replica set) or the provided `docker compose up -d`, and keep `?replicaSet=rs0&directConnection=true` in the local URL. |
| `bad auth : authentication failed` | Wrong Atlas username/password in `DATABASE_URL`. If the password has symbols like `@` or `#`, either change it or URL-encode them (`@` → `%40`). |
| Atlas connection times out | Add your IP in Atlas → Network Access. |
| "Payment gateway is not configured" | `PAYSTACK_SECRET_KEY` is empty or wrong in `.env`. Restart `npm run dev` after editing `.env`. |
| `JWT_SECRET is missing` when signing in | Set a 32+ character `JWT_SECRET` in `.env`. |
| Home page says "No products yet" | Run `npm run db:seed`. |
| Port 3000 already in use | Stop the other program, or run `npx next dev -p 3001` and set `NEXT_PUBLIC_SITE_URL="http://localhost:3001"`. |
| Changes to `.env` are ignored | Stop the server (Ctrl + C) and run `npm run dev` again. |

---

## 13. Accounts, checkout sign-in and the Admin Portal

### 13.1 How shoppers move through the store

1. **Browsing is open to everyone.** Home, Shop, search, product pages and the cart never ask anyone to sign in. The cart is remembered in the browser (a cookie) even for guests.
2. **Checkout asks for an account.** Clicking **Proceed to Checkout** shows step 1 of 3, *Account*: **Sign in** or **Quick sign-up** (full name, email, optional phone, password). The guest cart is attached to the account automatically, so nothing is lost.
3. **Delivery details** (step 2) are pre-filled from the account, then **Pay ₦…** sends the shopper to Paystack's secure page (step 3).
4. If a sign-in expires while someone is typing their address, the server answers "Please sign in…", the sign-in step reappears with their details kept, and payment continues by itself once they sign in.

**No Paystack keys yet?** The store still takes orders. The button says **Place order** instead of **Pay**, the customer sees "Order received", and the order appears in **Admin → Orders** as *Pending payment* (marked "pay later"). Call the customer, collect payment by bank transfer or on delivery, then set the order to **Paid · to pack**; that also takes the items out of stock. As soon as you add `PAYSTACK_SECRET_KEY` and `PAYSTACK_PUBLIC_KEY`, new orders are paid online through Paystack instead.

The header shows **Sign In** for visitors and the shopper's first name (**Account**) once signed in. Admins also see an **Admin Portal** button in the header (and in the phone menu). Customers never see it.

### 13.2 Create your first admin: `npm run seed:admin`

1. Open your `.env` file and fill in:

   ```bash
   ADMIN_EMAIL="owner@yourdomain.ng"
   ADMIN_PASSWORD="Choose-a-long-password-2026"
   ADMIN_NAME="Your Full Name"
   ```

2. Run:

   ```bash
   npm run seed:admin
   ```

   You should see `✔ Admin account created for owner@yourdomain.ng.` Running it again is safe: an existing account is simply made an admin. Add `--reset-password` to also change its password to `ADMIN_PASSWORD`.
3. Delete the `ADMIN_PASSWORD` line from `.env` (the account now exists; there is no need to keep the password in a file).
4. Open the shop, click **Sign In**, sign in with that email and password, and click **Admin Portal** in the header.

Other ways to manage admins:

```bash
# Make an existing customer account an admin (they keep their password):
npm run admin:create -- --email someone@yourdomain.ng

# Remove someone's admin access:
npm run admin:create -- --email someone@yourdomain.ng --revoke
```

(The `--` passes the rest of the line to the script.) After `npm run setup` there is also a demo admin: `admin@auraforge.test` / `Admin12345!`. **Remove or revoke it before going live.**

### 13.3 Who can open `/admin`

- `src/middleware.ts` runs before every `/admin` page and `/api/admin/*` request. Anyone without an admin sign-in is sent to the home page, which shows an **Unauthorized Access** alert ("please sign in with an administrator account" or "your account doesn't have administrator permissions"). The admin API answers `401` or `403` instead.
- Every admin page and API handler then checks the role again **in the database**, so removing someone's admin role works on their very next click.
- The role can only be set by `npm run seed:admin` / `npm run admin:create`. Sign-up always creates a `CUSTOMER`, whatever the browser sends.

### 13.4 What each Admin Portal page does

| Page | What you can do |
| --- | --- |
| **Dashboard** | Revenue cards in ₦ (total revenue, today, last 30 days with average order), **Total orders**, a **Low-stock alerts** card (5 units or fewer, with a "sold out" badge), paid orders waiting to be packed/shipped, orders awaiting payment, a 14-day sales chart (Lagos time), the low-stock list, a **Recent sales** table and the latest orders. |
| **Orders** | Filter chips: Pending, Paid · to pack, Processing, Shipped, Delivered, Failed, Cancelled (plus "Fulfilled (older)" for orders from before these statuses existed). Search by reference, email, name or phone. **Click an order** to open a pop-up with the items, **shipping information**, the customer's **phone number** (tap to call), the **Paystack reference** (with Copy) and payment attempts, and a **status selector**: Paid → Processing → Shipped → Delivered, or Cancel (optionally putting stock back). Only valid next steps are offered, e.g. an unpaid order cannot be marked Shipped. "Full page" opens a printable packing slip. |
| **Products** | The inventory table. **Add product** or click any product to open a pop-up with **Title, Brand, Category, Price (₦), Stock, Photo** (upload a picture from your computer or phone, or paste a link, with a live preview), **Description** and **Tech specs** (one `Name: value` per line). Products with several options show a price and stock box per option. **Archive** hides a product from the shop without deleting it (old orders stay correct); **Restore** brings it back. The **Advanced editor** still handles galleries, variants, tags and cost prices. |
| **Transactions** | Every Paystack payment attempt: date, Paystack reference and ID, customer, channel (card, bank transfer, USSD…), result (Success / Started / Failed / Abandoned), the order's status, and amount in ₦. Totals for the current filter, a date range, search, and **Download CSV** for your accountant. |
| **Categories** | Add, rename, reorder and delete (only when empty). |
| **Customers** | Registered accounts with paid order count, total spent, last order date; expand a row to see that customer's orders. |
| **Supplier sync** | Shows the current product source and runs a sync with one button, then reports what was added, updated, hidden or skipped. |

**Sign out** in the Admin Portal takes you back to the shop's home page.

### 13.5 Good to know

- **Refunds** are made in your Paystack dashboard (Transactions → the payment → Refund). Cancelling a paid order in the admin records the cancellation and can put stock back, but it does not move money.
- **Products are archived, not deleted**, so old orders always point at a real product.
- **Supplier products vs your own:** products created in the admin are marked `manual` and are never changed by a supplier sync. Products that came from a feed are refreshed by the sync, which replaces edits made to them in the admin.
- **Uploading photos:** in the product pop-up click **Choose** (or drag a photo onto the box). On a phone, Choose also lets you take a picture with the camera. In the **Advanced editor** you can pick up to 10 photos at once; the first one is the main picture and the arrows change the order.
  - Big phone photos are shrunk in your browser first (longest side 1600 px), so uploads are quick and pages stay fast on mobile data.
  - Accepted: JPG, PNG, WebP and GIF, up to 5 MB after shrinking. The server checks the file's real contents, not just its name.
  - Photos are saved in your MongoDB database (collection `uploaded_images`) and shown at addresses like `/media/uploads/6718f0c2…`. That works on every host, including Vercel, where files saved to disk disappear.
  - After pulling this update, run `npx prisma db push` once so the database knows about the new collection.
  - You can still paste a link instead (for example from your supplier), or use `/images/products/your-file.jpg` for files in the project.
- **Legal details** (company name, RC number, address, policies) appear only in the footer, never in the header.

---

© AURAFORGE WIDE TECHNOLOGIES LTD · RC No: 9920648
