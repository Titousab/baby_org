'use client';

import { useState } from 'react';
import { Icon } from '@/components/Icon';
import { tint } from '@/components/Sheet';
import { type NapEntry, napMinutes, type SlotEntry, type SlotKey, type SnackEntry } from '@/lib/log-types';
import { fmtDuration, fmtRange, fmtTime } from '@/lib/time';
import { NapSheet } from './NapSheet';
import { SnackSheet } from './SnackSheet';
import { TileSheet } from './TileSheet';
import { AMOUNT_TEXT, type SlotTileDef, type TileDef, type TileKey, TILES } from './tiles';

type Props = {
  date: string;
  slots: Record<SlotKey, SlotEntry | null>;
  naps: NapEntry[];
  snacks: SnackEntry[];
  foods: string[];
  colors: Record<string, string>;
};

export function TodayTiles({ date, slots, naps, snacks, foods, colors }: Props) {
  const [open, setOpen] = useState<TileKey | null>(null);
  const openTile = TILES.find((t) => t.key === open);
  return (
    <>
      <div className="tiles">
        {TILES.map((t) =>
          t.key === 'nap' ? (
            <NapTile key="nap" def={t} naps={naps} colors={colors} onOpen={() => setOpen('nap')} />
          ) : t.key === 'snack' ? (
            <SnackTile key="snack" def={t} snacks={snacks} colors={colors} onOpen={() => setOpen('snack')} />
          ) : (
            <Tile key={t.key} def={t} entry={slots[t.key]} colors={colors} onOpen={() => setOpen(t.key)} />
          ),
        )}
      </div>
      {open === 'nap' && <NapSheet key={`${date}-nap`} date={date} naps={naps} onClose={() => setOpen(null)} />}
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

/** Total sleep, and either the one nap's times or how many naps there were. */
function NapTile({ def, naps, colors, onOpen }: { def: TileDef; naps: NapEntry[]; colors: Record<string, string>; onOpen: () => void }) {
  if (!naps.length) return <EmptyTile def={def} onOpen={onOpen} />;
  const latest = naps[naps.length - 1];
  return (
    <button type="button" className="tile" style={tint(def.color)} onClick={onOpen}>
      <TileHead def={def} />
      <span className="t-big">{fmtDuration(napMinutes(naps))}</span>
      <span className="t-meta">{naps.length === 1 ? fmtRange(latest.start, latest.end) : `${naps.length} naps`}</span>
      <Who name={latest.byName} colors={colors} />
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
