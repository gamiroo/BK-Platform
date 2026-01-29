import { mustClass } from "../../../../../frontend/shared/css-modules.js";
import { el } from "../../shared/dom.js";
import { renderClientShell } from "../layout/shell.js";
import styles from "./dashboard.module.css";

import { uiCard, uiEmptyState, uiPill, uiSectionHeader } from "../../../../../frontend/shared/ui/index.js";

export function renderClientDashboardPage(
  root: HTMLElement,
  opts: Readonly<{ onLogout: () => void }>
): void {
  root.replaceChildren();

  const header = uiSectionHeader({
    title: "Dashboard",
    subtitle: "Your week at a glance (scaffold).",
  });

  const grid = el("div", { class: mustClass(styles, "grid") });

  const balance = uiCard({
    title: "Packs & credits",
    subtitle: "Balance / usage (soon)",
    actions: [uiPill({ text: "Scaffold", tone: "neutral" })],
  });
  balance.el.classList.add(mustClass(styles, "span2"));
  balance.body.append(uiEmptyState({ title: "No data yet", body: "Credit balance and pack info will show here.", icon: "🥗" }));

  const nextDelivery = uiCard({
    title: "Next delivery",
    subtitle: "Time & status (soon)",
  });
  nextDelivery.body.append(uiEmptyState({ title: "Not scheduled", body: "Your upcoming delivery details will appear here.", icon: "🚚" }));

  const menu = uiCard({
    title: "This week’s menu",
    subtitle: "Preset-driven ordering loop (soon)",
    actions: [uiPill({ text: "Weekly", tone: "accent" })],
  });
  menu.el.classList.add(mustClass(styles, "span2"));
  menu.body.append(uiEmptyState({ title: "Coming soon", body: "Weekly menu + presets will live here.", icon: "📋" }));

  const orders = uiCard({
    title: "Recent orders",
    subtitle: "History (soon)",
  });
  orders.el.classList.add(mustClass(styles, "span2"));
  orders.body.append(uiEmptyState({ title: "No orders yet", body: "Your recent orders will appear here.", icon: "🧾" }));

  const plan = uiCard({
    title: "Your plan",
    subtitle: "Diet / macro plan (soon)",
  });
  plan.body.append(uiEmptyState({ title: "Not set", body: "Your plan & preferences will appear here.", icon: "🎯" }));

  const support = uiCard({
    title: "Support",
    subtitle: "Chat / contact (soon)",
  });
  support.body.append(uiEmptyState({ title: "Need help?", body: "Support entry points will appear here.", icon: "💬" }));

  const debug = uiCard({
    title: "Debug",
    subtitle: "Dev-only placeholder",
    tone: "muted",
  });
  debug.body.append(uiEmptyState({ title: "Hidden in prod", body: "Wire behind a dev flag later.", icon: "🧪" }));

  grid.append(balance.el, nextDelivery.el, menu.el, orders.el, plan.el, support.el, debug.el);

  const page = el("div", { class: mustClass(styles, "page") }, header, grid);
  root.append(renderClientShell(page, { onLogout: opts.onLogout }));
}
