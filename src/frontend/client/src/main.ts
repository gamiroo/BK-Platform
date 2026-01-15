const appClient = document.querySelector<HTMLDivElement>("#app");
if (!appClient) throw new Error("Missing #app element.");

appClient.innerHTML = `
  <main style="font-family: system-ui; padding: 24px;">
    <h1>Client Dashboard</h1>
    <p>Client surface is wired.</p>
  </main>
`;
