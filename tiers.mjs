// Tier label <-> number mapping, shared by the browser (app.js), the server
// (server.mjs), and the enrich pipeline. No DOM or Node APIs — keep portable.

// label -> starting tier 1..5
export function startTier(tierRaw) {
  switch ((tierRaw || '').trim()) {
    case '1 - Open now': return 1;
    case '2 - Cultivate / participant':
    case 'VERIFY (poss. Tier-1)':
    case 'Inside / sponsor': return 2;
    case '3 - Follow / participant':
    case 'TBD': return 3;
    case 'Referral / deprioritize': return 4;
    case 'Gate': return 5;
    default: return 3;
  }
}

// canonical label for a tier number (round-trips through startTier)
export const TIER_LABEL = {
  1: '1 - Open now',
  2: '2 - Cultivate / participant',
  3: '3 - Follow / participant',
  4: 'Referral / deprioritize',
  5: 'Gate',
};

// The tier a firm is effectively in: the user's swipe decision wins,
// otherwise the label-derived starting tier.
export function effectiveTier(firm) {
  return firm.current_tier != null ? firm.current_tier : startTier(firm.tier_label);
}
