# DistribuStock design system (v3)

**Principle: wild visuals, predictable structure.** Big editorial type, one 3D hero per role home and scroll "chapters" give the wow. Everything that holds data sits on solid, high-contrast surfaces with the same navigation, spacing and components on every page.

## Files
| File | Purpose |
|---|---|
| `src/styles/ds.css` | The only stylesheet: tokens, role themes, components, responsive rules |
| `src/lib/roles.ts` | Per-role navigation, home page, accent colour |
| `src/lib/metrics.ts` | KPI maths + the manager performance engine |
| `src/components/AppShell.tsx` | Floating top bar (desktop) / tab bar (phone), demo strip, skip link |
| `src/components/Hero.tsx` + `HeroScene.tsx` | Kinetic headline + **contained** 3D stage |
| `src/components/ui.tsx` | Chapter, PageHead, Reveal, CountUp, Ring, Meter, Badge, Chips, Notice… |
| `src/components/ManagerBoard.tsx` | Owner's manager leaderboard, radar, methodology |
| `src/components/NetworkMap.tsx` | Data-driven warehouse map with live transfer routes |

## Role themes (`data-role` on the app root)
| Role | Surface | Accent / hero | 3D scene |
|---|---|---|---|
| Owner | dark | yellow `#ffd23f` | network (core + warehouses) |
| Warehouse manager | dark | lime `#c8ff4d` | one warehouse + orbiting stock |
| Admin | dark | violet `#6a5cff` | database core |
| Customer | **light** | coral `#ff5a36` | floating product crates |

Type: Archivo (variable width, 900) for display, Yellowtail script for one accent word per heading.

## Rules that keep the "crazy" usable
1. 3D lives in its own box (`.hero-stage`) and measures itself; it never sits behind text.
2. Data surfaces are opaque; no glass behind tables, forms or lists.
3. One hero per home page; inner pages use a compact `PageHead`.
4. Motion has a job (reveal, count-up, flow on live transfers) and is disabled by `prefers-reduced-motion`.
5. Smooth scrolling only; no scroll hijacking.
6. Every interactive element is ≥ 40px tall, keyboard reachable and has a visible focus ring.
7. Phones get a bottom tab bar; wide tables scroll inside their own card.
8. The 3D bundle is lazy-loaded; without WebGL the pages are fully usable.
