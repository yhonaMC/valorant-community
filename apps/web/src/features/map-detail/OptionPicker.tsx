import { useRef, useState, type KeyboardEvent } from 'react';
import { CheckIcon } from '../../Icons';
import styles from './OptionPicker.module.css';
import type { Option } from './useVote';

type Props = {
  labelledBy: string;
  layout: 'faces' | 'rows';
  options: Option[];
  confirmed: string | null;
  pending: string | null;
  busy: boolean;
  onSelect: (optionId: string) => void;
};

const STEP: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

// radiogroup con tabindex itinerante. Las flechas solo mueven el foco (cada elección
// envía un voto, así que recorrer no debe votar); Espacio/Enter eligen (§5.5).
export function OptionPicker({ labelledBy, layout, options, confirmed, pending, busy, onSelect }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<string | null>(null);
  const checked = pending ?? confirmed;
  const known = (id: string | null) => id !== null && options.some((o) => o.id === id);
  const tabStop = [active, checked].find(known) ?? options[0]?.id;

  function onKeyDown(e: KeyboardEvent) {
    const radios = [...ref.current!.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
    const i = radios.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    let next: number;
    if (e.key in STEP) next = (i + STEP[e.key] + radios.length) % radios.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = radios.length - 1;
    else return;
    e.preventDefault();
    radios[next].focus();
  }

  const radio = (o: Option) => {
    const state = o.id === pending ? 'pending' : o.id === confirmed ? 'confirmed' : undefined;
    return (
      <button
        key={o.id}
        type="button"
        role="radio"
        aria-checked={o.id === checked}
        tabIndex={o.id === tabStop ? 0 : -1}
        data-state={state}
        className={styles.option}
        onFocus={() => setActive(o.id)}
        onClick={() => !busy && onSelect(o.id)}
      >
        <img
          className={styles.image}
          src={o.icon}
          alt=""
          width={layout === 'faces' ? 72 : 120}
          height={layout === 'faces' ? 72 : 32}
          loading="lazy"
          decoding="async"
        />
        <span className={styles.name}>{o.name}</span>
        {state === 'confirmed' && <CheckIcon className={styles.check} size={14} />}
        {state === 'pending' && <span className="visually-hidden">, guardando</span>}
      </button>
    );
  };

  // Armas: filas agrupadas por categoría de tienda, en el orden que trae el catálogo.
  const groups: { name: string; options: Option[] }[] = [];
  if (layout === 'rows') {
    for (const o of options) {
      const last = groups.at(-1);
      if (last?.name === o.detail) last.options.push(o);
      else groups.push({ name: o.detail, options: [o] });
    }
  }

  return (
    <div
      ref={ref}
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-busy={busy}
      className={layout === 'faces' ? styles.faces : styles.rows}
      onKeyDown={onKeyDown}
    >
      {layout === 'faces'
        ? options.map(radio)
        : groups.map((g, i) => (
            <div key={g.name} role="group" aria-labelledby={`${labelledBy}-g${i}`} className={styles.group}>
              <p className={styles.groupName} id={`${labelledBy}-g${i}`}>
                {g.name}
              </p>
              {g.options.map(radio)}
            </div>
          ))}
    </div>
  );
}
