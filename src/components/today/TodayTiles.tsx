'use client';

import { useState } from 'react';
import { Icon } from '@/components/Icon';
import { tint } from '@/components/Sheet';
import { type NapEntry, napMinutes, runningNap, type SlotEntry, type SlotKey, type SnackEntry } from '@/lib/log-types';
import { fmtDuration, fmtRange, fmtTime, toMin } from '@/lib/time';
import { NapSheet } from './NapSheet';
import { SnackSheet } from './SnackSheet';
import { TileSheet } from './TileSheet';
import { AMOUNT_TEXT, type SlotTileDef, type TileDef, type TileKey, TILES } from './tiles';
import { useNowMin } from './useNowMin';

type Props = {
  date: string;
  slots: Record<SlotKey, SlotEntry | null>;
  naps: NapEntry[];
  snacks: SnackEntry[];
  foods: string[];
  colors: Record<string, string>;
  isToday: boolean;
  nowMin: number;
};

export function TodayTiles({ date, slots, naps, snacks, foods, colors, isToday, nowMin }: Props) {
  const [open, setOpen] = useState<TileKey | null>(null);
  const openTile = TILES.find((t) => t.key === open);
  return (
    <>
      <div className="tiles">
        {TILES.map((t) =>
          t.key === 'nap' ? (
            <NapTile key="nap" def={t} naps={naps} colors={colors} isToday={isToday} nowMin={nowMin} onOpen={() => setOpen('nap')} />
          ) : t.key === 'snack' ? (
            <SnackTile key="snack" def={t} snacks={snacks} colors={colors} onOpen={() => setOpen('snack')} />
          ) : (
            <Tile key={t.key} def={t} entry={slots[t.key]} colors={colors} onOpen={() => setOpen(t.key)} />
          ),
        )}
      </div>
      {open === 'nap' && (
        <NapSheet key={`${date}-nap`} date={date} naps={naps} isToday={isToday} nowMin={nowMin} onClose={() => setOpen(null)} />
      )}
      {open === 'snack' && <SnackSheet key={`${date}-snack`} date={date} snacks={snacks} foods={foods} onClose={() => setOpen(null)} />}
      {openTile && openTile.key !== 'nap' && openTile.key !== 'snack' && (
        <TileSheet
          key={`${date}-${openTile.key}`}
          def={openTile as SlotTileDef}
          date={date}
          entry={slots[openTile.key]}
          foods={foods}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}

function TileHead({ def }: { def: TileDef }) {
  return (
    <span className="t-head">
      <span className="t-ico">
        <Icon name={def.icon} />
      </span>
      {def.label}
    </span>
  );
}

function EmptyTile({ def, onOpen }: { def: TileDef; onOpen: () => void }) {
  return (
    <button type="button" className="tile empty" style={tint(def.color)} onClick={onOpen} aria-label={`Add ${def.label}`}>
      <TileHead def={def} />
      <span className="t-add">
        <Icon name="plus" />
        Add
      </span>
    </button>
  );
}

function Who({ name, colors }: { name: string; colors: Record<string, string> }) {
  return (
    <span className="t-by">
      <i className="dot" style={{ background: `var(--${colors[name] ?? 'sage'})` }} />
      {name}
    </span>
  );
}

function Tile({ def, entry, colors, onOpen }: { def: TileDef; entry: SlotEntry | null; colors: Record<string, string>; onOpen: () => void }) {
  if (!entry) return <EmptyTile def={def} onOpen={onOpen} />;
  let body: React.ReactNode;
  if (def.kind === 'time') {
    const [clock, ampm] = fmtTime(entry.time).split(' ');
    body = (
      <span className="t-big">
        {clock}
        <small> {ampm}</small>
      </span>
    );
  } else {
    body = (
      <>
        <span className="t-food">{entry.food}</span>
        <span className="t-meta">
          {fmtTime(entry.time)}
          {entry.amount ? ` · ${AMOUNT_TEXT[entry.amount]}` : ''}
        </span>
      </>
    );
  }
  return (
    <button type="button" className="tile" style={tint(def.color)} onClick={onOpen}>
      <TileHead def={def} />
      {body}
      <Who name={entry.byName} colors={colors} />
    </button>
  );
}

type NapTileProps = { def: TileDef; naps: NapEntry[]; colors: Record<string, string>; isToday: boolean; nowMin: number; onOpen: () => void };

/**
 * Today with a nap running: how long he's been asleep, counting up.
 * Otherwise total sleep, and the one nap's times, how many naps there were, or a missing wake-up time.
 */
function NapTile({ def, naps, colors, isToday, nowMin, onOpen }: NapTileProps) {
  const now = useNowMin(nowMin);
  if (!naps.length) return <EmptyTile def={def} onOpen={onOpen} />;
  const running = runningNap(naps);
  const latest = naps[naps.length - 1];
  const total = napMinutes(naps);

  let big: React.ReactNode = fmtDuration(total);
  let meta = naps.length === 1 && latest.end ? fmtRange(latest.start, latest.end) : `${naps.length} naps`;
  let by = latest.byName;
  if (running && isToday) {
    big = (
      <>
        <small>Asleep </small>
        {fmtDuration(Math.max(0, now - toMin(running.start)))}
      </>
    );
    meta = `since ${fmtTime(running.start)}`;
    by = running.byName;
  } else if (running) {
    big = total ? fmtDuration(total) : '—';
    meta = 'No wake-up time yet';
  }
  return (
    <button type="button" className="tile" style={tint(def.color)} onClick={onOpen}>
      <TileHead def={def} />
      <span className="t-big">{big}</span>
      <span className="t-meta">{meta}</span>
      <Who name={by} colors={colors} />
    </button>
  );
}

/** The latest snack, with how much he ate when it's the only one, or how many snacks there were. */
function SnackTile({ def, snacks, colors, onOpen }: { def: TileDef; snacks: SnackEntry[]; colors: Record<string, string>; onOpen: () => void }) {
  if (!snacks.length) return <EmptyTile def={def} onOpen={onOpen} />;
  const latest = snacks[snacks.length - 1];
  const detail = snacks.length > 1 ? `${snacks.length} snacks` : latest.amount ? AMOUNT_TEXT[latest.amount] : '';
  return (
    <button type="button" className="tile" style={tint(def.color)} onClick={onOpen}>
      <TileHead def={def} />
      <span className="t-food">{latest.food}</span>
      <span className="t-meta">
        {fmtTime(latest.time)}
        {detail ? ` · ${detail}` : ''}
      </span>
      <Who name={latest.byName} colors={colors} />
    </button>
  );
}
