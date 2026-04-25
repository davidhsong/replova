// ── Mock data shared across pages ───────────────────────────────────────────
const RESTAURANT = { name: 'Bella Napoli', city: 'New York, NY', plan: 'growth' };

const REVIEWS = [
  {
    id: 'r1', author: 'James K.', rating: 2,
    sentiment: 'negative',
    text: "Service was really slow tonight and my pasta came out cold. The waiter was nice but the kitchen was clearly backed up. We waited 45 minutes for our mains. Won't be returning.",
    drafts: {
      professional: "Hi James — thank you for taking the time to share this. A 45-minute wait and cold food fall well below the standard we hold ourselves to, and I want to apologise directly. I'd like the chance to make this right; please reply to this comment with your contact details and I'll be in touch personally. — Maria, GM",
      warm: "Hi James, I'm so sorry. Cold pasta and a long wait is not what we're about and we let you down. I'd love to fix it — please reach out and we'll take care of you on your next visit. Thanks for being honest with us.",
      brief: "Hi James, I sincerely apologise for the slow service and cold food. That's not acceptable. Please contact us directly so we can make it right.",
    },
    status: 'unreplied', urgent: true, hoursAgo: 3,
    keywords: ['slow service','cold food','wait time'],
  },
  {
    id: 'r2', author: 'Priya N.', rating: 1,
    sentiment: 'negative',
    text: "Found a hair in my food and when I raised it with the manager, they were dismissive and offered nothing. Absolutely shocking. Never coming back.",
    drafts: {
      professional: "Priya — I am deeply sorry. Finding something in your food is unacceptable, and how it was handled afterwards compounded the failure. This is not who we are. Please email me directly at maria@bellanapoli.com and I will personally see this resolved.",
      warm: "Priya, I'm so sorry this happened. You deserved better — both with the food and with how we responded. Please reach out to me directly; I want to make it right.",
      brief: "Hi Priya, I sincerely apologise. This is unacceptable and I want to address it immediately. Please contact us directly.",
    },
    status: 'unreplied', urgent: true, hoursAgo: 6,
    keywords: ['hygiene','manager','dismissive'],
  },
  {
    id: 'r3', author: 'Sofia L.', rating: 5,
    sentiment: 'positive',
    text: "Absolutely amazing. The carbonara was the best I've had outside of Rome. Marco the server was attentive without being intrusive — perfect for our anniversary. Will definitely be back.",
    drafts: {
      professional: "Hi Sofia — thank you, this means a lot to our whole team. Comparing the carbonara to Rome is the highest compliment we could ask for. I'll pass on your kind words to Marco. Many congratulations on your anniversary, and we look forward to having you back.",
      warm: "Sofia! What a thing to read on a Monday morning — thank you. Marco will be delighted, and our chef will be insufferable for the rest of the week. Happy anniversary, and please come back soon.",
      brief: "Thank you Sofia. So glad the carbonara hit the mark and that Marco took good care of you. Happy anniversary — see you soon.",
    },
    status: 'unreplied', urgent: false, hoursAgo: 22,
    keywords: ['carbonara','anniversary','Marco'],
  },
  {
    id: 'r4', author: 'Marco R.', rating: 4,
    sentiment: 'positive',
    text: "Truffle pizza was excellent. Service was a bit slow at first but picked up. Would come back for the food alone. Atmosphere is cozy and intimate.",
    drafts: {
      professional: "Hi Marco — thank you for the kind words about the truffle pizza; it's one of the dishes we're most proud of. We hear you on the early service timing and we're always working on consistency. We hope to see you again soon.",
      warm: "Marco, thanks so much! The truffle pizza is a labour of love so this means a lot. Sorry the start was slow — we're on it. Come back any time.",
      brief: "Thank you Marco. Glad you enjoyed the truffle pizza. We'll work on the service timing.",
    },
    status: 'replied', urgent: false, hoursAgo: 5*24,
    keywords: ['truffle pizza','atmosphere','service'],
  },
  {
    id: 'r5', author: 'David W.', rating: 3,
    sentiment: 'mixed',
    text: "Decent. Pasta was a touch overcooked, sauce lacked depth. Staff were friendly. Probably wouldn't go out of my way to return.",
    drafts: {
      professional: "Hi David — thank you for the honest feedback. Glad the team made you feel welcome. We take pasta seriously, so an overcooked plate is a real frustration to read. We'd love a second chance to win you over.",
      warm: "David, thanks for the honesty — overcooked pasta is the kind of feedback our kitchen actually wants. Come back and order something on us, on me.",
      brief: "Thanks David. We'll work on the pasta. Hope to see you again.",
    },
    status: 'unreplied', urgent: false, hoursAgo: 3*24,
    keywords: ['pasta','sauce','consistency'],
  },
  {
    id: 'r6', author: 'Aisha M.', rating: 5,
    sentiment: 'positive',
    text: "Tucked away gem. Wine list is exceptional and the staff (especially Lucia) really know it. The Barolo recommendation made the night.",
    drafts: {
      professional: "Aisha — thank you. Lucia takes the wine list personally and will be thrilled. The Barolo is one of our favourites. Looking forward to your return.",
      warm: "Aisha, thank you! Lucia is going to grin all week. So glad the Barolo landed.",
      brief: "Thank you Aisha. Lucia will be pleased — see you soon.",
    },
    status: 'replied', urgent: false, hoursAgo: 8*24,
    keywords: ['wine list','Lucia','Barolo'],
  },
];

// Reputation score components
const SCORE = {
  total: 78,
  delta: +4,
  rating: { value: 4.3, weight: 0.35, score: 86 },
  volume: { value: 142, weight: 0.20, score: 70 },
  response: { value: 0.91, weight: 0.25, score: 91 },
  sentiment: { value: 0.62, weight: 0.20, score: 62 },
};

const KEYWORDS = [
  { word: 'carbonara', count: 18, sentiment: 'pos' },
  { word: 'service', count: 14, sentiment: 'mixed' },
  { word: 'wine list', count: 9, sentiment: 'pos' },
  { word: 'wait', count: 7, sentiment: 'neg' },
  { word: 'atmosphere', count: 6, sentiment: 'pos' },
  { word: 'truffle pizza', count: 6, sentiment: 'pos' },
  { word: 'pricey', count: 4, sentiment: 'mixed' },
  { word: 'cold food', count: 3, sentiment: 'neg' },
];

const STAFF = [
  { name: 'Marco',   role: 'Front of house', mentions: 9, trend: +2 },
  { name: 'Lucia',   role: 'Sommelier',      mentions: 7, trend: +3 },
  { name: 'Chef Tomás', role: 'Head chef',   mentions: 5, trend: 0 },
];

// 12-week sentiment series (-1..+1)
const SENT_SERIES = [
  0.41, 0.55, 0.62, 0.48, 0.58, 0.66,
  0.71, 0.59, 0.64, 0.52, 0.68, 0.62,
];

// 12-week rating series for competitor chart
const RATING_SERIES = {
  you:    [4.1,4.1,4.2,4.2,4.2,4.2,4.3,4.3,4.3,4.3,4.3,4.3],
  cosa:   [4.4,4.4,4.4,4.4,4.4,4.5,4.5,4.5,4.5,4.5,4.4,4.4],
  ponte:  [4.0,4.0,3.9,3.9,4.0,4.0,4.0,4.0,4.0,4.1,4.1,4.0],
  fiori:  [4.6,4.6,4.7,4.7,4.7,4.7,4.7,4.7,4.7,4.7,4.7,4.7],
};

const COMPETITORS = [
  { id:'fiori', name:'Trattoria Fiori', address:'88 Spring St', rating:4.7, reviews:312, trend:+0.0, slot:1 },
  { id:'cosa',  name:'Cosa Nostra',     address:'214 Mott St',  rating:4.4, reviews:218, trend:-0.1, slot:2 },
  { id:'you',   name:'Bella Napoli',    address:'123 Mulberry St', rating:4.3, reviews:142, trend:+0.1, slot:0, isYou:true },
  { id:'ponte', name:'Il Ponte',        address:'47 Prince St', rating:4.0, reviews:96,  trend:+0.0, slot:3 },
];

const REQUESTS = [
  { id:'q1', name:'Eleanor Hayes',   email:'e.hayes@gmail.com',     status:'clicked', sent:'Apr 21' },
  { id:'q2', name:'Daniel Park',     email:'dpark@hotmail.com',     status:'opened',  sent:'Apr 21' },
  { id:'q3', name:'Rosa Aldana',     email:'rosa@aldana.co',         status:'sent',    sent:'Apr 21' },
  { id:'q4', name:'Tom Whitaker',    email:'tom.w@outlook.com',      status:'clicked', sent:'Apr 20' },
  { id:'q5', name:'Mei Lin',         email:'meilin@proton.me',       status:'opened',  sent:'Apr 20' },
  { id:'q6', name:'Chris Berolzheimer', email:'chrisb@example.com',  status:'sent',    sent:'Apr 20' },
  { id:'q7', name:'Nadia Aboud',     email:'nadia@aboud.io',         status:'pending', sent:'—' },
  { id:'q8', name:'Greg Yi',         email:'greg.yi@example.com',    status:'pending', sent:'—' },
];

Object.assign(window, { RESTAURANT, REVIEWS, SCORE, KEYWORDS, STAFF, SENT_SERIES, RATING_SERIES, COMPETITORS, REQUESTS });
