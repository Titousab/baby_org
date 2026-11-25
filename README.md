# Ezra's app

A private web app for Ezra's family and caretakers, saved to their phones' home screens:

- **Today:** log wake-up, meals, nap and anything else, and see who's with Ezra right now.
- **Calendar → Caretakers:** plan who covers which hours, spot gaps and copy weeks.
- **Calendar → Classes:** the next 7 days of classes from Ezra's places, filtered to his age, with prices and Book links, plus nearby ideas. The library and Young Ethel's update automatically; the others are typed in, with an alert when their pages change.

**Putting it online:** see [docs/setup.md](docs/setup.md).

## Development

```bash
npm install
npm run dev        # http://localhost:3000, with a local database in .data/ (no setup needed)
npm test           # unit and data tests (in-memory database)
npm run e2e        # browser tests on a phone-sized screen
```

For a first local account, start dev with `OWNER_NAME`, `OWNER_EMAIL` and `OWNER_PASSWORD` set (see `.env.example`).

- Design: [docs/superpowers/specs/2026-11-25-ezra-caretaker-app-design.md](docs/superpowers/specs/2026-11-25-ezra-caretaker-app-design.md)
- Plans: [Part 1](docs/superpowers/plans/2026-11-25-ezra-app-part1-core.md), [Part 2 (classes)](docs/superpowers/plans/2026-11-25-ezra-app-part2-classes.md)
- Mockup: [docs/mockups/ezra-mockup.html](docs/mockups/ezra-mockup.html) (option A)
