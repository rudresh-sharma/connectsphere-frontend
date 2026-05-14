#!/bin/sh
set -eu

gateway_api_url="${GATEWAY_API_URL:-}"
auth_api_url="${AUTH_API_URL:-}"
post_api_url="${POST_API_URL:-}"
follow_api_url="${FOLLOW_API_URL:-}"
comment_api_url="${COMMENT_API_URL:-}"
like_api_url="${LIKE_API_URL:-}"
notification_api_url="${NOTIFICATION_API_URL:-}"
notification_ws_url="${NOTIFICATION_WS_URL:-}"
media_api_url="${MEDIA_API_URL:-}"
search_api_url="${SEARCH_API_URL:-}"
oauth_google_url="${OAUTH_GOOGLE_URL:-}"
oauth_github_url="${OAUTH_GITHUB_URL:-}"

js_value() {
  if [ -n "$1" ]; then
    printf "'%s'" "$1"
  else
    printf "undefined"
  fi
}

cat > /usr/share/nginx/html/runtime-config.js <<EOF
globalThis.__CONNECTSPHERE_ENV__ = {
  gatewayApiUrl: $(js_value "$gateway_api_url"),
  authApiUrl: $(js_value "$auth_api_url"),
  postApiUrl: $(js_value "$post_api_url"),
  followApiUrl: $(js_value "$follow_api_url"),
  commentApiUrl: $(js_value "$comment_api_url"),
  likeApiUrl: $(js_value "$like_api_url"),
  notificationApiUrl: $(js_value "$notification_api_url"),
  notificationWsUrl: $(js_value "$notification_ws_url"),
  mediaApiUrl: $(js_value "$media_api_url"),
  searchApiUrl: $(js_value "$search_api_url"),
  oauthGoogleUrl: $(js_value "$oauth_google_url"),
  oauthGithubUrl: $(js_value "$oauth_github_url")
};
EOF
