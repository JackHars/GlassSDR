import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// Apply persisted theme before first paint to avoid flash.
const THEME_KEY = "glasssdr-theme";
try {
  const v = localStorage.getItem(THEME_KEY);
  document.documentElement.setAttribute("data-theme", v === "light" ? "light" : "dark");
} catch {
  document.documentElement.setAttribute("data-theme", "dark");
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
