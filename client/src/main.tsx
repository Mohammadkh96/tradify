import { createRoot } from "react-dom/client";
import AppRouter from "./router";
import "./index.css";
import "./lib/i18n";

createRoot(document.getElementById("root")!).render(<AppRouter />);
