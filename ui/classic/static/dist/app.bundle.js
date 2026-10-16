// src/gi-bootstrap.ts
import("./chunks/app-g4nk429d.js").catch(() => {
  const host = document.getElementById("app");
  if (host)
    host.textContent = "Unable to load Gi. Reload the page to retry.";
});
