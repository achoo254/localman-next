# /etc/nginx/localman/localman-app.inc (installed with each release by
# infra/localman/switch-release.sh; not in conf.d, so never loaded alone)
# The web app, dashboard API and /m/ fallback of a Localman dashboard host,
# included by the server block of localman.hoandat.com and by the one of
# every tenant's localman.<domain> (localman-tenants.conf). Each server keeps
# its own certificate, logs, security headers (the CSP names its IdP) and
# /internal/ rule.

    # Through the release symlink (infra/localman/switch-release.sh).
    root /opt/localman/current/web;
    client_max_body_size 128k;
    limit_req_status 429;
    limit_conn_status 429;
    limit_req_log_level warn;
    limit_conn_log_level warn;

    # Inherited by the proxied locations.
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto https;
    proxy_read_timeout 30s;

    location /api/ {
        add_header X-Robots-Tag "noindex" always;
        proxy_pass http://127.0.0.1:4000;
    }

    # API client tab drafts and history (/api/v1/client/drafts,
    # /client/history…): the API takes up to DRAFT_BODY_LIMIT (1 MiB draft
    # plus 64 KiB, draft-size.ts) on those routes and answers its own JSON
    # 413 past it; 2m leaves it that answer instead of nginx's HTML page.
    # Every other route keeps the 128k above.
    location ^~ /api/v1/client/ {
        client_max_body_size 2m;
        add_header X-Robots-Tag "noindex" always;
        proxy_pass http://127.0.0.1:4000;
    }

    # Public sharing reads (public links, the JSON of an access key): no
    # session, so per-IP limits come first (zone in localman-http.conf).
    # Case-insensitive like the API's router. Link ids and access keys are
    # in the URL and error lines (upstream down, limit hit) quote it, so
    # only critical errors are logged here.
    location ~* ^/api/v1/public/ {
        error_log /var/log/nginx/localman-mock.error.log crit;
        limit_req zone=localman_public burst=20 nodelay;
        add_header X-Robots-Tag "noindex" always;
        proxy_pass http://127.0.0.1:4000;
    }

    # Collections and environments (/api/v1/collections/…,
    # /api/v1/environments/…, and creating either in
    # /api/v1/workspaces/:id/…): an imported collection tree takes up to
    # 12 MiB (TREE_BODY_LIMIT in collection-write-operations.ts), a node
    # 4 MiB, a variable list 3 MiB and local values 6 MiB; 16m leaves the
    # API its own JSON 413 past those caps instead of nginx's HTML page.
    location ~ ^/api/v1/(collections|environments|workspaces)/ {
        limit_req zone=localman_api_large burst=40 nodelay;
        client_max_body_size 16m;
        add_header X-Robots-Tag "noindex" always;
        proxy_pass http://127.0.0.1:4000;
    }

    # API client proxy (client.sendRequest): a JSON envelope of up to 15 MiB
    # (MAX_PROXY_ENVELOPE_BYTES in packages/shared/src/api-client/limits.ts:
    # a 10 MB body in base64), 16m so the API answers past it with its own
    # 413, and an upstream timeout of up to 120 s. The
    # API refuses guests before reading the body and limits each account;
    # this per-IP zone (localman-http.conf) stops floods of large bodies
    # before nginx buffers them. Responses (up to ~14 MB of JSON) go out
    # unbuffered instead of through temp files.
    location = /api/v1/proxy {
        limit_req zone=localman_proxy burst=20 nodelay;
        client_max_body_size 16m;
        proxy_read_timeout 130s;
        proxy_send_timeout 130s;
        proxy_buffering off;
        add_header X-Robots-Tag "noindex" always;
        proxy_pass http://127.0.0.1:4000;
    }

    location /auth/ {
        add_header X-Robots-Tag "noindex" always;
        proxy_pass http://127.0.0.1:4000;
    }

    # Localman MCP for AI agents: Streamable HTTP with Bearer tokens of the
    # IdP. Answers may stream (SSE), so no buffering, and a listen stream
    # stays open longer than an API call. Bodies up to the SDK's 4 MB cap.
    # Per-IP rate (zone in localman-http.conf); a burst covers an agent
    # opening its listen streams and listing tools at once.
    location = /mcp {
        limit_req zone=localman_mcp burst=40 nodelay;
        client_max_body_size 4m;
        proxy_buffering off;
        proxy_read_timeout 300s;
        add_header X-Robots-Tag "noindex" always;
        proxy_pass http://127.0.0.1:4000;
    }

    # RFC 9728 metadata of /mcp (and the root form), served by the API.
    location ^~ /.well-known/oauth-protected-resource {
        add_header X-Robots-Tag "noindex" always;
        proxy_pass http://127.0.0.1:4000;
    }

    # Mock fallback https://localman.<domain>/m/{secret}{prefix}/...
    # Same origin as the dashboard, while the answer is the project's
    # (hybrid upstream, webhook inbox): the runtime sends a sandbox CSP
    # (MOCK_CONTENT_SECURITY_POLICY in apps/api/src/mock-server.ts) and
    # nosniff, and nginx enforces the same here in case it ever does not.
    # With its own add_header lines this location inherits none of the
    # server-level ones, so HSTS is repeated; the runtime's copies of the
    # headers nginx sets are hidden so each goes out once. The dashboard
    # CSP is not repeated: its script-src 'self' would let a mock answer
    # run.
    location /m/ {
        # The secret is in the path, and error lines quote the request.
        error_log /var/log/nginx/localman-mock.error.log crit;
        limit_req zone=localman_mock burst=100 nodelay;
        limit_conn localman_mock_conn 50;
        proxy_hide_header Content-Security-Policy;
        proxy_hide_header X-Content-Type-Options;
        proxy_hide_header Strict-Transport-Security;
        add_header Content-Security-Policy "sandbox; default-src 'none'; frame-ancestors 'none'" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
        add_header X-Robots-Tag "noindex" always;
        proxy_pass http://127.0.0.1:4100;
    }

    # Content-hashed build assets.
    location /assets/ {
        expires 1y;
        try_files $uri =404;

        # nginx 1.20's mime.types has no wasm; without application/wasm the
        # browser refuses streaming compile of the script sandbox (QuickJS).
        location ~ \.wasm$ {
            types { }
            default_type application/wasm;
            expires 1y;
            try_files $uri =404;
        }
    }

    # Entry points that must never be stale.
    location = /index.html {
        expires -1;
    }

    # No pricing page while Localman is not sold: old links go to the
    # landing. 302, not 301, so browsers do not cache it for good and the
    # page can come back (docs/decisions/0002-*).
    location = /pricing {
        return 302 /;
    }

    location = /sw.js {
        expires -1;
    }

    location = /robots.txt {
        expires 1d;
    }

    # "Run in Localman" badge embedded in READMEs (GitHub fetches it through
    # its image proxy). A missing file is a 404, never the app's HTML.
    location = /run-button.svg {
        expires 1d;
        try_files $uri =404;
    }

    # SPA: unknown paths render the app, which shows its own 404.
    location / {
        try_files $uri /index.html;
    }
