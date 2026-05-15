import { useState } from 'react';
import { BookHeart, Pencil, Check, X } from 'lucide-react';
import { PALETTE } from './styles';

interface Props {
  /** Current memory text. Undefined / empty = no memory yet. */
  memory?: string;
  /** Called with the new text on save. Empty string clears the memory. */
  onSave: (text: string) => void;
  /** Surface tint. Light surfaces (modals on white) use 'light';
   *  dark surfaces (capture flow) use 'dark'. */
  surface?: 'light' | 'dark';
  /** Optional title above the panel. Defaults to "Memory". */
  title?: string;
}

/**
 * Reusable read-or-edit memory panel. Shown inside card inspect modals
 * across the app. Read state: the player-written text with a small
 * "Edit" pencil. Edit state: textarea + Save/Cancel. Empty memory
 * collapses to a single "+ Add memory" button.
 */
export function MemoryPanel({ memory, onSave, surface = 'light', title = 'Memory' }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(memory ?? '');

  const dark = surface === 'dark';
  const panelBg = dark ? 'rgba(255,255,255,.08)' : 'rgba(58,46,42,.04)';
  const border  = dark ? '1px solid rgba(255,255,255,.18)' : `1px solid ${PALETTE.border}`;
  const bodyColor = dark ? '#fff' : PALETTE.text;
  const labelColor = dark ? 'rgba(255,255,255,.65)' : PALETTE.textMid;
  const placeholderColor = dark ? 'rgba(255,255,255,.45)' : PALETTE.textLight;

  const hasMemory = !!memory && memory.trim().length > 0;

  if (!editing) {
    // Empty: show a soft "+ Add memory" CTA so the player knows the
    // capability exists for cards captured before the feature shipped.
    if (!hasMemory) {
      return (
        <button
          onClick={() => { setDraft(''); setEditing(true); }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 12px',
            background: panelBg,
            border,
            borderRadius: 12,
            color: labelColor,
            fontSize: 12, fontWeight: 700,
            fontFamily: 'inherit',
            cursor: 'pointer',
            letterSpacing: '0.02em',
          }}
        >
          <BookHeart size={13} strokeWidth={2.4} />
          + Add memory
        </button>
      );
    }
    return (
      <div style={{
        background: panelBg,
        border,
        borderRadius: 12,
        padding: '10px 12px',
        maxWidth: 320,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontSize: 9.5, letterSpacing: '0.18em', textTransform: 'uppercase',
          color: labelColor, fontWeight: 700,
          marginBottom: 6,
        }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <BookHeart size={11} strokeWidth={2.4} />
            {title}
          </span>
          <button
            type="button"
            aria-label="Edit memory"
            onClick={() => { setDraft(memory ?? ''); setEditing(true); }}
            style={{
              background: 'transparent', border: 'none', padding: 4,
              cursor: 'pointer', color: labelColor,
              display: 'inline-grid', placeItems: 'center',
            }}
          >
            <Pencil size={12} strokeWidth={2.4} />
          </button>
        </div>
        <div style={{
          fontSize: 12.5, color: bodyColor,
          lineHeight: 1.45, whiteSpace: 'pre-wrap',
          fontFamily: '"Inter", system-ui, sans-serif',
        }}>{memory}</div>
      </div>
    );
  }

  // Edit mode
  return (
    <div style={{
      background: panelBg,
      border,
      borderRadius: 12,
      padding: '10px 12px',
      maxWidth: 320,
      width: '100%',
    }}>
      <div style={{
        fontSize: 9.5, letterSpacing: '0.18em', textTransform: 'uppercase',
        color: labelColor, fontWeight: 700,
        marginBottom: 6,
        display: 'inline-flex', alignItems: 'center', gap: 6,
      }}>
        <BookHeart size={11} strokeWidth={2.4} />
        {title}
      </div>
      <textarea
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value.slice(0, 280))}
        placeholder="Write whatever you want to remember about this card."
        rows={3}
        style={{
          width: '100%',
          background: dark ? 'rgba(0,0,0,.20)' : '#fff',
          border: dark ? '1px solid rgba(255,255,255,.18)' : `1px solid ${PALETTE.border}`,
          borderRadius: 10,
          padding: '8px 10px',
          color: bodyColor,
          fontFamily: '"Inter", system-ui, sans-serif',
          fontSize: 13, lineHeight: 1.4,
          resize: 'none',
          outline: 'none',
        }}
      />
      <div style={{
        marginTop: 6,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 8,
      }}>
        <span style={{ fontSize: 9.5, color: placeholderColor, fontStyle: 'italic' }}>
          {draft.length}/280
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => { setDraft(memory ?? ''); setEditing(false); }}
            style={{
              padding: '6px 12px',
              background: 'transparent',
              border,
              borderRadius: 10,
              color: bodyColor,
              fontSize: 12, fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}
          >
            <X size={12} strokeWidth={2.4} />
            Cancel
          </button>
          <button
            onClick={() => { onSave(draft.trim()); setEditing(false); }}
            style={{
              padding: '6px 12px',
              background: PALETTE.accent,
              border: 'none',
              borderRadius: 10,
              color: '#fff',
              fontSize: 12, fontWeight: 800,
              cursor: 'pointer',
              fontFamily: 'inherit',
              display: 'inline-flex', alignItems: 'center', gap: 4,
              boxShadow: `0 2px 6px ${PALETTE.accent}66`,
            }}
          >
            <Check size={12} strokeWidth={2.6} />
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
