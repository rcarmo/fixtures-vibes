// src/gi-bootstrap.ts
import("./chunks/app-b707kypq.js").catch(() => {
  const host = document.getElementById("app");
  if (host)
    host.textContent = "Unable to load Gi. Reload the page to retry.";
});
