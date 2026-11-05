# Security

## Do not commit secrets

Keep `.env`, API keys, Redis passwords, provider tokens, and private URLs out of
Git. Use `.env.example` only for safe placeholder values. If a credential was
committed or shared, revoke and rotate it.

## Local-first deployment

Core defaults to `localhost:3000` and is intended for personal or trusted
networks. Binding to `0.0.0.0` makes it reachable from other interfaces.
Do not expose it directly to the public Internet without:

- HTTPS through a trusted reverse proxy.
- Authentication and authorization.
- Rate limiting and request monitoring.
- A restrictive `CORS_ORIGIN`.
- Firewall rules limiting who can connect.

Redis should remain on a private network and should use a password when the
network is not fully trusted.

## Provider and proxy risks

Provider integrations contact external services and proxy returned media
requests. External services can change or return malicious or unexpected data.
Keep dependencies updated and review provider changes carefully. Do not bypass
DRM, authentication, paywalls, or access controls.

## Reporting a vulnerability

For a CinePro-specific vulnerability, use a private GitHub Security Advisory
for this repository. Do not disclose exploitable details in a public issue.

If the issue belongs to `@omss/framework` or another dependency, report it to
that project's security channel as well.
