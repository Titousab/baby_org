'use client';

import { useState } from 'react';
import { Icon } from '@/components/Icon';
import { ageInMonths, ageLabel, fitFor } from '@/lib/classes/ages';
import type { ClassItem } from '@/lib/classes/list';
import { addDays, dowShort, fmtDayShort, fmtTime, toMin } from '@/lib/time';
import { ClassSheet } from './ClassSheet';
import { ManualClassSheet } from './ManualClassSheet';
import { PlacesSheet } from './PlacesSheet';
import type { ManualRow, PlaceView } from './types';

type Props = {
  items: ClassItem[];
  places: PlaceView[];
  manual: ManualRow[];
  birthdate: string | null;
  today: string;
  daysOff: Record<string, string>;
  updatedLabel: string;
  canEdit: boolean;
};

type Open = { kind: 'places' } | { kind: 'class'; item: ClassItem } | { kind: 'manual'; row: ManualRow | null } | null;

const FIT_LABEL = { older: 'Older kids', younger: 'Younger kids' } as const;

export function ClassesView(p: Props) {
  const [placeFilter, setPlaceFilter] = useState<number | 'all'>('all');
  const [showAll, setShowAll] = useState(false);
  const [open, setOpen] = useState<Open>(null);
  const close = () => setOpen(null);

  const classPlaces = p.places.filter((pl) => pl.kind === 'class');
  const changedCount = classPlaces.filter((pl) => pl.changed).length;
  const fit = (i: ClassItem) => fitFor({ min: i.ageMin, max: i.ageMax }, p.birthdate ? ageInMonths(p.birthdate, i.date) : null);

  const classes = p.items.filter((i) => i.kind === 'class' && (placeFilter === 'all' || i.placeId === placeFilter));
  const otherAges = classes.filter((i) => fit(i) === 'older' || fit(i) === 'younger');
  const shown = showAll ? classes : classes.filter((i) => !otherAges.includes(i));
  const ideas = p.items.filter((i) => i.kind === 'idea');
  const days = Array.from({ length: 7 }, (_, n) => addDays(p.today, n));

  const dayLabel = (date: string) => {
    const base = fmtDayShort(date);
    return date === p.today ? `Today · ${base}` : date === addDays(p.today, 1) ? `Tomorrow · ${base}` : base;
  };

  return (
    <>
      <button type="button" className="places-bar" onClick={() => setOpen({ kind: 'places' })}>
        <span className="dots-stack" aria-hidden="true">
          {classPlaces.map((pl) => (
            <i key={pl.id} style={{ background: `var(--${pl.color})` }} />
          ))}
        </span>
        <span className="pb-text">
          <b>{classPlaces.length} places connected</b>
          <small>{changedCount ? `${changedCount} ${changedCount === 1 ? 'page' : 'pages'} changed · ${p.updatedLabel}` : p.updatedLabel}</small>
        </span>
        <span className="link">Manage</span>
      </button>

      <div className="chips" role="group" aria-label="Filter by place">
        <button type="button" className="chip" aria-pressed={placeFilter === 'all'} onClick={() => setPlaceFilter('all')}>
          All places
        </button>
        {classPlaces.map((pl) => (
          <button key={pl.id} type="button" className="chip" aria-pressed={placeFilter === pl.id} onClick={() => setPlaceFilter(pl.id)}>
            <i className="dot" style={{ background: `var(--${pl.color})` }} />
            {pl.name}
          </button>
        ))}
      </div>

      {p.birthdate ? (
        <span className="age-badge">
          <Icon name="check" />
          Ezra is {ageInMonths(p.birthdate, p.today)} months · classes for his age
        </span>
      ) : (
        <p className="sub">Add Ezra&apos;s birthday (tap your initial → Settings) to see only classes for his age.</p>
      )}

      {days.map((date) => {
        const list = shown.filter((i) => i.date === date);
        const off = p.daysOff[date];
        if (!list.length && !off) return null;
        return (
          <section key={date} className="group">
            <h3 className="group-h">{dayLabel(date)}</h3>
            {off && !list.length && (
              <p className="closed">
                <Icon name="leaf" />
                Most places are closed for {off}.
              </p>
            )}
            {list.length > 0 && (
              <ul className="class-list">
                {list.map((i) => (
                  <ClassRow key={i.key} item={i} fit={fit(i)} onOpen={() => setOpen({ kind: 'class', item: i })} />
                ))}
              </ul>
            )}
          </section>
        );
      })}
      {!shown.length && <p className="hidden-note">No classes in the next 7 days{placeFilter === 'all' ? '' : ' at this place'}.</p>}

      {otherAges.length > 0 && (
        <p className="hidden-note">
          {showAll ? (
            <>
              Showing every age.{' '}
              <button type="button" className="btn-text" onClick={() => setShowAll(false)}>
                Only Ezra&apos;s age
              </button>
            </>
          ) : (
            <>
              {otherAges.length} for other ages hidden.{' '}
              <button type="button" className="btn-text" onClick={() => setShowAll(true)}>
                Show
              </button>
            </>
          )}
        </p>
      )}

      <section className="section">
        <div className="section-head">
          <h2 className="h2">Nearby ideas</h2>
          <span className="muted-sm">Not connected</span>
        </div>
        <p className="sub">Free and drop-in things nearby, from the Central Library and Prospect Park.</p>
        {ideas.length ? (
          ideas.map((i) => (
            <div key={i.key} className="idea">
              <div className="idea-main">
                {i.priceText && <span className="price">{i.priceText}</span>}
                <b>{i.title}</b>
                <span>
                  {i.placeName} · {dowShort(i.date)} {fmtTime(i.start)}
                  {i.ageMin !== null || i.ageMax !== null ? ` · ${ageLabel(i.ageMin, i.ageMax)}` : ''}
                </span>
              </div>
              {i.bookingUrl && (
                <a className="book" href={i.bookingUrl} target="_blank" rel="noopener noreferrer">
                  Details <Icon name="ext" />
                </a>
              )}
            </div>
          ))
        ) : (
          <p className="hidden-note">No nearby ideas this week.</p>
        )}
      </section>

      {open?.kind === 'places' && (
        <PlacesSheet places={p.places} canEdit={p.canEdit} onClose={close} onAddClass={() => setOpen({ kind: 'manual', row: null })} />
      )}
      {open?.kind === 'class' && (
        <ClassSheet
          key={open.item.key}
          item={open.item}
          canEdit={p.canEdit}
          onClose={close}
          onEdit={() => setOpen({ kind: 'manual', row: p.manual.find((m) => m.id === open.item.manualId) ?? null })}
        />
      )}
      {open?.kind === 'manual' && (
        <ManualClassSheet key={open.row?.id ?? 'new'} row={open.row} places={classPlaces} today={p.today} onClose={close} />
      )}
    </>
  );
}

function ClassRow({ item, fit, onOpen }: { item: ClassItem; fit: ReturnType<typeof fitFor>; onOpen: () => void }) {
  const m = toMin(item.start);
  const [clock, ampm] = fmtTime(m).split(' ');
  const meta = [item.durationMin ? `${item.durationMin} min` : null, ageLabel(item.ageMin, item.ageMax)].filter(Boolean).join(' · ');
  return (
    <li className={`class${fit === 'older' || fit === 'younger' ? ' is-out' : ''}`}>
      <div className="c-time">
        <b>{clock}</b>
        <span>{ampm}</span>
      </div>
      <button type="button" className="c-main class-open" onClick={onOpen}>
        <span className="c-title">{item.title}</span>
        <span className="c-place">
          <i className="dot" style={{ background: `var(--${item.color})` }} />
          {item.placeName}
        </span>
        <span className="c-meta">
          {meta}
          {item.priceText && <> · <span className="spots">{item.priceText}</span></>}
          {item.statusText && <> · <span className={/full|wait/i.test(item.statusText) ? 'wait' : 'spots'}>{item.statusText}</span></>}
          {(fit === 'older' || fit === 'younger') && <> · <span className="older">{FIT_LABEL[fit]}</span></>}
        </span>
      </button>
      {item.bookingUrl && (
        <a className="book" href={item.bookingUrl} target="_blank" rel="noopener noreferrer">
          Book <Icon name="ext" />
        </a>
      )}
    </li>
  );
}
