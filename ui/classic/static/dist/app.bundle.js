// src/gi-bootstrap.ts
import("./chunks/app-9jt8exjg.js").catch(() => {
  const host = document.getElementById("app");
  if (host)
    host.textContent = "Unable to load Gi. Reload the page to retry.";
});
