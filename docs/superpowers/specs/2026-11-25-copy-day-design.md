# Copy one day onto other days: design

**Status:** approved 2026-11-25. Small change.

## Why

While planning caretakers, family often sets up one day (say Monday) and wants the same caretakers on a few other days of that week (say Wednesday and Thursday). Today the only copy is "Copy week", which repeats all seven days onto later weeks. Repeating a single day means re-adding every shift by hand.

## Goals

- From a day that has shifts, copy those shifts onto any of the other six days of the same week, in one step.
- Only family can do it. Caretakers can't, whether in the browser or by calling the server directly.

## Non-goals

- Copying a day into other weeks. Copy the day within the week, then use "Copy week".
- A "fill only empty days" option. Days are picked one at a time, so replacing what's on them is what the person asked for.

## Anti-goals

- Wiping shifts the person didn't know about. Every picked day that already has shifts says so before the copy.
- Clearing days by copying an empty day. A day with no shifts offers no copy, and the server refuses one.

## Approaches considered

1. **Picked: a "Copy this day to…" section in the existing day sheet** (opened by tapping a day's name). That sheet is already where day-level actions go, and the week view stays uncluttered.
2. A "copy" button on every day row. Clutters a screen that's mostly for reading the week.
3. A "one day / whole week" switch in the Copy week sheet. Mixes two different choices (which days, which weeks) in one sheet.

## Design

- **Sheet:** when the tapped day has shifts and isn't a day off, the day sheet shows "Copy this day to", with one checkbox for each of the week's other six days, then a "Copy day" button. The "Mark as a day off" form stays below it.
  - A picked day that already has shifts shows "has N shifts · will be replaced".
  - A day off is shown greyed out ("Thanksgiving · day off") and can't be picked.
  - Picking nothing shows "Pick at least one day."
  - When the copy succeeds, the sheet closes and a toast reads "Copied Mon to Wed and Thu".
- **Server:** `copyDay(db, src, targets)` sits next to `copyWeek` and runs everything in one transaction. Each target day ends up matching the source day. Target days off are left alone. The source day is ignored if it's also listed as a target. Bad dates, no targets, or a source with no shifts are refused, and nothing changes.
- **Permissions:** `copyDayAction` calls `requireFamily()` first, like the other schedule actions.

## Left to the builder

The exact layout inside the sheet (spacing, how the two sections are separated), using the existing sheet styles.
