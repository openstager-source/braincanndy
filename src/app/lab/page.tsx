import type { Metadata } from "next";
import Link from "next/link";
import Demo from "@/components/Demo";
import { BrandMark } from "@/components/icons";
import MotionToggle from "@/components/MotionToggle";

export const metadata: Metadata = {
  title: "Foolproof Lab",
  description: "Play the attacker: buy fake reviews, clear the missions, and try to fool the detector. Plus a spot-the-fake quiz.",
};

export const dynamic = "force-static";

export default function LabPage() {
  return (
    <main className="wrap">
      <header className="hero">
        <div className="brand" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            <BrandMark />
            <span className="eyebrow">Foolproof Lab · 38 fictional Hyderabad places</span>
          </span>
          <Link className="navlink" href="/">← Back to search</Link>
        </div>
        <h1>Try to fool it</h1>
        <p className="lede">
          <b>Play the attacker:</b> buy fake reviews, clear the missions, and try to change what the AI recommends. Then see if you can spot fakes yourself.
        </p>
      </header>
      <Demo />
      <footer>
        <span>All places and reviews are fictional and generated. Flags show suspicious signals, not proof of fraud.</span>
        <MotionToggle />
      </footer>
    </main>
  );
}
