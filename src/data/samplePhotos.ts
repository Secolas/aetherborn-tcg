/**
 * Photo URLs the AI uses for its battlefield creatures so a match looks like
 * a duel between two photo-summoners.
 *
 * Mix of two sources:
 *   - Themed Unsplash CDN URLs where the card concept maps cleanly to a
 *     photo subject. These need to stay current — when an Unsplash photo
 *     gets removed or its ID rotates, SmartImage falls back to
 *     picsum.photos/seed which returns a totally random image (e.g.
 *     Abuela showed up as a wolf because her ID had rotted). When in
 *     doubt, prefer popular long-stable IDs.
 *   - Local illustrated cards in /public/cards/*.webp for the iconic
 *     family / pet / spell art. WebP at ~40-60 KB each (down from the
 *     1.5-1.7 MB source PNGs) so they load instantly on mobile —
 *     resized to 440x640 max, more than enough for the 220x320
 *     display size at 2x retina.
 */

const U = (id: string) => `https://images.unsplash.com/${id}?w=400&q=80`;

const THEMED: Record<string, string> = {
  // Family
  'fam-01': '/cards/family-pet.webp',                // Family Pet → illustrated puppy
  'fam-02': '/cards/cousin.webp',                    // Cousin → illustrated kids
  'fam-03': U('photo-1547592180-85f173990554'),     // Soup → bowl of soup
  'fam-04': '/cards/tio.webp',                       // Tio → illustrated portrait
  'fam-05': '/cards/mom.webp',                       // Mom → illustrated portrait
  'fam-06': U('photo-1531746020798-e6953c6e8e04'),  // The Look → silhouette
  'fam-07': '/cards/older-sibling.webp',             // Sibling → illustrated portrait
  'fam-08': '/cards/abuela.webp',                    // Abuela → illustrated portrait
  'fam-09': U('photo-1535141192574-5d4897c12636'),  // Birthday Cake → cake
  'fam-10': '/cards/family-photo.webp',              // Family Photo → illustrated group
  'fam-11': '/cards/dad.webp',                       // Dad → illustrated portrait
  'fam-12': U('photo-1414235077428-338989a2e8c0'),  // Sunday Dinner → table
  'fam-13': U('photo-1559839734-2b71ea197ec2'),     // Tough Love → stern parent

  // Work
  'wrk-01': U('photo-1573496359142-b8d87734a5a2'),  // Intern → young employee
  'wrk-02': U('photo-1526374965328-7f61d4dc18c5'),  // Spam Email → screen/code
  'wrk-03': U('photo-1494790108377-be9c29b29330'),  // Coworker → portrait
  'wrk-04': '/cards/coffee.webp',                    // Coffee → illustrated mug
  'wrk-05': U('photo-1517694712202-14dd9538aa97'),  // IT Support → cables/code
  'wrk-06': U('photo-1556761175-5973dc0f32e7'),     // Sales Pitch → presentation
  'wrk-07': U('photo-1573497019703-cef38d1b8da9'),  // HR → professional
  'wrk-08': U('photo-1560250097-0b93528c311a'),     // Senior Engineer → suit
  'wrk-09': U('photo-1517245386807-bb43f82c33c4'),  // Meeting → conference room
  'wrk-10': U('photo-1567427017947-545c5f8d16ad'),  // Promotion → trophy/award
  'wrk-11': U('photo-1568901346375-23c9450c58cd'),  // Lunch Break → meal
  'wrk-12': U('photo-1573497019940-1c28c88b4f3e'),  // The Boss → dapper man
  'wrk-13': U('photo-1454165804606-c3d57bc86b40'),  // Performance Review → laptop / paperwork

  // Animals
  'ani-01': '/cards/mouse.webp',                     // Mouse → illustrated mouse
  'ani-02': '/cards/snake-bite.webp',                // Snake Bite → illustrated bottle
  'ani-03': U('photo-1535241749838-299277b6305f'),  // Rabbit → bunny
  'ani-04': U('photo-1574144611937-0df059b5ef3e'),  // Cat → cat
  'ani-05': '/cards/dog.webp',                       // Dog → illustrated sleeping dog
  'ani-06': U('photo-1543549790-8b5f4a028cfb'),  // Bird → owl portrait (fallback only — players photograph their own bird) (was a leaf-droplet photo when the previous ID rotated)
  'ani-07': U('photo-1601758228041-f3b2795255f1'),  // Treats → pet food
  'ani-08': U('photo-1583337130417-3346a1be7dee'),  // Vet Visit → vet/pet
  'ani-09': U('photo-1485894050903-8e8ee7b071a8'),  // Cage → fence/wire
  'ani-10': U('photo-1553284965-83fd3e82fa5a'),     // Horse → horse
  'ani-11': U('photo-1474511320723-9a56873867b5'),  // Wolf → wolf portrait, mountain backdrop
  'ani-12': U('photo-1546182990-dffeafbe841d'),     // Lion → lion
  'ani-13': U('photo-1601758228041-f3b2795255f1'),  // Muzzle → leashed pet

  // Travel
  'trv-01': U('photo-1499856871958-5b9627545d1a'),  // Boarding Pass → passport stamps
  'trv-02': U('photo-1553062407-98eeb64c6a62'),     // Carry-On → backpack
  'trv-03': U('photo-1473625247510-8ceb1760943f'),  // Suitcase → packed luggage
  'trv-04': U('photo-1530521954074-e64f6810b32d'),  // Lost Luggage → scattered baggage
  'trv-05': U('photo-1502139214982-d0ad755818d8'),  // Window Seat → airplane window over clouds
  'trv-06': U('photo-1474487548417-781cb71495f3'),  // Train Conductor → vintage train
  'trv-07': U('photo-1507608616759-54f48f0af0ee'),  // Roadmap → paper map
  'trv-08': U('photo-1466354424719-343280fe118b'),  // Airport Wait → departure board
  'trv-09': U('photo-1566073771259-6a8506099945'),  // Hotel → hotel facade
  'trv-10': U('photo-1507525428034-b723cf961d3e'),  // Beach → tropical shore
  'trv-11': U('photo-1540339832862-474599807836'),  // First Class → luxury cabin
  'trv-12': U('photo-1464822759023-fed622ff2c3b'),  // Mountain Summit → peak panorama

  // Food — meals, snacks, coffee, kitchen.
  'fd-01': U('photo-1486297678162-eb2a19b0a32d'),  // Toast → buttered toast
  'fd-02': U('photo-1547592180-85f173990554'),     // Hot Soup → bowl of soup
  'fd-03': U('photo-1599490659213-e2b9527bd087'),  // Snack → chips / bowl of snacks
  'fd-04': U('photo-1490645935967-10de6ba17061'),  // Breakfast Plate → eggs / pancakes
  'fd-05': U('photo-1565299507177-b0ac66763828'),  // Lunch Box → packed meal box
  'fd-06': U('photo-1556909114-f6e7ad7d3136'),     // Crockpot → kitchen stove
  'fd-07': U('photo-1455619452474-d2be8b1e70cd'),  // Recipe Card → handwritten recipe
  'fd-08': U('photo-1414235077428-338989a2e8c0'),  // Share the Meal → table set for many
  'fd-09': U('photo-1567620905732-2d1ec7ab7445'),  // Comfort Food → pancake stack
  'fd-10': U('photo-1568571780765-9276ac8b75a2'),  // Grandma's Pie → homemade pie
  'fd-11': U('photo-1583394293214-28ded15ee548'),  // The Cook → chef at the stove
  'fd-12': U('photo-1542010589005-d1eacc3918f2'),  // Family Feast → big spread
  'fd-13': U('photo-1556679343-c7306c1976bc'),     // Sip → glass of water/iced drink

  // Cheap-card pass additions
  'fam-14': '/cards/hug.webp',                       // Hug → illustrated embrace
  'wrk-14': U('photo-1531403009284-440f080d1e12'),  // Stand-up Meeting → team gathered
  'wrk-15': U('photo-1554224155-6726b3ff858f'),     // Payroll → ATM / paycheck
  'ani-14': U('photo-1518810827419-c66f7c5b2c63'),  // Mosquito → small bug
  'trv-13': U('photo-1499856871958-5b9627545d1a'),  // Ticket Stub → boarding stub
  'trv-15': U('photo-1568708151706-8c1d9eb84a1f'),  // Scooter → parked Vespa / scooter
  'trv-16': U('photo-1524661135-423995f22d0b'),     // Where to Travel? → world map with pins
  'trv-17': U('photo-1548574505-5e239809ee19'),     // Cruise → cruise ship at sea

  // Education — school days, classrooms, exams, graduation
  'edu-01': U('photo-1455390582262-044cdead277a'),  // Pencil → pencil / notebook
  'edu-02': U('photo-1622260614153-03223fb72052'),  // Backpack → school bag with books
  'edu-03': U('photo-1577896851231-70ef18881754'),  // Teacher → chalkboard
  'edu-04': U('photo-1497436072909-60f360e1d4b1'),  // Bathroom Break → empty school hallway
  'edu-05': U('photo-1571260899304-425eee4c7efc'),  // Group Project → students working
  'edu-06': U('photo-1532094349884-543bc11b234d'),  // Science Class → science lab
  'edu-07': U('photo-1606326608690-4e0281b1e588'),  // Pop Quiz → scantron / answer sheet
  // Detention — moody teen portrait as the AI-side fallback. (Was
  // previously "The Bully"; the rename landed on Detention partly
  // because the original-intent bully photo was impossible to source
  // from Unsplash, and "moody teen in detention" reads naturally
  // for the same image.)
  'edu-08': U('photo-1496345875659-11f7dd282d1d'),  // Detention → moody teen portrait
  'edu-09': U('photo-1481627834876-b7833e8f5570'),  // Library → bookshelves
  'edu-10': U('photo-1576267423445-b2e0074d68a4'),  // Final Exam → exam room
  'edu-11': U('photo-1523580494863-6f3031224c94'),  // Senior Year → graduation cap closeup
  'edu-12': U('photo-1627556704290-2b1f5853ff78'),  // Graduation Day → ceremony / diploma
  'edu-13': U('photo-1571902943202-507ec2618e8f'),  // Physical Ed Class → kids running / gym

  // New balance-pass additions
  'cou-18': U('photo-1518621736915-f3b1c41bfd00'),  // Holding Hands → silhouetted couple
  'fd-17':  U('photo-1547592180-85f173990554'),     // Stew Pot → bubbling soup pot
  'wrk-17': U('photo-1531403009284-440f080d1e12'),  // Colleagues → team around a desk
  'wrk-18': U('photo-1517245386807-bb43f82c33c4'),  // All-Hands Meeting → packed conference room (placeholder, reuses wrk-09's conference-room photo)
  'wrk-19': U('photo-1542744173-8e7e53415bb0'),     // Hired → empty desk / first day office

  // Family Pet micro-set (Animals theme support spells).
  'ani-15': U('photo-1450778869180-41d0601e046e'),  // Belly Rub → dog being petted
  'ani-16': '/cards/good-boy.webp',                  // Good Boy → illustrated petting
  'ani-17': U('photo-1530281700549-e82e7bf110d6'),  // Walkies → dog on a leash mid-walk
};

/**
 * Thematic photo for an AI-controlled card. Falls back to a deterministic
 * picsum.photos seed so every template gets *some* real image — but a
 * picsum fallback means the photo will be visually unrelated to the card.
 * Always prefer adding a real entry above.
 */
export function aiPhoto(templateId: string): string {
  return THEMED[templateId] ?? `https://picsum.photos/seed/lifedeck-${templateId}/400/400`;
}
