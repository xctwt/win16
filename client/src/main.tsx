import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// A lazy chunk from an older deploy is gone: reload to pick up the new build.
window.addEventListener("vite:preloadError", () => window.location.reload());

createRoot(document.getElementById("root")!).render(<App />);
