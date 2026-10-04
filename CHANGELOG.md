# Changelog

This is the **platform** version — the pin callers use (`@v1`, `?ref=v1`). It is not a product release (that stays in the caller, via `java-maven-release`).

## Versioning

- A breaking change to an input, output, secret name, or module variable bumps the major (`v2`).
- A fix or an additive input is `v1.x`.
- `v1` is a moving tag. It always points at the latest `v1.x`.
- A caller that must not move pins the exact tag (`@v1.0.0`, `?ref=v1.0.0`).

## v1.0.0 — 2026-10-03

First pin. Contains:

- `.github/workflows/java-maven-render.yml`
- `.github/workflows/java-maven-release.yml`
- `.github/workflows/next-cloudflare.yml`
- `terraform/modules/render-service`
- `terraform/modules/cloudflare-worker`
- `terraform/modules/supabase-project`
