import { useEffect, useRef, useState } from 'react';

/**
 * Precision reticle cursor for fine-pointer devices. Two layers:
 * a center dot that tracks the pointer 1:1 and a thin outer ring that
 * eases in behind it (rAF lerp — no React state per movement).
 *
 * Activates only on (hover: hover) and (pointer: fine) devices without
 * prefers-reduced-motion. Text fields and editable regions keep the
 * native text cursor; the reticle parks itself while typing/ selecting.
 */

const INTERACTIVE = 'a, button, [role="button"], label, input[type="radio"], input[type="checkbox"], select, summary';
const TEXTUAL = 'input[type="text"], input[type="search"], input[type="email"], input[type="url"], input:not([type]), textarea, [contenteditable="true"]';

export default function Cursor() {
  const [motionAllowed, setMotionAllowed] = useState(true);
  useEffect(() => {
    const pointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setMotionAllowed(pointer.matches && !reduced.matches);
    sync(); pointer.addEventListener('change', sync); reduced.addEventListener('change', sync);
    return () => { pointer.removeEventListener('change', sync); reduced.removeEventListener('change', sync); };
  }, []);
  const dotRef = useRef(null);
  const ringRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !motionAllowed) return undefined;
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!fine.matches || reduced.matches) return undefined;

    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return undefined;

    document.documentElement.classList.add('has-reticle');

    let raf = 0;
    let visible = false;
    let px = -100; let py = -100; // pointer position
    let rx = -100; let ry = -100; // eased ring position
    let mode = 'default'; // default | link | text | press

    function render() {
      rx += (px - rx) * 0.28;
      ry += (py - ry) * 0.28;
      dot.style.transform = `translate3d(${px}px, ${py}px, 0)`;
      ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
      raf = requestAnimationFrame(render);
    }

    function onMove(e) {
      px = e.clientX; py = e.clientY;
      if (!visible) {
        visible = true;
        rx = px; ry = py;
        document.documentElement.classList.add('reticle-live');
        raf = requestAnimationFrame(render);
      }
    }

    function onOver(e) {
      const t = e.target;
      if (!(t instanceof Element)) return;
      if (t.closest(TEXTUAL)) mode = 'text';
      else if (t.closest('[data-cursor="inspect"]')) mode = 'inspect';
      else if (t.closest('[data-cursor="open"]')) mode = 'open';
      else if (t.closest('[data-cursor="cta"]') || t.closest(INTERACTIVE)) mode = 'link';
      else mode = 'default';
      ring.dataset.mode = mode;
      dot.dataset.mode = mode;
    }

    function onDown() { ring.classList.add('press'); }
    function onUp() { ring.classList.remove('press'); }
    function onLeave() {
      document.documentElement.classList.remove('reticle-live');
      visible = false;
      cancelAnimationFrame(raf);
    }

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerover', onOver, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);

    return function cleanup() {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerover', onOver);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      cancelAnimationFrame(raf);
      document.documentElement.classList.remove('has-reticle', 'reticle-live');
    };
  }, [motionAllowed]);

  return (
    <>
      <div ref={ringRef} className="reticle-ring" aria-hidden="true">
        <i className="reticle-c1" /><i className="reticle-c2" />
        <i className="reticle-c3" /><i className="reticle-c4" />
      </div>
      <div ref={dotRef} className="reticle-dot" aria-hidden="true" />
    </>
  );
}
