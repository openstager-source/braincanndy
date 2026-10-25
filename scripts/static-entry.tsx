// Entry for the static preview build (no server, so no live AI or web results). See scripts/build-static.mjs.
import { createRoot } from "react-dom/client";
import "../src/app/globals.css";
import SearchApp from "../src/components/search/SearchApp";
import b from "../public/brand/braincanndy-b-ink.svg";
import logo from "../public/brand/braincanndy-logo-on-dark.svg";

createRoot(document.getElementById("root")!).render(<SearchApp live={false} brand={{ b, logo }} />);
