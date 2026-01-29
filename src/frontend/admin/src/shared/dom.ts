export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> | null,
  ...children: Array<Node | string | null | undefined>
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);

  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      node.setAttribute(k, v);
    }
  }

  for (const c of children) {
    if (c === null || c === undefined) continue;
    node.append(typeof c === "string" ? document.createTextNode(c) : c);
  }

  return node;
}

export function clear(node: HTMLElement): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}
