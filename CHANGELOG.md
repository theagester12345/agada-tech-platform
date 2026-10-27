# Changelog

This is the **platform** version — the pin callers use (`@v1`, `?ref=v1`). It is not a product release (that stays in the caller, via `java-maven-release`).

## Versioning

- A breaking change to an input, output, secret name, or module variable bumps the major (`v2`).
- A fix or an additive input is `v1.x`.
- `v1` is a moving tag. It always points at the latest `v1.x`.
- A caller that must not move pins the exact tag (`@v1.0.0`, `?ref=v1.0.0`).

## v1.1.0 — unreleased

Additive. No input, output or secret changed, and a caller that sets nothing builds as before.

- `next-cloudflare` passes the caller's optional repo variable `NEXT_PUBLIC_CLIENT_URL` to the deploy build of every app in the matrix. It is not in the presence check: unset arrives as an empty string, and an app that reads it treats that as off. Set the variable; no `ci.yml` change.

## v1.0.1 — 2026-10-05

Fix. No input, output, secret or module variable changed.

- Every recipe job runs on `ubuntu-26.04`, pinned, instead of `ubuntu-latest`. GitHub moves `ubuntu-latest` to Ubuntu 26.04 between 2026-10-19 and 2026-11-19; pinning means a caller's runner changes only with a platform release. A caller that depends on something only Ubuntu 24.04 ships should pin `@v1.0.0` until it is fixed.
- Actions moved to their first Node 24 major: `actions/checkout@v5`, `actions/setup-java@v5`, `actions/setup-node@v5`, `actions/cache@v5`, `docker/setup-buildx-action@v4`, `docker/login-action@v4`, `docker/build-push-action@v7`. Removes the Node 20 deprecation warning.

## v1.0.0 — 2026-10-03

First pin. Contains:

- `.github/workflows/java-maven-render.yml`
- `.github/workflows/java-maven-release.yml`
- `.github/workflows/next-cloudflare.yml`
- `terraform/modules/render-service`
- `terraform/modules/cloudflare-worker`
- `terraform/modules/supabase-project`
