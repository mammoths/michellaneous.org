# Michellaneous — Consolidated Spec
*Single source of truth. Updated May 2026.*

---

## 1. What This Is

A personal life OS and public dispatch site for Michelle Vo. Visitors see a minimal, beautiful snapshot of what Michelle is tracking this week. Michelle, in private mode, manages her stamp inventory and logs her life.

The aesthetic is **Italian romantic postal** — aged cream paper, engraved stamp illustrations, vintage postmark motifs. A dashboard, but one that feels found rather than built.

---

## 2. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js (App Router) | Routing, SSR, Supabase server calls |
| Hosting | Hostinger | Static export or Node |
| Database | Supabase (Postgres + auth) | Logs, words, stamps, notes |
| Styling | Tailwind CSS + custom CSS | Perforation masks, animations |
| Weather | Open-Meteo API | Free, no key, WMO codes |
| Audio | Web Audio API | Accordion wheeze, typewriter clack (V2) |
| Motion | CSS transitions | Stamp flip, fade-ins |
| Image gen | Replicate / Flux | Stamp illustrations (future) |

---

## 3. Typography

Five fonts. Each has a role. Don't mix them up.

| Role | Font | Feel |
|---|---|---|
| Site title, stamp names | Cormorant Garamond Italic | Script, romantic |
| Stamp numbers, stats | Playfair Display Bold | Engraved, postal |
| Body, notes, stamp labels | Playfair Display | Readable, warm |
| Time, weather, live data | Special Elite | Typewriter, factual |
| Links, handwritten hints | Caveat | Handwritten, intimate |
| UI chrome, inputs | Inter 300/400 | Invisible, functional |

```
Google Fonts URL:
https://fonts.googleapis.com/css2?
  family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400;1,600
  &family=Playfair+Display:ital,wght@0,400;0,700;1,400;1,700
  &family=Special+Elite
  &family=Caveat:wght@400;600
  &family=Inter:wght@300;400;500
  &display=swap
```

---

## 4. Color Palette

### Base

```
Page background:   #eae2cf   aged cream
Stamp paper:       #f6f1e4
Stamp border:      #c8a870
UI text:           #1a1208   near-black ink
Muted text:        #8a6a3a
Very muted:        #b8a080
```

### Per-Stamp Ink Colors (border + illustration bg)

```
run:      #2a4a20  /  #c4d8b4
gym:      #1a2a4a  /  #bac4d8
vibe:     #5a1020  /  #d4b8b8
books:    #3a2010  /  #d4c8b4
meili:    #7a4a10  /  #dccca8
viet:     #8a1010  /  #d8b4b4
pilates:  #1a4030  /  #b4ccbf
aerials:  #3a1a5a  /  #cabcd4
ship:     #5a3010  /  #d4bfa8
sleep:    #1a1a50  /  #b8b8d4
pullups:  #2a3a20  /  #c8d4b8
```

New stamps added via Michelle-mode get assigned the next unused color pair, or Michelle picks from the palette.

---

## 5. Page Structure

```
<header>
  "michellaneous"          ← Cormorant Garamond Italic, large, centered
  "san francisco"          ← Special Elite, small, centered (editable in Michelle-mode)
  "☁ 58°f"               ← Special Elite, small, centered (live, ASCII weather glyph)

<main>
  [stamp grid]             ← flex-wrap, centered
  time window toggle       ← inline in header or just above stamps

<footer> (Michelle-mode only, below fold)
  stamp inventory manager
  (V2: north stars / goal system)
```

One page. One scroll. No sidebar. No nav.

---

## 6. Header

### Weather

Pulled from Open-Meteo on mount, refreshed every 10 minutes.

San Francisco default: `lat=37.7749&lon=-122.4194`
In Michelle-mode, city is editable → stores lat/lon in Supabase (or localStorage for V1).

```js
// endpoint
https://api.open-meteo.com/v1/forecast
  ?latitude=37.7749&longitude=-122.4194
  &current=temperature_2m,weathercode
  &temperature_unit=fahrenheit
```

### WMO Code → ASCII Glyph

```js
const WEATHER_GLYPHS = {
  0:       '○',   // clear sky
  1:       '◌',   // mainly clear
  2:       '◑',   // partly cloudy
  3:       '●',   // overcast
  45:      '≈',   // fog
  48:      '≈',   // rime fog
  51:      '∵',   // light drizzle
  53:      '∵',   // moderate drizzle
  55:      '∵',   // dense drizzle
  61:      '⌇',   // slight rain
  63:      '⌇',   // moderate rain
  65:      '⌇',   // heavy rain
  71:      '❄',   // slight snow
  73:      '❄',   // moderate snow
  75:      '❄',   // heavy snow
  80:      '⌇',   // rain showers
  95:      '↯',   // thunderstorm
};
```

Display format: `[glyph] [temp]°f` — e.g. `◑ 61°f`
All in Special Elite, lowercase, no fuss.

### Time Window Toggle

The word in the subheader cycles on click:

```
"this week"   →   "this month"   →   "today"   →   "this year"   →   "all time"
```

Implemented as a clickable underlined span in Caveat or Special Elite.
Controls which logs are counted across all stamps.

---

## 7. Stamp System

### Visual Anatomy

```
152px × 184px per stamp

- Perforated edge: CSS radial-gradient mask, 5px dots, 13px pitch
- Inner border:    inset 11px, 0.8px solid [stamp ink color]
- Inner double:    inset 14px, 0.3px solid [stamp ink color], 35% opacity
- Illustration:    inset 11px, colored bg (#stamp bg color) + diagonal hatch lines
                   (placeholder until Replicate illustrations are ready)
- Stat area:       bottom-aligned, centered inside illustration
    - Large number: 42px Playfair Display Bold
    - Label:        7px Playfair Display, letter-spacing 3px, uppercase
- Progress bar:    absolute bottom 12px, 1.5px tall, ink color 40% opacity
```

### Stamp Types

Four behavioral types. Defined per stamp in the inventory.

---

**`tally`** — tap to count

The simplest stamp. Optimized for one-handed mobile use.

- Front shows: count in current time window
- Tap the stamp face = +1 logged right now (no form, no confirmation)
- Long-press or flip = see history (date + count per day)
- Unit defined per stamp (e.g. "pull-ups", "espressos", "pages")
- Use for: pull-ups, glasses of water, pages read, coffees

---

**`log`** — structured entries with a value

- Front shows: aggregate for current window (sum of miles, total pages, etc.)
- Tap = inline mini-form slides up: [value] [optional note] → submit
- Flip = entry list, most recent first
- Unit and label defined per stamp
- Use for: running (miles), weight lifted (lbs), books (pages with precision)

---

**`note`** — qualitative, no numbers

- Front shows: stamp name + illustration only (no stat)
- Flip = a standing personal note (Playfair Italic) — "why I do this"
- Michelle-mode: flip reveals edit affordance, saves on blur
- Use for: vibe check, gratitude, context stamps

---

**`study`** — the Viet stamp (one-of-a-kind, see Section 8)

- Tap = enters fullscreen study mode
- Hover = words float up out of the stamp (public view)
- Only one stamp of this type ever exists

---

### Stamp States

| State | Look |
|---|---|
| **dim** | Faint, desaturated, no stat shown — no logs in current window |
| **active** | Full color, postmarked, stat visible |
| **milestone** | Active + one small gold detail in illustration (V2) |

Dim vs. active determined by whether any logs exist in the current time window.

### Flip Animation

```css
.stamp { transform-style: preserve-3d; }
.stamp.flipped { transform: rotateY(180deg); }
.stamp-face, .stamp-back { backface-visibility: hidden; }
transition: transform 0.58s cubic-bezier(0.4, 0.2, 0.2, 1);
```

### Entry Animation (on page load / window change)

```css
@keyframes stampIn {
  from { opacity: 0; transform: scale(0.88) translateY(10px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}
/* stagger: index * 50ms delay */
```

### Grid Layout

- Mobile: 2 columns
- Tablet: 3 columns
- Desktop: 4–5 columns, flex-wrap, centered
- Only shows stamps with activity in the current window
- Empty window: `"a quiet day."` — Cormorant Garamond Italic, centered

---

## 8. Time Window Logic

```js
const WINDOWS = ['week', 'month', 'today', 'year', 'all time'];

function logsInWindow(logs, window) {
  const today = new Date();
  return logs.filter(log => {
    if (window === 'all time') return true;
    const diff = (today - new Date(log.logged_at)) / 86400000;
    if (window === 'today') return isSameDay(log.logged_at, today);
    if (window === 'week')  return diff <= 7;
    if (window === 'month') return diff <= 31;
    if (window === 'year')  return diff <= 365;
  });
}
```

---

## 9. Michelle Mode

### Unlock (V1)

Simple: env var password stored in Supabase or `.env.local`. A small hidden tap target in the header (or just a keyboard shortcut) opens a password input. Correct → Michelle mode. No login page, no modal — it's inline and invisible to observers.

### Unlock (V2)

Secret melody tapped on the accordion sprite (see Deferred). Each tap plays a note. Correct sequence → accordion opens further than it should → Michelle mode. Wrong sequence → nothing.

### What Michelle Mode Unlocks

1. **Stamp inventory** — add, edit, archive stamps
2. **City edit** — tap "san francisco" to change the city (updates lat/lon for weather)
3. **Tally stamps** — tap to log (also works in public, but only saves if authenticated)
4. **Log stamps** — entry form becomes available
5. **Note stamps** — flip reveals edit affordance
6. **Viet quick-add** — word entry flow in study mode
7. **Below-fold** — stamp inventory manager + (V2) north stars

### Stamp Inventory Manager

Lives below the fold, Michelle-mode only.

A stamp is defined by:

```ts
type StampDefinition = {
  id:          string;          // slug, e.g. 'pullups'
  label:       string;          // display name, e.g. "Pull-ups"
  type:        'tally' | 'log' | 'note' | 'study';
  unit:        string;          // e.g. 'reps', 'mi', 'pp', '' for note
  color_key:   string;          // maps to per-stamp ink colors
  illustration: string | null;  // SVG string or Replicate URL, null = hatch placeholder
  active:      boolean;         // show/hide from grid
  sort_order:  number;
}
```

Michelle can:
- **Add** a new stamp (name, type, unit, color) — appears immediately
- **Edit** any stamp's label, unit, color, illustration
- **Archive** a stamp — removes from grid, keeps all log history
- **Reorder** stamps via drag handle

---

## 10. Viet Study Mode

Clicking the viet stamp fullscreens into study mode. Other stamps fade out, header whispers small. Escape or "← back" returns.

### Data Model per Word

```ts
type VietWord = {
  id:        string;       // uuid
  viet:      string;       // Vietnamese word/phrase
  meaning:   string;       // English meaning
  example:   string;       // AI-generated example sentence
  tag:        string;       // auto-categorized by AI
  lvl:        0–4;          // spaced repetition level
  due:        number;       // days since epoch, when to review next
  corrected:  string|null;  // AI spelling flag (flags, never auto-corrects)
  audio_ref:  string|null;  // Wiktionary audio URL if found
  audio_own:  string|null;  // Supabase storage path for user's recording
}
```

### Spaced Repetition

```js
const INTERVALS = [0, 1, 3, 7, 14]; // days per level
// knew it       → lvl++ → due = today + INTERVALS[newLvl]
// still learning → lvl = max(0, lvl-1) → due = today + 1
```

### Session Queue

```js
const overdue  = words.filter(w => w.lvl > 0 && w.due <= today);
const newWords = words.filter(w => w.lvl === 0).slice(0, 8);
queue = [...overdue, ...newWords]; // max ~25 cards
// words with lvl ≤ 1 get a second pass at end of session
```

### Flashcard Mechanic

- Stack with physical depth (2 offset shadows behind)
- Front: Vietnamese word + tag + level dots (4 dots, filled = learned)
- Tap → flips to meaning + example
- Drag right = knew it (green zone)
- Drag left = still learning (red zone)
- Threshold: 80px to commit, else snaps back
- Buttons also: flip / knew it / still learning

### Quick Add Flow (Michelle-mode)

1. Tap "add vietnamese word" (Cormorant Garamond italic, underlined)
2. Large italic input: Vietnamese → Enter
3. English meaning appears → Enter → commits instantly
4. Vietnamese field auto-focuses for next word (rapid-fire)
5. AI fires in background: spelling check + example + category
6. Spelling flag shown as soft red note below word
7. Word appears in table: viet | meaning | example | tag

### Auto-Categories (AI-assigned, never manual)

```
greetings, family, food & drink, feelings, body,
numbers, time, places, verbs, phrases, nature,
home, work, slang, other
```

Falls back to local keyword matching if Claude API unavailable.

### Audio System

- Wiktionary lookup on add: pulls OGG if available
- Reference waveform: green, drawn from AudioBuffer
- User recording: red waveform, MediaRecorder API
- Side-by-side: reference left, yours right
- "Play both": reference → beat → yours
- Public visitors: can practice recording, nothing stored

### Wiktionary Lookup

```js
const url = `https://en.wiktionary.org/w/api.php?action=parse&page=${word}&prop=wikitext&format=json&origin=*`;
// parse wikitext for [[File:*.ogg]] → construct wikimedia commons URL
```

---

## 11. Supabase Schema

```sql
-- All stamp logs (tally, log types)
create table logs (
  id          uuid default gen_random_uuid() primary key,
  stamp_id    text not null,       -- matches StampDefinition.id
  value       numeric default 1,   -- 1 for tally, actual value for log
  note        text,
  logged_at   timestamp default now()
);

-- Standing notes per stamp (note type)
create table stamp_notes (
  stamp_id    text primary key,
  note        text,
  updated_at  timestamp default now()
);

-- Stamp inventory (Michelle manages these)
create table stamps (
  id           text primary key,
  label        text not null,
  type         text not null,       -- 'tally' | 'log' | 'note' | 'study'
  unit         text default '',
  color_key    text,
  illustration text,
  active       boolean default true,
  sort_order   int default 0,
  created_at   timestamp default now()
);

-- Vietnamese words
create table viet_words (
  id          uuid default gen_random_uuid() primary key,
  viet        text not null,
  meaning     text not null,
  example     text,
  tag         text,
  lvl         int default 0,
  due         date default now(),
  corrected   text,
  audio_ref   text,
  audio_own   text,
  created_at  timestamp default now()
);

-- Site settings (city, lat/lon, etc.)
create table settings (
  key         text primary key,
  value       text
);
-- e.g. { key: 'city', value: 'san francisco' }
--      { key: 'lat',  value: '37.7749' }
--      { key: 'lon',  value: '-122.4194' }

-- Goals (V2)
create table goals (
  id          uuid default gen_random_uuid() primary key,
  title       text,
  target_date date,
  metric      text,
  milestones  jsonb,
  created_at  timestamp default now()
);
```

---

## 12. V2 — North Stars

Each stamp can optionally point at a north star: a goal it is building toward.

Examples:
- Pull-ups stamp → "first muscle-up"
- Running stamp → "SF Marathon"
- Viet stamp → "B2 fluency by age 30"
- Aerials stamp → "first competition"

North stars live below the fold in Michelle-mode. They show:
- Goal statement
- Target date + countdown
- Weekly target derived from gap analysis (e.g. "need 15 words/week to hit B2 by Oct")
- Progress bar vs. actual logged data
- Milestone list (AI-generated first, Michelle edits)

This is not fully designed. Build V1 stamps first. North stars emerge from actual use.

---

## 13. Deferred

| Feature | Target |
|---|---|
| Accordion sprite (nav object + secret login) | V2 |
| Melody unlock mechanic | V2 |
| Landscape / instrument mode | V2 |
| Postcard composer (footer) | V2 |
| Replicate stamp illustrations | V2 (after V1 hatch bg) |
| North star / goal system | V2 |
| Audio persistence (Supabase storage) | V2 |
| Milestone stamp state (gold detail) | V2 |

---

## 14. Sprint Order (V1)

1. **Foundation** — Next.js + Tailwind + 5 fonts + CSS vars + paper grain texture
2. **Header** — title, city, weather (Open-Meteo), time window toggle
3. **Stamp shell** — `Stamp.tsx` base component: anatomy, perforation mask, flip animation, dim/active state, entry animation
4. **Tally type** — tap to log, history on flip, Supabase write
5. **Log type** — mini entry form, aggregate display, history on flip
6. **Note type** — flip to standing note, Michelle-mode edit
7. **Stamp inventory** — Michelle-mode CRUD for stamp definitions
8. **Viet stamp** — hover floats, study mode entry/exit
9. **Quick add + flashcards** — word entry, session queue, drag-to-grade
10. **Michelle mode** — password unlock, city edit, full mode toggle

---

*One page. One scroll. Feels found, not built.*
