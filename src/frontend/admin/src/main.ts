// src/frontend/admin/src/main.ts
// Admin surface entrypoint

const appAdmin = document.querySelector<HTMLDivElement>("#app");
if (!appAdmin) {
  throw new Error("Missing #app element.");
}

appAdmin.innerHTML = `
  <main style="font-family: system-ui; padding: 24px;">
    <h1>Admin Dashboard</h1>
    <p>Admin surface is wired.</p>
  </main>
`;
