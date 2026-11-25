'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { copyPrevWeekAction } from '@/app/actions/schedule';
import { Icon } from '@/components/Icon';
import { useToast } from '@/components/Toast';
import type { CoverageRules, ShiftView } from '@/lib/schedule/coverage';
import { fmtHours, fmtRange, fromMin, toMin } from '@/lib/time';
import { CopyWeekSheet } from './CopyWeekSheet';
import { DayOffSheet } from './DayOffSheet';
import { barSpan, coverageLine, scaleTicks } from './scale';
import { ShiftSheet, type ShiftDraft } from './ShiftSheet';
import type { DayData, Person } from './types';

type Props = {
  weekStart: string;
  weekLabel: string;
  range: string;
  prevWeek: string | null;
  nextWeek: string | null;
  days: DayData[];
  people: Person[];
  rules: CoverageRules;
  hours: Array<{ personName: string; color: string; minutes: number }>;
  laterWeeks: string[];
  canEdit: boolean;
  today: string;
};

type Open = { kind: 'shift'; draft: ShiftDraft } | { kind: 'copy' } | { kind: 'dayoff'; day: DayData } | null;

export function CaretakersView(p: Props) {
  const [open, setOpen] = useState<Open>(null);
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const close = () => setOpen(null);

  const total = p.days.reduce((n, d) => n + d.shifts.length, 0);
  const gapCount = p.days.reduce((n, d) => n + d.gaps.length, 0);
  const inWeek = p.days.some((d) => d.date === p.today);
  const newShift = (): ShiftDraft => ({ date: inWeek ? p.today : p.weekStart, personId: p.people[0]?.id ?? null, start: '08:00', end: '16:00' });

  function copyPrev() {
    startTransition(async () => {
      const r = await copyPrevWeekAction(p.weekStart);
      toast(r.ok ? 'Copied last week. Change any days that are different.' : r.message);
    });
  }

  const nav = (
    <div className="pillnav" style={{ marginTop: 0 }}>
      {p.prevWeek ? (
        <Link className="icon-btn" href={`/calendar/caretakers?week=${p.prevWeek}`} aria-label="Previous week">
          <Icon name="chevL" />
        </Link>
      ) : (
        <span className="icon-btn" aria-label="Previous week" aria-disabled="true">
          <Icon name="chevL" />
        </span>
      )}
      <div className="pillnav-label">
        <b>{p.weekLabel}</b>
        <span>{p.range}</span>
      </div>
      {p.nextWeek ? (
        <Link className="icon-btn" href={`/calendar/caretakers?week=${p.nextWeek}`} aria-label="Next week">
          <Icon name="chevR" />
        </Link>
      ) : (
        <span className="icon-btn" aria-label="Next week" aria-disabled="true">
          <Icon name="chevR" />
        </span>
      )}
    </div>
  );

  const sheets = (
    <>
      {open?.kind === 'shift' && (
        <ShiftSheet key={JSON.stringify(open.draft)} draft={open.draft} days={p.days} people={p.people} onClose={close} />
      )}
      {open?.kind === 'copy' && <CopyWeekSheet weekStart={p.weekStart} laterWeeks={p.laterWeeks} days={p.days} onClose={close} />}
      {open?.kind === 'dayoff' && <DayOffSheet key={open.day.date} day={open.day} onClose={close} />}
    </>
  );

  if (!total) {
    return (
      <>
        {nav}
        <div className="empty">
          <p className="empty-t">Nothing planned yet</p>
          {p.canEdit ? (
            <>
              <p>Copy last week&apos;s caretakers here, then change any days that are different.</p>
              <button type="button" className="btn-primary" onClick={copyPrev} disabled={pending}>
                <Icon name="copy" /> Copy last week here
              </button>
              <button type="button" className="btn-text" onClick={() => setOpen({ kind: 'shift', draft: newShift() })}>
                Or add one shift
              </button>
            </>
          ) : (
            <p>Nobody has planned this week yet.</p>
          )}
        </div>
        {sheets}
      </>
    );
  }

  return (
    <>
      {nav}
      <div className="cover-row">
        <span className="muted-sm">{coverageLine(p.rules)}</span>
        {gapCount ? (
          <span className="status bad">
            <Icon name="alert" />
            {gapCount} {gapCount === 1 ? 'gap' : 'gaps'} to fill
          </span>
        ) : (
          <span className="status ok">
            <Icon name="check" />
            All covered
          </span>
        )}
      </div>
      {p.canEdit && (
        <div className="actions">
          <button type="button" className="btn-soft" onClick={() => setOpen({ kind: 'copy' })}>
            <Icon name="copy" /> Copy week
          </button>
          <button type="button" className="btn-primary" onClick={() => setOpen({ kind: 'shift', draft: newShift() })}>
            <Icon name="plus" /> Add shift
          </button>
        </div>
      )}
      <div className="scale" aria-hidden="true">
        {scaleTicks(p.rules).map((t) => (
          <span key={t.label} style={{ left: `${t.pct}%` }}>
            {t.label}
          </span>
        ))}
      </div>
      <ul className="days">
        {p.days.map((d) => (
          <DayRow
            key={d.date}
            day={d}
            rules={p.rules}
            canEdit={p.canEdit}
            onShift={(s) => setOpen({ kind: 'shift', draft: { id: s.id, date: s.date, personId: s.personId, start: s.start, end: s.end } })}
            onFill={(g) => setOpen({ kind: 'shift', draft: { date: d.date, personId: null, start: fromMin(g[0]), end: fromMin(g[1]) } })}
            onDay={() => setOpen({ kind: 'dayoff', day: d })}
          />
        ))}
      </ul>
      <section className="section">
        <h2 className="h2">Hours this week</h2>
        <div className="hours">
          {p.hours.map((h) => (
            <span key={h.personName} className="hour-chip">
              <i className="dot" style={{ background: `var(--${h.color})` }} />
              {h.personName} <b>{fmtHours(h.minutes)}</b>
            </span>
          ))}
        </div>
      </section>
      {sheets}
    </>
  );
}

type RowProps = {
  day: DayData;
  rules: CoverageRules;
  canEdit: boolean;
  onShift: (s: ShiftView) => void;
  onFill: (gap: [number, number]) => void;
  onDay: () => void;
};

function DayRow({ day, rules, canEdit, onShift, onFill, onDay }: RowProps) {
  const name = (
    <>
      {day.dow} <span>{day.monthDay}</span>
    </>
  );
  const dayName = canEdit ? (
    <button type="button" className="day-name" onClick={onDay} aria-label={`Day options for ${day.dow}, ${day.monthDay}`}>
      {name}
    </button>
  ) : (
    <span className="day-name">{name}</span>
  );

  if (!day.need && !day.shifts.length) {
    return (
      <li className="day compact">
        {dayName}
        <span className="muted-sm">
          {day.dayOff ? `${day.dayOff} · day off` : day.weekend ? 'Weekend · nobody needed' : 'Nobody needed'}
        </span>
      </li>
    );
  }

  return (
    <li className={`day${day.isToday ? ' is-today' : ''}`}>
      <div className="day-head">
        {dayName}
        {day.isToday && <span className="tag">Today</span>}
        {day.dayOff && <span className="tag holiday">{day.dayOff}</span>}
      </div>
      {day.need && (
        <div className="bar" aria-hidden="true">
          {day.shifts.map((s) => {
            const span = barSpan(rules, toMin(s.start), toMin(s.end));
            return span && <i key={s.id} style={{ left: `${span.left}%`, width: `${span.width}%`, background: `var(--${s.color})` }} />;
          })}
          {day.gaps.map((g) => {
            const span = barSpan(rules, g[0], g[1]);
            return span && <i key={`gap-${g[0]}`} className="gap" style={{ left: `${span.left}%`, width: `${span.width}%` }} />;
          })}
        </div>
      )}
      {day.shifts.length > 0 && (
        <ul className="shifts">
          {day.shifts.map((s) => {
            const inner = (
              <>
                <i className="dot" style={{ background: `var(--${s.color})` }} />
                <span className="who">{s.personName}</span>
                <span className="when">{fmtRange(s.start, s.end)}</span>
                <span className="hrs">{fmtHours(toMin(s.end) - toMin(s.start))}</span>
              </>
            );
            return (
              <li key={s.id}>
                {canEdit ? (
                  <button type="button" className="shift" onClick={() => onShift(s)}>
                    {inner}
                  </button>
                ) : (
                  <div className="shift">{inner}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {day.gaps.map((g) => (
        <div key={g[0]} className="gap-row">
          <Icon name="alert" />
          <span>Nobody {fmtRange(g[0], g[1])}</span>
          {canEdit && (
            <button type="button" className="btn-mini" onClick={() => onFill(g)}>
              Fill
            </button>
          )}
        </div>
      ))}
    </li>
  );
}
