/**
 * Photo URLs the AI uses for its battlefield creatures so a match looks like
 * a duel between two photo-summoners, not the player vs blank cards.
 *
 * Strategy: thematic Unsplash URLs where the card concept clearly maps to a
 * recognizable subject (Ember Hound → dog, Bloomshield → succulent), and
 * deterministic picsum.photos seeds for everything else. Both sources are
 * fast CDNs and don't require API keys.
 */

// Known-good Unsplash CDN URLs (carried over from the original design bundle).
const U = (id: string) => `https://images.unsplash.com/${id}?w=400&q=80`;

const THEMED: Record<string, string> = {
  // Ember — fierce, hot, animal
  'em-01': U('photo-1543466835-00a7907e9de1'),       // dog → Ember Hound
  'em-02': U('photo-1518709268805-4e9042af9f23'),    // small flame → Cinder Imp
  'em-03': U('photo-1523301343968-6a6ebf63c672'),    // bonfire → Ashen Pyre
  'em-06': U('photo-1492321936769-b49830bc1d1e'),    // wildfire texture → Wildfire
  'em-07': U('photo-1583089580406-b8e4b9c2a18d'),    // volcano → Magma Titan

  // Tide — water, calm, fluid
  'ti-01': U('photo-1574144611937-0df059b5ef3e'),    // cat → Tide Familiar
  'ti-02': U('photo-1502082553048-f009c37129b9'),    // misty mountain → Mistwalker
  'ti-03': U('photo-1535591273668-578e31182c4f'),    // deep sea → Deepscale Sage
  'ti-05': U('photo-1505142468610-359e7d316be0'),    // calm water → Reflecting Pool
  'ti-06': U('photo-1568430462989-44163eb1752f'),    // whale tail → Leviathan

  // Bloom — green, plant, taunting wall
  'bl-01': U('photo-1463320726281-696a485928c7'),    // succulent → Bloomshield
  'bl-02': U('photo-1490750967868-88aa4486c946'),    // flower → Bloompetal
  'bl-03': U('photo-1444492417251-9c84a5fa18e0'),    // forest → Greatroot
  'bl-05': U('photo-1533743983669-94fa5c4338ec'),    // green leaves → Verdant Mend

  // Gust — sky, fast, evasive
  'gu-02': U('photo-1559563458-527698bf5295'),       // sparrow → Sky Sparrow
  'gu-03': U('photo-1561484930-998b6a7b22e8'),       // storm → Storm Caller
  'gu-04': U('photo-1551772732-f8f17ac9dde9'),       // bird in sky → Cloudpiercer

  // Void — dark, mysterious
  'vo-01': U('photo-1505672954112-0e1f10adee94'),    // lightning → Voidlash
  'vo-02': U('photo-1531746020798-e6953c6e8e04'),    // silhouette → Voidtouched Oracle
  'vo-05': U('photo-1502134249126-9f3755a50d78'),    // moon → Eclipse
};

/**
 * Thematic photo for an AI-controlled card. Falls back to a deterministic
 * picsum.photos seed so every template gets *some* real image.
 */
export function aiPhoto(templateId: string): string {
  return THEMED[templateId] ?? `https://picsum.photos/seed/aetherborn-${templateId}/400/400`;
}
