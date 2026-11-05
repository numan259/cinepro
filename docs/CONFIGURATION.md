# Configuration

Core loads `.env` through `dotenv/config`. `.env.example` contains safe
placeholders and must not contain real credentials.

| Variable         | Required | Default            | Description                                                              |
| ---------------- | -------- | ------------------ | ------------------------------------------------------------------------ |
| `PORT`           | No       | `3000`             | HTTP listening port.                                                     |
| `HOST`           | No       | `localhost`        | Listening host.                                                          |
| `NODE_ENV`       | No       | unset              | Runtime environment label.                                               |
| `PUBLIC_URL`     | No       | unset              | Public base URL for framework integrations. Do not add a trailing slash. |
| `STREMIO_ADDON`  | No       | `false`            | Set to `true` to enable the native Stremio addon.                        |
| `CORS_ORIGIN`    | No       | `*`                | CORS origin setting. Restrict it in trusted deployments.                 |
| `MCP_ENABLED`    | No       | `false`            | Set to `true` to enable MCP integration.                                 |
| `INTERNAL_DEBUG` | No       | `false`            | Existing ecosystem/debug compatibility flag.                             |
| `TMDB_API_KEY`   | Yes      | none               | TMDB API credential used for validation and media metadata.              |
| `TMDB_CACHE_TTL` | No       | `86400` in example | Ecosystem/framework compatibility setting.                               |
| `CACHE_TYPE`     | No       | `memory`           | Select `memory` or `redis`.                                              |
| `REDIS_HOST`     | No       | `localhost`        | Redis hostname when Redis is selected.                                   |
| `REDIS_PORT`     | No       | `6379`             | Redis port when Redis is selected.                                       |
| `REDIS_PASSWORD` | No       | empty              | Redis password when required.                                            |

When using Docker Compose, the service sets `HOST=0.0.0.0` and connects to the
Compose service named `redis`.
