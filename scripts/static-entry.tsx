// Entry for the static preview build (no server, no live AI). See scripts/build-static.mjs.
import { createRoot } from "react-dom/client";
import Demo from "../src/components/Demo";

createRoot(document.getElementById("root")!).render(<Demo live={false} />);
