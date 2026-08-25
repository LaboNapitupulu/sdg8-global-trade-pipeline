# Trade8 frontend

React/Vite dashboard for the Trade8 API.

## Commands

```bash
npm ci
npm run dev
npm run lint
npm run build
npm run preview
```

Node.js `^20.19.0` or `>=22.12.0` is required by Vite 8.

During local development the frontend requests `http://localhost:5000/api`. Set `VITE_API_URL` to override it. Production uses same-origin `/api` routes.

The world topology is bundled from `world-atlas`; no runtime CDN is required. The Trade map is lazy loaded, and the 3D motion hero automatically disables continuous motion when the operating system requests reduced motion.
