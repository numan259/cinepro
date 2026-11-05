# Installation

## Local installation

Install Node.js 20 or newer and npm, then run:

```bash
git clone https://github.com/cinepro-org/core.git
cd core
npm ci
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Edit `.env` and set `TMDB_API_KEY` to your own TMDB API key.

Start development mode:

```bash
npm run dev
```

The default server URL is `http://localhost:3000`.

## Production-style Node start

```bash
npm run build
npm start
```

## Docker Compose

Docker is optional:

```bash
docker compose up --build
```

The included Compose configuration starts Core on port `3000` and Redis on
port `6379`. It expects `TMDB_API_KEY` to be available to Compose. Stop it with
`docker compose down`.

## Stopping

Use `Ctrl+C` for a foreground process. For a service manager, stop the process
or service created by that manager; Core does not install a service definition.
