import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { QuickStartWindow } from "./components/Timer/QuickStartWindow";

const isQuickStart = new URLSearchParams(window.location.search).get("view") === "quick-start";

createRoot(document.getElementById("root")!).render(
  <StrictMode>{isQuickStart ? <QuickStartWindow /> : <App />}</StrictMode>,
);
