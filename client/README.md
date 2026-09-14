# AI News Aggregator frontend

React and Vite frontend for **AI-News-Aggregator**. See the [project README](../README.md) for architecture, environment variables, backend setup, and deployment.

From this directory:

```powershell
npm install
npm run dev
npm run lint
npm run build
```

The development server normally uses port 5178. `/home` is the landing page and `/news` is the application. Legacy dashboard aliases redirect to `/news`.

API calls default to `/api`, proxied locally to port 8000. For separate hosting, set `VITE_API_BASE_URL` (including `/api`) in the frontend build environment. Local browser overrides belong in `client/.env.local`, not the parent backend `.env`. Never expose server secrets through `VITE_*` variables.

The existing Light, Dark, and SYS modes, responsive layout, and reduced-motion behavior are shared across the product.
