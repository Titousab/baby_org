# Log a nap as it happens: design

**Status:** approved 2026-11-26. Small change.

## Why

Today a nap can only be saved once both times are known, so whoever is with Ezra has to remember when he fell asleep until he wakes up, and sometimes they forget. They want to record the start when he goes down (with one tap, or by typing it a few minutes later) and add the end when he wakes.

## Goals

- Save a nap with only a start time; add the wake-up time later.
- One tap for "he's asleep now" and one for "he just woke up".
- Type the start instead when the app is opened a few minutes after he fell asleep (owner asked for this explicitly), and type either time afterwards to correct it.
- Everyone sees that he's asleep, so a nap started by one person can be ended by another (for example across a shift handover).

## Non-goals

- Night sleep, or naps that cross midnight.
- Reminders or alerts about a nap that's running long.
- Showing the nap on the "With Ezra now" card.

## Anti-goals

- A nap that looks "asleep" forever, or shows as asleep on a later day.
- Silently saving a nap with a made-up wake-up time when the person meant "still asleep".

## Approaches considered

1. **Picked: save the nap when it starts, with no wake-up time yet.** The nap is stored on the server straight away, so every phone sees it and anyone can end it.
2. Keep the start time only on the phone that tapped it, and save the whole nap at the end. No database change, but another person can't end it, and it's lost if the phone changes or the page reloads. Ruled out: handovers mid-nap are normal here.

## Design

- **Data:** a nap's wake-up time becomes optional. A nap without one is "running". The rule "has to end after it starts" still applies whenever there is a wake-up time. A day can have at most one nap without a wake-up time.
- **Starting a nap, on today:** the nap form shows a big **He's asleep now** button that saves the current time as the start. Below it, the usual fields: "Fell asleep" (filled with the current time) and "Woke up" (empty). Typing a start, such as 5 minutes ago, and saving with "Woke up" empty also saves a running nap. While "Woke up" is empty, the line under the fields reads "Still asleep. Add when he woke up later." instead of "Slept 1h 30m".
- **While he's asleep, on today:** the Nap tile counts up, updating every minute:

  ```
  Nap
  Asleep 45m
  since 1:05 pm
  ```

  Tapping it goes straight to that nap. The form shows a big **He just woke up** button that saves the current time as the end, with the fields still there to type or fix either time, plus Remove and "‹ All naps" when there are other naps. "He's asleep now" is hidden while a nap is running. Earlier, finished naps can still be added from the list.
- **The "now" buttons** only appear on today. "Now" is the server's New York time, so every phone agrees. Past days take typed times only. A new nap on a past day starts with both fields filled (1:00 pm to 2:30 pm), as now.
- **Totals:** a running nap isn't counted in the tile's total or in "Napped 1h 30m" until it ends. On today, the progress line adds "asleep now" while one is running.
- **Forgotten naps:** a nap from an earlier day that never got a wake-up time isn't shown as asleep. On that day, its row reads "1:05 pm, no wake-up time yet" and the tile's detail line says "No wake-up time yet", until someone types one.
- **Errors:** "He just woke up" in the same minute he fell asleep gives "The nap has to end after it starts." Saving a second running nap on the same day gives "He's already asleep since 1:05 pm. Add when he woke up first."

## Left to the builder

- How the tile's minute-by-minute count is driven on the page.
- The exact layout of the big buttons, using the existing sheet styles.
- Whether "now" saves go through their own actions or through `saveNapAction`, as long as the time comes from the server.
