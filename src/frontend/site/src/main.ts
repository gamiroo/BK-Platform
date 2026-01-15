// src/frontend/site/src/main.ts
// Minimal entry for Day 0 so the surface boots and CI can build.

const appSite = document.querySelector<HTMLDivElement>("#app");
if (!appSite) {
  throw new Error("Missing #app element.");
}

appSite.innerHTML = `
  <main style="font-family: system-ui; padding: 24px;">
    <h1>Balance Kitchen</h1>
    <p>Site surface is wired.</p>
  </main>
`;
