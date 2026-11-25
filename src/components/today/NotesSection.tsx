'use client';

import { useId, useState } from 'react';
import { Icon } from '@/components/Icon';
import type { NoteEntry } from '@/lib/log-types';
import { fmtTime } from '@/lib/time';
import { NoteSheet } from './NoteSheet';
import { KIND_COLORS } from './tiles';

type Props = { date: string; notes: NoteEntry[]; colors: Record<string, string>; defaultTime: string };

export function NotesSection({ date, notes, colors, defaultTime }: Props) {
  const headingId = useId();
  const [editing, setEditing] = useState<NoteEntry | 'new' | null>(null);
  return (
    <section className="section">
      <div className="section-head">
        <h2 className="h2" id={headingId}>
          Anything else
        </h2>
        <span className="muted-sm">{notes.length ? `${notes.length} ${notes.length === 1 ? 'note' : 'notes'}` : ''}</span>
      </div>
      {notes.length ? (
        <ul className="list" aria-labelledby={headingId}>
          {notes.map((n) => {
            const c = KIND_COLORS[n.kind] ?? 'sage';
            return (
              <li key={n.id}>
                <button type="button" className="note" onClick={() => setEditing(n)}>
                  <span className="n-time">{fmtTime(n.time)}</span>
                  <span className="n-body">
                    <span className="kind" style={{ ['--ks' as string]: `var(--${c}-soft)`, ['--ki' as string]: `var(--${c}-ink)` }}>
                      {n.kind}
                    </span>
                    <p>{n.text}</p>
                    <span className="t-by">
                      <i className="dot" style={{ background: `var(--${colors[n.byName] ?? 'sage'})` }} />
                      {n.byName}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="list">
          <p className="empty-line">Health, milestones, diapers, medicine: anything the others should know.</p>
        </div>
      )}
      <button type="button" className="btn-dashed wide" onClick={() => setEditing('new')}>
        <Icon name="plus" /> Add something else
      </button>
      {editing && (
        <NoteSheet
          key={editing === 'new' ? 'new' : editing.id}
          date={date}
          note={editing === 'new' ? null : editing}
          defaultTime={defaultTime}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}
