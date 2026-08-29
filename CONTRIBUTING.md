# Contributing

Thanks for your interest in `dsh-agent-frugality` 🎉

## How to contribute

1. **Open an issue first** for any bug report or feature request — describe the scenario, expected vs actual behavior, and the DSH version in use.
2. **Code changes**: fork → branch → change `lib/core.js` (pure logic) and/or `lib/index.js` (host assembly) → **add/extend tests in `test/core.test.mjs`** → run `node --test test/core.test.mjs` (must be 18/18 green).
3. **PR**: conventional commits (`feat:`/`fix:`/`docs:`/`test:`) against `main`.

## Rules

- **Zero runtime dependencies** — node built-ins + `lib/core.js` only. No new imports are accepted.
- **Pure functions live in `lib/core.js`** — anything testable must be a pure function there; `lib/index.js` is assembly only.
- **Security model (SPEC §7) is inviolable**: verify command sourced exclusively from host config (tool-arg verify ignored by default); review file reads only whitelisted extensions ≤256KB; logs/ledger never store content bodies; rule file capped at 8KB.
- **Measure-first philosophy**: new intervention layers default OFF; observability first.
- **Never regress tests** — every behavioral change ships with a regression test.

## Verification (before PR)

```powershell
node --test test/core.test.mjs
node --check lib/core.js
node --check lib/index.js
```

## Tasks

The productization checklist lives in [`TICKETS.md`](TICKETS.md); the spec is [`docs/SPEC.md`](docs/SPEC.md).

## License

MIT — see [LICENSE](LICENSE).
