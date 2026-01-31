import { ReaderSettings, ThemeMode, Book } from '../types';

export const DEFAULT_SETTINGS: ReaderSettings = {
  fontSize: 18,
  lineHeight: 1.6,
  marginHorizontal: 48, // Increased default margin from 32 to 48
  fontFamily: '"Crimson Text", "Noto Serif TC", "Noto Serif SC", serif',
  warmth: 0,
  textAlign: 'justify',
  theme: ThemeMode.Day,
  highContrast: false,
  eInkMode: true,
  twoColumnMode: false,
  chineseConversion: false,
  readingSpeed: 1.0,
  paragraphSpacing: 1.5,
  bilingualMode: false,
  ttsEnabled: false,
};

export const DEMO_BOOK_CONTENT = `
# The Art of Ink

## Chapter 1: The Beginning

Call me Ishmael. Some years ago—never mind how long precisely—having little or no money in my purse, and nothing particular to interest me on shore, I thought I would sail about a little and see the watery part of the world. It is a way I have of driving off the spleen and regulating the circulation. Whenever I find myself growing grim about the mouth; whenever it is a damp, drizzly November in my soul; whenever I find myself involuntarily pausing before coffin warehouses, and bringing up the rear of every funeral I meet; and especially whenever my hypos get such an upper hand of me, that it requires a strong moral principle to prevent me from deliberately stepping into the street, and methodically knocking people's hats off—then, I account it high time to get to sea as soon as I can. This is my substitute for pistol and ball. With a philosophical flourish Cato throws himself upon his sword; I quietly take to the ship. There is nothing surprising in this. If they but knew it, almost all men in their degree, some time or other, cherish very nearly the same feelings towards the ocean with me.

## Chapter 2: The Carpet-Bag

I stuffed a shirt or two into my old carpet-bag, tucked it under my arm, and started for Cape Horn and the Pacific. Quitting the good city of old Manhatto, I duly arrived in New Bedford. It was a Saturday night in December. Much was I disappointed upon learning that the little packet for Nantucket had already sailed, and that no way of reaching that place would offer, till the following Monday.

As most young candidates for the pains and penalties of whaling stop at this same New Bedford, thence to embark on their voyage, it may as well be related that I, for one, had no idea of so doing. For my mind was made up to sail in no other than a Nantucket craft, because there was a fine, boisterous something about everything connected with that famous old island, which amazingly pleased me. Besides though New Bedford has of late been gradually monopolizing the business of the whaling, and though in this matter poor old Nantucket is now much behind her, yet Nantucket was her great original—the Tyre of this Carthage;—the place where the first dead American whale was stranded. Where else but from Nantucket did those aboriginal whalemen, the Red-Men, first sally out in canoes to give chase to the Leviathan? And where but from Nantucket, too, did that first adventurous little sloop put forth, partly laden with imported cobblestones—so goes the story—to throw at the whales, in order to discover when they were nigh enough to risk a harpoon from the bowsprit?

... [This simulates a long book for pagination testing] ...

The town itself is perhaps the dearest place to live in, in all New England.. It is a land of oil, true enough: but not like Canaan; a land, also, of corn and wine. The streets do not run with milk; nor in the spring-time do they pave them with fresh eggs. Yet, in spite of this, nowhere in all America will you find more patrician-like houses; parks and gardens more opulent, than in New Bedford. Whence came they? how planted upon this once scraggy scoria of a country? Go and gaze upon the iron emblematical harpoons round yonder lofty mansion, and your question will be answered. Yes; all these brave houses and flowery gardens came from the Atlantic, Pacific, and Indian oceans. One and all, they were harpooned and dragged up hither from the bottom of the sea. Can Herr Alexander perform a feat like that?

In New Bedford, fathers, they say, give whales for dowrs to their daughters, and portion off their nieces with a few porpoises a-piece. You must go to New Bedford to see a brilliant wedding; for, they say, they have reservoirs of oil in every house, and every night burn their lengths in spermaceti candles.

In summer time, the town is sweet to see; full of fine maples—long avenues of green and gold. And in August, high in air, the beautiful and bountiful horse-chestnuts, candelabra-wise, proffer the passer-by their tapering upright cones of congregated blossoms. So omnipotent is art; which in many a district of New Bedford has superinduced bright terraces of flowers upon the barren refuse rocks thrown aside at creation's final day.

And the women of New Bedford, they bloom like their own red roses. But roses only bloom in summer; whereas the fine carnation of their cheeks is perennial as sunlight in the seventh heavens. Elsewhere match that bloom of theirs, ye cannot, save in Salem, where they tell me the young girls breathe such musk, their sailor sweethearts smell them miles off shore, as though they were drawing nigh the odorous Moluccas instead of the Puritanic sands.
`;

export const DEMO_BOOK: Book = {
  id: 'demo-1',
  title: 'Moby Dick',
  author: 'Herman Melville',
  content: DEMO_BOOK_CONTENT.repeat(5), // Make it long enough to have pages
  progress: 0,
  totalWords: 3000,
  lastRead: Date.now(),
  coverUrl: 'https://picsum.photos/200/300',
  highlights: []
};