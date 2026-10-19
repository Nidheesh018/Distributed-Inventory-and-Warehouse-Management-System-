import { lazy, ReactNode, Suspense, useEffect, useRef } from "react";
import gsap from "gsap";
import { Marquee, prefersReducedMotion } from "./ui";
import type { SceneVariant } from "./HeroScene";

// Three.js is large: load it after first paint so the headline appears instantly.
const HeroScene = lazy(() => import("./HeroScene"));

export type HeroChip = { label: string; value: string };

/**
 * Role home hero. Copy and 3D stage live in separate grid columns, so the
 * scene can never cover text (the old layout's main UX bug). On mobile the
 * stage stacks under the copy at a fixed height.
 */
export default function Hero({ kicker, title, script, lead, actions, variant, accent, belt, chips }: { kicker: string; title: string; script: string; lead: string; actions?: ReactNode; variant: SceneVariant; accent: number; belt: string[]; chips?: HeroChip[] }) {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.from(".hero .l1 i", { yPercent: 110, duration: 0.95, stagger: 0.035, ease: "expo.out" });
      gsap.from(".hero .l2", { opacity: 0, x: -30, rotate: -10, duration: 1.1, ease: "expo.out", delay: 0.35 });
      gsap.from(".hero .kicker, .hero .lead, .hero-actions > *", { opacity: 0, y: 18, duration: 0.7, stagger: 0.08, delay: 0.5, ease: "power3.out" });
      gsap.from(".hero .sticker", { opacity: 0, scale: 0.8, y: 12, duration: 0.7, stagger: 0.12, delay: 0.9, ease: "back.out(1.6)" });
    }, root);
    return () => ctx.revert();
  }, [title, script]);

  return (
    <section className="hero" ref={root}>
      <div className="wrap hero-grid">
        <div className="hero-copy">
          <p className="kicker">{kicker}</p>
          <h1 aria-label={`${title} ${script}`}>
            <span className="l1" aria-hidden="true">
              {title.split(" ").map((word, wi) => (
                <span className="word" key={wi}>{word.split("").map((c, i) => <i key={i}>{c}</i>)}</span>
              ))}
            </span>
            <span className="l2" aria-hidden="true">{script}</span>
          </h1>
          <p className="lead">{lead}</p>
          {actions && <div className="hero-actions">{actions}</div>}
        </div>
        <div className="hero-stage">
          <Suspense fallback={null}><HeroScene variant={variant} accent={accent} /></Suspense>
          {chips?.map((c, i) => <span key={c.label} className={`sticker s${i + 1}`}><small>{c.label}</small><b>{c.value}</b></span>)}
        </div>
      </div>
      <Marquee items={belt} />
    </section>
  );
}
