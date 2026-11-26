# Log as many snacks as Ezra eats: design

**Status:** approved 2026-11-26. Small change.

## Why

Ezra often has more than one snack a day (for example one in the morning and one in the afternoon). Snack is one of the once-a-day entries, so saving a second snack overwrites the first. Naps had the same problem and were fixed by turning them into a list (commit 6bdc7f5). Snacks should work the same way.

## Goals

- Log any number of snacks on a day, each with its own food, amount and time, and each editable or removable on its own.
- Keep every snack already saved.

## Non-goals

- More than one breakfast, lunch or dinner. Those stay once a day.
- Any change to naps, notes, or the meal form's fields.

## Anti-goals

- Losing or duplicating snacks already saved when the change ships.
- Snack foods dropping out of the recent-food chips.

## Approaches considered

1. **Picked: a separate snack list, mirroring naps.** A `snacks` table (one row per snack), a migration that moves existing snacks out of `log_slots`, and a list sheet like the Naps one.
2. Several snack rows in `log_slots`. Breaks that table's one-entry-per-day key, which the other entries depend on. Ruled out.
3. Every meal becomes a list. More than was asked. Ruled out.

## Design

- **Data:** a new `snacks` table: id, date, time, food, amount, created_by, updated_by, created_at, updated_at. Food is required and amount is optional, as for meals today. A migration copies every `log_slots` row with slot `snack` into `snacks`, then deletes those rows. `snack` leaves the once-a-day slots (`SLOTS`, `MEAL_SLOTS`). The day log returns the day's snacks sorted by time.
- **Tile:** with no snacks, the empty "Add" tile, as now. With one, it looks as it does today: the food, then the time and how much he ate. With several, it shows the latest snack's food, then its time and the count:

  ```
  Snack
  Apple slices
  3:00 PM · 2 snacks
  ```

  The person shown is whoever saved the latest snack.
- **Snacks sheet:** tapping a filled tile lists the day's snacks (time, food, how much, who saved it). Tapping one opens it to edit, with Remove. "Add another snack" opens a blank form. With no snacks yet, the tile goes straight to the form. The form keeps today's fields (what he ate with recent-food chips, how much, what time) and gets "‹ All snacks" when there's a list to go back to, like naps.
- **Defaults:** every new snack starts at 3:00 PM and "Most", as the snack form does today.
- **Recent foods:** the chips read foods from both the meal entries and the snack list.
- **Progress:** Snack still counts as one of the "6 logged" once there's at least one snack.
- **Toasts:** "Snack saved. Everyone can see it now." and "Snack removed".
- **Main design doc:** update §6.1 and the data model (§7.4) to describe snacks as a list.

## Left to the builder

- How the meal form is shared between the once-a-day sheet and the snack form, as long as both look and behave as today.
- Function and component names.
- Which of "meals" and "snacks" wins when they're merged for recent foods, as long as the newest foods come first.
