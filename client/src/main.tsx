import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initializeSentry, Sentry } from "./lib/sentry";

initializeSentry();

createRoot(document.getElementById("root")!, {
  onUncaughtError: Sentry.reactErrorHandler(),
  onRecoverableError: Sentry.reactErrorHandler(),
}).render(<App />);
