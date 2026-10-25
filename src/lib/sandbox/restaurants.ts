// All restaurants are fictional. Any resemblance to a real business is unintended.

/** Rough positions in km relative to Gachibowli, used for "near X" queries. */
export const AREAS: Record<string, [number, number]> = {
  Gachibowli: [0, 0],
  Kondapur: [1.5, 2.5],
  "Hitech City": [2.5, 1.5],
  Nanakramguda: [-1, -2.5],
  Madhapur: [4, 2],
  "Jubilee Hills": [7, 0.5],
  "Banjara Hills": [9, -1],
  Ameerpet: [10, 3],
  Begumpet: [12, 3],
  Kukatpally: [5, 9],
  Tolichowki: [7, -5],
  Mehdipatnam: [10, -5],
  Secunderabad: [17, 5],
  Charminar: [15, -9],
};

export const NEAR_KM = 4;

export function areasNear(area: string): string[] {
  const origin = AREAS[area];
  if (!origin) return [];
  return Object.entries(AREAS)
    .filter(([, [x, y]]) => Math.hypot(x - origin[0], y - origin[1]) <= NEAR_KM)
    .map(([name]) => name);
}

export interface RestaurantSpec {
  id: string;
  name: string;
  area: string;
  dishes: string[];
  priceForOne: number;
  /** Hidden true quality that genuine ratings are drawn around. */
  quality: number;
  reviews: number;
  /** How long the place has been on the platform. */
  ageDays: number;
  /**
   * A fake-review campaign already present in the seed data. textStyle "genuine" models
   * LLM-written fakes: they read like real reviews and only behaviour gives them away.
   */
  campaign?: { kind: "boost" | "smear"; count: number; daysAgo: number; textStyle?: "template" | "genuine" };
}

export const RESTAURANTS: RestaurantSpec[] = [
  // Demo query: "best biryani near Gachibowli under ₹400"
  { id: "r01", name: "Dum Darbar", area: "Gachibowli", dishes: ["biryani", "haleem"], priceForOne: 320, quality: 4.65, reviews: 80, ageDays: 900 },
  { id: "r02", name: "Zafrani Handi", area: "Kondapur", dishes: ["biryani", "kebab"], priceForOne: 350, quality: 4.3, reviews: 70, ageDays: 800 },
  { id: "r03", name: "Nizam Pot House", area: "Hitech City", dishes: ["biryani", "mandi"], priceForOne: 380, quality: 4.25, reviews: 60, ageDays: 700 },
  { id: "r04", name: "Kesar Kitchen", area: "Gachibowli", dishes: ["biryani", "haleem"], priceForOne: 300, quality: 3.9, reviews: 55, ageDays: 650 },
  { id: "r05", name: "Spice Route Express", area: "Gachibowli", dishes: ["biryani", "fried rice"], priceForOne: 250, quality: 3.8, reviews: 15, ageDays: 180 },
  { id: "r06", name: "Biryani Junction 24x7", area: "Nanakramguda", dishes: ["biryani"], priceForOne: 220, quality: 3.1, reviews: 45, ageDays: 600 },
  { id: "r07", name: "Royal Deccan Grill", area: "Gachibowli", dishes: ["biryani", "kebab"], priceForOne: 650, quality: 4.6, reviews: 75, ageDays: 1000 },
  // Seeded campaigns for detection metrics (outside the demo query).
  { id: "r08", name: "Mandi Mahal", area: "Tolichowki", dishes: ["mandi"], priceForOne: 400, quality: 3.1, reviews: 50, ageDays: 700, campaign: { kind: "boost", count: 18, daysAgo: 240 } },
  { id: "r09", name: "Chai Chowrasta", area: "Secunderabad", dishes: ["irani chai", "osmania biscuit"], priceForOne: 80, quality: 3.4, reviews: 40, ageDays: 500, campaign: { kind: "boost", count: 12, daysAgo: 60 } },
  { id: "r10", name: "Dosa Diaries", area: "Ameerpet", dishes: ["dosa", "idli"], priceForOne: 150, quality: 4.4, reviews: 65, ageDays: 900, campaign: { kind: "smear", count: 10, daysAgo: 120 } },
  // Background.
  { id: "r11", name: "Haleem Ghar", area: "Charminar", dishes: ["haleem", "biryani"], priceForOne: 280, quality: 4.2, reviews: 90, ageDays: 1200 },
  { id: "r12", name: "Old City Kebab Co.", area: "Charminar", dishes: ["kebab", "biryani"], priceForOne: 350, quality: 4.0, reviews: 70, ageDays: 1100 },
  { id: "r13", name: "Tiffin Tales", area: "Madhapur", dishes: ["dosa", "idli", "vada"], priceForOne: 120, quality: 4.1, reviews: 60, ageDays: 800 },
  { id: "r14", name: "Andhra Spice Bhojanam", area: "Kukatpally", dishes: ["andhra meals", "biryani"], priceForOne: 260, quality: 4.0, reviews: 55, ageDays: 700 },
  { id: "r15", name: "Pesarattu Point", area: "Kondapur", dishes: ["pesarattu", "dosa"], priceForOne: 110, quality: 3.7, reviews: 35, ageDays: 400 },
  { id: "r16", name: "Banjara Bowl", area: "Banjara Hills", dishes: ["pizza", "pasta"], priceForOne: 600, quality: 3.8, reviews: 50, ageDays: 600 },
  { id: "r17", name: "Jubilee Wok", area: "Jubilee Hills", dishes: ["noodles", "fried rice"], priceForOne: 450, quality: 3.6, reviews: 45, ageDays: 500 },
  { id: "r18", name: "Mehdipatnam Mandi House", area: "Mehdipatnam", dishes: ["mandi", "biryani"], priceForOne: 420, quality: 3.9, reviews: 60, ageDays: 800 },
  { id: "r19", name: "Begumpet Bakers", area: "Begumpet", dishes: ["cake", "osmania biscuit"], priceForOne: 200, quality: 4.3, reviews: 55, ageDays: 900 },
  { id: "r20", name: "Irani Cafe Noor", area: "Charminar", dishes: ["irani chai", "bun maska"], priceForOne: 90, quality: 4.5, reviews: 85, ageDays: 1300 },
  { id: "r21", name: "Kukatpally Biryani Adda", area: "Kukatpally", dishes: ["biryani"], priceForOne: 240, quality: 3.5, reviews: 40, ageDays: 500 },
  { id: "r22", name: "Coastal Curry Co.", area: "Madhapur", dishes: ["fish curry", "andhra meals"], priceForOne: 420, quality: 4.2, reviews: 50, ageDays: 600 },
  { id: "r23", name: "Hitech Thali House", area: "Hitech City", dishes: ["thali", "andhra meals"], priceForOne: 300, quality: 3.8, reviews: 45, ageDays: 550 },
  { id: "r24", name: "Kondapur Kebab Corner", area: "Kondapur", dishes: ["kebab", "shawarma"], priceForOne: 260, quality: 3.4, reviews: 40, ageDays: 450 },
  { id: "r25", name: "Shawarma Stop", area: "Gachibowli", dishes: ["shawarma"], priceForOne: 180, quality: 3.6, reviews: 35, ageDays: 400 },
  { id: "r26", name: "Ameerpet Andhra Mess", area: "Ameerpet", dishes: ["andhra meals"], priceForOne: 180, quality: 4.0, reviews: 50, ageDays: 700 },
  { id: "r27", name: "Secunderabad Sweet Co.", area: "Secunderabad", dishes: ["sweets", "cake"], priceForOne: 150, quality: 3.9, reviews: 40, ageDays: 800 },
  { id: "r28", name: "Tolichowki Haleem House", area: "Tolichowki", dishes: ["haleem"], priceForOne: 260, quality: 3.7, reviews: 40, ageDays: 600 },
  { id: "r29", name: "Madhapur Momo Bar", area: "Madhapur", dishes: ["momos", "noodles"], priceForOne: 200, quality: 3.5, reviews: 35, ageDays: 350 },
  { id: "r30", name: "Jubilee Juice Co.", area: "Jubilee Hills", dishes: ["juice", "sandwich"], priceForOne: 160, quality: 3.3, reviews: 30, ageDays: 300 },
  // Cafés. Demo query: "best cafe in Gachibowli".
  { id: "r31", name: "Brew Theory", area: "Gachibowli", dishes: ["cafe", "coffee", "croissant"], priceForOne: 380, quality: 4.75, reviews: 75, ageDays: 700 },
  { id: "r32", name: "Chai & Chapter", area: "Gachibowli", dishes: ["cafe", "chai", "bun maska"], priceForOne: 180, quality: 4.2, reviews: 65, ageDays: 800 },
  { id: "r33", name: "The Filter Room", area: "Gachibowli", dishes: ["cafe", "filter coffee", "coffee", "dosa"], priceForOne: 150, quality: 4.45, reviews: 70, ageDays: 900 },
  // A new café that bought a burst of human-sounding 5★ reviews from fresh accounts.
  { id: "r34", name: "Cloud Nine Café", area: "Gachibowli", dishes: ["cafe", "coffee", "waffles"], priceForOne: 420, quality: 3.4, reviews: 15, ageDays: 120, campaign: { kind: "boost", count: 50, daysAgo: 6, textStyle: "genuine" } },
  // A good café hit by a 1★ smear campaign.
  { id: "r35", name: "Velvet Bean", area: "Gachibowli", dishes: ["cafe", "coffee", "cheesecake"], priceForOne: 320, quality: 4.55, reviews: 55, ageDays: 600, campaign: { kind: "smear", count: 16, daysAgo: 15, textStyle: "genuine" } },
  { id: "r36", name: "Roast Republic", area: "Kondapur", dishes: ["cafe", "coffee", "sandwich"], priceForOne: 300, quality: 4.0, reviews: 50, ageDays: 500 },
  { id: "r37", name: "Masala Mug", area: "Hitech City", dishes: ["cafe", "chai", "sandwich"], priceForOne: 160, quality: 3.8, reviews: 45, ageDays: 400 },
  { id: "r38", name: "Bakehouse 32", area: "Nanakramguda", dishes: ["cafe", "croissant", "cake"], priceForOne: 260, quality: 4.1, reviews: 40, ageDays: 450 },
];

export const ALL_DISHES = [...new Set(RESTAURANTS.flatMap((r) => r.dishes))];
