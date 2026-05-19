# echokit-server

Headless mock server that replays EchoKit recordings in CI or locally — no browser required.

[![npm](https://img.shields.io/npm/v/echokit-server?style=flat-square)](https://www.npmjs.com/package/echokit-server)

## Install

```bash
npm install -g echokit-server
# or run without installing:
npx echokit-server --help
```

## Quick start

1. In Chrome, record traffic with the EchoKit extension.
2. Click the three-dot menu → **Export JSON** → save `echokit-export.json`.
3. Run:

   ```bash
   echokit-server echokit-export.json --port 3001
   ```

4. Point your app at `http://localhost:3001` — the server replays every recorded response.

## CLI reference

```
echokit-server <export.json> [options]

  --port <n>          listen port (default: 3001)
  --host <h>          bind host (default: 127.0.0.1)
  --latency <ms>      add base latency to every response
  --strict            exit non-zero if any request is unmatched
  --ci                strict + dump unmatched requests on exit (recommended for CI)
  --watch             reload mocks when the file changes (dev mode)
  --quiet             suppress per-request logs
  --report            print a color-coded coverage report on exit
  --report-format     output format: text (default) | markdown
```

## CI usage

```yaml
- run: npx echokit-server ./mocks.json --ci --port 3001 &
- run: API_BASE=http://localhost:3001 npm test
```

If any test triggers an unmocked request, the server exits non-zero and CI fails — missing mocks become visible failures, not silent network calls.

See `.github/workflows/echokit-mock.yml` in this repo for a complete copy-paste template, or use the bundled composite action at `.github/echokit-action.yml`.

## Match modes

The server honours every match mode set on the recording:

| Mode | Matches when… |
|---|---|
| `strict` | method + normalized URL + normalized body all equal |
| `ignore-query` | method + path + body equal (query params ignored) |
| `ignore-body` | method + URL equal (body ignored) |
| `path-wildcard` | method + path equal (any query, any body) |
| `graphql` | GraphQL operation + query + variables equal |
| `graphql-op` | GraphQL operation + query equal (any variables) |

## Mock chains

If a recording has `mockChain: [{ status, body, headers }, …]`, the server cycles through the steps in order on each hit and loops back after the last step.

```json
{
  "url": "/api/auth",
  "method": "POST",
  "mockChain": [
    { "status": 401, "body": "{\"error\":\"invalid credentials\"}" },
    { "status": 200, "body": "{\"token\":\"abc123\"}" }
  ]
}
```

## Coverage report

```bash
echokit-server mocks.json --report
```

Prints which mocks were hit, which were missed, and a coverage % — useful for verifying your test suite actually exercises all mocked endpoints.

For CI markdown output (pastes well into GitHub PR comments):

```bash
echokit-server mocks.json --ci --report --report-format markdown
```

## Limitations

- WebSocket / SSE replay is not supported — use the browser extension for those.
- Request bodies must be string-serializable (JSON, urlencoded, plain text).
- If you hand-craft an export without `matchKeys`, the server recomputes them from `url`, `method`, and `body`.

## Development

```bash
# Run tests
node cli/test/test.js

# Run directly from the repo (no install needed)
node cli/bin/echokit-server.js <export.json>
```
