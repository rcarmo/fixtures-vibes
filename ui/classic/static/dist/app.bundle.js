// src/gi-bootstrap.ts
import("./chunks/app-j7fetgt0.js").catch(() => {
  const host = document.getElementById("app");
  if (host)
    host.textContent = "Unable to load Gi. Reload the page to retry.";
});
