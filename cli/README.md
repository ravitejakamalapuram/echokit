# echokit-server

Headless mock server that replays EchoKit recordings — drop into CI or run locally to serve mocked responses without a browser.

## Install

```bash
# from npm (once published)
npm install -g echokit-server

# or run directly from the repo
node /app/cli/bin/echokit-server.js <export.json>
```

## Quick start

1. In Chrome, record some traffic with the EchoKit extension.
2. Click the three-dot menu → **Export JSON** and save `echokit-export.json`.
3. Run:

   ```bash
   echokit-server echokit-export.json --port 3001
   ```

4. Point your app at `http://localhost:3001` and the server will replay every recorded response.

## CLI

```
echokit-server <export.json> [options]

  --port <n>          listen port (default: 3001)
  --host <h>          bind host (default: 127.0.0.1)
  --latency <ms>      add base latency to every response
  --strict            exit non-zero if any request is unmatched
  --ci                strict + dump unmatched on exit (good for GitHub Actions)
  --watch             reload mocks when the file changes
  --quiet             suppress per-request logs
```

## CI usage

```yaml
- run: npx echokit-server ./mocks.json --ci --port 3001 &
- run: API_BASE=http://localhost:3001 npm test
```

If any test triggers an unmocked request, the server exits non-zero and the
CI run fails — so missing mocks become visible failures, not silent network
calls.

See `.github/workflows/echokit-mock.yml` in this repo for a complete template.

## Match modes

The server honours every match mode set on the recording:

| Mode             | Matches when…                                       |
| ---------------- | --------------------------------------------------- |
| `strict`         | method + normalized URL + body all equal            |
| `ignore-query`   | method + path + body equal (query params ignored)   |
| `ignore-body`    | method + URL equal (body ignored)                   |
| `path-wildcard`  | method + path equal (any query, any body)           |
| `graphql`        | GraphQL op + query + variables equal                |
| `graphql-op`     | GraphQL op + query equal (any variables)            |

## Mock chains

If a recording has `mockChain: [{ status, body, headers }, …]`, the server
cycles through the steps in order on each hit and (by default) loops back to
step 1 after the last step.

## Limitations

- WebSocket / SSE replay is **not** supported by the CLI — use the browser
  extension for those.
- Request bodies must be string-serializable (JSON, urlencoded, plain text).
- The server reads `matchKeys` from the export — if you hand-craft an export,
  the keys are recomputed automatically.
