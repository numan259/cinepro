# Contributing

Thanks for contributing to CinePro Core. Please read the project
[Code of Conduct](.github/CODE_OF_CONDUCT.md) and [Security Policy](SECURITY.md)
before opening an issue or pull request.

## Development setup

```bash
git clone https://github.com/cinepro-org/core.git
cd core
npm ci
cp .env.example .env
npm run dev
```

Set your own `TMDB_API_KEY` in `.env`. Never commit `.env`, credentials, or
provider tokens.

## Before opening a pull request

Run:

```bash
npm run format
npm run build
npm audit --audit-level=moderate
```

The repository CI also checks formatting and the emitted `dist/` directory.
Provider behavior depends on external services, so include the TMDB IDs,
provider name, commands, and relevant non-secret results used for manual
testing.

## Provider changes

Providers live under `src/providers/` and are auto-discovered at startup. A
provider should:

- Extend `BaseProvider` from `@omss/framework`.
- Use a unique `id` and descriptive `name`.
- Declare accurate movie/TV capabilities.
- Return the framework's `ProviderResult`.
- Proxy external stream URLs with `this.createProxyUrl()`.
- Handle missing content, timeouts, and upstream errors without leaking
  credentials.
- Document any new environment variables.
- Respect the provider's terms, access controls, and applicable law.

Keep changes focused. Do not include unrelated formatting or generated
artifacts.

## Commit and pull request guidance

Use clear Conventional Commit-style messages such as:

```text
feat: add provider integration
fix: handle expired playlist tokens
docs: clarify Redis setup
```

Use the repository pull request template and include validation results.
