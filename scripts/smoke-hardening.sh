#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   API_BASE="https://tu-backend.onrender.com" \
#   GOOD_ORIGIN="https://tu-frontend.vercel.app" \
#   BAD_ORIGIN="https://evil.example" \
#   GOOD_TENANT="tenant-a" \
#   BAD_TENANT="tenant-b" \
#   AUTH_TOKEN="eyJ..." \
#   ./scripts/smoke-hardening.sh

API_BASE="${API_BASE:-}"
GOOD_ORIGIN="${GOOD_ORIGIN:-}"
BAD_ORIGIN="${BAD_ORIGIN:-https://evil.example}"
GOOD_TENANT="${GOOD_TENANT:-}"
BAD_TENANT="${BAD_TENANT:-}"
AUTH_TOKEN="${AUTH_TOKEN:-}"
CHAT_PAYLOAD="${CHAT_PAYLOAD:-{\"text\":\"hola\"}}"

if [[ -z "$API_BASE" || -z "$GOOD_ORIGIN" ]]; then
  echo "Falta configurar API_BASE y GOOD_ORIGIN"
  exit 1
fi

hit_chat() {
  local origin="$1"
  local label="$2"
  local resp status body code
  resp="$(curl -sS -i -X POST "$API_BASE/api/v1/chat" \
    -H "Origin: $origin" \
    -H "Content-Type: application/json" \
    -d "$CHAT_PAYLOAD")"
  status="$(printf "%s" "$resp" | awk 'toupper($1) ~ /^HTTP\\// {s=$2} END{print s}')"
  body="$(printf "%s" "$resp" | awk 'BEGIN{p=0} /^\\r?$/{p=1; next} p{print}')"
  code="$(printf "%s" "$body" | tr -d '\r\n' | sed -n 's/.*"code"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
  echo "[$label] HTTP ${status:-<no-status>} error.code=${code:-<none>}"
}

echo "== 1) Origin allowlist =="
hit_chat "$GOOD_ORIGIN" "GOOD_ORIGIN"
hit_chat "$BAD_ORIGIN" "BAD_ORIGIN (esperado 403/forbidden_origin)"

echo
echo "== 2) Rate limit =="
echo "Configura temporalmente en deploy: CHAT_RATE_MAX=2 y CHAT_RATE_WINDOW_MS=60000."
for i in 1 2 3 4 5; do
  hit_chat "$GOOD_ORIGIN" "RATE req-$i"
done

echo
echo "== 3) Forbidden tenant =="
if [[ -z "$AUTH_TOKEN" || -z "$GOOD_TENANT" || -z "$BAD_TENANT" ]]; then
  echo "Saltado (define AUTH_TOKEN, GOOD_TENANT y BAD_TENANT para este check)."
  exit 0
fi

tenant_hit() {
  local tenant="$1"
  local label="$2"
  local resp status body code
  resp="$(curl -sS -i -X GET "$API_BASE/api/v1/groups?limit=5&offset=0" \
    -H "Origin: $GOOD_ORIGIN" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -H "x-ttd-tenant: $tenant")"
  status="$(printf "%s" "$resp" | awk 'toupper($1) ~ /^HTTP\\// {s=$2} END{print s}')"
  body="$(printf "%s" "$resp" | awk 'BEGIN{p=0} /^\\r?$/{p=1; next} p{print}')"
  code="$(printf "%s" "$body" | tr -d '\r\n' | sed -n 's/.*"code"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
  echo "[$label] HTTP ${status:-<no-status>} error.code=${code:-<none>}"
}

tenant_hit "$GOOD_TENANT" "GOOD_TENANT (esperado !=403)"
tenant_hit "$BAD_TENANT" "BAD_TENANT (esperado 403/forbidden_tenant)"
