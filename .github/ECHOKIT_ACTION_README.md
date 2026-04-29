# EchoKit GitHub Action

Run your integration tests against EchoKit-recorded API mocks with automatic coverage tracking and PR comments.

## Quick Start

```yaml
name: Integration Tests

on: [pull_request, push]

jobs:
  test:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write  # for PR coverage comments
    
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Start EchoKit mock server
        uses: ravitejakamalapuram/echokit-action@v1
        with:
          mocks-file: 'tests/fixtures/echokit-export.json'
          port: 3001
      
      - name: Run tests
        env:
          API_BASE_URL: http://localhost:3001
        run: npm test
      
      - name: Stop EchoKit and report coverage
        if: always()
        uses: ravitejakamalapuram/echokit-action@v1
        with:
          mode: stop
          comment-pr: true
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `mocks-file` | Path to your EchoKit JSON export | Yes | - |
| `port` | Port for the mock server | No | `3001` |
| `mode` | `start` or `stop` | No | `start` |
| `report-path` | Coverage report output path | No | `echokit-coverage.json` |
| `report-format` | Report format: `json` or `markdown` | No | `json` |
| `strict` | Fail if any request is unmatched | No | `false` |
| `comment-pr` | Post coverage as PR comment | No | `true` |

## Outputs

| Output | Description |
|--------|-------------|
| `server-url` | URL of the started mock server |
| `coverage` | Coverage percentage (0-100) |

## Advanced Usage

### Strict Mode

Fail the build if any API request is unmatched:

```yaml
- name: Start EchoKit
  uses: ravitejakamalapuram/echokit-action@v1
  with:
    mocks-file: 'tests/api-mocks.json'
    strict: true
```

### Markdown Reports

Generate human-readable markdown reports for CI logs:

```yaml
- name: Stop EchoKit
  uses: ravitejakamalapuram/echokit-action@v1
  with:
    mode: stop
    report-format: markdown
    report-path: coverage-report.md

- name: Show coverage
  run: cat coverage-report.md
```

### Multiple Mock Servers

Run multiple EchoKit instances for different services:

```yaml
- name: Start Auth API mock
  uses: ravitejakamalapuram/echokit-action@v1
  with:
    mocks-file: 'tests/auth-api.json'
    port: 3001

- name: Start Payment API mock
  uses: ravitejakamalapuram/echokit-action@v1
  with:
    mocks-file: 'tests/payment-api.json'
    port: 3002

- name: Run tests
  env:
    AUTH_API_URL: http://localhost:3001
    PAYMENT_API_URL: http://localhost:3002
  run: npm test
```

## Recording Mocks

Install the [EchoKit Chrome Extension](https://chromewebstore.google.com/detail/echokit) to record API traffic and export as JSON for use in CI.

## License

MIT
