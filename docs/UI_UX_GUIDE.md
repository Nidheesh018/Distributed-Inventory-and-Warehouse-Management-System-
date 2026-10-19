# UI / UX guide: what changed and why

## 1. One product, four workspaces (RBAC in the UI)
The server remains the security boundary; the UI mirrors it so each person only sees what is theirs.

| Role | Home | Sees | Cannot see |
|---|---|---|---|
| **Owner** | *Command*: 5 chapters (network, managers, money, attention, audit) | Everything, plus every manager's scorecard | DBMS lab |
| **Warehouse manager** | *My warehouse*: queue, own scorecard, own floor, own movements | Own stock/orders/transfers; can act only on transfers addressed to them | Other warehouses' stock, other managers' scores |
| **Admin** | *Operations*: how an order stays honest, network, exceptions | Network + DBMS lab | Manager scorecards |
| **Customer** | *Shop* + *My orders* | Catalogue, own orders | Any staff data |

## 2. Manager performance (owner only)
Computed in `src/lib/metrics.ts → scoreManagers()` from orders, inventory and transfer timestamps, with no manual ratings.

| Component | Weight | How |
|---|---|---|
| Order fulfilment | 35% | completed ÷ non-cancelled orders routed to the warehouse |
| Stock health | 25% | share of product lines above reorder level |
| Transfer response time | 25% | mean hours to approve / dispatch / receive when it was their turn; ≤4h = full marks, 0 at 48h; −8 points per item overdue >24h |
| Capacity balance | 15% | full marks at 45–85% full |

Missing data (e.g. no transfers yet) is excluded and the remaining weights are rescaled. Grades: ≥85 Excellent · ≥70 Solid · ≥55 Needs focus · else At risk.
The owner sees a leaderboard, radar comparison, a side-by-side table, and a per-manager "what the data says" list. Weights are shown in the UI.

## 3. UX problems fixed
* **Text covered by 3D / cards:** the old scene sized itself to the window but was squashed into a short hero box, and several pages put text over a full-page fixed canvas. Now copy and 3D are separate grid columns and the scene measures its own container.
* **Three stylesheets overriding each other** replaced by one `ds.css`.
* **Giant hero on every page** replaced by a compact page header on data pages.
* **No storytelling** replaced by numbered chapters per role home ("The network, right now" → "Who is running what" → "Money & movement" → "Needs your attention" → "The audit trail").
* **Managers had to hunt for work:** their queue is on their home page with inline Approve / Dispatch / Receive.
* **Live-mode bug:** Transfers/Inventory used the *demo* user's warehouse even when signed in to the real backend. They now use the signed-in user.
* Filters, status chips, cover meters, empty states, loading skeletons, success/error notices, and a purchase receipt that explains the allocation.

## 4. Demo data
`src/services/demoData.ts` is seeded deterministically (relative to "now") so the four managers genuinely differ: Aarav fast and reliable, Isha solid, Kabir slower with stuck orders, Ananya with overdue transfers and low stock. Use *Reset demo data* on the login screen or the demo strip.

## 5. Suggested demo flow
1. Login → **Owner** → scroll the chapters → open *Who is running what* → *Full scorecards* → *Expand all*.
2. Login → **Manager · Delhi** → approve the overdue transfer in *Your queue* → see the nav badge drop.
3. Login → **Customer** → order a product → read the receipt → *My orders*.
4. Login → **Admin** → *DBMS Lab*.
