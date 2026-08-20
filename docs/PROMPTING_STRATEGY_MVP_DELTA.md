# Prompting Strategy: Single Big Prompt for MVP → Iterative Delta Prompts

Reference guide for how agents and humans should scope prompts when building or
extending a feature in AISENA (or any new sub-application built with this framework).
Complements the `Prompt Starter Patterns` table in
[AGENTIC_AI_KNOWLEDGE_BASE.md](AGENTIC_AI_KNOWLEDGE_BASE.md).

## Core idea

1. **One big, tightly-scoped prompt** builds the MVP end-to-end in a single shot.
2. Every feature *not* in the MVP is explicitly listed as an "out of scope for now" —
   this stops the model from over-building or under-building.
3. Once the MVP works, send **small "delta prompts"** — each references the current
   state of the app and asks for exactly one feature, with a rule: "don't touch
   anything else."

This avoids two failure modes: (a) a single giant prompt that tries to do everything
and produces a mess, and (b) endless small prompts with no coherent architecture
because there was never a real spec.

---

## Structure of the MVP prompt

A good MVP prompt has 8 sections, in this order:

1. **Role & context** — who the AI is acting as, and what kind of app this is
2. **Product vision (1–2 sentences)** — the "why," so every decision downstream can
   be checked against it
3. **Tech stack** — be explicit; don't let the model choose
4. **MVP feature list** — a numbered list, small enough to actually ship
5. **Explicit non-goals** — features you *know* you'll want later, named so they
   aren't half-built now
6. **Data model / architecture** — entities, screens, state management approach
7. **Design direction** — visual style, tone, reference apps if useful
8. **Output & acceptance criteria** — what "done" looks like, file structure
   expected, how to verify

The non-goals section (#5) is the one people skip and shouldn't — it's what keeps
the MVP small.

---

## Structure of a feature-addition ("delta") prompt

Once the MVP is live, each new feature prompt should have 4 parts:

1. **Current state** — one paragraph describing what exists now (or literally paste
   the current file/prompt)
2. **The one feature to add** — scoped tightly, no bundling
3. **Constraints** — "do not modify X, Y, Z; do not change the existing data model
   unless required"
4. **Output** — same format as before, so features stay consistent with the MVP's
   structure

---

## Sample: MVP prompt (habit-tracking app example)

```
ROLE
You are building a mobile app MVP for me. Act as a senior product engineer —
make reasonable technical decisions yourself rather than asking me to choose,
but note any assumptions at the end of your response.

PRODUCT VISION
A minimalist daily habit tracker that removes friction: logging a habit
should take one tap, no forms, no setup screens.

TECH STACK
- Kotlin + Jetpack Compose
- Room for local persistence (no backend for MVP)
- MVVM with StateFlow
- Material Design 3 as the base, restyled per "Design direction" below

MVP FEATURE LIST
1. User can create a habit (name + icon, nothing else)
2. Home screen lists today's habits as tappable cards
3. Tapping a card marks it done for today (single tap, no confirmation)
4. A simple streak counter per habit (consecutive days completed)
5. Habits persist across app restarts (Room)

EXPLICIT NON-GOALS (do not build these yet)
- No reminders/notifications
- No habit editing or deletion (create-only for now)
- No analytics/charts/history view beyond the streak number
- No user accounts or cloud sync
- No categories or tags

DATA MODEL
- Habit(id, name, iconId, createdAt)
- HabitLog(id, habitId, date)
- Streak = count of consecutive HabitLog dates ending today or yesterday

DESIGN DIRECTION
Clean, calm, a little playful. Soft rounded cards, generous whitespace,
one accent color used sparingly for the "done" state. Avoid anything
that feels like a productivity/enterprise tool.

OUTPUT & ACCEPTANCE CRITERIA
- Provide full file structure and complete code for each file, not snippets
- App should build and run with the feature list above fully working
- At the end, list any assumptions you made and flag anything you think
  needs my input before continuing
```

---

## Sample: delta prompt (adding a feature after MVP)

```
CURRENT STATE
The app is a Jetpack Compose habit tracker (MVVM + Room). Habits have
name/icon, home screen shows today's habits as tappable cards, tapping
marks done and updates a streak counter. [Paste current HabitViewModel.kt
and Habit.kt here, or attach files.]

FEATURE TO ADD
Let users edit or delete an existing habit via long-press on its card,
opening a bottom sheet with "Edit" and "Delete" options.

CONSTRAINTS
- Do not change the Habit or HabitLog data model
- Do not change how "mark done" or streak calculation works
- Keep the same visual style already established (see current card design)
- Deleting a habit should also delete its HabitLog history (cascade)

OUTPUT
Provide only the new/changed files, clearly marked, plus a one-line note
on anything else that needed to change and why.
```

---

## Applying this to AISENA

- Use the MVP prompt structure when scaffolding a **new sub-application/portal**
  (recall: every new application must have its own portal, isolated from the AISENA
  portal per [copilot-instructions.md](../.github/copilot-instructions.md)).
- Use the delta prompt structure for **TASK-NNNN** work items handed to an
  engineering agent — the "current state" section maps to the relevant
  `project/handoffs/` file or the actual current source, and "constraints" maps to
  Definition-of-Done items in that agent's `CHECKLIST.md`.

## Practical tips

- **Keep MVP prompts to 5–8 features max.** If you're listing more than that, it's
  not an MVP.
- **Always write the non-goals list.** It's more useful than the feature list for
  keeping scope tight.
- **Reuse your design-token/style section verbatim across delta prompts** to keep
  visual consistency as you bolt on features.
- **Paste real current code/state into delta prompts** rather than describing it
  from memory — the model architecture-matches much better against actual files
  than against a summary.
- **One feature per delta prompt.** If you bundle two features, ambiguous
  interactions between them tend to produce bugs that are hard to trace back to
  the prompt.
