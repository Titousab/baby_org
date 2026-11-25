'use client';

import { useState } from 'react';
import { Icon } from '@/components/Icon';
import { tint } from '@/components/Sheet';
import type { SlotEntry, SlotKey } from '@/lib/log';
import { fmtDuration, fmtRange, fmtTime, toMin } from '@/lib/time';
import { TileSheet } from './TileSheet';
import { AMOUNT_TEXT, type TileDef, TILES } from './tiles';

type Props = {
  date: string;
  slots: Record<SlotKey, SlotEntry | null>;
  foods: string[];
  colors: Record<string, string>;
};

export function TodayTiles({ date, slots, foods, colors }: Props) {
  const [open, setOpen] = useState<SlotKey | null>(null);
  const openTile = TILES.find((t) => t.key === open);
  return (
    <>
      <div className="tiles">
        {TILES.map((t) => (
          <Tile key={t.key} def={t} entry={slots[t.key]} color={colors} onOpen={() => setOpen(t.key)} />
        ))}
      </div>
      {openTile && (
        <TileSheet
          key={`${date}-${openTile.key}`}
          def={openTile}
          date={date}
          entry={slots[openTile.key]}
          foods={foods}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}

function Tile({ def, entry, color, onOpen }: { def: TileDef; entry: SlotEntry | null; color: Record<string, string>; onOpen: () => void }) {
  const head = (
    <span className="t-head">
      <span className="t-ico">
        <Icon name={def.icon} />
      </span>
      {def.label}
    </span>
  );

  if (!entry) {
    return (
      <button type="button" className="tile empty" style={tint(def.color)} onClick={onOpen} aria-label={`Add ${def.label}`}>
        {head}
        <span className="t-add">
          <Icon name="plus" />
          Add
        </span>
      </button>
    );
  }

  let body: React.ReactNode;
  if (def.kind === 'time') {
    const [clock, ampm] = fmtTime(entry.time).split(' ');
    body = (
      <span className="t-big">
        {clock}
        <small> {ampm}</small>
      </span>
    );
  } else if (def.kind === 'meal') {
    body = (
      <>
        <span className="t-food">{entry.food}</span>
        <span className="t-meta">
          {fmtTime(entry.time)}
          {entry.amount ? ` · ${AMOUNT_TEXT[entry.amount]}` : ''}
        </span>
      </>
    );
  } else {
    body = (
      <>
        <span className="t-big">{fmtDuration(toMin(entry.endTime ?? entry.time) - toMin(entry.time))}</span>
        <span className="t-meta">{fmtRange(entry.time, entry.endTime ?? entry.time)}</span>
      </>
    );
  }

  return (
    <button type="button" className="tile" style={tint(def.color)} onClick={onOpen}>
      {head}
      {body}
      <span className="t-by">
        <i className="dot" style={{ background: `var(--${color[entry.byName] ?? 'sage'})` }} />
        {entry.byName}
      </span>
    </button>
  );
}
