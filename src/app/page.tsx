import Demo from "@/components/Demo";
import { BrandMark } from "@/components/icons";

// Fully static: prerendered at build time and served from the edge cache.
export const dynamic = "force-static";

export default function Page() {
  return (
    <main className="wrap">
      <header className="hero">
        <div className="brand">
          <BrandMark />
          <span className="eyebrow">Sandbox · 30 fictional Hyderabad restaurants</span>
        </div>
        <h1>Foolproof</h1>
        <p className="lede">
          An AI &ldquo;where should I eat?&rdquo; assistant that fake reviews can&rsquo;t fool. <b>Play the attacker:</b> buy fake reviews, clear the missions, and try to change its answer.
        </p>
      </header>
      <Demo />
      <footer>
        <span>All restaurants and reviews are fictional and generated. Flags show suspicious signals, not proof of fraud.</span>
      </footer>
    </main>
  );
}
