import Demo from "@/components/Demo";

// Fully static: prerendered at build time and served from the edge cache.
export const dynamic = "force-static";

export default function Page() {
  return (
    <main className="wrap">
      <header>
        <span className="tag">Sandbox · 30 fictional Hyderabad restaurants</span>
        <h1>Foolproof</h1>
        <p className="muted">
          An AI &ldquo;where should I eat?&rdquo; assistant that fake reviews can&rsquo;t fool. Inject fake reviews below and watch which AI changes its answer.
        </p>
      </header>
      <Demo />
      <footer>
        All restaurants and reviews are fictional and generated. Flags show suspicious signals, not proof of fraud.
      </footer>
    </main>
  );
}
