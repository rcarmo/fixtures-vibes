// src/gi-bootstrap.ts
import("./chunks/app-bwkyw6wq.js").catch(() => {
  const host = document.getElementById("app");
  if (host)
    host.textContent = "Unable to load Gi. Reload the page to retry.";
});
