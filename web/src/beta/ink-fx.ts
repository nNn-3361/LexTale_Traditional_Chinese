/**
 * Ink-spread ripple on buttons of the beta page's start, result and analysis
 * pages (inside #app). It is not attached to the test stage (#stage), so it
 * cannot affect trial display or response timing.
 */
export function installInkFx(root: HTMLElement): void {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  root.addEventListener("pointerdown", (ev) => {
    const btn = (ev.target as Element | null)?.closest<HTMLElement>(".btn");
    if (!btn || btn.hasAttribute("disabled") || !root.contains(btn)) return;
    const box = btn.getBoundingClientRect();
    const size = Math.max(box.width, box.height) * 2.2;
    const drop = document.createElement("span");
    drop.className = "ink-drop";
    drop.style.width = drop.style.height = `${size}px`;
    drop.style.left = `${ev.clientX - box.left}px`;
    drop.style.top = `${ev.clientY - box.top}px`;
    btn.appendChild(drop);
    drop.addEventListener("animationend", () => drop.remove(), { once: true });
  });
}
