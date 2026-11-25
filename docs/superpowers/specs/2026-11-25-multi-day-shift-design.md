# Add one shift on several days at once: design

**Status:** approved 2026-11-25. Small change.

## Why

When a caretaker works the same hours on several days (say Lauren, 8–4, Monday to Friday), the family has to add the identical shift five times. The "Add a shift" sheet only lets them pick one day.

## Goals

- When adding a shift, pick any number of days of the week being viewed and save once. Each picked day gets its own shift.
- A quick way to pick Monday to Friday.

## Non-goals

- Repeating shifts ("every weekday until March"). That would be a new kind of schedule entry and overlaps "Copy week", which already repeats a week onto later weeks.
- Picking days in other weeks. Add the shift in this week, then use "Copy week".
- Changing several shifts at once when editing.

## Anti-goals

- Saving some of the picked days and not others. Either every picked day gets its shift or none does.
- Linked shifts. Each shift created this way is an ordinary shift and can be edited or deleted on its own.

## Approaches considered

1. **Picked: checkboxes in the existing "Add a shift" sheet.** The day row becomes multi-pick when adding, and the server creates one shift per day in one transaction. Matches the checkbox pattern "Copy this day to…" already uses, and needs no change to the database.
2. A repeating-shift entry (a pattern stored once, shown on many days). Much bigger, and would compete with "Copy week". Ruled out.

## Design

- **Adding a shift:** the day section is headed "Which days?" and uses checkboxes instead of radios, so any number of the week's seven days can be ticked. The day that the sheet opened on (today, the week's first day, or the gap's day for "Fill") starts ticked.
- **"Weekdays" shortcut:** a small button in the "Which day?" section makes the ticked days exactly Monday to Friday. (Proposed by Claude, accepted.) It leaves out any of those days marked as a day off, which can still be ticked by hand. (Claude's call, made while planning.)
- **Duration line:** shows "8h shift" for one day and "8h shift × 5 days" when several are ticked.
- **Saving:** one shift per ticked day, all in one transaction. If any is invalid, nothing is saved. Ticking no days shows "Pick at least one day." The toast reads "Shift added" for one and "5 shifts added" for several.
- **"+ Someone new":** the new person is added once, then gets every picked day's shift.
- **Editing a shift:** unchanged. "Which day?" stays single-pick, because an existing shift belongs to one day.
- **Days off and overlaps:** behave as today. Adding a shift on a day off or on top of another shift is allowed.
- **Permissions:** unchanged. `saveShiftAction` already calls `requireFamily()` first.

## Left to the builder

- The exact look of the "Weekdays" button and where it sits, using the existing sheet styles.
- Whether the server takes repeated `date` form values or a new field name, and how the repo function for adding several shifts is shaped.
