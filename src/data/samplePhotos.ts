/**
 * Photo URLs the AI uses for its battlefield creatures so a match looks like
 * a duel between two photo-summoners.
 *
 * Themed Unsplash CDN URLs where the card concept maps cleanly to a photo
 * subject. These need to stay current — when an Unsplash photo gets removed
 * or its ID rotates, SmartImage falls back to picsum.photos/seed which
 * returns a totally random image (e.g. Abuela showed up as a wolf because
 * her ID had rotted). When in doubt, prefer popular long-stable IDs.
 */

const U = (id: string) => `https://images.unsplash.com/${id}?w=400&q=80`;

const THEMED: Record<string, string> = {
  // Family
  'fam-01': U('photo-1543466835-00a7907e9de1'),     // Family Pet → dog
  'fam-02': U('photo-1503454537195-1dcabb73ffb9'),  // Cousin → young person candid portrait
  'fam-03': U('photo-1547592180-85f173990554'),     // Soup → bowl of soup
  'fam-04': U('photo-1521119989659-a83eee488004'),  // Tio → older man w/ story
  'fam-05': U('photo-1438761681033-6461ffad8d80'),  // Mom → smiling woman
  'fam-06': U('photo-1531746020798-e6953c6e8e04'),  // The Look → silhouette
  'fam-07': U('photo-1500648767791-00dcc994a43e'),  // Older Sibling → young adult
  'fam-08': U('photo-1566616213894-2d4e1baee5d8'),  // Abuela → kind grandmother portrait
  'fam-09': U('photo-1535141192574-5d4897c12636'),  // Birthday Cake → cake
  'fam-10': U('photo-1511895426328-dc8714191300'),  // Family Photo → group
  'fam-11': U('photo-1507003211169-0a1dd7228f2d'),  // Dad → man
  'fam-12': U('photo-1414235077428-338989a2e8c0'),  // Sunday Dinner → table
  'fam-13': U('photo-1559839734-2b71ea197ec2'),     // Tough Love → stern parent

  // Work
  'wrk-01': U('photo-1573496359142-b8d87734a5a2'),  // Intern → young employee
  'wrk-02': U('photo-1526374965328-7f61d4dc18c5'),  // Spam Email → screen/code
  'wrk-03': U('photo-1494790108377-be9c29b29330'),  // Coworker → portrait
  'wrk-04': U('photo-1495474472287-4d71bcdd2085'),  // Coffee → mug
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
  'ani-01': U('photo-1425082661705-1834bfd09dca'),  // Mouse → small mouse
  'ani-02': U('photo-1531386151447-fd76ad50012f'),  // Snake Bite → snake
  'ani-03': U('photo-1535241749838-299277b6305f'),  // Rabbit → bunny
  'ani-04': U('photo-1574144611937-0df059b5ef3e'),  // Cat → cat
  'ani-05': U('photo-1543466835-00a7907e9de1'),     // Dog → dog
  'ani-06': U('photo-1543549790-8b5f4a028cfb'),  // Owl → owl portrait (was a leaf-droplet photo when the previous ID rotated)
  'ani-07': U('photo-1601758228041-f3b2795255f1'),  // Treats → pet food
  'ani-08': U('photo-1583337130417-3346a1be7dee'),  // Vet Visit → vet/pet
  'ani-09': U('photo-1485894050903-8e8ee7b071a8'),  // Bear Trap → fence/wire
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
  'trv-08': U('photo-1466354424719-343280fe118b'),  // Layover → departure board
  'trv-09': U('photo-1566073771259-6a8506099945'),  // Hotel → hotel facade
  'trv-10': U('photo-1507525428034-b723cf961d3e'),  // Beach → tropical shore
  'trv-11': U('photo-1540339832862-474599807836'),  // First Class → luxury cabin
  'trv-12': U('photo-1464822759023-fed622ff2c3b'),  // Mountain Summit → peak panorama

  // Food — meals, snacks, coffee, kitchen.
  'fd-01': U('photo-1495474472287-4d71bcdd2085'),  // Coffee Mug → steaming mug
  'fd-02': U('photo-1547592180-85f173990554'),     // Hot Soup → bowl of soup
  'fd-03': U('photo-1599490659213-e2b9527bd087'),  // Snack → chips / bowl of snacks
  'fd-04': U('photo-1490645935967-10de6ba17061'),  // Breakfast Plate → eggs / pancakes
  'fd-05': U('photo-1565299507177-b0ac66763828'),  // Lunch Box → packed meal box
  'fd-06': U('photo-1556909114-f6e7ad7d3136'),     // Slow Cooker → kitchen stove
  'fd-07': U('photo-1455619452474-d2be8b1e70cd'),  // Recipe Card → handwritten recipe
  'fd-08': U('photo-1414235077428-338989a2e8c0'),  // Share the Meal → table set for many
  'fd-09': U('photo-1567620905732-2d1ec7ab7445'),  // Comfort Food → pancake stack
  'fd-10': U('photo-1568571780765-9276ac8b75a2'),  // Grandma's Pie → homemade pie
  'fd-11': U('photo-1583394293214-28ded15ee548'),  // The Cook → chef at the stove
  'fd-12': U('photo-1542010589005-d1eacc3918f2'),  // Family Feast → big spread
  'fd-13': U('photo-1556679343-c7306c1976bc'),     // Sip → glass of water/iced drink

  // Cheap-card pass additions
  'fam-14': U('photo-1542038784456-1ea8e935640e'),  // Hug → embrace
  'wrk-14': U('photo-1531403009284-440f080d1e12'),  // Stand-up Meeting → team gathered
  'wrk-15': U('photo-1554224155-6726b3ff858f'),     // Payroll → ATM / paycheck
  'ani-14': U('photo-1518810827419-c66f7c5b2c63'),  // Mosquito → small bug
  'trv-13': U('photo-1499856871958-5b9627545d1a'),  // Ticket Stub → boarding stub

  // Education — school days, classrooms, exams, graduation
  'edu-01': U('photo-1455390582262-044cdead277a'),  // Pencil → pencil / notebook
  'edu-02': U('photo-1622260614153-03223fb72052'),  // Backpack → school bag with books
  'edu-03': U('photo-1577896851231-70ef18881754'),  // Math Teacher → chalkboard
  'edu-04': U('photo-1497436072909-60f360e1d4b1'),  // Bathroom Break → empty school hallway
  'edu-05': U('photo-1571260899304-425eee4c7efc'),  // Group Project → students working
  'edu-06': U('photo-1532094349884-543bc11b234d'),  // Physics Class → science lab
  'edu-07': U('photo-1606326608690-4e0281b1e588'),  // Pop Quiz → scantron / answer sheet
  // The Bully — Unsplash doesn't really stock "bully" photos. We use
  // a thematic substitute: a moody teen portrait. Previous IDs kept
  // rotating into unrelated stock (water / mountain / cousin photo).
  'edu-08': U('photo-1496345875659-11f7dd282d1d'),  // The Bully → moody teen portrait
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

  // Family Pet micro-set (Animals theme support spells).
  'ani-15': U('photo-1450778869180-41d0601e046e'),  // Belly Rub → dog being petted
  'ani-16': U('photo-1561037404-61cd46aa615b'),     // Good Boy → happy dog face
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
