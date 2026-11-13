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

The demo clock is fixed at Friday 13 Nov 2026, 10:30 Dubai time, so counts and ages are the same on every load. Sales Manager's My Day opens at **594 tasks on your desk**, across about 237 cases.

## Where things live

| Path | What it holds |
| --- | --- |
| `src/domain/rules.ts` | Stage lists per bank team, bucket mapping, the stage transition map (pack doc 04) and every permission check. UI code asks these functions and never hard-codes stages or roles. |
| `src/domain/pipelineQuery.ts` | Pipeline filters, sorting and the drill-down links used by My Day and Company leads. |
| `src/data/mock.ts` | Seeded generator: about 300 Mawarid and 80 DIB cases, 15 officers, upload batches, and the 594 desk tasks. |
| `src/state/store.ts` | Zustand store: role, data and every action (qualify, file, move, reply, run check and so on). |
| `src/components/CasePanel.tsx` | The one side panel every list opens. |
| `src/pages/` | My Day for each role, Pipeline, Company leads, placeholders. |

## Deviations to log (D4)

- **All banks for every demo role.** The scope gives the "All banks" option to Head of Sales and Admin only. The prototype keeps it for the Sales Manager, Coordinator and Compliance Officer, because those are the only switchable roles and the brief's demo checklist needs "All banks adds a Bank column". Suggested D4 entry: *"Prototype shows All banks to all three demo roles so the Bank column can be demonstrated; production restricts it to Head of Sales and Admin."*
- **My Day counts tasks, Pipeline counts cases.** My Day reads "594 tasks on your desk · across N cases" and Pipeline's chips count cases, so the two are labelled as different units rather than forced to match.

## Assumptions to confirm

- **Desk items are tasks, not cases.** One case can carry several (for example an open query and an overdue follow-up). Only actions the Sales Manager can take right now are recommended: a case whose journey hasn't started, or that has an open query, isn't offered for Qualify until it can be.
- **Over 72h is a placeholder.** The 72-hour untouched threshold is waiting on the founder and is labelled as a placeholder in the UI.
- **A customer query blocks moves until it is closed**, including while it reads "Replied · waiting to close".
- **DIB qualifying:** DIB has no Pre-Compliance stage, so a qualified DIB case stays at Eligible, moves to To file, and the Coordinator files it to Pre-screening.
- **Document pickup:** approved card cases move through approve, assign, then complete. The Sales Manager has a "Mark pickup completed" action so the post-compliance block can be shown and lifted in the demo.
- **Lift hold** is shown disabled with its reason for all three roles. This follows the latest instruction rather than the brief's "no lift button".
- **Role on reload:** the role resets to Sales Manager, as the brief asks.
