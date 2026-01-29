import { mustClass } from "../../../../../frontend/shared/css-modules.js";
import { el } from "../../shared/dom.js";
import styles from "./dashboard.module.css";

import { uiCard, uiEmptyState, uiPill, uiSectionHeader } from "../../../../../frontend/shared/ui/index.js";

export function renderAdminDashboardPage(root: HTMLElement): void {
  const header = uiSectionHeader({
    title: "Dashboard",
    subtitle: "Operational overview (scaffold).",
  });

  const grid = el("div", { class: mustClass(styles, "grid") });

  const overview = uiCard({
    title: "Overview",
    subtitle: "KPIs & status",
    actions: [uiPill({ text: "Scaffold", tone: "neutral" })],
  });
  overview.el.classList.add(mustClass(styles, "span2"));
  overview.body.append(uiEmptyState({ title: "No data yet", body: "KPIs will appear here once modules land.", icon: "📈" }));

  const queue = uiCard({
    title: "Operational queue",
    subtitle: "Requires attention",
    actions: [uiPill({ text: "Today", tone: "accent" })],
  });
  queue.el.classList.add(mustClass(styles, "span2"));
  queue.body.append(uiEmptyState({ title: "Nothing queued", body: "Orders / deliveries needing action will show here.", icon: "🧾" }));

  const quick = uiCard({
    title: "Quick actions",
    subtitle: "Common admin tasks",
  });
  quick.body.append(
    el(
      "div",
      { class: mustClass(styles, "pillRow") },
      uiPill({ text: "Create pack" }),
      uiPill({ text: "Open enquiries" }),
      uiPill({ text: "Check deliveries" })
    )
  );

  const activity = uiCard({
    title: "Recent activity",
    subtitle: "Audit preview",
  });
  activity.el.classList.add(mustClass(styles, "span2"));
  activity.body.append(uiEmptyState({ title: "No events", body: "Audit preview will appear once the audit module lands.", icon: "🧷" }));

  const debug = uiCard({
    title: "Debug",
    subtitle: "Dev-only placeholder",
    tone: "muted",
  });
  debug.body.append(uiEmptyState({ title: "Hidden in prod", body: "Wire behind a dev flag later.", icon: "🧪" }));

  grid.append(overview.el, queue.el, quick.el, activity.el, debug.el);

  const page = el("div", { class: mustClass(styles, "page") }, header, grid);
  root.append(page);
}
