import SearchApp from "@/components/search/SearchApp";

// Fully static: prerendered at build time and served from the edge cache.
export const dynamic = "force-static";

export default function Page() {
  return <SearchApp />;
}
