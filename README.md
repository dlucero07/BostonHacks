# On-the-Go

Find a good bite between A and B in Boston, without a big detour. React + TypeScript + Vite + Tailwind; Express + Zod; Google Maps JavaScript / Places API (New) / Routes API; PostgreSQL; Docker + Caddy on one Vultr VM.

## Run now, without credentials

Requires Node.js 22+ and npm.

```sh
npm ci
cp .env.example .env
npm run dev
```

Open http://localhost:5173. The API runs on port 3000; Vite proxies relative `/api` calls to it. Demo mode starts with Boston University → Boston Common. The six demo locations are offered in the inputs. Choose walking/driving/train/bus, submit, select a card or marker, and add a stop. Compare both journeys and open the selected journey in Google Maps.

**Demo restaurants, ratings, review counts, prices, hours, routes, geometry, distances and travel times are fictional or simulated.** Demo routing is an illustrative provider, not a navigation engine. The Google Maps handoff opens the simulated coordinates, which are not real restaurant locations. No Google API is called in demo mode. Demo supports six named locations and Boston-area coordinates. Unknown free-text locations produce an actionable error. Live mode never falls back to demo data.

## Keys and placeholders

All placeholders are in **[.env.example](.env.example)**. Copy it to `.env` (Git-ignored). No secret belongs in a `VITE_` variable or in source code.

| Variable | Purpose | Visibility |
| --- | --- | --- |
| `APP_MODE` | `demo` (default) or `live` | Public mode |
| `GOOGLE_MAPS_BROWSER_KEY` | Maps JS and modern Places autocomplete | Public browser credential |
| `GOOGLE_MAP_ID` | Google Cloud JavaScript map ID for advanced markers | Public identifier |
| `GOOGLE_MAPS_SERVER_KEY` | Routes API and Places API (New) REST | Server only |
| `DATABASE_URL` | Tiger Data PostgreSQL connection URI | Server only |
| `GEMINI_API_KEY` | Reserved optional placeholder; Gemini is not implemented | Server only; unused |
| `REQUIRE_DATABASE` | Require DB in demo when `true`; live always requires DB | Server config |
| `SITE_ADDRESS` | `:80` for HTTP or your domain for automatic HTTPS | Caddy config |

`GET /api/config` exposes only mode, browser key and map ID. Browser configuration is injected at runtime, so switching keys does not require rebuilding the frontend. Startup fails clearly when live credentials or database configuration are missing. Placeholder database URLs are ignored in demo mode.

## Live Google setup

1. Create a Google Cloud project, enable billing and enable **Maps JavaScript API**, **Places API (New)**, and **Routes API**. Create a JavaScript map ID.
2. Create a **browser key** with Website/HTTP-referrer restrictions. Allow `http://localhost:5173/*` during development and `https://YOUR_DOMAIN/*` in production. Restrict APIs to Maps JavaScript API and Places API (New). Use separate development and production keys when possible. This key is intentionally public, so restrictions matter.
3. Create a **server key** with IP restrictions for the Vultr VM's outbound public IP and API restrictions to Routes API and Places API (New). For local live testing, allow your actual outbound IP or use a separate restricted development key. Never put the server key in browser settings.
4. Replace the Google placeholders in `.env`, set `APP_MODE=live`, configure/migrate Tiger Data below, and restart.
5. Verify a live Boston journey and the browser console after deployment. Provider authentication, quota, timeout, invalid geometry and no-route failures are surfaced without synthetic substitutes.

Uses [Routes computeRoutes](https://developers.google.com/maps/documentation/routes/reference/rest/v2/TopLevel/computeRoutes), [Text Search along a route](https://developers.google.com/maps/documentation/places/web-service/search-along-route), [Autocomplete Data (New)](https://developers.google.com/maps/documentation/javascript/place-autocomplete-data), and [Advanced Markers](https://developers.google.com/maps/documentation/javascript/advanced-markers/overview). Autocomplete requests debounce 300 ms with per-input session tokens, finishing the session with `fetchFields` after selection. Manual Boston addresses are supported if suggestions fail. Walking, driving, train, and bus use Routes; transit uses rail/bus preferences and Google may include other transport. Transit stop journeys combine two sequential requests with the second departing after the first leg. Switching modes automatically recalculates the journey and recommendations. driving uses `TRAFFIC_UNAWARE` for comparable baseline/stop estimates. Transit Google Maps handoff opens directions to the food stop; request onward directions after eating. Google may require showing walking-route warnings; the UI includes the provider walking safety notice in live mode.

### Costs, attribution and retention

Search runs on submit or an explicit filter change, never on map movement. Text Search requests at most 20 candidates; inexpensive filters and place-ID deduplication precede at most twenty stop-route calculations with concurrency three. Stop routes are reused in the current journey. Details are fetched on demand. Transit stop calculations use up to forty leg requests for twenty candidates. REST calls time out after 10 seconds with no automatic retries; quota/auth failures stop queued route work. Requests already in flight may complete. Autocomplete is sessionized and debounced.

Field masks are explicit. Ratings, review counts, price and opening status trigger higher Places pricing tiers; vegetarian support is temporarily disabled, and `servesVegetarianFood` is omitted from both search and details requests to avoid Enterprise + Atmosphere pricing. TODO comments in the provider mask, shared filter schema, and frontend filter UI mark where to restore support. Review the [field/SKU table](https://developers.google.com/maps/documentation/places/web-service/data-fields) before enabling live mode. Configure per-API quotas and Cloud Billing budgets/alerts in Google Cloud. **Budget alerts are notifications, not a spending cap.** Choose actual enforceable quotas appropriate to your account.

Live results appear on a Google map; autocomplete includes the Google attribution logo. Google Maps links and returned third-party attributions are displayed in details. No provider reviews or complete raw responses are stored. Normalized place/route data, including origin and destination, exist only in bounded process memory, with a 15-minute journey expiry and maximum 300 journeys. No origin/destination history is written to PostgreSQL. First-party interaction events store only place ID, type, server timestamp and random session UUID. Apply [Google Places policies](https://developers.google.com/maps/documentation/places/web-service/policies) and your billing-region terms before public launch; EEA-specific terms may affect permitted displays. Deploy the supplied privacy and terms pages with your operator/contact information completed. The app requests device location permission on startup to set the starting point automatically; device location updates stay in browser memory until a route is requested.

## Tiger Data / PostgreSQL

Create a Tiger Data PostgreSQL service. Get its connection URI from the service console and replace `DATABASE_URL`. Use TLS with certificate verification (`sslmode=verify-full`); if your service uses a private CA, configure `NODE_EXTRA_CA_CERTS` with the CA file mounted into the container. Do not disable certificate verification.

```sh
npm run db:migrate
```

Migration is idempotent. The DB user must initially be allowed to create the table/index. At runtime it needs SELECT/INSERT; schema creation is not run automatically by the app. Live mode requires the database; missing schema/connection makes `/api/health` return 503. Local demo without DB uses bounded, ephemeral storage (10,000 events). PostgreSQL deduplicates with a unique `(session_id, place_id, event_type)` constraint, including concurrent inserts.

For a hackathon, keep only the last seven days of first-party events; run the following in the database console on a daily schedule (not automatically configured):

```sql
DELETE FROM interaction_events WHERE created_at < now() - interval '7 days';
```

## Architecture and API

- `frontend/`: mobile-first React interface; Google adapter or an explicitly illustrated SVG demo map. On phones the results become an expandable sheet below the map.
- `shared/schema.ts`: Zod contracts and shared types. `shared/domain.ts`: deterministic filters, detours, ranking, polyline decoding and marker sizing.
- `backend/providers/`: interchangeable demo and live routing/place providers. Google errors are normalized; missing place data stays unknown.
- `backend/service.ts`: bounded 15-minute journey state, candidate shortlisting, route concurrency, partial failure handling and ranking.
- `backend/storage.ts`: first-party interaction adapters for PostgreSQL and ephemeral demo use.
- Express serves the production frontend and API from one public origin. Caddy is the only public service; port 3000 stays internal.

| Endpoint | Purpose |
| --- | --- |
| `GET /api/health` | Health + actual database/schema connectivity |
| `GET /api/config` | Allowlisted public browser config |
| `POST /api/routes` | `{origin:{label,point?,placeId?},destination:{...},mode:"WALK"|"DRIVE"}` → journey + baseline |
| `POST /api/restaurants/search` | `{journeyId,filters}` → recommendations with actual stop routes |
| `POST /api/routes/with-stop` | `{journeyId,placeId}` → stop route and extra seconds |
| `POST /api/places/details` | `{journeyId,placeId}` → on-demand provider details |
| `POST /api/interactions` | `{placeId,eventType,sessionId}` → deduplicated first-party event |

All request bodies are validated, limited to 20 KB, and `/api` rate-limited to 90 requests/minute/IP (health exempt). Error shape: `{error:{code,message,fields?}}`. Caddy is the one trusted reverse proxy in production. Health never returns keys or connection strings. Routes outside the Boston bounding box are rejected. Simulated fixture results and live results never share a provider.

## Popularity versus relevance

Configuration is in `shared/domain.ts` (`popularityConfig`):

```
BayesianRating = (n × rating + 50 × 4.1) / (n + 50)
R = clamp((BayesianRating - 1) / 4, 0, 1)
V = clamp(log(1 + n) / log(1 + 2000), 0, 1)
I = clamp(log(1 + uniqueSessions7days) / log(1 + 50), 0, 1)
popularity = 0.55R + 0.30V + 0.15I
markerDiameter = 24 + 40 × popularity² (pixels)
relevance = 0.45 × popularity + 0.55 × (1 - clamp(extraSeconds / maxDetourSeconds, 0, 1))
```

Unknown rating uses the 4.1 prior and unknown review count uses zero **for scoring only**; the UI shows unknown. Interaction popularity counts unique sessions per place across all event types in the last seven days, so clicking details and adding the same stop does not inflate it. Event types are individually deduplicated per session. Automatic/programmatic state changes do not record clicks. Empty interaction data contributes zero. No recent-review signal is used because coverage/timestamps are unavailable. The minimum rating defaults to 3+ stars and can be set from 0 (any rating, including unrated places) to 5 stars. Filter match is a hard gate: category, known price/rating thresholds and **maximum calculated detour** always override popularity.

```
extraTravelSeconds = max(0, duration(A → stop → B) - duration(A → B))
```

Same provider, mode and routing preferences are used for both. Negative differences from provider variations are clamped to zero. Added travel time excludes eating, queueing, parking and service. The UI labels estimates and never invents a second live route after a failure.

## Vultr first deployment

Deployment is **not performed** by this checkout: no Vultr account access, SSH host/key, domain or Tiger Data service credentials were supplied. All artifacts needed to deploy are included. A real deployment requires completing the following steps with your host and secrets.

Create one **Ubuntu 24.04 LTS Vultr VM**, add your SSH public key and configure the Vultr firewall for SSH (22, preferably your IP), HTTP (80) and HTTPS (443 TCP/UDP). Add a DNS A record for your domain pointing at its public IP (remove an incorrect AAAA record). An IP-only demo can use `SITE_ADDRESS=:80`; geolocation is generally unavailable on plain HTTP except localhost.

From your own terminal, replace `YOUR_VM_IP` with the real IP:

```sh
ssh root@YOUR_VM_IP
```

On the VM, install Docker using its official Ubuntu repository:

```sh
apt-get update
apt-get install -y ca-certificates curl git
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
printf '%s\n' 'deb [arch=amd64 signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu noble stable' > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
mkdir -p /opt/on-the-go
```

The repository command assumes an amd64 Vultr VM. For arm64, replace `arch=amd64` with `arch=arm64`. Transfer this checkout from your local machine (in a separate local terminal):

```sh
rsync -av --exclude=node_modules --exclude=.git --exclude=dist --exclude=.env ./ root@YOUR_VM_IP:/opt/on-the-go/
```

Back on the VM:

```sh
cd /opt/on-the-go
cp .env.example .env
chmod 600 .env
nano .env
```

For an immediate no-key demo keep `APP_MODE=demo`, leave the key placeholders, and set `SITE_ADDRESS=YOUR_DOMAIN` (or `:80` for an IP). For live mode, fill Google/Tiger values, set `APP_MODE=live` and `REQUIRE_DATABASE=true`, and migrate before startup:

```sh
docker compose build
# Run this migration for a configured database; skip for a DB-free demo.
docker compose run --rm app node dist/migrate.js
docker compose up -d
# Internal health, including the database if configured:
docker compose exec app node -e 'fetch("http://127.0.0.1:3000/api/health").then(async r=>{console.log(await r.json());process.exit(r.ok?0:1)})'
docker compose logs --tail=50 app caddy
```

Caddy automatically provisions HTTPS when `SITE_ADDRESS` is a reachable domain and ports 80/443 are open. TLS state survives restarts via named volumes. Verify from your machine:

```sh
curl -fsS https://YOUR_DOMAIN/api/health
```

Open the domain on desktop and phone and test A → stop → B. In Google Cloud, set the browser referrer restriction to this domain and the server key IP to the VM's outbound IP. Check Tiger's firewall/network allowlist if required. Both containers restart automatically; the app runs as a non-root user. Container secrets are runtime `.env` values, never image build arguments.

### Updates

From the project on your local machine:

```sh
npm ci
npm test
npm run build
rsync -av --exclude=node_modules --exclude=.git --exclude=dist --exclude=.env ./ root@YOUR_VM_IP:/opt/on-the-go/
ssh root@YOUR_VM_IP 'cd /opt/on-the-go && docker compose up -d --build && docker compose ps'
curl -fsS https://YOUR_DOMAIN/api/health
```

The excluded `.env` preserves production credentials. Run migrations explicitly if the schema changes. Back up the database before destructive migrations. `docker compose logs --tail=100 app caddy` shows operational errors without logging route bodies or credentials.

## Validation

```sh
npm test
npm run build
npm start
```

Focused tests cover detour arithmetic, Bayesian sparse-review handling, bounded popularity/markers, strict filters and missing fields, session deduplication, Boston validation, provider/partial/quota failures and the HTTP A → restaurant → B flow. `npm run build` performs a full TypeScript check before bundling. See `VERIFICATION.md` for checks actually performed in this environment; live integrations require real credentials.

## Known limitations

- Hackathon scope: one stop, walking/driving/train/bus, Boston bounding box, twenty routed candidates per query (shortlisted by popularity from up to 20 fetched places). A suitable place may be omitted by shortlisting.
- No Gemini parsing, live traffic, menus, photos, reservations or eating/wait-time estimates.
- In-memory journey cache is lost on restart; refresh a journey after 15 minutes. Single-VM rate limiter/state does not support horizontal scaling.
- Anonymous session interactions are deduplicated, not abuse-proof or authenticated. No attempt is made to track people across browsers; interaction popularity is not a review signal.
- Fields absent from Google remain unknown. Strict dietary/price/rating filters exclude unknowns. Provider opening data is not guaranteed current.
- End-to-end Google, Tiger and Vultr checks cannot run before credentials and host access are configured. Docker packaging also requires Docker installed on the target machine.

## 90-second demo script

- **0–15s:** “On-the-Go answers: where can I get food on my journey without adding too much travel?” Show Boston University → Boston Common, walking, and point out the demo label.
- **15–30s:** Find stops. Show direct distance/time and the list. Explain circles vs triangles and bounded popularity sizing.
- **30–45s:** Choose Coffee, then return to Restaurants. Try a 5-minute maximum detour and a price filter. Results obey calculated detour limits.
- **45–65s:** Select Little Green Kitchen on the map; its card highlights. Click Add stop. Compare Direct versus With a food stop; switch between the two polylines.
- **65–80s:** Open details, show ratings/price/known hours. Close and open Google Maps for the chosen journey. Explain eating and waiting are excluded.
- **80–90s:** Show the phone sheet. “The same vertical slice switches to live Routes and Places with restricted keys. Express, Tiger Data, Docker and Caddy run behind one Vultr origin.”

## Live device location

On startup, the app requests browser location permission and uses your current position as the starting point. If permission is denied or location is unavailable, it falls back to Boston University. Demo route planning waits for the initial location attempt to finish. Choose **Use my location** to retry or restart tracking. The map shows a blue dot and accuracy area; the starting point follows your latest fix. Submit to plan from that position—GPS movement does not automatically recalculate routes or restaurants, and does not disable adding or removing stops on the submitted journey. Stop estimates use that journey’s starting point until you submit again. Tracking stops when you choose **Stop live location**, edit the start, swap endpoints, or leave the app. If high-accuracy location times out or is unavailable, tracking retries with general accuracy. Permission errors, a failed retry, and positions outside the supported Boston area stop tracking with an actionable message. Tracking stays active while you are stationary; the browser need not send repeated positions when you have not moved. Requires HTTPS or localhost. Device updates stay in browser memory until a route is requested. In demo mode the position is real but map geography and routes remain illustrative; a position beyond the illustrated map is called out.
