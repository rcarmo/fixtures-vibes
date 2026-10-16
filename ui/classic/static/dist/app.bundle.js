// src/gi-bootstrap.ts
import("./chunks/app-s1a7s8sy.js").catch(() => {
  const host = document.getElementById("app");
  if (host)
    host.textContent = "Unable to load Gi. Reload the page to retry.";
});
