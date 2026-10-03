#!/usr/bin/env bash
# Deploy one image to the Render service and wait until Render says it is live.
#
#   render-deploy.sh <image-url>
#
# <image-url> is ghcr.io/<owner>/<name>@sha256:<digest>. Pass a
# digest, not a tag: a tag can move after the tests ran, a digest cannot. Pass
# an older digest to roll back.
#
# Needs RENDER_API_KEY and RENDER_SERVICE_ID in the environment.
#
# Exits non-zero unless the deploy reaches "live". Render only reports live
# after the service health check passes, so a failure here means the
# new image did not come up. Render keeps the previous deploy serving then.
set -euo pipefail

image="${1:?usage: render-deploy.sh <image-url@sha256:digest>}"
: "${RENDER_API_KEY:?RENDER_API_KEY is not set}"
: "${RENDER_SERVICE_ID:?RENDER_SERVICE_ID is not set}"

api="https://api.render.com/v1/services/${RENDER_SERVICE_ID}/deploys"
auth=(-H "Authorization: Bearer ${RENDER_API_KEY}" -H "Accept: application/json")

# The free instance can take several minutes to pull and boot the JVM. Fifteen
# minutes is well past a healthy deploy and short of a hung runner.
timeout_s=900
interval_s=10

# --fail-with-body still fails on a non-2xx, but keeps the response. Plain -f
# throws it away, which left a refused deploy as a bare "error: 400" with no
# reason. The body is Render's reply (API errors are usually {"id","message"},
# a gateway error can be HTML); the request's key is never part of it.
body=$(jq -n --arg img "$image" '{imageUrl: $img}')
if ! resp=$(curl -sS --fail-with-body "${auth[@]}" -H "Content-Type: application/json" -X POST -d "$body" "$api"); then
  echo "Render deploy request failed for ${image}: ${resp:-no response body, see the curl error above}" >&2
  exit 1
fi
deploy_id=$(jq -r '.id // empty' <<<"$resp" 2>/dev/null || true)
if [[ -z "$deploy_id" ]]; then
  echo "Render did not return a deploy id. Response: ${resp:-empty}" >&2
  exit 1
fi
echo "Render deploy ${deploy_id} started for ${image}"

# A poll that errors says nothing about the deploy, which carries on at Render.
# Failing on one blip would report a deploy as failed that may go live, and
# hold back later jobs that wait on this one. Several errors in a row mean
# the API is not answering.
max_poll_errors=5
poll_errors=0
status="unknown"

elapsed=0
while (( elapsed < timeout_s )); do
  if resp=$(curl -sS --fail-with-body "${auth[@]}" "${api}/${deploy_id}") &&
     polled=$(jq -er '.status' <<<"$resp" 2>/dev/null); then
    status="$polled"
    poll_errors=0
  else
    poll_errors=$(( poll_errors + 1 ))
    echo "Polling Render failed (${poll_errors}/${max_poll_errors}); retrying" >&2
    if (( poll_errors >= max_poll_errors )); then
      echo "Render deploy ${deploy_id}: status unknown, the API did not answer ${max_poll_errors} times in a row. Last response: ${resp:-empty}" >&2
      exit 1
    fi
  fi
  case "$status" in
    live)
      echo "Render deploy ${deploy_id} is live"
      exit 0
      ;;
    build_failed|update_failed|pre_deploy_failed|canceled|deactivated)
      echo "Render deploy ${deploy_id} ended as ${status}" >&2
      exit 1
      ;;
  esac
  sleep "$interval_s"
  elapsed=$(( elapsed + interval_s ))
done

echo "Render deploy ${deploy_id} was still ${status} after ${timeout_s}s" >&2
exit 1
