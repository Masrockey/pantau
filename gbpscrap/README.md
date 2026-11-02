# Google Business Profile & Review Scraper API (Apify `compass/crawler-google-places` Compatible)

Layanan REST API untuk scraping data profil bisnis (Google Business Profile) dan ulasan (reviews) dari Google Maps menggunakan pustaka web crawling [Crawlee](https://github.com/apify/crawlee.git) (Playwright), intercept RPC internal Google Maps (`batchexecute?rpcids=qv9Egd`), framework Fastify, dan dokumentasi interaktif **OpenAPI 3.0 (Swagger UI)**.

Kompatibel penuh dengan skema input & output **Apify Google Maps Scraper (`compass/crawler-google-places` / Actor ID `nwua9Gu5YrADL7ZDj`)** sekaligus 100% backward-compatible dengan aplikasi **Pantau**.

---

## Fitur Utama

- **Apify `compass/crawler-google-places` (`nwua9Gu5YrADL7ZDj`) Parity**:
  - Mendukung endpoint drop-in Apify:
    - `POST /api/scrape/places`
    - `POST /v2/acts/compass~crawler-google-places/run-sync-get-dataset-items`
    - `POST /v2/acts/nwua9Gu5YrADL7ZDj/run-sync-get-dataset-items`
  - Mendukung mode `oneReviewPerRow: true` (setiap baris dataset berisi detail tempat + 1 review, persis seperti export Excel/JSON Apify) maupun `oneReviewPerRow: false` (nested `reviews` array).
- **Hybrid Google Maps RPC (`qv9Egd`) + DOM Extraction**:
  - Mengintersep response internal Google Maps (`/_/MapsWizUi/data/batchexecute?rpcids=qv9Egd`) untuk mengekstrak **timestamp review presisi milidetik (`publishedAtDate`)**, `reviewerId`, `reviewerPhotoUrl`, `reviewerNumberOfReviews`, `isLocalGuide`, `originalLanguage`, `reviewImageUrls`, `reviewOrigin`, dan `responseFromOwnerDate`.
  - Otomatis melakukan rotasi filter sort & topik ulasan saat Google Maps menampilkan *Limited View* tanpa login.
- **Rich Place Metadata**:
  - Mengekstrak `title`, `subTitle`, `totalScore`, `reviewsCount`, `reviewsDistribution` (`oneStar`..`fiveStar`), `categoryName`, `categories`, `address`, `neighborhood`, `street`, `city`, `postalCode`, `state`, `countryCode`, `plusCode`, `phone`, `phoneUnformatted`, `cid` (decimal), `fid` (hex), `placeId`, `location` (`lat`, `lng`), `openingHours` & `openingHoursDetailed`, `imageUrl`, `imagesCount`, `reviewsTags`, `permanentlyClosed`, `temporarilyClosed`.
- **Synchronous & Asynchronous Mode**:
  - **Sync**: Cocok untuk scraping cepat langsung mengembalikan data JSON.
  - **Async (Job Queue)**: Menghasilkan `jobId` (`type: "full" | "profile" | "reviews" | "apify"`) untuk scraping di background tanpa risiko HTTP timeout.
- **Proxy Pool & Auto-Rotation**: Menggunakan daftar proxy publik otomatis dari [Proxifly](https://cdn.jsdelivr.net/gh/proxifly/free-proxy-list@main/proxies/all/data.json) dengan **fast TCP pre-validation**.

---

## Instalasi & Menjalankan

### 1. Instalasi Dependensi
```bash
npm install
npx playwright install chromium
```

### 2. Menjalankan Server

**Mode Pengembangan (Dev / Watch):**
```bash
npm run dev
```

**Mode Produksi:**
```bash
npm run build
npm start
```

Server berjalan di `http://localhost:3016` (atau sesuai `PORT` pada `.env`).
- **Swagger UI Interaktif**: `http://localhost:3016/docs`
- **Spesifikasi OpenAPI JSON**: `http://localhost:3016/openapi.json`

---

## Format Input Request (Apify `compass/crawler-google-places` Compatible)

```json
{
  "searchStringsArray": [
    "Astra Motor NTB"
  ],
  "locationQuery": "Mataram, Indonesia",
  "startUrls": [
    {
      "url": "https://maps.app.goo.gl/q5Q1NgmEvVk1a86a9"
    }
  ],
  "placeIds": [
    "ChIJN1t_tDeuEmsRUsoyG83frY4"
  ],
  "maxReviews": 20,
  "reviewsSort": "newest",
  "reviewsStartDate": "2025-01-01",
  "language": "id",
  "personalData": true,
  "scrapeReviewsPersonalData": true,
  "oneReviewPerRow": false,
  "skipClosedPlaces": false,
  "useProxy": false
}
```

---

## Daftar Endpoint

1. **`POST /api/scrape/places`** — Mengembalikan dataset lengkap sesuai skema Apify `compass/crawler-google-places` (`nwua9Gu5YrADL7ZDj`).
2. **`POST /v2/acts/compass~crawler-google-places/run-sync-get-dataset-items`** & **`POST /v2/acts/nwua9Gu5YrADL7ZDj/run-sync-get-dataset-items`** — Drop-in replacement endpoint Apify Actor v2 API (mengembalikan array dataset langsung).
3. **`POST /api/scrape/profile`** — Scraping metadata profil bisnis Google (mencakup semua field Apify + field kompatibilitas Pantau).
4. **`POST /api/scrape/reviews`** — Scraping daftar ulasan bisnis (mencakup semua field review Apify + field kompatibilitas Pantau).
5. **`POST /api/scrape/full`** — Scraping profil bisnis + ulasan secara bersamaan.
6. **`POST /api/scrape/jobs`** & **`GET /api/scrape/jobs/:id`** — Pembuatan & pengecekan status background job (`type: "full" | "profile" | "reviews" | "apify"`).
7. **`GET /api/proxy/stats`** & **`GET /health`** — Statistik proxy pool & cek status kesehatan layanan.
