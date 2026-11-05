# Troubleshooting

## Server does not start

- Confirm Node.js is version 20 or newer.
- Run `npm ci` again if dependencies are missing.
- Confirm `.env` exists and `TMDB_API_KEY` is set.
- Check that the configured `PORT` is not already in use.
- Run `npm run build` to surface TypeScript errors.

## Cannot connect from another device

The default host is `localhost`, which accepts local connections only. Set:

```env
HOST=0.0.0.0
```

Then allow the selected port through the host firewall only on a trusted
network. Do not port-forward Core to the public Internet without security
controls.

## CORS errors

Set `CORS_ORIGIN` to the exact browser origin, for example:

```env
CORS_ORIGIN=http://localhost:5173
```

Use `*` only when the deployment's risk is understood.

## TMDB errors

Verify the key belongs to your TMDB account and has not been revoked. Do not
paste the key into issue reports or logs.

## Redis errors

Use `CACHE_TYPE=memory` to run without Redis. If using Redis, verify the host,
port, password, and that Redis is reachable from Core. In Compose, use
`REDIS_HOST=redis`, not `localhost`.

## No playable movie or episode source

Core depends on external provider integrations. A title can be present in TMDB
while providers return no source, expired URLs, blocked segments, or an
unsupported format. Check the returned diagnostics and test another title
before changing application configuration.

## Browser playback issues

Use the stable `/streams/.../master.m3u8` routes and an HLS-capable player such
as hls.js in browsers that do not provide native HLS. Check CORS, nested
playlist requests, and media segment responses. Codec metadata alone does not
prove that a provider's segments are reachable.

## Formatting and CI

Run the same local checks used by the project:

```bash
npm ci
npm audit --audit-level=moderate
npx prettier --check src
npm run build
```
