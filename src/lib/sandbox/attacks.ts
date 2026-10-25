import type { Review, Sandbox } from "../types";
import { makeFakes, makeInjection } from "./generate";
import { RESTAURANTS } from "./restaurants";

export const MAX_FAKES = 30;

/** Everything the client may send about an attack. The server rebuilds the fake reviews itself. */
export interface AttackConfig {
  boost: number;
  boostTarget: string;
  smear: number;
  smearTarget: string;
  injection: boolean;
  smart: boolean;
}

export const NO_ATTACK: AttackConfig = {
  boost: 0,
  boostTarget: "r05",
  smear: 0,
  smearTarget: "r01",
  injection: false,
  smart: false,
};

const specOf = (id: string) => RESTAURANTS.find((r) => r.id === id)!;

/** Fake reviews to add to the sandbox. Deterministic: fake #k is the same at every slider position. */
export function attackReviews(sb: Sandbox, cfg: AttackConfig): Review[] {
  const out: Review[] = [];
  if (cfg.boost > 0) {
    out.push(
      ...makeFakes(specOf(cfg.boostTarget), {
        kind: "boost", count: MAX_FAKES, smart: cfg.smart, endsAt: sb.now, idPrefix: "atk-boost", attack: "boost",
      }).slice(0, cfg.boost),
    );
  }
  if (cfg.smear > 0) {
    out.push(
      ...makeFakes(specOf(cfg.smearTarget), {
        kind: "smear", count: MAX_FAKES, smart: cfg.smart, endsAt: sb.now, idPrefix: "atk-smear", attack: "smear",
      }).slice(0, cfg.smear),
    );
  }
  if (cfg.injection) out.push(makeInjection(specOf(cfg.boostTarget), sb.now));
  return out;
}

export function attackedPlaces(cfg: AttackConfig): Set<string> {
  const s = new Set<string>();
  if (cfg.boost > 0 || cfg.injection) s.add(cfg.boostTarget);
  if (cfg.smear > 0) s.add(cfg.smearTarget);
  return s;
}
