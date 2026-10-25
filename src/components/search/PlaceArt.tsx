// Procedural illustrations for places: one drawing per kind of dish, varied per place by a seed, so
// every result gets a picture without loading a single image. Decorative; names are in the text.
import { useId, type ReactNode } from "react";
import { hashString, mulberry32, pick } from "@/lib/rng";
import type { Restaurant } from "@/lib/types";

type Kind = "coffee" | "filter" | "chai" | "pot" | "dosa" | "skewer" | "croissant" | "cake" | "waffle" | "cookie" | "bun" | "pizza" | "bowl" | "juice" | "sandwich" | "thali";

const KINDS: [RegExp, Kind][] = [
  [/filter coffee/, "filter"],
  [/coffee/, "coffee"],
  [/chai/, "chai"],
  [/biryani|haleem|mandi/, "pot"],
  [/dosa|idli|vada|pesarattu/, "dosa"],
  [/kebab|shawarma/, "skewer"],
  [/croissant/, "croissant"],
  [/cake|sweets/, "cake"],
  [/waffle/, "waffle"],
  [/biscuit/, "cookie"],
  [/bun/, "bun"],
  [/pizza|pasta/, "pizza"],
  [/noodles|fried rice|momos/, "bowl"],
  [/juice/, "juice"],
  [/sandwich/, "sandwich"],
  [/meals|thali|curry/, "thali"],
];
const kindOf = (dish: string) => KINDS.find(([re]) => re.test(dish))?.[1];
/** Small things that can sit beside a drink. */
const SIDES = new Set<Kind>(["croissant", "cake", "waffle", "cookie", "bun", "sandwich"]);
const DRINKS = new Set<Kind>(["coffee", "filter", "chai", "juice"]);

const C = {
  plate: "#E3F0F0", plateIn: "#CFE2E2", coffee: "#4E3122", crema: "#C8925F", tea: "#C98F5A", teaTop: "#DDAA78",
  golden: "#E8B85C", goldenDark: "#B9813A", teal: "#00BCC8", tealDark: "#00A3AE", tealDeep: "#00737A",
  lime: "#D0FF00", limeSoft: "#E9FF8A", coral: "#FF7A64", steel: "#C7D5D8", steelDark: "#93A9AE", bread: "#F1D9A6",
};

interface Look {
  cup: string;
  rim: string;
  accent: string;
  juice: string;
  frosting: string;
  mound: "rice" | "haleem";
}

/** Rising steam, three wisps; animated by CSS. */
const Steam = ({ xs, top }: { xs: number[]; top: number }) => (
  <g className="steam">{xs.map((x) => <path key={x} d={`M${x} ${top}c-4-5 4-9 0-14s4-9 0-14`} />)}</g>
);

// Each drawing sits on a baseline at y=0, centred on x=0.
const DRAW: Record<Kind, (l: Look) => ReactNode> = {
  coffee: (l) => (
    <>
      <ellipse cx="0" cy="-1" rx="31" ry="6.5" fill={C.plate} />
      <ellipse cx="0" cy="-2.6" rx="19" ry="3" fill={C.plateIn} />
      <path d="M23 -32h3.5a8.5 8.5 0 0 1 0 17H20" fill="none" stroke={l.cup} strokeWidth="5" strokeLinecap="round" />
      <path d="M-24 -38h48v10c0 14.4-10.7 24-24 24s-24-9.6-24-24z" fill={l.cup} />
      <ellipse cx="0" cy="-38" rx="24" ry="5" fill={l.rim} />
      <ellipse cx="0" cy="-37.6" rx="20.5" ry="3.6" fill={C.coffee} />
      <ellipse cx="-3" cy="-38" rx="8" ry="1.4" fill={C.crema} opacity=".75" />
      <circle cx="0" cy="-21" r="4.5" fill={l.accent} />
      <Steam xs={[-8, 0, 8]} top={-46} />
    </>
  ),
  filter: () => (
    <>
      <path d="M-30 -14h60l-4 11a5 5 0 0 1-4.7 3h-42.6a5 5 0 0 1-4.7-3z" fill={C.steel} />
      <ellipse cx="0" cy="-14" rx="30" ry="4" fill="#DDE7E9" />
      <ellipse cx="0" cy="-14" rx="25" ry="3" fill={C.crema} />
      <path d="M-13 -52h26l-2.5 36h-21z" fill={C.steel} />
      <path d="M-13.2 -40h26.4" stroke={C.steelDark} strokeWidth="1.2" />
      <path d="M-8 -47v28" stroke="#FFFFFF" strokeOpacity=".55" strokeWidth="2.5" strokeLinecap="round" />
      <ellipse cx="0" cy="-52" rx="13" ry="3" fill="#E4ECEE" />
      <ellipse cx="0" cy="-52" rx="10.5" ry="2.2" fill={C.crema} />
      <Steam xs={[-5, 1, 7]} top={-58} />
    </>
  ),
  chai: () => (
    <>
      <ellipse cx="0" cy="-1" rx="22" ry="4.5" fill={C.plate} opacity=".9" />
      <path d="M-15 -48h30l-3.4 44.4a4 4 0 0 1-4 3.6h-15.2a4 4 0 0 1-4-3.6z" fill="#FFFFFF" fillOpacity=".18" />
      <path d="M-13.7 -36h27.4l-2.4 32a3 3 0 0 1-3 2.6h-16.6a3 3 0 0 1-3-2.6z" fill={C.tea} />
      <ellipse cx="0" cy="-36" rx="13.7" ry="2.2" fill={C.teaTop} />
      {[-10, -5, 0, 5, 10].map((x) => <path key={x} d={`M${x} -46.5L${x * 0.78} -2`} stroke="#FFFFFF" strokeOpacity=".28" strokeWidth="1.3" />)}
      <path d="M-15 -48h30" stroke="#FFFFFF" strokeOpacity=".8" strokeWidth="2" strokeLinecap="round" />
      <Steam xs={[-6, 0, 6]} top={-54} />
    </>
  ),
  pot: (l) => (
    <>
      <path d="M-38 -32h-5a4 4 0 0 0 0 8h5M38 -32h5a4 4 0 0 1 0 8h-5" fill="none" stroke={C.tealDark} strokeWidth="3" />
      <path d="M-34 -30c0 17 15 30 34 30s34-13 34-30z" fill={C.tealDeep} />
      <path d="M-27 -22c2 9 9 15 17 18" fill="none" stroke={C.teal} strokeWidth="3" strokeLinecap="round" opacity=".7" />
      <path d="M-30 -35c3-12 15-19 30-19s27 7 30 19z" fill={l.mound === "rice" ? "#F4E3B5" : "#8A5A3B"} />
      {l.mound === "rice" ? (
        <path d="M-16 -44c5 3 10 3 15 0M-2 -49c4 2 9 2 13 0M8 -40c4 2 8 2 12 0" fill="none" stroke="#F2A93B" strokeWidth="3" strokeLinecap="round" />
      ) : (
        [[-12, -42], [-3, -47], [6, -43], [14, -39], [-20, -38]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="1.8" fill={C.golden} />)
      )}
      <path d="M6 -51c4-4 9-4 12-1-4 3-8 4-12 1z" fill={C.lime} />
      <rect x="-38" y="-36" width="76" height="9" rx="4.5" fill={C.tealDark} />
      <Steam xs={[-10, 0, 10]} top={-58} />
    </>
  ),
  dosa: () => (
    <>
      <path d="M-50 -2c20-18 66-28 100-22-16 18-64 30-100 22z" fill="#1F8A5B" />
      <path d="M-46 -3c30-8 62-16 94-21" fill="none" stroke="#5CC48D" strokeWidth="1.5" />
      <circle cx="-26" cy="-30" r="9" fill={C.plate} />
      <circle cx="-26" cy="-30" r="6.5" fill="#F4F1E1" />
      <circle cx="-5" cy="-40" r="8" fill={C.plate} />
      <circle cx="-5" cy="-40" r="5.8" fill="#E2703F" />
      <path d="M-38 -12 32 -34a7 7 0 0 1 4 13.4L-32 1a6.5 6.5 0 0 1-6-13z" fill={C.golden} />
      <path d="M-26 -12l50-15M-20 -6l46-14" stroke={C.goldenDark} strokeOpacity=".5" strokeWidth="1.6" strokeLinecap="round" />
      <ellipse cx="34" cy="-27.3" rx="3.6" ry="6.8" transform="rotate(-17 34 -27.3)" fill="#C8923F" />
      <Steam xs={[-9, -3]} top={-50} />
    </>
  ),
  skewer: () => {
    const sticks: [number, number, number, number][] = [[-42, -12, 42, -40], [-38, -2, 46, -26]];
    const pieces = ["#9C5A33", C.lime, "#9C5A33", "#F3FCFC", C.coral];
    return (
      <>
        <ellipse cx="0" cy="-6" rx="44" ry="10" fill={C.plate} />
        <ellipse cx="0" cy="-7" rx="36" ry="7" fill={C.plateIn} />
        {sticks.map(([x1, y1, x2, y2]) => {
          const deg = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
          return (
            <g key={x1}>
              <path d={`M${x1 - 4} ${y1 + 1.4}L${x2 + 4} ${y2 - 1.4}`} stroke="#D9C7A0" strokeWidth="2.5" strokeLinecap="round" />
              {pieces.map((fill, i) => {
                const t = 0.18 + i * 0.16;
                return <rect key={i} x="-6.5" y="-6" width="13" height="12" rx="3.5" fill={fill} transform={`translate(${x1 + (x2 - x1) * t} ${y1 + (y2 - y1) * t}) rotate(${deg})`} />;
              })}
            </g>
          );
        })}
        <Steam xs={[-6, 6, 18]} top={-46} />
      </>
    );
  },
  croissant: () => (
    <>
      <ellipse cx="0" cy="-2" rx="40" ry="6" fill={C.plate} />
      <path d="M-36 -4c4-22 20-34 36-34s32 12 36 34c-7-5-14-5-19-1-4-9-10-13-17-13s-13 4-17 13c-5-4-12-4-19 1z" fill={C.golden} />
      <path d="M-17 -6-23 -26M0 -18v-20M17 -6l6-20" stroke={C.goldenDark} strokeOpacity=".55" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M-24 -26c6-6 14-9 22-9" fill="none" stroke="#F6D894" strokeWidth="2.5" strokeLinecap="round" opacity=".8" />
    </>
  ),
  cake: (l) => (
    <>
      <ellipse cx="2" cy="-2" rx="34" ry="6" fill={C.plate} />
      <path d="M14 -34 30 -42v30L14 -4z" fill="#E6C894" />
      <path d="M-26 -34h40v30h-40z" fill={C.bread} />
      <path d="M-26 -24h40v3.5h-40zM-26 -14h40v3.5h-40z" fill="#FFFFFF" />
      <path d="M-26 -34-10 -42h40l-16 8z" fill={l.frosting} />
      <path d="M-26 -34h40v4h-40z" fill={l.frosting} opacity=".85" />
      <circle cx="2" cy="-43" r="4.2" fill="#E5483A" />
      <path d="M2 -47c1-3 3-5 6-6" stroke="#2F7D4F" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </>
  ),
  waffle: () => (
    <>
      <ellipse cx="0" cy="-2" rx="34" ry="6" fill={C.plate} />
      <rect x="-24" y="-30" width="48" height="26" rx="6" fill={C.golden} />
      <path d="M-12 -30v26M0 -30v26M12 -30v26M-24 -21h48M-24 -13h48" stroke={C.goldenDark} strokeWidth="2.2" />
      <path d="M-14 -30c0 6 3 7 3 11s3 4 3 0v-11z" fill="#B0632C" opacity=".85" />
      <rect x="-6" y="-37" width="12" height="9" rx="2" fill={C.limeSoft} />
    </>
  ),
  cookie: () => (
    <>
      <ellipse cx="0" cy="-2" rx="30" ry="5.5" fill={C.plate} />
      {[0, 1, 2].map((k) => (
        <g key={k} transform={`translate(0 ${-7 - k * 7})`}>
          <ellipse cx="0" cy="2" rx="21" ry="6" fill={C.goldenDark} />
          <ellipse cx="0" cy="0" rx="21" ry="6" fill={C.golden} />
        </g>
      ))}
      {[[-8, -21], [0, -23], [8, -21], [-3, -19], [5, -19]].map(([x, y]) => <circle key={`${x},${y}`} cx={x} cy={y} r="1.2" fill={C.goldenDark} />)}
    </>
  ),
  bun: () => (
    <>
      <ellipse cx="0" cy="-2" rx="30" ry="5.5" fill={C.plate} />
      <path d="M-24 -6c0-6 10-9 24-9s24 3 24 9z" fill="#D9964A" />
      <path d="M-20 -15h40l-3 5h-34z" fill={C.limeSoft} />
      <path d="M-24 -16c0-14 10-22 24-22s24 8 24 22c-8 2-40 2-48 0z" fill="#D9964A" />
      <path d="M-12 -30c4-3 10-4 15-3" stroke="#F0C27E" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </>
  ),
  pizza: () => (
    <>
      <ellipse cx="0" cy="-2" rx="40" ry="7" fill={C.plate} />
      <path d="M-30 -8 0 -52 30 -8z" fill="#F2C14E" />
      <path d="M-33 -8h66a4 4 0 0 1 0 8h-66a4 4 0 0 1 0-8z" fill="#C8923F" />
      <circle cx="-8" cy="-20" r="5" fill={C.coral} />
      <circle cx="9" cy="-24" r="4.5" fill={C.coral} />
      <circle cx="0" cy="-37" r="4" fill={C.coral} />
      <path d="M-14 -30c3-3 6-3 8 0-3 2-6 2-8 0zM10 -14c3-3 6-3 8 0-3 2-6 2-8 0z" fill={C.lime} />
    </>
  ),
  bowl: () => (
    <>
      <path d="M8 -36 40 -66M14 -34 44 -62" stroke="#E6D3B0" strokeWidth="3" strokeLinecap="round" />
      <path d="M-34 -30h68c0 18-15 30-34 30s-34-12-34-30z" fill={C.tealDark} />
      <ellipse cx="0" cy="-30" rx="34" ry="6" fill={C.teal} />
      <ellipse cx="0" cy="-30" rx="30" ry="4.5" fill="#F2C14E" />
      <path d="M-20 -32c4-6 8 6 12 0s8 6 12 0 8 6 12 0" fill="none" stroke="#F7D57A" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="12" cy="-31" r="2" fill={C.lime} />
      <circle cx="-14" cy="-29" r="1.6" fill={C.lime} />
      <circle cx="-2" cy="-28" r="1.8" fill={C.coral} />
      <path d="M-26 -16c4 8 12 12 20 13" stroke={C.teal} strokeWidth="3" strokeLinecap="round" fill="none" opacity=".6" />
      <Steam xs={[-10, 0, 10]} top={-40} />
    </>
  ),
  juice: (l) => (
    <>
      <path d="M4 -40 12 -64h7" fill="none" stroke={C.coral} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M-14 -52h28l-3 48a4 4 0 0 1-4 4h-14a4 4 0 0 1-4-4z" fill="#FFFFFF" fillOpacity=".18" />
      <path d="M-12.4 -40h24.8l-2.3 34a3 3 0 0 1-3 2.8h-14.2a3 3 0 0 1-3-2.8z" fill={l.juice} />
      <path d="M-14 -52h28" stroke="#FFFFFF" strokeOpacity=".8" strokeWidth="2" strokeLinecap="round" />
      <path d="M-8 -36v26" stroke="#FFFFFF" strokeOpacity=".4" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="-13" cy="-50" r="8" fill={C.lime} />
      <circle cx="-13" cy="-50" r="6" fill={C.limeSoft} />
      <path d="M-13 -56v12M-19 -50h12M-17.2 -54.2l8.4 8.4M-17.2 -45.8l8.4-8.4" stroke={C.lime} strokeWidth="1" />
    </>
  ),
  sandwich: () => (
    <>
      <ellipse cx="0" cy="-2" rx="34" ry="6" fill={C.plate} />
      <rect x="-26" y="-14" width="52" height="10" rx="3" fill={C.bread} />
      <path d="M-27 -16c4-3 6 3 10 0s6 3 10 0 6 3 10 0 6 3 10 0 6 3 10 0 6 3 7 0v3h-57z" fill={C.lime} />
      <rect x="-25" y="-21" width="50" height="5" rx="2" fill={C.coral} />
      <rect x="-26" y="-32" width="52" height="11" rx="3.5" fill={C.bread} />
      <path d="M-26 -29h52M-26 -7h52" stroke="#D9B57A" strokeWidth="1.2" />
    </>
  ),
  thali: () => (
    <>
      <ellipse cx="0" cy="-12" rx="48" ry="14" fill={C.plate} />
      <ellipse cx="0" cy="-12" rx="42" ry="11" fill={C.plateIn} />
      {([[-26, -20, C.coral], [-9, -25, "#F2C14E"], [9, -25, C.limeSoft], [26, -20, "#FFFFFF"]] as const).map(([x, y, fill]) => (
        <g key={x}>
          <ellipse cx={x} cy={y + 1.5} rx="9" ry="4.4" fill="#B8CDCF" />
          <ellipse cx={x} cy={y} rx="9" ry="4.4" fill="#DDE8E9" />
          <ellipse cx={x} cy={y} rx="7" ry="3.2" fill={fill} />
        </g>
      ))}
      <path d="M-14 -6c2-8 8-12 14-12s12 4 14 12z" fill="#FFFFFF" />
      <path d="M18 -8c4-3 10-3 14 0-4 3-10 3-14 0z" fill={C.lime} />
      <Steam xs={[-6, 4]} top={-32} />
    </>
  ),
};

const TONES = ["#00737A", "#00A3AE", "#0B5960", "#10424A"];

function composition(place: Restaurant) {
  const dishes = place.dishes.filter((d) => d !== "cafe");
  const main = kindOf(dishes[0] ?? "coffee") ?? "thali";
  const side = DRINKS.has(main) || main === "croissant" ? dishes.slice(1).map(kindOf).find((k) => k && SIDES.has(k) && k !== main) : undefined;
  const r = mulberry32(hashString(place.id));
  const look: Look = {
    cup: pick(r, ["#FFFFFF", C.limeSoft, C.teal]),
    rim: "",
    accent: pick(r, [C.lime, C.coral, "#062A2E"]),
    juice: pick(r, ["#C5F000", "#FF8A6E", "#FFB347"]),
    frosting: pick(r, ["#FF8E7B", C.limeSoft, "#FFFFFF"]),
    mound: /haleem/.test(dishes[0] ?? "") ? "haleem" : "rice",
  };
  look.rim = look.cup === "#FFFFFF" ? "#E6F2F2" : look.cup === C.teal ? C.tealDark : "#D8EE73";
  const tone = pick(r, TONES);
  const glow = { x: 20 + r() * 80, y: 12 + r() * 36 };
  const dots = Array.from({ length: 9 }, () => ({ x: -30 + r() * 180, y: r() * 70, r: 0.8 + r() * 2 }));
  return { main, side, look, tone, glow, dots };
}

interface Props {
  place: Restaurant;
  /** "hero" is the wide header in the details panel: slow zoom and steam that never stops. */
  variant?: "thumb" | "hero";
  className?: string;
}

export default function PlaceArt({ place, variant = "thumb", className = "" }: Props) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const { main, side, look, tone, glow, dots } = composition(place);
  const hero = variant === "hero";
  return (
    <div className={`art${hero ? " hero lively" : ""} ${className}`} aria-hidden="true">
      <svg viewBox={hero ? "-40 0 200 112.5" : "0 0 120 120"} preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id={`${id}bg`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#0A3337" />
            <stop offset="1" stopColor={tone} />
          </linearGradient>
          <radialGradient id={`${id}glow`}>
            <stop offset="0" stopColor={C.lime} stopOpacity=".28" />
            <stop offset="1" stopColor={C.lime} stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect x="-60" y="-60" width="240" height="240" fill={`url(#${id}bg)`} />
        <circle cx={glow.x} cy={glow.y} r="46" fill={`url(#${id}glow)`} />
        {dots.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={d.r} fill={C.limeSoft} opacity=".16" />)}
        {hero && <path d="M112 20c6-6 12 4 18-2s12 4 18-2" fill="none" stroke={C.lime} strokeWidth="2.5" strokeLinecap="round" opacity=".7" />}
        <ellipse cx="60" cy="101" rx="46" ry="8" fill="#041A1D" opacity=".32" />
        <g transform={`translate(${side ? 50 : 60} 98)`}>{DRAW[main](look)}</g>
        {side && <g transform="translate(95 100) scale(.5)">{DRAW[side](look)}</g>}
      </svg>
    </div>
  );
}
