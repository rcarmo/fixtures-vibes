// src/gi-bootstrap.ts
import("./chunks/app-q94vdbz2.js").catch(() => {
  const host = document.getElementById("app");
  if (host)
    host.textContent = "Unable to load Gi. Reload the page to retry.";
});
