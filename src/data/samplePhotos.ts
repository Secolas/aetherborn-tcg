/**
 * Photo URLs the AI uses for its battlefield creatures so a match looks like
 * a duel between two photo-summoners.
 *
 * Themed Unsplash CDN URLs where the card concept maps cleanly to a photo
 * subject. Falls back to deterministic picsum.photos seeds otherwise.
 */

const U = (id: string) => `https://images.unsplash.com/${id}?w=400&q=80`;

const THEMED: Record<string, string> = {
  // Family
  'fam-01': U('photo-1543466835-00a7907e9de1'),  // Family Pet → dog
  'fam-02': U('photo-1587616211892-f743fcca64f9'),  // Cousin → kid
  'fam-03': U('photo-1547592180-85f173990554'),  // Soup → bowl of soup
  'fam-04': U('photo-1521119989659-a83eee488004'),  // Tio → older man w/ story
  'fam-05': U('photo-1573497019940-1c28c88b4f3e'),  // Mom → woman
  'fam-06': U('photo-1531746020798-e6953c6e8e04'),  // The Look → silhouette
  'fam-07': U('photo-1500648767791-00dcc994a43e'),  // Older Sibling → man
  'fam-08': U('photo-1566616213894-2d4e1baee5d8'),  // Abuela → grandmother
  'fam-09': U('photo-1535141192574-5d4897c12636'),  // Birthday Cake → cake
  'fam-10': U('photo-1511895426328-dc8714191300'),  // Family Photo → group
  'fam-11': U('photo-1507003211169-0a1dd7228f2d'),  // Dad → man
  'fam-12': U('photo-1414235077428-338989a2e8c0'),  // Sunday Dinner → table

  // Work
  'wrk-01': U('photo-1573496359142-b8d87734a5a2'),  // Intern → young employee
  'wrk-02': U('photo-1526374965328-7f61d4dc18c5'),  // Spam Email → screen/code
  'wrk-03': U('photo-1494790108377-be9c29b29330'),  // Coworker → portrait
  'wrk-04': U('photo-1495474472287-4d71bcdd2085'),  // Coffee → mug
  'wrk-05': U('photo-1517694712202-14dd9538aa97'),  // IT Support → cables/code
  'wrk-06': U('photo-1556761175-5973dc0f32e7'),  // Sales Pitch → presentation
  'wrk-07': U('photo-1573497019703-cef38d1b8da9'),  // HR → professional
  'wrk-08': U('photo-1560250097-0b93528c311a'),  // Senior Engineer → suit
  'wrk-09': U('photo-1517245386807-bb43f82c33c4'),  // Meeting → conference room
  'wrk-10': U('photo-1567427017947-545c5f8d16ad'),  // Promotion → trophy/award
  'wrk-11': U('photo-1568901346375-23c9450c58cd'),  // Lunch Break → sandwich/meal
  'wrk-12': U('photo-1560250097-0b93528c311a'),  // The Boss → suited man

  // Animals
  'ani-01': U('photo-1425082661705-1834bfd09dca'),  // Mouse → small mouse
  'ani-02': U('photo-1531386151447-fd76ad50012f'),  // Snake Bite → snake
  'ani-03': U('photo-1535241749838-299277b6305f'),  // Rabbit → bunny
  'ani-04': U('photo-1574144611937-0df059b5ef3e'),  // Cat → cat
  'ani-05': U('photo-1543466835-00a7907e9de1'),  // Dog → dog
  'ani-06': U('photo-1551772732-f8f17ac9dde9'),  // Owl → owl/bird
  'ani-07': U('photo-1601758228041-f3b2795255f1'),  // Treats → pet food
  'ani-08': U('photo-1583337130417-3346a1be7dee'),  // Vet Visit → vet/pet
  'ani-09': U('photo-1485894050903-8e8ee7b071a8'),  // Bear Trap → fence/wire
  'ani-10': U('photo-1553284965-83fd3e82fa5a'),  // Horse → horse
  'ani-11': U('photo-1564415051543-c4b21afae0bd'),  // Wolf → wolfdog
  'ani-12': U('photo-1546182990-dffeafbe841d'),  // Lion → lion
};

/**
 * Thematic photo for an AI-controlled card. Falls back to a deterministic
 * picsum.photos seed so every template gets *some* real image.
 */
export function aiPhoto(templateId: string): string {
  return THEMED[templateId] ?? `https://picsum.photos/seed/lifedeck-${templateId}/400/400`;
}
