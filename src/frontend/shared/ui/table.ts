import { mustClass } from "../css-modules.js";
import { h } from "./dom.js";
import styles from "./table.module.css";

export type UiTable = Readonly<{
  el: HTMLElement;
  tbody: HTMLTableSectionElement;
}>;

export function uiTable(opts: Readonly<{ headers: readonly string[] }>): UiTable {
  const thead = h(
    "thead",
    null,
    h(
      "tr",
      null,
      ...opts.headers.map((label) => h("th", { class: mustClass(styles, "th"), scope: "col" }, label))
    )
  );

  const tbody = document.createElement("tbody");
  tbody.className = mustClass(styles, "tbody");

  const table = h("table", { class: mustClass(styles, "table") }, thead, tbody);

  return { el: table, tbody };
}

export function uiTableRow(cells: readonly (string | Node)[]): HTMLTableRowElement {
  const tr = document.createElement("tr");
  tr.className = mustClass(styles, "tr");

  for (const c of cells) {
    const td = document.createElement("td");
    td.className = mustClass(styles, "td");
    td.append(typeof c === "string" ? document.createTextNode(c) : c);
    tr.append(td);
  }

  return tr;
}
