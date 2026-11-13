# AEON Connect — back-office prototype

A clickable front-end prototype of the redesigned AEON Connect back office, built for the design-challenge walkthrough. Every name, phone number and application number is invented. There is no backend: all data lives in memory and resets on reload.

## Run it

```bash
npm install
npm run dev
```

Open the URL Vite prints. Desktop only, designed for 1024 px wide and up.

## Deploy on Vercel

Import the repository in Vercel. It detects Vite; `vercel.json` sets the build (`npm run build`, output `dist`) and a rewrite so deep links such as `/pipeline?officer=SO-14` survive a page refresh.

## Demo controls

The floating **Viewing as** button (bottom left) switches between Sales Manager, Coordinator and Compliance Officer. Its menu also has:

- **List state**: Normal, Loading, Empty or Error, to show every list's skeleton, empty line and error-with-Retry.
- **Reset demo data**: regenerates the seeded data set.

The demo clock is fixed at Friday 13 Nov 2026, 10:30 Dubai time, so counts and ages are the same on every load. Sales Manager's My Day opens at **594 on your desk**.

## Where things live

| Path | What it holds |
| --- | --- |
| `src/domain/rules.ts` | Stage lists per bank team, bucket mapping, the stage transition map (pack doc 04) and every permission check. UI code asks these functions and never hard-codes stages or roles. |
| `src/domain/pipelineQuery.ts` | Pipeline filters, sorting and the drill-down links used by My Day and Company leads. |
| `src/data/mock.ts` | Seeded generator: about 300 Mawarid and 80 DIB cases, 15 officers, upload batches, and the 594 desk tasks. |
| `src/state/store.ts` | Zustand store: role, data and every action (qualify, file, move, reply, run check and so on). |
| `src/components/CasePanel.tsx` | The one side panel every list opens. |
| `src/pages/` | My Day for each role, Pipeline, Company leads, placeholders. |

## Assumptions to confirm

- **Desk items are tasks, not cases.** 594 desk items come from about 300 Mawarid cases, so one case can carry several (for example an open query and an overdue follow-up).
- **A customer query blocks moves until it is closed**, including while it reads "Replied · waiting to close".
- **DIB qualifying:** DIB has no Pre-Compliance stage, so a qualified DIB case stays at Eligible, moves to To file, and the Coordinator files it to Pre-screening.
- **Document pickup:** approved card cases move through approve, assign, then complete. The Sales Manager has a "Mark pickup completed" action so the post-compliance block can be shown and lifted in the demo.
- **Lift hold** is shown disabled with its reason for all three roles. This follows the latest instruction rather than the brief's "no lift button".
- **Role on reload:** the role resets to Sales Manager, as the brief asks.
