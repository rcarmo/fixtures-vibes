// src/gi-bootstrap.ts
import("./chunks/app-r6m6t3q2.js").catch(() => {
  const host = document.getElementById("app");
  if (host)
    host.textContent = "Unable to load Gi. Reload the page to retry.";
});
