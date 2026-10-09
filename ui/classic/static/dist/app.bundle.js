// src/gi-bootstrap.ts
import("./chunks/app-p4c8p8fv.js").catch(() => {
  const host = document.getElementById("app");
  if (host)
    host.textContent = "Unable to load Gi. Reload the page to retry.";
});
