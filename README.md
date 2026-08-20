# BD Alert

Keep the birthdays and anniversaries that matter, and get reminded in time.

A small web app built to live on an iPhone Home Screen. Add a person, give them
a date of birth and an anniversary, and BD Alert works out when each one next
comes round — and makes sure you hear about it beforehand.

No account, no server, no tracking. Everything you type stays on your phone.

---

## Installing it on your iPhone

1. Open the app's URL in **Safari** (it must be Safari — Chrome on iOS cannot
   install web apps).
2. Tap the **Share** button, then **Add to Home Screen**.
3. Open it from the Home Screen. It runs full-screen with no browser bars and
   works with no connection at all.

Where does the URL come from? See [Hosting it](#hosting-it) below.

---

## How the reminders work

This is the part worth understanding, because iOS puts a real limit on what any
web app can do.

**iOS will not wake a web app in the background.** No web app on iPhone — this
one included — can run a timer while it is closed and fire an alert at you. Any
app that claims otherwise is either a native app or is sending push
notifications from a server. So BD Alert takes two routes at once:

### Apple Calendar (the reliable one)

**Settings → Apple Calendar → Add dates to Calendar** produces a `.ics` file
holding every date as a yearly repeating event with your chosen alerts attached.
Import it once, and from then on your iPhone's own Calendar owns the schedule —
alerts arrive whether BD Alert is open, closed, or deleted.

- Tap the button; iPhone saves `bd-alert.ics`.
- Open it from the Files app, or from Safari's download bar.
- Choose **Add All** and pick a calendar.

Each event carries a stable identity, so re-importing after you add people or
change reminder times **updates** the existing events rather than duplicating
them. Do it again whenever your dates change.

### In-app catch-up (the immediate one)

Whenever you open BD Alert, it works out which reminders fell due since you last
looked and shows them at the top of **Upcoming**, with a count on the tab and on
the Home Screen icon. If you have granted notification permission, it also posts
them as system notifications. Dismiss one and it stays dismissed until the date
comes round again next year.

---

## What it does

| | |
|---|---|
| **Two dates per person** | A date of birth and an anniversary, either or both |
| **Unknown years** | Tick "I don't know the year" when you know the day but not the year — you still get reminders, just no age |
| **Ages and milestones** | "turning 36", "11th year", worked out for each occurrence |
| **Per-person reminders** | Defaults for everyone, overridden for anyone who needs it |
| **29 February** | Observed on the 28th in common years, in the app and in the exported calendar alike |
| **Works offline** | Fully cached; opens and works with no connection |
| **Light and dark** | Follows your iPhone's appearance, or pick one |
| **Backups** | Export everything to a JSON file, restore it on another device |
| **Importing** | Restore also reads a CSV exported by hip., merging its rows into people |

### Where your data lives

In this browser's `localStorage`, on this device, and nowhere else. There is no
account and no sync — which also means **the app is the only copy**. If you rely
on it, export a backup from **Settings → Your data**, and send your dates to
Calendar so they survive independently.

### Coming from another app

**Settings → Your data → Restore from a file** takes a backup this app exported,
and also a CSV exported by [hip.](https://www.hip.app/) — no conversion step in
between, so it can be done on the phone.

hip writes one row per event, with the day, month and year in separate columns
and the year blank where it is not known. BD Alert holds one record per person
carrying up to two dates, so the reader merges rows by name: someone with a
birthday row and an anniversary row arrives as one person with both. A blank
year becomes BD Alert's own "day and month known, year not", so those dates
still raise reminders, just without an age.

Two things worth knowing before you tap Restore:

- **It replaces, it does not merge.** Everyone already in BD Alert is cleared.
  Export a backup first if you have entries the CSV does not cover.
- **Anything the reader changed or skipped is listed** on the confirmation card
  before you commit to it — merged rows, unreadable dates, and entries named
  `Anniversary <couple>`, which hip has no other way to store and which arrive
  here as a real anniversary.

Person ids are derived from the name rather than being random, and the calendar
export builds its `UID`s from them. Importing a later hip export therefore
**updates** the events already in Apple Calendar instead of adding a second copy
of every birthday.

---

## Hosting it

The app is a folder of static files. Any static host works; two easy routes:

### GitHub Pages

`.github/workflows/deploy.yml` builds and publishes on every push to `main`.

Pages has to be switched on once by hand first, under **Settings → Pages →
Build and deployment → Source → GitHub Actions**. The workflow cannot do this
for you: creating a Pages site needs repository-admin rights, which the
`GITHUB_TOKEN` a workflow runs with does not have. Once it is on, every push
deploys by itself.

The app then lives at `https://<user>.github.io/<repo>/`.

GitHub Pages needs the repository to be **public** on a free plan. On a private
repository, use Netlify or Vercel instead.

### Netlify or Vercel

Point either at this repository and accept the defaults — build `npm run build`,
publish `dist`. Both serve private repositories on their free tier and give you
an HTTPS URL, which Safari requires before it will install a web app.

---

## Development

```bash
npm install
npm run dev          # http://localhost:5173
```

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Type-check, then build to `dist/` |
| `npm run preview` | Serve the built app locally |
| `npm run typecheck` | Types only, no build |
| `npm run icons` | Regenerate the app icons in `public/` |

To try it on your phone over your local network, run
`npm run dev -- --host` and open the address it prints. Note that iOS only
allows **Add to Home Screen** and notifications over HTTPS, so a real deploy is
needed for the full experience.

### Layout

```
src/
  lib/dates.ts         Recurrence, leap years, ages, formatting
  lib/occurrences.ts   Resolving people into dated events and due reminders
  lib/ics.ts           The iCalendar file, alarms and all
  lib/storage.ts       localStorage, plus validation of anything imported
  lib/hip.ts           Reading a CSV exported by the hip. app
  lib/notifications.ts Permissions, system notifications, the icon badge
  components/          The three tabs, the add/edit sheet, shared pieces
scripts/
  generate-icons.mjs   Draws the icons from geometry — no image libraries
```

Icons are generated, not hand-drawn: `scripts/generate-icons.mjs` rasterises the
cake from rounded rectangles and circles and writes the PNGs with node's own
`zlib`, so they can be rebuilt anywhere with no dependencies.

Built with React, TypeScript, Tailwind CSS and Vite, with `vite-plugin-pwa` for
the service worker and manifest.
