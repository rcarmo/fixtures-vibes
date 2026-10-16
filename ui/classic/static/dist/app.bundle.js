// src/gi-bootstrap.ts
import("./chunks/app-7qh53wsk.js").catch(() => {
  const host = document.getElementById("app");
  if (host)
    host.textContent = "Unable to load Gi. Reload the page to retry.";
});
