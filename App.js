/**
 * 🧬 Money Cells — Expo Snack v11
 * New: Colony graduation (cap 50), Colony Museum, 3-tier performance rendering
 * Fix: JSX ternary brace (line ~1079 bug resolved)
 * 1. Go to https://snack.expo.dev → Cmd+A → delete → paste
 * 2. Scan QR with Expo Go
 */
import React, {
  useState, useEffect, useRef, useReducer,
  createContext, useContext, useCallback, useMemo,
} from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, ActivityIndicator,
  ScrollView, TextInput, Dimensions, SafeAreaView, Modal, Linking,
  Image, Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';

// ── Supabase client ────────────────────────────────────────────────────────
// Replace with your actual project URL and anon key from Supabase dashboard
// Settings → API → Project URL and anon/public key
const SUPABASE_URL  = 'https://wztykysqvnngsnmadrdt.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6dHlreXNxdm5uZ3NubWFkcmR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwMTA5MjUsImV4cCI6MjA5MDU4NjkyNX0.l4qJz6_lX83H1vAxbv5vYWVugtwCl_PXrl6gVMd51Hw'; // Settings → API → anon key

// Custom storage adapter using SecureStore for auth tokens
const ExpoSecureStoreAdapter = {
  getItem:    (key) => SecureStore.getItemAsync(key),
  setItem:    (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

const { width: SW } = Dimensions.get('window');

// ── Theme ──────────────────────────────────────────────────────────────────
const C = {
  // Bright ocean-candy — light backgrounds, vivid accents
  bg:'#f0f9ff',        // sky-50
  surface:'#e0f2fe',   // sky-100
  card:'#ffffff',      // white cards
  border:'#bae6fd',    // sky-200
  green500:'#0284c7',  // sky-600 — primary buttons
  green400:'#0ea5e9',  // sky-500 — main accent
  green300:'#38bdf8',  // sky-400
  green900:'#dbeafe',  // blue-100 — light tint backgrounds
  green700:'#0369a1',  // sky-700
  amber:'#f59e0b', red:'#ef4444', blue:'#3b82f6', purple:'#a855f7',
  orange:'#f97316', cyan:'#06b6d4', pink:'#ec4899',
  text:'#0f172a',      // slate-950
  textMuted:'#64748b', // slate-500
  textFaint:'#94a3b8', // slate-400
  // Legacy aliases used in existing code
  greenL:'#0ea5e9',    // same as green400
  greenD:'#e0f2fe',    // same as surface
  muted:'#64748b',     // same as textMuted
  white:'#0f172a',     // readable dark text on light bg
};

// ── Per-colony accent palette (hue values in HSL, cycles every 5) ──────────
// Colony 1=green, 2=cyan, 3=purple, 4=coral, 5=gold, then repeats
const COLONY_HUES=[130,190,270,10,45];
function colonyAccent(num){return COLONY_HUES[((num||1)-1)%COLONY_HUES.length];}
// Pre-built hex accent colours used in non-HSL contexts (ring, buttons, etc.)
const COLONY_HEX=['#4ade80','#22d3ee','#c084fc','#fb7185','#fbbf24'];
function colonyHex(num){return COLONY_HEX[((num||1)-1)%COLONY_HEX.length];}
// Gem colours for the 5 resistance stars (fixed, independent of colony)
const GEM_COLORS=['#f87171','#fb923c','#facc15','#4ade80','#818cf8'];

// ── Performance tiers ──────────────────────────────────────────────────────
// Tier 1 (≤20): full animations. Tier 2 (21-35): breathe only. Tier 3 (36-50): static dots.
const TIER1_MAX = 20;
const TIER2_MAX = 35;
const COLONY_CAP = 50;        // cells at which colony graduates
const COLONY_WARN = 40;       // cells at which warning amber kicks in
const BONUS_CARRY = 3;        // bonus starter cells carried to next colony

// ── Constants ──────────────────────────────────────────────────────────────
const RATES = { slow:0.02, medium:0.05, fast:0.10 };
const TIMER_MAX = 12;
const FLASH_DEAL_DURATION = 20;
const RESIST_MAX = 100;
const RESIST_GAIN = 22;
const RESIST_LOSS = 30;
const RESIST_BONUS_CELLS = 3;
const KID_AVATARS = ['🦁','🐼','🦊','🐸','🐙','🦋','🐧','🦄'];
const TIMER_OPTIONS = [
  {label:'5 min',value:5*60},{label:'10 min',value:10*60},
  {label:'15 min',value:15*60},{label:'20 min',value:20*60},
];
const DISH = Math.min(SW-48, 290);
const CR = 11, CSIZE = CR*2;
let _id = 0;

// ── Shop Items ─────────────────────────────────────────────────────────────
const SHOP_ITEMS = [
  {id:'yoyo',     emoji:'🪀',name:'Yo-yo',          cost:6,  color:C.amber  },
  {id:'puzzle',   emoji:'🧩',name:'Puzzle Set',      cost:10, color:C.blue   },
  {id:'bear',     emoji:'🧸',name:'Teddy Bear',      cost:15, color:'#ec4899'},
  {id:'unicorn',  emoji:'🦄',name:'Stuffed Unicorn', cost:20, color:C.purple },
  {id:'artkit',   emoji:'🎨',name:'Art Kit',         cost:25, color:C.amber  },
  {id:'lego',     emoji:'🏗️',name:'Building Blocks', cost:30, color:C.blue   },
  {id:'train',    emoji:'🚂',name:'Toy Train Set',   cost:40, color:C.red    },
  {id:'telescope',emoji:'🔭',name:'Mini Telescope',  cost:50, color:C.blue   },
  {id:'controller',emoji:'🎮',name:'Game Controller',cost:60, color:C.green500},
  {id:'robot',    emoji:'🤖',name:'Robot Toy',       cost:80, color:C.green400},
];

// ── Amazon Demo Catalog ────────────────────────────────────────────────────
const AMAZON_CATALOG = [
  {id:'az1', emoji:'🦕',name:'Dinosaur Plush Set (5 pack)',  category:'Stuffed Animals',priceUsd:16.99,searchQ:'dinosaur plush stuffed animal set kids'},
  {id:'az2', emoji:'🎨',name:'Crayola Art Studio Kit',       category:'Arts & Crafts',  priceUsd:24.97,searchQ:'crayola art studio kit kids'},
  {id:'az3', emoji:'🧩',name:'Melissa & Doug Floor Puzzle',  category:'Puzzles',        priceUsd:12.99,searchQ:'melissa doug floor puzzle kids 100 piece'},
  {id:'az4', emoji:'🚗',name:'Hot Wheels 20-Car Gift Pack',  category:'Vehicles',       priceUsd:19.88,searchQ:'hot wheels 20 car gift pack'},
  {id:'az5', emoji:'🤖',name:'LEGO Classic Creative Bricks', category:'Building',       priceUsd:29.99,searchQ:'lego classic creative bricks set'},
  {id:'az6', emoji:'🎮',name:'Nintendo Switch Game',         category:'Games',          priceUsd:39.99,searchQ:'nintendo switch game kids family'},
  {id:'az7', emoji:'🔭',name:'Educational Telescope',        category:'Science',        priceUsd:34.95,searchQ:'educational insights beginners telescope kids'},
  {id:'az8', emoji:'🪆',name:'Learning Resources Toys',      category:'Educational',    priceUsd:18.99,searchQ:'learning resources educational toys kids'},
  {id:'az9', emoji:'🎸',name:'Kids Ukulele Starter Kit',     category:'Music',          priceUsd:29.95,searchQ:'kids ukulele starter kit beginners'},
  {id:'az10',emoji:'🧸',name:'GUND Soft Teddy Bear',         category:'Stuffed Animals',priceUsd:21.99,searchQ:'gund teddy bear plush soft'},
  {id:'az11',emoji:'🎯',name:'Nerf Rival Blaster',           category:'Outdoor',        priceUsd:22.99,searchQ:'nerf rival blaster kids outdoor'},
  {id:'az12',emoji:'🌍',name:'LeapFrog Globe',               category:'Educational',    priceUsd:49.99,searchQ:'leapfrog interactive globe kids learning'},
  {id:'az13',emoji:'🎪',name:'Puppet Theater Set',           category:'Pretend Play',   priceUsd:59.99,searchQ:'melissa doug puppet theater kids'},
  {id:'az14',emoji:'🏄',name:'Boogie Board Kids Tablet',     category:'Tech',           priceUsd:29.99,searchQ:'boogie board kids lcd writing tablet'},
  {id:'az15',emoji:'🪀',name:'Duncan Butterfly Yo-Yo',       category:'Toys',           priceUsd:7.99, searchQ:'duncan butterfly yo-yo classic'},
];
// ── Cellie AI endpoint ────────────────────────────────────────────────────
// AI endpoints — baked in at build time from .env (EXPO_PUBLIC_* vars)
const CELLIE_URL        = process.env.EXPO_PUBLIC_CELLIE_URL        || null;
const CELLIE_VISION_URL = process.env.EXPO_PUBLIC_CELLIE_VISION_URL || null;
const CELLIE_IMAGE_URL  = process.env.EXPO_PUBLIC_CELLIE_IMAGE_URL  || null;

function openAmazon(query,tag){Linking.openURL(`https://www.amazon.com/s?k=${encodeURIComponent(query)}&tag=${tag||'moneycells-20'}&linkCode=ur2`).catch(()=>{});}

// ══════════════════════════════════════════════════════════════════════════
// 🧬 CELLIE CHALLENGE — question repository
// 30 questions: cell_biology (10) + compound_growth (10) + money_science (10)
// difficulty: easy (+1 cell) or medium (+2 cells)
// Each: {id, topic, difficulty, q, choices[3], answer(0-2), because, reward}
// ══════════════════════════════════════════════════════════════════════════
const QUIZ_QUESTIONS = [
  // ── CELL BIOLOGY ──────────────────────────────────────────────────────
  {id:'cb01',topic:'cell_biology',difficulty:'easy',reward:1,
    q:'What do scientists call it when one cell splits into two?',
    choices:['Mitosis','Digestion','Evaporation'],answer:0,
    because:'Mitosis is the name for cell division — one cell becomes two perfect copies!'},
  {id:'cb02',topic:'cell_biology',difficulty:'easy',reward:1,
    q:'What is the "brain" of a cell called?',
    choices:['The membrane','The nucleus','The cytoplasm'],answer:1,
    because:'The nucleus holds DNA — the instructions that tell the cell what to do!'},
  {id:'cb03',topic:'cell_biology',difficulty:'easy',reward:1,
    q:'About how many cells are in a human body?',
    choices:['1 thousand','37 trillion','200 million'],answer:1,
    because:'Your body has roughly 37 trillion cells — that\'s 37,000,000,000,000!'},
  {id:'cb04',topic:'cell_biology',difficulty:'easy',reward:1,
    q:'What is the outer wall of a cell called?',
    choices:['The nucleus','The organelle','The membrane'],answer:2,
    because:'The membrane is the protective layer that holds everything inside the cell!'},
  {id:'cb05',topic:'cell_biology',difficulty:'easy',reward:1,
    q:'What does DNA stand for?',
    choices:['Deoxyribonucleic acid','Daily nutrient acid','Digital number array'],answer:0,
    because:'DNA carries the instructions for how a living thing grows and works!'},
  {id:'cb06',topic:'cell_biology',difficulty:'medium',reward:2,
    q:'What is the tiny bright dot inside a nucleus called?',
    choices:['Organelle','Nucleolus','Mitochondria'],answer:1,
    because:'The nucleolus is a small structure inside the nucleus that helps make proteins!'},
  {id:'cb07',topic:'cell_biology',difficulty:'medium',reward:2,
    q:'What do we call the jelly-like liquid inside a cell?',
    choices:['Cytoplasm','Blood plasma','Cell juice'],answer:0,
    because:'Cytoplasm fills the cell and holds all the tiny organelles in place!'},
  {id:'cb08',topic:'cell_biology',difficulty:'medium',reward:2,
    q:'What is a petri dish used for?',
    choices:['Eating soup','Growing tiny living things in a lab','Mixing paint'],answer:1,
    because:'Scientists grow bacteria and cells in petri dishes to study how life works!'},
  {id:'cb09',topic:'cell_biology',difficulty:'medium',reward:2,
    q:'When a cell divides, how many new cells are made?',
    choices:['One','Two','Four'],answer:1,
    because:'One parent cell splits into exactly two daughter cells — each a perfect copy!'},
  {id:'cb10',topic:'cell_biology',difficulty:'medium',reward:2,
    q:'Which part of the cell controls what goes in and out?',
    choices:['The nucleus','The membrane','The nucleolus'],answer:1,
    because:'The cell membrane acts like a doorman — controlling what enters and exits!'},

  // ── COMPOUND GROWTH ───────────────────────────────────────────────────
  {id:'cg01',topic:'compound_growth',difficulty:'easy',reward:1,
    q:'If you start with 1 and double it 10 times, what do you get?',
    choices:['20','1,024','200'],answer:1,
    because:'1→2→4→8→16→32→64→128→256→512→1024. Doubling grows FAST!'},
  {id:'cg02',topic:'compound_growth',difficulty:'easy',reward:1,
    q:'What do rabbits, bacteria, and your money cells have in common?',
    choices:['They all smell bad','They all multiply over time','They all live in water'],answer:1,
    because:'All three grow by multiplication — one becomes two, two become four, and so on!'},
  {id:'cg03',topic:'compound_growth',difficulty:'easy',reward:1,
    q:'A snowball rolling downhill gets bigger because it picks up more snow each second. What does this remind you of?',
    choices:['Melting ice','Compound growth','Weather patterns'],answer:1,
    because:'Compound growth is just like a snowball — the bigger it gets, the faster it grows!'},
  {id:'cg04',topic:'compound_growth',difficulty:'easy',reward:1,
    q:'If bacteria double every hour, how many will there be after 3 hours starting from 1?',
    choices:['3','6','8'],answer:2,
    because:'1→2→4→8. Doubling three times gives you 8 — that\'s exponential growth!'},
  {id:'cg05',topic:'compound_growth',difficulty:'easy',reward:1,
    q:'What is the word scientists use for growth that keeps doubling?',
    choices:['Exponential','Diagonal','Rectangular'],answer:0,
    because:'Exponential growth means the amount grows by multiplying, not just adding!'},
  {id:'cg06',topic:'compound_growth',difficulty:'medium',reward:2,
    q:'A lily pad doubles every day. It covers half a pond on day 29. When does it cover the whole pond?',
    choices:['Day 58','Day 30','Day 45'],answer:1,
    because:'Since it doubles, half the pond on day 29 becomes the full pond on day 30!'},
  {id:'cg07',topic:'compound_growth',difficulty:'medium',reward:2,
    q:'Which grows faster: adding 5 every day, or doubling every day starting from 1?',
    choices:['Adding 5','Doubling','They\'re the same'],answer:1,
    because:'Doubling wins every time — after 10 days: adding gives 50, doubling gives 1,024!'},
  {id:'cg08',topic:'compound_growth',difficulty:'medium',reward:2,
    q:'In nature, what happens to a population of animals when food is unlimited?',
    choices:['It stays the same','It shrinks','It grows exponentially'],answer:2,
    because:'With unlimited food, animals reproduce freely and populations grow exponentially!'},
  {id:'cg09',topic:'compound_growth',difficulty:'medium',reward:2,
    q:'What pattern appears in sunflower seeds, pinecones, and galaxies?',
    choices:['Fibonacci sequence','Random scatter','Square pattern'],answer:0,
    because:'The Fibonacci sequence (1,1,2,3,5,8...) appears everywhere in nature\'s growth!'},
  {id:'cg10',topic:'compound_growth',difficulty:'medium',reward:2,
    q:'If a cell colony doubles every round, after how many rounds does 1 cell become 16?',
    choices:['4 rounds','8 rounds','16 rounds'],answer:0,
    because:'1→2→4→8→16. Just 4 doublings turns 1 into 16! Like folding a piece of paper — fold it 42 times and it would reach the Moon. That\'s the wild power of compounding!'},

  // ── MONEY SCIENCE ─────────────────────────────────────────────────────
  {id:'ms01',topic:'money_science',difficulty:'easy',reward:1,
    q:'The bank pays you a thank-you gift just for keeping your money there. What is that gift called?',
    choices:['Interest — bonus money for saving!','Inflation','Investment'],answer:0,
    because:'Interest is the bank\'s thank-you gift for letting them borrow your money! You save $10, they use it, and give back $10.50 — that extra 50 cents is interest.'},
  {id:'ms02',topic:'money_science',difficulty:'easy',reward:1,
    q:'If you save $1 that earns 5% each year, after 2 years you have more than $1.10 — why?',
    choices:['Magic','The bank made a mistake','You earned interest on your interest'],answer:2,
    because:'That\'s compound interest — earning on your earnings! Like a snowball: Year 1: $1.05. Year 2: $1.05 × 1.05 = $1.1025. The snowball keeps growing!'},
  {id:'ms03',topic:'money_science',difficulty:'easy',reward:1,
    q:'What do we call money that loses value over time as prices rise?',
    choices:['Inflation','Deflation','Interest'],answer:0,
    because:'Inflation means prices go up — the same $10 buys less stuff each year!'},
  {id:'ms04',topic:'money_science',difficulty:'easy',reward:1,
    q:'Why is it better to save early rather than late?',
    choices:['It\'s not — saving time doesn\'t matter','Early savings grow longer through compound interest','Banks prefer young savers'],answer:1,
    because:'Time is the secret ingredient! Think of compound interest like a fruit tree — the longer it grows, the more fruit it makes. Plant money early and it grows into a forest!'},
  {id:'ms05',topic:'money_science',difficulty:'easy',reward:1,
    q:'You spend $5 on candy instead of saving it. What do you give up? Grown-ups call this...',
    choices:['The price of a ticket','Opportunity cost — what that $5 could have grown into!','The cost of opportunity'],answer:1,
    because:'Every time you spend, you give up what that money could have grown into — like cutting down a fruit tree to eat one apple! Grown-ups call this opportunity cost.'},
  {id:'ms06',topic:'money_science',difficulty:'medium',reward:2,
    q:'$100 at 7% interest for 10 years becomes about how much?',
    choices:['$170','$197','$300'],answer:1,
    because:'Compound interest formula: $100 × (1.07)^10 ≈ $197. Nearly double!'},
  {id:'ms07',topic:'money_science',difficulty:'medium',reward:2,
    q:'Warren Buffett made most of his wealth after what age?',
    choices:['30','60','80'],answer:1,
    because:'Buffett started saving young and just... waited. Like a snowball rolled for decades. 90% of his wealth came AFTER age 60 — the snowball just kept getting bigger and bigger!'},
  {id:'ms08',topic:'money_science',difficulty:'medium',reward:2,
    q:'Prices go up 3% each year (like ice cream melting!). Your savings only grow 2%. Are you getting richer?',
    choices:['Yes — any growth is good!','No — prices rise faster than savings, so I\'m losing ground','It depends on the bank'],answer:1,
    because:'Inflation means prices creep up every year — like ice cream slowly melting. Your savings (2%) grew slower than prices (3%), so you\'re actually losing ground. You need savings to BEAT inflation!'},
  {id:'ms09',topic:'money_science',difficulty:'medium',reward:2,
    q:'The "Rule of 72" is a money cheat code! Divide 72 by your savings rate to find out what?',
    choices:['How much interest you earn each year','How many years until your money doubles!','Your total savings amount'],answer:1,
    because:'72 ÷ 6% = 12 years to double your money! It\'s a quick trick — like a cheat code for maths. Divide 72 by your interest rate and that\'s how long before your money doubles like magic!'},
  {id:'ms10',topic:'money_science',difficulty:'medium',reward:2,
    q:'What is the best analogy for compound interest?',
    choices:['A leaking bucket','A snowball rolling downhill','A straight road'],answer:1,
    because:'Like a snowball, compound interest starts small and grows faster and faster as it rolls!'},

  // ── CELL BIOLOGY — HARD ───────────────────────────────────────────────
  {id:'cb11',topic:'cell_biology',difficulty:'hard',reward:3,
    q:'What is the powerhouse of the cell?',
    choices:['The nucleus','The mitochondria','The membrane'],answer:1,
    because:'Mitochondria convert food into energy the cell can use — like a tiny battery factory!'},
  {id:'cb12',topic:'cell_biology',difficulty:'hard',reward:3,
    q:'What happens to a cell\'s chromosomes just before it divides?',
    choices:['They disappear','They duplicate so each new cell gets a full set','They shrink in half'],answer:1,
    because:'Before dividing, DNA copies itself so both new cells get identical complete instructions!'},
  {id:'cb13',topic:'cell_biology',difficulty:'hard',reward:3,
    q:'Which type of cell has no nucleus?',
    choices:['Animal cell','Plant cell','Bacteria cell'],answer:2,
    because:'Bacteria are prokaryotes — their DNA floats freely with no nucleus wrapper!'},
  {id:'cb14',topic:'cell_biology',difficulty:'hard',reward:3,
    q:'What does a cell wall do that a cell membrane does NOT?',
    choices:['Controls what enters','Provides rigid structure and extra protection','Makes energy'],answer:1,
    because:'Cell walls (in plants and bacteria) are stiff and protective — membranes are flexible!'},
  {id:'cb15',topic:'cell_biology',difficulty:'hard',reward:3,
    q:'If one bacterium divides every 20 minutes, how many are there after 1 hour?',
    choices:['3','6','8'],answer:2,
    because:'20 min → 2, 40 min → 4, 60 min → 8. Three doublings in one hour!'},

  // ── COMPOUND GROWTH — HARD ────────────────────────────────────────────
  {id:'cg11',topic:'compound_growth',difficulty:'hard',reward:3,
    q:'You invest $100 at 10% per year. After 7.2 years you have roughly how much?',
    choices:['$172','$200','$172'],answer:1,
    because:'The Rule of 72: 72 ÷ 10% = 7.2 years to double. $100 becomes ~$200!'},
  {id:'cg12',topic:'compound_growth',difficulty:'hard',reward:3,
    q:'What is the difference between simple and compound interest?',
    choices:['Simple earns more','Compound earns interest on interest too','They are the same'],answer:1,
    because:'Simple interest only earns on your original amount. Compound earns on the total including past interest — so it snowballs!'},
  {id:'cg13',topic:'compound_growth',difficulty:'hard',reward:3,
    q:'A colony of 2 cells doubles every round. How many rounds to reach 64 cells?',
    choices:['5 rounds','6 rounds','32 rounds'],answer:0,
    because:'2→4→8→16→32→64. Five doublings! Exponential growth reaches big numbers fast.'},
  {id:'cg14',topic:'compound_growth',difficulty:'hard',reward:3,
    q:'Why does starting to save at age 10 vs age 20 make such a big difference?',
    choices:['Banks give bonuses to young people','10 extra years of compounding multiplies wealth dramatically','It does not make a difference'],answer:1,
    because:'At 7% growth, money doubles every ~10 years. Starting 10 years earlier means one extra doubling — your final amount is roughly TWICE as large!'},
  {id:'cg15',topic:'compound_growth',difficulty:'hard',reward:3,
    q:'Which chart shape represents compound growth?',
    choices:['A straight line going up','A J-shaped curve that gets steeper','A flat horizontal line'],answer:1,
    because:'Compound growth produces a J-curve — slow at first then dramatically steeper. That J is what your cell colony makes!'},

  // ── MONEY SCIENCE — HARD ─────────────────────────────────────────────
  {id:'ms11',topic:'money_science',difficulty:'hard',reward:3,
    q:'If inflation is 4% and your savings earn 6%, what is your REAL return?',
    choices:['10%','2%','6%'],answer:1,
    because:'Real return = interest rate minus inflation. 6% - 4% = 2% real growth. You need to beat inflation to actually get richer!'},
  {id:'ms12',topic:'money_science',difficulty:'hard',reward:3,
    q:'Warren Buffett started investing at age 11 and has $100B+ now. What is his biggest advantage?',
    choices:['He was lucky','He had the most time for compounding to work','He earned the highest returns'],answer:1,
    because:'Buffett\'s returns are good but not the highest ever. His real superpower is TIME — 80+ years of compounding!'},
  {id:'ms13',topic:'money_science',difficulty:'hard',reward:3,
    q:'You have $50. Option A: spend it on a game. Option B: invest it at 7% for 10 years. What is option B worth?',
    choices:['$57','$85','$98'],answer:2,
    because:'$50 × (1.07)^10 ≈ $98. That game cost you almost $100 in future value — that\'s opportunity cost!'},
  {id:'ms14',topic:'money_science',difficulty:'hard',reward:3,
    q:'What is a stock?',
    choices:['A loan to a company','A tiny piece of ownership in a company','Money stored in a bank'],answer:1,
    because:'Buying stock means owning a small piece of a company. If the company grows, your piece is worth more!'},
  {id:'ms15',topic:'money_science',difficulty:'hard',reward:3,
    q:'Why do banks pay you interest on savings accounts?',
    choices:['They are being generous','They lend your money to others and share the profit','The government makes them'],answer:1,
    because:'Banks take your savings, lend it to people who need loans, charge those people interest, and share some of it back with you. Your money is working while you sleep!'},

  // ── GAME MECHANICS ────────────────────────────────────────────────────
  {id:'gm01',topic:'money_science',difficulty:'easy',reward:1,
    q:'In Money Cells, what happens to a cell you spend?',
    choices:['It multiplies twice as fast','It disappears forever and cannot grow','It turns amber'],answer:1,
    because:'Spent cells burst and vanish — just like real money. Once it\'s gone it can\'t earn interest anymore!'},
  {id:'gm02',topic:'money_science',difficulty:'easy',reward:1,
    q:'What does the Resistance Meter reward you for?',
    choices:['Spending all your cells','Saving without spending','Playing fast'],answer:1,
    because:'Every round you resist spending fills your Resistance Meter. Fill it completely and you earn bonus cells — your willpower literally pays off!'},
  {id:'gm03',topic:'money_science',difficulty:'easy',reward:1,
    q:'Why should you think twice before accepting a Flash Deal?',
    choices:['Flash Deals always save money','The timer tricks your brain into spending without thinking','Flash Deals give bonus cells'],answer:1,
    because:'Flash Deals create urgency on purpose — shops use this trick to make you spend before you have time to think. Pause and ask: would I want this tomorrow?'},
  {id:'gm04',topic:'money_science',difficulty:'medium',reward:2,
    q:'Your colony has 20 cells at medium rate (5%). How many new cells appear next round?',
    choices:['1 cell','5 cells','10 cells'],answer:0,
    because:'20 × 0.05 = 1 new cell. At medium rate only 1 in 20 cells splits per round — small but it compounds over time!'},
  {id:'gm05',topic:'money_science',difficulty:'medium',reward:2,
    q:'What is the real-world lesson when your colony goes extinct?',
    choices:['Spending is always bad','If you spend everything there is nothing left to grow','Fast rate is risky'],answer:1,
    because:'An extinct colony is like spending your last dollar. Zero dollars earn zero interest. You must always keep some to keep growing — Warren Buffett\'s rule: never lose your principal!'},

  // ── SAVING HABITS ─────────────────────────────────────────────────────
  {id:'sh01',topic:'money_science',difficulty:'easy',reward:1,
    q:'What is an emergency fund?',
    choices:['Money for fun treats','Savings set aside for unexpected problems','A bank account for kids'],answer:1,
    because:'An emergency fund is your safety net — money saved for surprise expenses like a broken phone or unexpected bill. It means surprises don\'t turn into disasters!'},
  {id:'sh02',topic:'money_science',difficulty:'easy',reward:1,
    q:'What does it mean to "pay yourself first"?',
    choices:['Buy yourself a treat each week','Save money before spending on anything else','Ask your parents for more money'],answer:1,
    because:'Paying yourself first means moving money to savings the moment you get it — before you can spend it. It\'s the secret habit of most wealthy people!'},
  {id:'sh03',topic:'money_science',difficulty:'medium',reward:2,
    q:'The 50/30/20 rule says to split your money how?',
    choices:['50% save, 30% spend, 20% give','50% needs, 30% wants, 20% savings','50% food, 30% fun, 20% school'],answer:1,
    because:'50% for things you need (food, transport), 30% for things you want (fun), 20% into savings. A simple budget that works at any age!'},
  {id:'sh04',topic:'money_science',difficulty:'medium',reward:2,
    q:'What is the difference between a want and a need?',
    choices:['Needs cost more than wants','Needs are essential for survival, wants are extras','There is no difference'],answer:1,
    because:'Needs: food, shelter, clothing, transport. Wants: games, candy, toys. Knowing the difference is the foundation of smart spending!'},
  {id:'sh05',topic:'money_science',difficulty:'hard',reward:3,
    q:'You want a $120 toy. You get $10 allowance a week. If you save 50% each week, how many weeks to buy it?',
    choices:['12 weeks','24 weeks','6 weeks'],answer:1,
    because:'$10 × 50% = $5 saved per week. $120 ÷ $5 = 24 weeks. That\'s goal-based saving — and you\'d still have $5 fun money every week!'},
];

// ── Content ────────────────────────────────────────────────────────────────
const ROUND_STORIES = [
  {emoji:'🌱',title:'Your cells had babies!',    body:"Every saved cell made a tiny new one. Like planting a seed!"},
  {emoji:'🍪',title:'Cookies made more cookies!',body:"Every cookie in your jar magically made a new one!"},
  {emoji:'⛄',title:'Snowball getting bigger!',  body:"The more you save, the BIGGER it grows all by itself!"},
  {emoji:'🐰',title:'Bunnies everywhere!',       body:"Your saved cells are just like bunnies — they keep multiplying!"},
  {emoji:'🎈',title:'New cells appeared!',       body:"Every cell you didn't spend grew a baby. Now you have MORE!"},
  {emoji:'🌊',title:'Waves getting bigger!',     body:"A small wave gets bigger and bigger. Same with savings!"},
];

// Shown when growth rate is too low to produce new cells this round
const NO_GROWTH_STORIES = [
  {emoji:'🌰',title:'Cells resting this round',  body:"At a slow rate it takes a few rounds to grow. Keep saving — it's building up!"},
  {emoji:'💤',title:'Slow and steady...',         body:"No new cells this round, but your colony is still here. Switch to medium rate to grow faster!"},
  {emoji:'🐢',title:'Turtles take their time!',  body:"Slow compounding means not every round produces babies. Save more cells to speed things up!"},
  {emoji:'🪴',title:'Seeds are germinating',     body:"Growth is happening slowly. Save more rounds and you'll see cells multiply!"},
];
const BADGE_INFO = {
  first_split: {emoji:'🌱',label:'First Baby Cells!', kidLesson:"WOW! 🎉\n\nYour cells made NEW cells! Like a dollar that woke up with a little brother!", example:'Saved 10 → made a new friend!'},
  first_double:{emoji:'💰',label:'Double Trouble!',   kidLesson:"🤯 Your money DOUBLED!\n\nImagine 10 cookies → sleep → wake up with 20. For FREE!",              example:'Starting cells × 2 = NOW cells ✨'},
  streak_3:    {emoji:'🔥',label:'3-Round Saver!',    kidLesson:"⛄ You're like a snowball!\n\nEvery round you save makes your cells multiply FASTER!",              example:'Save every round → faster growth!'},
  colony_50:   {emoji:'⭐',label:'50 Cells!',          kidLesson:"🎊 50 cells!\n\nYou grew to $50 just by NOT spending. Pretty cool!",                              example:'Started small → 50 cells!'},
  resist_full: {emoji:'💪',label:'Willpower Master!', kidLesson:"🏆 Your Resistance Meter filled up!\n\nBy NOT spending, your cells multiplied AND you got bonus cells!", example:'Resisted spending → earned BONUS cells!'},
  first_grad:  {emoji:'🎓',label:'Colony Graduated!', kidLesson:"🎓 Your colony reached 50 cells and GRADUATED!\n\nIt's like your money grew so much it needed a bigger home!", example:'Colony #1 complete → Museum!'},
  multi_grad:  {emoji:'🏛️',label:'Museum Collector!', kidLesson:"🏛️ You have 3+ graduated colonies in your museum!\n\nYou're a real colony scientist now!",            example:'3 colonies raised → master!'},
};
const RATE_STORIES = {
  slow:  {emoji:'🐢',speed:'Slow',  desc:'~2 new baby cells per 100 saved', analogy:'Like a turtle — takes more rounds, but every cell still counts!'},
  medium:{emoji:'🐇',speed:'Medium',desc:'~5 new baby cells per 100 saved', analogy:'Like a rabbit — a new cell pops up every few hops!'},
  fast:  {emoji:'⚡',speed:'Fast',  desc:'~10 new baby cells per 100 saved',analogy:'Like a rocket — cells multiply fast but you have less time to decide!'},
};

// ── Game Engine ────────────────────────────────────────────────────────────
function cellSeed(id){return id.split('').reduce((a,c)=>a+c.charCodeAt(0),0);}
function makeCell(baseHue=130){
  let x,y,tries=0;
  do{x=Math.random();y=Math.random();tries++;}
  while(Math.sqrt((x-.5)**2+(y-.5)**2)>.42&&tries<50);
  const id=`c${++_id}_${Math.random().toString(36).slice(2,5)}`;
  const s=cellSeed(id);
  const organelles=[
    {angle:(s%100)/100*Math.PI*2,        dist:0.30+(s%5)*0.02},
    {angle:(s%100)/100*Math.PI*2+2.094,  dist:0.28+(s%4)*0.02},
    {angle:(s%100)/100*Math.PI*2+4.189,  dist:0.32+(s%3)*0.02},
  ];
  const elongAngle=(s%314)/100*Math.PI;
  return{id,x,y,spendState:'none',pendingAt:null,marked:false,isNew:true,burst:false,splitting:false,
    breathOffset:(s%100)/100*Math.PI*2,breathSpeed:1400+(s%800),
    floatSeedX:(s%10)/10*Math.PI*2,floatSeedY:((s*7)%10)/10*Math.PI*2,
    floatSpeedX:2000+(s%1200),floatSpeedY:1800+((s*3)%1400),
    nucleusOX:(s%7)-3,nucleusOY:((s*3)%7)-3,
    hue:baseHue+(s%5)*8,
    elongAngle,
    organelles,
  };
}
function scatter(n,baseHue=130){return Array.from({length:n},()=>makeCell(baseHue));}

// Build a retired colony record from current game state
function retireColony(state){
  const live=state.cells.filter(c=>!c.burst);
  return{
    colonyNum:state.colonyNumber||1,
    cells:live.length,
    rounds:state.totalRounds||0,
    bestStreak:state.bestStreak||0,
    badges:[...state.badges],
    owned:[...state.owned],
    retiredAt:new Date().toLocaleDateString(),
  };
}

function pickFlashDeal(ownedIds=[]){
  const eligible=SHOP_ITEMS.filter(i=>!ownedIds.includes(i.id)&&i.cost>=6);
  if(!eligible.length)return null;
  const item=eligible[Math.floor(Math.random()*eligible.length)];
  const discount=0.55+Math.random()*0.15;
  return{itemId:item.id,emoji:item.emoji,name:item.name,originalCost:item.cost,
    dealCost:Math.max(2,Math.round(item.cost*discount)),color:item.color,secondsLeft:FLASH_DEAL_DURATION};
}

function createGame(name,principal,rate,wishId,colonyNumber=1,bonusStarters=0,initialGoal=null){
  // Cap starting cells at COLONY_CAP-1 so the colony doesn't immediately
  // graduate on the first round regardless of principal chosen
  const startCells=Math.min(principal+bonusStarters, COLONY_CAP-1);
  // Resolve initial goal — accept full goal object OR look up by id in catalogs
  const resolvedGoal=initialGoal||
    (wishId?(SHOP_ITEMS.find(i=>i.id===wishId)||AMAZON_CATALOG.find(i=>i.id===wishId)):null);
  const goals=resolvedGoal
    ?[{...resolvedGoal,
       cost:resolvedGoal.cost||(resolvedGoal.priceUsd?Math.round(resolvedGoal.priceUsd*100):20),
       color:resolvedGoal.color||C.orange,
       status:'saving',addedAt:Date.now()}]
    :[];
  const baseHue=colonyAccent(colonyNumber);
  return{name,principal,rate,
    cells:scatter(startCells,baseHue).map(c=>({...c,isNew:false})),
    phase:'active',round:1,streak:0,bestStreak:0,level:1,
    timer:TIMER_MAX,badges:[],history:[],
    owned:[],wishTarget:resolvedGoal?.isAmazon?null:(resolvedGoal?.id||null),
    amazonGoal:resolvedGoal?.isAmazon?resolvedGoal:null,
    goals,
    totalRounds:0,totalSpent:0,lifetimeCellsGained:0,
    resistMeter:0,resistBonusThisGame:0,
    flashDeal:null,flashDealExpiredMsg:null,
    colonyNumber,
    retiredColonies:[],
    totalLifetimeCells:0,
    hasSeenOnboarding:false,  // shows petri dish intro on first play
    seenQuestions:[],          // IDs of questions already shown this colony
    roundInteractions:0,       // cell taps this round — gate requires >=1 when colony>=10
  };
}

function resolveRound(state){
  const kept=state.cells.filter(c=>c.spendState!=='confirmed');
  const spent=state.cells.filter(c=>c.spendState==='confirmed');
  const r=RATES[state.rate];
  const newCount=Math.floor(kept.length*r)+(Math.random()<(kept.length*r%1)?1:0);
  const afterCount=kept.length+newCount;
  const streak=spent.length===0?state.streak+1:0;
  const bestStreak=Math.max(state.bestStreak||0,streak);

  // Resistance meter
  let resistMeter=state.resistMeter||0;
  let bonusCells=0, newBadges=[...state.badges], resistBonusThisGame=state.resistBonusThisGame||0;
  if(spent.length===0){resistMeter=Math.min(RESIST_MAX,resistMeter+RESIST_GAIN);}
  else{resistMeter=Math.max(0,resistMeter-RESIST_LOSS);}
  if(resistMeter>=RESIST_MAX){bonusCells=RESIST_BONUS_CELLS;resistMeter=0;resistBonusThisGame++;if(!newBadges.includes('resist_full'))newBadges.push('resist_full');}

  // Standard badges
  if(state.round===1&&kept.length>0&&!newBadges.includes('first_split'))newBadges.push('first_split');
  if(afterCount>=state.principal*2&&!newBadges.includes('first_double'))newBadges.push('first_double');
  if(streak>=3&&!newBadges.includes('streak_3'))newBadges.push('streak_3');
  if(afterCount>=50&&!newBadges.includes('colony_50'))newBadges.push('colony_50');

  // Hard cap: never let cells exceed COLONY_CAP in any branch
  const cappedNew  = Math.max(0, Math.min(newCount+bonusCells, COLONY_CAP - kept.length));
  const totalAfter = Math.min(kept.length + cappedNew, COLONY_CAP);
  const level=totalAfter>=state.level*20?state.level+1:state.level;

  // ── BUST CHECK — all cells spent, colony extinct ──────────────────────
  if(kept.length===0){
    return{...state,
      cells:[...spent.map(c=>({...c,burst:true}))],
      phase:'extinct',
      round:state.round+1,streak:0,bestStreak:state.bestStreak||0,
      level:state.level,timer:TIMER_MAX,roundInteractions:0,
      totalRounds:(state.totalRounds||0)+1,
      totalSpent:(state.totalSpent||0)+spent.length,
      lifetimeCellsGained:state.lifetimeCellsGained||0,
      totalLifetimeCells:state.totalLifetimeCells||0,
      history:[...state.history,{before:state.cells.length,after:0,
        spent:spent.length,gained:0,kept:0,bonusCells:0}],
      badges:newBadges,resistMeter:0,resistBonusThisGame,
    };
  }

  // ── GRADUATION CHECK ───────────────────────────────────────────────────
  if(kept.length>=COLONY_CAP||totalAfter>=COLONY_CAP){
    // Graduate with ONLY the kept cells — no new scatter cells added to this state.
    // New cells appear in the next colony (BONUS_CARRY starters).
    if(!newBadges.includes('first_grad'))newBadges.push('first_grad');
    const retiredCount=(state.retiredColonies||[]).length+1;
    if(retiredCount>=3&&!newBadges.includes('multi_grad'))newBadges.push('multi_grad');
    // Cap kept cells at COLONY_CAP for display
    const keptCapped=kept.slice(0,COLONY_CAP).map(c=>({...c,spendState:'none',pendingAt:null,marked:false,isNew:false,burst:false,splitting:false}));
    return{...state,
      cells:[...keptCapped,...spent.map(c=>({...c,burst:true}))],
      phase:'graduating',
      round:state.round+1,streak,bestStreak,level,timer:TIMER_MAX,
      roundInteractions:0,
      totalRounds:(state.totalRounds||0)+1,totalSpent:(state.totalSpent||0)+spent.length,
      lifetimeCellsGained:(state.lifetimeCellsGained||0)+newCount+bonusCells,
      totalLifetimeCells:(state.totalLifetimeCells||0)+totalAfter,
      history:[...state.history,{before:state.cells.length,after:totalAfter,spent:spent.length,gained:newCount,kept:kept.length,bonusCells}],
      badges:newBadges,resistMeter,resistBonusThisGame,
      graduatingCellCount:Math.min(kept.length,COLONY_CAP),
    };
  }

  const nextFlashDeal=(!state.flashDeal&&Math.random()<0.35)?pickFlashDeal(state.owned||[]):null;
  return{...state,
    cells:[...kept.map(c=>({...c,spendState:'none',pendingAt:null,marked:false,isNew:false,burst:false,splitting:false})),
      ...spent.map(c=>({...c,burst:true})),...scatter(cappedNew,colonyAccent(state.colonyNumber||1))],
    phase:level>state.level?'levelup':'results',
    round:state.round+1,streak,bestStreak,level,timer:TIMER_MAX,
    roundInteractions:0,
    totalRounds:(state.totalRounds||0)+1,totalSpent:(state.totalSpent||0)+spent.length,
    lifetimeCellsGained:(state.lifetimeCellsGained||0)+newCount+bonusCells,
    totalLifetimeCells:(state.totalLifetimeCells||0)+afterCount+bonusCells,
    history:[...state.history,{before:state.cells.length,after:totalAfter,spent:spent.length,gained:newCount,kept:kept.length,bonusCells}],
    badges:newBadges,resistMeter,resistBonusThisGame,
    flashDeal:nextFlashDeal,flashDealExpiredMsg:null,
  };
}

// Start a new colony after graduation
function startNextColony(state){
  const retired=retireColony(state);
  const nextNum=(state.colonyNumber||1)+1;
  const newGame=createGame(state.name,state.principal,state.rate,state.wishTarget,nextNum,BONUS_CARRY);
  return{
    ...newGame,
    // Carry forward accumulated data
    retiredColonies:[...(state.retiredColonies||[]),retired],
    totalLifetimeCells:(state.totalLifetimeCells||0)+(state.cells.filter(c=>!c.burst).length),
    owned:[...(state.owned||[])],  // keep owned items
    seenQuestions:[...(state.seenQuestions||[])], // never repeat questions across colonies
    goals:(state.goals||[]).filter(g=>g.status==='saving'), // carry unsatisfied goals forward
    lifetimeCellsGained:(state.lifetimeCellsGained||0),
    resistBonusThisGame:state.resistBonusThisGame||0,
  };
}

// ── App Store ──────────────────────────────────────────────────────────────
const AppCtx=createContext({});
// Demo account — kept for App Store review purposes only
const DEMO_PARENT={
  email:'parent@demo.com',pin:'1234',
  settings:{cellToDollar:100,affiliateTag:'moneycells-20'},
  kids:[
    {id:'kid1',name:'Alex',avatar:'🦁',age:8, game:null,sessions:[],totalPlayTime:0,
      ledger:{vaultCents:0,paidOutCents:0,cellsAtLastSettle:0,lastSettledAt:null,history:[]},amazonWishList:[],kidFeedback:[]},
    {id:'kid2',name:'Mia', avatar:'🦋',age:10,game:null,sessions:[],totalPlayTime:0,
      ledger:{vaultCents:0,paidOutCents:0,cellsAtLastSettle:0,lastSettledAt:null,history:[]},amazonWishList:[],kidFeedback:[]},
  ],
};

function appReducer(state,action){
  switch(action.type){
    case 'LOGIN':{
      // Demo account check
      if(action.email==='parent@demo.com'&&action.pin==='1234'){
        return{...state,parent:DEMO_PARENT,loggedIn:true,error:null};
      }
      // Existing account — verify PIN
      if(state.parent&&action.email===state.parent.email){
        return action.pin===state.parent.pin
          ?{...state,loggedIn:true,error:null}
          :{...state,error:'Wrong PIN for this account.'};
      }
      // New email — auto-register as fresh parent account
      const newParent={
        email:action.email,pin:action.pin,
        settings:{cellToDollar:100,affiliateTag:'moneycells-20'},
        kids:[
          {id:'kid1',name:'Kid 1',avatar:'🌟',age:8,game:null,sessions:[],totalPlayTime:0,
            ledger:{vaultCents:0,paidOutCents:0,cellsAtLastSettle:0,lastSettledAt:null,history:[]},
            amazonWishList:[],kidFeedback:[]},
        ],
      };
      return{...state,parent:newParent,loggedIn:true,error:null};
    }
    case 'HYDRATE':{
      const p=action.payload||{};
      return{...state,
        parent:p.parent||null,
        hasSeenParentWelcome:p.hasSeenParentWelcome||false,
        loggedIn:false,
        supabaseUser:null,
        pendingPasswordReset:false,
        _loaded:true,
      };
    }
    case 'SET_SUPABASE_USER':
      return{...state,
        supabaseUser:action.user,
        loggedIn:action.user?true:state.loggedIn,
      };
    case 'LOGOUT':
      clearAllStorage();
      supabaseSignOut().catch(()=>{});
      return{...state,loggedIn:false,activeKidId:null,sessionActive:false,
        parent:null,supabaseUser:null,hasSeenParentWelcome:state.hasSeenParentWelcome};
    case 'DELETE_ACCOUNT':
      clearAllStorage();
      deleteAccount(state.supabaseUser?.id).catch(()=>{});
      return{...state,loggedIn:false,activeKidId:null,sessionActive:false,
        parent:null,supabaseUser:null,hasSeenParentWelcome:false};
    case 'SET_PARENT_WELCOME_SEEN':return{...state,hasSeenParentWelcome:true};
    case 'SET_PIN':
      return{...state,parent:{...state.parent,pin:action.pin}};
    case 'SHOW_RESET_PASSWORD':return{...state,pendingPasswordReset:true};
    case 'CLEAR_RESET_PASSWORD':return{...state,pendingPasswordReset:false};
    // Sign out of Supabase session without wiping parent/kids data
    // Used after password reset so user signs in fresh with new password
    case 'RESET_AUTH_STATE':return{...state,loggedIn:false,supabaseUser:null,pendingPasswordReset:false};
    case 'UPDATE_KID_GAME':{
      if(!state.parent)return state;
      const updatedKids=(state.parent.kids||[]).map(k=>
        k.id===action.kidId?{...k,game:action.game}:k
      );
      return{...state,parent:{...state.parent,kids:updatedKids}};
    }
    case 'ADD_KID':{
      const existingKids=state.parent?.kids||[];
      const autoName=action.name||`Kid ${existingKids.length+1}`;
      const k={id:`kid_${Date.now()}`,name:autoName,avatar:action.avatar||'🌟',age:action.age||8,
        game:null,sessions:[],totalPlayTime:0,
        ledger:{vaultCents:0,paidOutCents:0,cellsAtLastSettle:0,lastSettledAt:null,history:[]},amazonWishList:[]};
      return{...state,parent:{...state.parent,kids:[...existingKids,k]}};
    }
    case 'RENAME_KID':{
      if(!state.parent)return state;
      const kids=(state.parent.kids||[]).map(k=>k.id===action.kidId?{...k,name:action.name}:k);
      return{...state,parent:{...state.parent,kids}};
    }
    case 'REMOVE_KID':{
      if(!state.parent)return state;
      const kids=(state.parent.kids||[]).filter(k=>k.id!==action.kidId);
      return{...state,parent:{...state.parent,kids}};
    }
    case 'START_SESSION':
      return{...state,activeKidId:action.kidId,sessionActive:true,sessionDuration:action.duration,sessionStartTime:Date.now()};
    case 'END_SESSION':{
      const elapsed=Math.round((Date.now()-(state.sessionStartTime||Date.now()))/1000);
      const kids=(state.parent?.kids||[]).map(k=>
        k.id===state.activeKidId
          ?{...k,totalPlayTime:(k.totalPlayTime||0)+elapsed,lastPlayed:new Date().toLocaleDateString(),
            sessions:[...(k.sessions||[]),{date:new Date().toLocaleDateString(),duration:elapsed}]}:k);
      return{...state,parent:{...state.parent,kids},activeKidId:null,sessionActive:false};
    }
    case 'SAVE_GAME':{
      const kids=(state.parent?.kids||[]).map(k=>k.id===state.activeKidId?{...k,game:action.game}:k);
      return{...state,parent:{...state.parent,kids}};
    }
    case 'SET_ERROR':  return{...state,error:action.message};
    case 'CLEAR_ERROR':return{...state,error:null};
    // ── FEEDBACK ───────────────────────────────────────────────────────
    case 'SAVE_KID_FEEDBACK':{
      // action.kidId, action.emoji, action.favourite, action.sessionCells
      const entry={
        type:'kid', ts:Date.now(), date:new Date().toLocaleDateString(),
        emoji:action.emoji, favourite:action.favourite,
        sessionCells:action.sessionCells,
      };
      const kids=(state.parent?.kids||[]).map(k=>
        k.id===action.kidId
          ?{...k,kidFeedback:[entry,...(k.kidFeedback||[])].slice(0,50)}:k);
      return{...state,parent:{...state.parent,kids}};
    }
    case 'SAVE_PARENT_FEEDBACK':{
      // action.category, action.text, action.rating, action.email
      const entry={
        type:'parent', ts:Date.now(), date:new Date().toLocaleDateString(),
        category:action.category, text:action.text,
        rating:action.rating, email:action.email||'',
      };
      const existing=(state.parent?.parentFeedback||[]);
      return{...state,parent:{...state.parent,
        parentFeedback:[entry,...existing].slice(0,100)}};
    }
    case 'ADD_AMAZON_WISH':{
      const kids=(state.parent?.kids||[]).map(k=>{
        if(k.id!==state.activeKidId)return k;
        const existing=(k.amazonWishList||[]).find(w=>w.id===action.item.id);
        if(existing)return k;
        return{...k,amazonWishList:[...(k.amazonWishList||[]),{...action.item,addedAt:Date.now()}]};
      });
      return{...state,parent:{...state.parent,kids}};
    }
    default:           return state;
  }
}
// Headers for Cellie calls — send the parent's session token when signed in
// so the Edge Function can tag logged questions with user_id (for deletion)
async function cellieHeaders(){
  let token=SUPABASE_ANON;
  try{
    const{data}=await supabase.auth.getSession();
    if(data?.session?.access_token)token=data.session.access_token;
  }catch(e){}
  return{'Content-Type':'application/json','Authorization':`Bearer ${token}`};
}

// ── Supabase Auth helpers ─────────────────────────────────────────────────

// Sign up new parent with email + password
// PIN is stored in user_metadata and locally — it's a kid-lock, not security
async function supabaseSignUp(email, password, pin){
  const{data,error}=await supabase.auth.signUp({
    email,
    password,
    options:{data:{pin, kidsCount:1}},
  });
  if(error)throw error;
  return data.user;
}

// Sign in existing parent
async function supabaseSignIn(email, password){
  const{data,error}=await supabase.auth.signInWithPassword({email,password});
  if(error)throw error;
  return data.user;
}

// Sign out
async function supabaseSignOut(){
  await supabase.auth.signOut();
}

// Delete account — removes all user data from Supabase + signs out
// IMPORTANT: invoke delete-user FIRST while session is still active,
// then delete data tables, then sign out last
async function deleteAccount(userId){
  try{
    if(userId){
      // Step 1: Delete the auth.users record via Edge Function
      // Must happen BEFORE signOut so the auth token is still valid
      const{error:fnError}=await supabase.functions.invoke('delete-user',{
        body:{userId},
      });
      if(fnError)console.warn('delete-user fn error (continuing):',fnError);

      // Step 2: Delete all associated data (cascade would handle most, but be explicit)
      await Promise.allSettled([
        supabase.from('sessions').delete().eq('user_id',userId),
        supabase.from('events').delete().eq('user_id',userId),
        supabase.from('goals').delete().eq('user_id',userId),
        supabase.from('feedback').delete().eq('user_id',userId),
        supabase.from('tutor_sessions').delete().eq('user_id',userId),
        supabase.from('profiles').delete().eq('id',userId),
      ]);
    }
    // Step 3: Sign out last — session is no longer needed
    await supabase.auth.signOut().catch(()=>{});
    return true;
  }catch(e){
    console.warn('deleteAccount error:',e);
    await supabase.auth.signOut().catch(()=>{});
    return true;
  }
}

// Send a password reset email — Supabase emails a token the user types back in
// No redirectTo = no broken localhost link; the token is in the email body
async function supabaseSendResetOtp(email){
  const{error}=await supabase.auth.resetPasswordForEmail(email);
  if(error)throw error;
}
// Verify the token from the reset email and establish a recovery session
// onAuthStateChange fires PASSWORD_RECOVERY → SHOW_RESET_PASSWORD
async function supabaseVerifyResetOtp(email,token){
  const{error}=await supabase.auth.verifyOtp({email,token:token.trim(),type:'recovery'});
  if(error)throw error;
}

// Get current session (called on app start)
async function getSupabaseSession(){
  const{data:{session}}=await supabase.auth.getSession();
  return session;
}

// Log a session end event to Supabase
async function logSession(userId, sessionData){
  if(!userId)return;
  try{
    await supabase.from('sessions').insert({
      user_id:userId,
      kid_name:sessionData.kidName,
      kid_age:sessionData.kidAge,
      ended_at:new Date().toISOString(),
      duration_secs:sessionData.durationSecs,
      rounds_played:sessionData.totalRounds||0,
      cells_saved:sessionData.lifetimeCellsGained||0,
      cells_spent:sessionData.totalSpent||0,
      flash_deals_resisted:sessionData.resistBonusThisGame||0,
      cellie_questions:sessionData.cellieQuestions||0,
      colony_number:sessionData.colonyNumber||1,
      rate:sessionData.rate,
      graduated:sessionData.phase==='graduating',
    });
  }catch(e){console.warn('logSession failed:',e);}
}

// Log a key event (graduation, goal reached, etc.)
async function logEvent(userId, eventType, payload={}){
  if(!userId)return;
  try{
    await supabase.from('events').insert({
      user_id:userId,
      event_type:eventType,
      payload,
    });
  }catch(e){console.warn('logEvent failed:',e);}
}

// Submit feedback to Supabase
async function submitFeedback(userId, feedbackData){
  try{
    const{error}=await supabase.from('feedback').insert({
      user_id:userId||null,
      category:feedbackData.category,
      text:feedbackData.text||null,
      rating:feedbackData.rating||null,
      email:feedbackData.email||null,
      source:feedbackData.source||'parent', // 'parent' | 'kid'
      app_version:'1.0.0',
      created_at:new Date().toISOString(),
    });
    if(error)throw error;
    return true;
  }catch(e){
    console.warn('submitFeedback failed:',e);
    return false;
  }
}

// Update last_login_at on the profile
async function updateLastLogin(userId){
  if(!userId)return;
  try{
    await supabase.from('profiles')
      .update({last_login_at:new Date().toISOString()})
      .eq('id',userId);
  }catch(e){console.warn('updateLastLogin failed:',e);}
}

// ── Persistence keys ──────────────────────────────────────────────────────
const STORAGE_KEY_APP   = '@money_cells_app_state';
const STORAGE_KEY_GAME  = '@money_cells_game_state';

// Save app state (parent account, kids, settings, hasSeenParentWelcome)
async function saveAppState(state){
  try{
    // Don't persist sensitive fields — just what we need to restore
    const toSave={
      parent:state.parent,
      hasSeenParentWelcome:state.hasSeenParentWelcome,
    };
    await AsyncStorage.setItem(STORAGE_KEY_APP, JSON.stringify(toSave));
  }catch(e){ console.warn('saveAppState failed:', e); }
}

// Save game state for a specific kid
async function saveGameState(kidId, gameState){
  try{
    if(!kidId||!gameState)return;
    const key=`${STORAGE_KEY_GAME}_${kidId}`;
    await AsyncStorage.setItem(key, JSON.stringify(gameState));
  }catch(e){ console.warn('saveGameState failed:', e); }
}

// Load app state from storage
async function loadAppState(){
  try{
    const raw=await AsyncStorage.getItem(STORAGE_KEY_APP);
    return raw?JSON.parse(raw):null;
  }catch(e){ console.warn('loadAppState failed:', e); return null; }
}

// Load game state for a specific kid
async function loadGameState(kidId){
  try{
    const key=`${STORAGE_KEY_GAME}_${kidId}`;
    const raw=await AsyncStorage.getItem(key);
    return raw?JSON.parse(raw):null;
  }catch(e){ console.warn('loadGameState failed:', e); return null; }
}

// Clear all stored data (used on logout)
async function clearAllStorage(){
  try{
    const keys=await AsyncStorage.getAllKeys();
    const appKeys=keys.filter(k=>k.startsWith('@money_cells'));
    if(appKeys.length>0)await AsyncStorage.multiRemove(appKeys);
  }catch(e){ console.warn('clearAllStorage failed:', e); }
}


function AppProvider({children}){
  const[state,dispatch]=useReducer(appReducer,{
    parent:null,loggedIn:false,activeKidId:null,sessionActive:false,
    sessionDuration:10*60,sessionStartTime:null,error:null,
    hasSeenParentWelcome:false,
    _loaded:false, // false = still reading from storage
  });
  const stateRef=useRef(state);
  stateRef.current=state;

  // Load persisted state on first mount + listen to Supabase auth changes
  useEffect(()=>{
    (async()=>{
      const saved=await loadAppState();
      dispatch({type:'HYDRATE',payload:saved||{}});

      // Restore Supabase session if one exists (handles app restart)
      const session=await getSupabaseSession();
      if(session?.user){
        dispatch({type:'SET_SUPABASE_USER',user:session.user});
        updateLastLogin(session.user.id);
      }
    })();

    // Listen for auth state changes (sign in, sign out, token refresh, password recovery)
    const{data:{subscription}}=supabase.auth.onAuthStateChange((event,session)=>{
      dispatch({type:'SET_SUPABASE_USER',user:session?.user||null});
      if(event==='PASSWORD_RECOVERY'){
        // User tapped the reset link in their email — show new password screen
        dispatch({type:'SHOW_RESET_PASSWORD'});
      }
    });
    return()=>subscription.unsubscribe();
  },[]);// eslint-disable-line react-hooks/exhaustive-deps

  // Save app state whenever it changes (debounced 1s)
  const saveTimer=useRef(null);
  useEffect(()=>{
    if(!state._loaded)return; // don't save until hydrated
    clearTimeout(saveTimer.current);
    saveTimer.current=setTimeout(()=>{
      saveAppState(state);
    },1000);
    return()=>clearTimeout(saveTimer.current);
  },[state]);// eslint-disable-line react-hooks/exhaustive-deps

  return<AppCtx.Provider value={{state,dispatch}}>{children}</AppCtx.Provider>;
}
const useApp=()=>useContext(AppCtx);

// ── Game Store ─────────────────────────────────────────────────────────────
const GameCtx=createContext({game:null,dispatch:()=>{}});
function gameReducer(state,action){
  switch(action.type){
    case 'INIT':  return createGame(action.name,action.principal,action.rate,action.wishId,1,0,action.goal||null);
    case 'LOAD':  return action.state||action.game; // handles both AsyncStorage and KidGameFlow
    case 'CELL_INTERACTED':
      return state?{...state,roundInteractions:(state.roundInteractions||0)+1}:state;
    case 'TOGGLE':{
      if(!state)return state;
      return{...state,cells:state.cells.map(c=>{
        if(c.id!==action.id)return c;
        if(c.spendState==='none')     return{...c,spendState:'pending',  pendingAt:Date.now(),marked:false};
        if(c.spendState==='pending')  return{...c,spendState:'confirmed',pendingAt:null,      marked:true };
        if(c.spendState==='confirmed')return{...c,spendState:'none',     pendingAt:null,      marked:false};
        return c;
      })};
    }
    // Direct confirm/unconfirm — used by stepper, bypasses 3s pending delay
    case 'CONFIRM_CELL':
      return state?{...state,cells:state.cells.map(c=>
        c.id===action.id?{...c,spendState:'confirmed',pendingAt:null,marked:true}:c)}:state;
    case 'UNCONFIRM_CELL':
      return state?{...state,cells:state.cells.map(c=>
        c.id===action.id&&(c.spendState==='confirmed'||c.spendState==='pending')
          ?{...c,spendState:'none',pendingAt:null,marked:false}:c)}:state;
    case 'HEAL_PENDING':{
      if(!state)return state;
      return{...state,cells:state.cells.map(c=>c.id===action.cellId?{...c,spendState:'none',pendingAt:null,marked:false}:c)};
    }
    case 'TICK':{
      if(!state||state.phase!=='active')return state;
      const t=state.timer-1;
      const fd=state.flashDeal;
      let newFd=fd, expiredMsg=state.flashDealExpiredMsg;
      if(fd){
        const sl=fd.secondsLeft-1;
        if(sl<=0){newFd=null;expiredMsg=`⏰ The ${fd.emoji} deal expired — cells kept growing! 🌱`;}
        else{newFd={...fd,secondsLeft:sl};}
      }
      return t<=0
        ?{...state,timer:0,phase:'splitting',flashDeal:newFd,flashDealExpiredMsg:expiredMsg}
        :{...state,timer:t,flashDeal:newFd,flashDealExpiredMsg:expiredMsg};
    }
    case 'MARK_SPLITTING':{
      if(!state)return state;
      return{...state,cells:state.cells.map(c=>(c.spendState!=='confirmed'&&!c.burst)?{...c,splitting:true}:c)};
    }
    case 'RESOLVE':return state?resolveRound(state):state;
    case 'NEXT':  return state?{...state,phase:'active',timer:TIMER_MAX,
      cells:state.cells.filter(c=>!c.burst).map(c=>({...c,isNew:false,splitting:false})),
      flashDealExpiredMsg:null}:state;

    // ── Graduate colony → start next ──────────────────────────────────────
    case 'GRADUATE':
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return state?startNextColony(state):state;
    case 'SEEN_ONBOARDING':return state?{...state,hasSeenOnboarding:true}:state;
    case 'QUIZ_BONUS':{
      // Add bonus cells directly to the live colony, mark question as seen
      if(!state)return state;
      const bonus=scatter(action.cells).map(c=>({...c,isNew:true,burst:false}));
      const seen=[...(state.seenQuestions||[]),action.questionId];
      return{...state,
        cells:[...state.cells.filter(c=>!c.burst),...bonus],
        seenQuestions:seen,
        lifetimeCellsGained:(state.lifetimeCellsGained||0)+action.cells,
      };
    }

    case 'CHEER_BONUS':{
      if(!state||state.phase!=='active')return state;
      const live=state.cells.filter(c=>!c.burst);
      if(live.length>=COLONY_CAP)return state;
      const bonus=scatter(1,colonyAccent(state.colonyNumber||1)).map(c=>({...c,isNew:true,burst:false}));
      return{...state,cells:[...state.cells,...bonus],
        lifetimeCellsGained:(state.lifetimeCellsGained||0)+1};
    }

    case 'BUY_FLASH_DEAL':{
      if(!state||!state.flashDeal)return state;
      const deal=state.flashDeal;
      const live=state.cells.filter(c=>!c.burst);
      if(live.length<deal.dealCost)return state;
      const remaining=[...live];
      const removed=remaining.splice(0,deal.dealCost).map(c=>({...c,burst:true}));
      return{...state,cells:[...remaining,...removed],owned:[...(state.owned||[]),deal.itemId],
        flashDeal:null,flashDealExpiredMsg:`🎉 Deal grabbed! Saved ${deal.originalCost-deal.dealCost} cells!`,
        wishTarget:state.wishTarget===deal.itemId?null:state.wishTarget};
    }
    case 'DISMISS_FLASH_DEAL':
      return state?{...state,flashDeal:null,flashDealExpiredMsg:'Saving is smarter anyway! 🌱'}:state;
    case 'BUY_ITEM':{
      if(!state)return state;
      const item=SHOP_ITEMS.find(i=>i.id===action.itemId);
      if(!item)return state;
      const live=state.cells.filter(c=>!c.burst);
      if(live.length<item.cost)return state;
      const remaining=[...live];
      const removed=remaining.splice(0,item.cost).map(c=>({...c,burst:true}));
      return{...state,cells:[...remaining,...removed],owned:[...(state.owned||[]),item.id],
        wishTarget:state.wishTarget===item.id?null:state.wishTarget};
    }
    case 'SET_WISH':{ // backward compat — adds built-in item as first goal
      if(!state)return state;
      const item=SHOP_ITEMS.find(i=>i.id===action.itemId);
      if(!item)return state;
      const newGoal={...item,status:'saving',addedAt:Date.now()};
      const existing=(state.goals||[]).filter(g=>g.id!==action.itemId);
      return{...state,wishTarget:action.itemId,amazonGoal:null,goals:[newGoal,...existing]};
    }
    case 'ADD_GOAL':{
      if(!state)return state;
      const g=action.goal;
      // Deduplicate
      const existing=(state.goals||[]).filter(gl=>gl.id!==g.id);
      const newGoal={...g,status:'saving',addedAt:Date.now()};
      // If no active goals, make this the first; otherwise append
      const activeGoals=existing.filter(gl=>gl.status==='saving');
      const gotGoals=existing.filter(gl=>gl.status==='got');
      const goals=action.makeActive
        ? [newGoal,...activeGoals,...gotGoals]
        : [...activeGoals,newGoal,...gotGoals];
      return{...state,goals,
        wishTarget:goals[0]?.isAmazon?null:(goals[0]?.id||null),
        amazonGoal:goals[0]?.isAmazon?goals[0]:null};
    }
    case 'PROMOTE_GOAL':{
      if(!state)return state;
      const goals=[...(state.goals||[])];
      const idx=goals.findIndex(g=>g.id===action.id);
      if(idx<=0)return state;
      const [item]=goals.splice(idx,1);
      goals.unshift(item);
      return{...state,goals,
        wishTarget:goals[0]?.isAmazon?null:(goals[0]?.id||null),
        amazonGoal:goals[0]?.isAmazon?goals[0]:null};
    }
    case 'REMOVE_GOAL':{
      if(!state)return state;
      const goals=(state.goals||[]).filter(g=>g.id!==action.id);
      return{...state,goals,
        wishTarget:goals[0]?.isAmazon?null:(goals[0]?.id||null),
        amazonGoal:goals[0]?.isAmazon?goals[0]:null};
    }
    case 'MARK_GOAL_GOT':{
      if(!state)return state;
      const goals=(state.goals||[]).map(g=>g.id===action.id?{...g,status:'got',gotAt:Date.now()}:g);
      const activeFirst=[...goals.filter(g=>g.status==='saving'),...goals.filter(g=>g.status==='got')];
      return{...state,goals:activeFirst,
        wishTarget:activeFirst[0]?.isAmazon?null:(activeFirst[0]?.id||null),
        amazonGoal:activeFirst[0]?.isAmazon?activeFirst[0]:null};
    }
    case 'SET_AMAZON_GOAL':{ // backward compat
      if(!state)return state;
      const newGoal={id:action.item.id,name:action.item.name,emoji:action.item.emoji,
        cost:action.cellsNeeded,color:C.orange,isAmazon:true,
        priceUsd:action.item.priceUsd,searchQ:action.item.searchQ,
        status:'saving',addedAt:Date.now()};
      const existing=(state.goals||[]).filter(g=>g.id!==action.item.id);
      const goals=[newGoal,...existing.filter(g=>g.status==='saving'),...existing.filter(g=>g.status==='got')];
      return{...state,wishTarget:null,amazonGoal:newGoal,goals};
    }
    case 'CLEAR_AMAZON_GOAL':return state?{...state,amazonGoal:null}:state;
    case 'RESET':  return null;
    default:       return state;
  }
}
function GameProvider({children,kidId}){
  const[game,dispatch]=useReducer(gameReducer,null);
  const{dispatch:appDispatch}=useApp();

  // Load saved game for this kid on mount
  useEffect(()=>{
    if(!kidId)return;
    (async()=>{
      const saved=await loadGameState(kidId);
      if(saved&&saved.phase&&saved.cells){
        dispatch({type:'LOAD',state:saved});
      }
    })();
  },[kidId]);// eslint-disable-line react-hooks/exhaustive-deps

  // Save game state whenever it changes (debounced 2s)
  const saveTimer=useRef(null);
  useEffect(()=>{
    if(!game||!kidId)return;
    clearTimeout(saveTimer.current);
    saveTimer.current=setTimeout(()=>{
      saveGameState(kidId,game);
      // Also sync back into parent.kids so dashboard shows latest
      appDispatch({type:'UPDATE_KID_GAME',kidId,game});
    },2000);
    return()=>clearTimeout(saveTimer.current);
  },[game,kidId]);// eslint-disable-line react-hooks/exhaustive-deps

  return<GameCtx.Provider value={{game,dispatch}}>{children}</GameCtx.Provider>;
}
const useGame=()=>useContext(GameCtx);

// ── Helpers ────────────────────────────────────────────────────────────────
function Btn({label,onPress,primary,danger,style}){
  const s=useRef(new Animated.Value(1)).current;
  const bg=primary?C.green500:danger?C.red:'transparent';
  const bc=primary?C.green400:danger?C.red:C.border;
  const tc=(primary||danger)?C.bg:C.green400;
  return(
    <Animated.View style={[{transform:[{scale:s}]},style]}>
      <TouchableOpacity onPress={onPress}
        onPressIn={()=>Animated.spring(s,{toValue:0.95,useNativeDriver:true}).start()}
        onPressOut={()=>Animated.spring(s,{toValue:1,useNativeDriver:true}).start()}
        style={[ss.btn,{backgroundColor:bg,borderColor:bc}]}>
        <Text style={[ss.btnText,{color:tc}]}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

function PinInput({value,onChange,label}){
  return(
    <View style={{alignItems:'center',gap:12}}>
      {!!label&&<Text style={{color:C.textMuted,fontSize:13}}>{label}</Text>}
      <View style={{flexDirection:'row',gap:12}}>
        {[0,1,2,3].map(i=>(
          <View key={i} style={{width:44,height:52,backgroundColor:C.card,borderRadius:10,borderWidth:1.5,borderColor:value.length>i?C.green400:C.border,alignItems:'center',justifyContent:'center'}}>
            <Text style={{color:C.green400,fontSize:22,fontWeight:'800'}}>{value[i]?'●':''}</Text>
          </View>
        ))}
      </View>
      <View style={{flexDirection:'row',flexWrap:'wrap',gap:8,justifyContent:'center',maxWidth:240}}>
        {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((k,i)=>(
          <TouchableOpacity key={i} onPress={()=>{if(!k)return;if(k==='⌫'){onChange(value.slice(0,-1));return;}if(value.length<4)onChange(value+k);}}
            style={{width:68,height:44,backgroundColor:k?C.card:'transparent',borderRadius:8,borderWidth:k?1:0,borderColor:C.border,alignItems:'center',justifyContent:'center'}}>
            <Text style={{color:k==='⌫'?C.red:C.text,fontSize:16,fontWeight:'700'}}>{k}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function formatTime(s){const m=Math.floor(s/60);return`${m}:${(s%60).toString().padStart(2,'0')}`;}
function formatPlayTime(s){if(!s)return'0m';const m=Math.floor(s/60),h=Math.floor(m/60);return h>0?`${h}h ${m%60}m`:`${m}m`;}
function toDollars(cents){return`$${(cents/100).toFixed(2)}`;}
function cellsToCents(cells,rate){return Math.round(cells*(100/rate));}

// ══════════════════════════════════════════════════════════════════════════
// 🎓 COLONY GRADUATION SCREEN
// ══════════════════════════════════════════════════════════════════════════
function ColonyGraduationScreen({game,onContinue}){
  const scaleA =useRef(new Animated.Value(0)).current;
  const fadeA  =useRef(new Animated.Value(0)).current;
  const slideA =useRef(new Animated.Value(40)).current;

  useEffect(()=>{ // eslint-disable-line react-hooks/exhaustive-deps
    Animated.sequence([
      Animated.parallel([
        Animated.spring(scaleA,{toValue:1,friction:3,tension:80,useNativeDriver:true}),
        Animated.timing(fadeA, {toValue:1,duration:400,useNativeDriver:true}),
      ]),
      Animated.delay(300),
      Animated.timing(slideA,{toValue:0,duration:350,useNativeDriver:true}),
    ]).start();
  },[]);// eslint-disable-line react-hooks/exhaustive-deps

  const colonyNum   =game?.colonyNumber||1;
  const roundCount  =game?.totalRounds||0;
  const bestStreak  =game?.bestStreak||0;
  const retiredCount=(game?.retiredColonies||[]).length;

  return(
    <SafeAreaView style={{flex:1,backgroundColor:C.bg}}>
      <ScrollView contentContainerStyle={{padding:24,gap:18,paddingBottom:40}}>
        {/* Trophy header */}
        <Animated.View style={{alignItems:'center',gap:8,transform:[{scale:scaleA}]}}>
          <Text style={{fontSize:80}}>🎓</Text>
          <Text style={{color:C.green400,fontWeight:'800',fontSize:26,textAlign:'center',letterSpacing:-1}}>
            Colony #{colonyNum} Graduated!
          </Text>
          <Text style={{color:C.textMuted,fontSize:14,textAlign:'center'}}>
            Your colony reached {COLONY_CAP} cells!
          </Text>
        </Animated.View>

        {/* Stats recap */}
        <Animated.View style={{opacity:fadeA}}>
          <View style={{backgroundColor:C.card,borderRadius:16,borderWidth:2,borderColor:C.green700,padding:16,gap:10}}>
            <Text style={{color:C.green400,fontWeight:'700',fontSize:13,letterSpacing:0.5,marginBottom:4}}>COLONY #{colonyNum} FINAL STATS</Text>
            {[
              ['🧬','Cells at graduation',COLONY_CAP],
              ['🔄','Rounds survived',roundCount],
              ['🔥','Best saving streak',`${bestStreak} rounds`],
              ['💰','Value earned',`$${(COLONY_CAP/100).toFixed(2)}`],
              ['🏆','Colonies in museum',retiredCount+1],
            ].map(([icon,label,val])=>(
              <View key={label} style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
                <View style={{flexDirection:'row',gap:8,alignItems:'center'}}>
                  <Text style={{fontSize:16}}>{icon}</Text>
                  <Text style={{color:C.textMuted,fontSize:13}}>{label}</Text>
                </View>
                <Text style={{color:C.text,fontWeight:'700',fontSize:14}}>{val}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* Colony badge */}
        <Animated.View style={{opacity:fadeA,alignItems:'center'}}>
          <View style={{backgroundColor:C.green900,borderRadius:16,borderWidth:2,borderColor:C.green500+'66',padding:16,alignItems:'center',gap:6,width:'100%'}}>
            <Text style={{fontSize:9,letterSpacing:2,color:C.textMuted}}>NEW BADGE UNLOCKED</Text>
            <Text style={{fontSize:48}}>🏛️</Text>
            <Text style={{color:C.green400,fontWeight:'800',fontSize:14}}>Colony #{colonyNum} · {COLONY_CAP} cells</Text>
            <Text style={{color:C.textMuted,fontSize:12}}>Added to your Museum!</Text>
          </View>
        </Animated.View>

        {/* Next colony bonus */}
        <Animated.View style={{opacity:fadeA,transform:[{translateY:slideA}]}}>
          <View style={{backgroundColor:C.green900,borderRadius:14,borderWidth:1.5,borderColor:C.green500+'44',padding:16,gap:8}}>
            <Text style={{color:C.green400,fontWeight:'800',fontSize:15}}>🌱 Colony #{colonyNum+1} Starting!</Text>
            <Text style={{color:C.green300,fontSize:13,lineHeight:20}}>
              Your old colony's children are ready to grow! Colony #{colonyNum+1} begins with <Text style={{color:C.green400,fontWeight:'800'}}>{BONUS_CARRY} bonus starter cells</Text> — like a snowball that keeps rolling, your hard work carries forward!
            </Text>
            <View style={{backgroundColor:C.green900,borderRadius:8,padding:10,flexDirection:'row',alignItems:'center',gap:8}}>
              <Text style={{fontSize:20}}>🔬</Text>
              <Text style={{color:C.textMuted,fontSize:12,flex:1}}>
                This is exactly what happens with real savings — the interest you earned last year becomes the principal that earns even more next year!
              </Text>
            </View>
          </View>
        </Animated.View>

        <Btn label={`🚀 Start Colony #${colonyNum+1}!`} onPress={onContinue} primary/>
      </ScrollView>
    </SafeAreaView>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// 🏛️ COLONY MUSEUM SCREEN
// ══════════════════════════════════════════════════════════════════════════
// Extracted so hooks (useState) are legal — can't use hooks inside .map()
function GenerationCard({gen, genNum, defaultExpanded}){
  const[expanded,setExpanded]=useState(defaultExpanded);
  const startColony=gen[0].colonyNum;
  const endColony  =gen[gen.length-1].colonyNum;
  const totalCells =gen.reduce((a,c)=>a+(c.cells||0),0);
  const bestStreak =Math.max(...gen.map(c=>c.bestStreak||0));
  const genEmoji   =genNum===1?'🌱':genNum===2?'🌿':genNum===3?'🌳':'🏛️';

  return(
    <View style={{marginBottom:8}}>
      <TouchableOpacity
        onPress={()=>setExpanded(e=>!e)}
        style={{backgroundColor:C.card,borderRadius:12,
          borderWidth:1.5,borderColor:expanded?C.green500+'66':C.border,
          padding:14,flexDirection:'row',alignItems:'center',gap:12}}>
        <View style={{width:40,height:40,borderRadius:20,
          backgroundColor:C.green900,alignItems:'center',justifyContent:'center',
          borderWidth:1.5,borderColor:C.green700}}>
          <Text style={{fontSize:20}}>{genEmoji}</Text>
        </View>
        <View style={{flex:1}}>
          <Text style={{color:C.text,fontWeight:'800',fontSize:14}}>
            Generation {genNum}
          </Text>
          <Text style={{color:C.textMuted,fontSize:11}}>
            Colonies #{startColony}–#{endColony} · {totalCells} total cells · 🔥{bestStreak} best streak
          </Text>
        </View>
        <Text style={{color:C.textMuted,fontSize:18}}>{expanded?'▾':'▸'}</Text>
      </TouchableOpacity>
      {expanded&&gen.map((col,ci)=>(
        <View key={ci} style={{backgroundColor:C.surface,borderRadius:10,
          borderWidth:1,borderColor:C.border,
          padding:12,marginTop:4,marginLeft:12,
          flexDirection:'row',alignItems:'center',gap:10}}>
          <View style={{width:32,height:32,borderRadius:16,
            backgroundColor:C.green900,alignItems:'center',justifyContent:'center',
            borderWidth:1.5,borderColor:C.green500+'44'}}>
            <Text style={{fontSize:14}}>🧬</Text>
          </View>
          <View style={{flex:1}}>
            <Text style={{color:C.text,fontWeight:'700',fontSize:13}}>
              Colony #{col.colonyNum}
            </Text>
            <Text style={{color:C.textMuted,fontSize:11}}>
              {col.cells} cells · {col.rounds} rounds · 🔥{col.bestStreak}
            </Text>
          </View>
          <View style={{backgroundColor:C.green900,borderRadius:6,
            paddingHorizontal:8,paddingVertical:4,
            borderWidth:1,borderColor:C.green500+'44'}}>
            <Text style={{color:C.green400,fontWeight:'800',fontSize:11}}>
              ✓ {col.cells}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function ColonyMuseumScreen({game,onBack}){
  if(!game)return null;
  const retired  =game.retiredColonies||[];
  const current  =game.colonyNumber||1;
  const liveCount=game.cells?.filter(c=>!c.burst).length||0;
  const totalEver=(game.totalLifetimeCells||0)+liveCount;
  const settings ={cellToDollar:100};

  // Pre-compute dynasty stats (replaces IIFE in JSX — Hermes safe)
  let dynastyStatsView=null;
  if(retired.length>=3){
    const totalColonies=retired.length+1;
    const allCells=retired.map(c=>c.cells||COLONY_CAP);
    const avgCells=Math.round(allCells.reduce((a,b)=>a+b,0)/allCells.length);
    const allRounds=retired.map(c=>c.rounds||1);
    const avgRounds=Math.round(allRounds.reduce((a,b)=>a+b,0)/allRounds.length);
    const DTIER=[
      {name:'Seedling',emoji:'🌱',max:5},
      {name:'Grower',  emoji:'🌿',max:10},
      {name:'Thriving',emoji:'🌳',max:19},
      {name:'Dynasty', emoji:'🏛️',max:Infinity},
    ];
    const dTier=DTIER.find(t=>totalColonies<=t.max)||DTIER[3];
    dynastyStatsView=(
      <View style={{backgroundColor:C.green900,borderRadius:14,borderWidth:1.5,
        borderColor:C.green700,padding:16,gap:10}}>
        <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
          <Text style={{fontSize:32}}>{dTier.emoji}</Text>
          <View style={{flex:1}}>
            <Text style={{color:C.green400,fontWeight:'800',fontSize:16}}>
              {dTier.name} Dynasty
            </Text>
            <Text style={{color:C.textMuted,fontSize:12}}>
              {totalColonies} colonies · avg {avgRounds} rounds to graduate
            </Text>
          </View>
        </View>
        <View style={{flexDirection:'row',gap:6,alignItems:'flex-end',height:32}}>
          {retired.slice(-10).map((col,i)=>{
            const h=Math.max(4,Math.round((col.cells/COLONY_CAP)*32));
            return(
              <View key={i} style={{flex:1,alignItems:'center',gap:2}}>
                <View style={{width:'100%',height:32,justifyContent:'flex-end'}}>
                  <View style={{backgroundColor:C.green500,borderRadius:2,height:h,opacity:0.5+i*0.05}}/>
                </View>
                <Text style={{color:C.textFaint,fontSize:7}}>#{col.colonyNum}</Text>
              </View>
            );
          })}
        </View>
        <Text style={{color:C.textMuted,fontSize:10,textAlign:'center'}}>
          cells per colony over last {Math.min(retired.length,10)} colonies
        </Text>
      </View>
    );
  }

  // Pre-compute generation groups (replaces IIFE in JSX — Hermes safe)
  let generationGroupsView=null;
  if(retired.length>0){
    const generations=[];
    for(let i=0;i<retired.length;i+=5){generations.push(retired.slice(i,i+5));}
    generationGroupsView=generations.reverse().map((gen,gi)=>(
      <GenerationCard
        key={gi}
        gen={gen}
        genNum={generations.length-gi}
        defaultExpanded={gi===0}
      />
    ));
  }

  return(
    <SafeAreaView style={{flex:1,backgroundColor:C.bg}}>
      <ScrollView contentContainerStyle={{padding:20,gap:16,paddingBottom:32}}>
        <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
          <TouchableOpacity onPress={onBack}><Text style={{color:C.green400,fontSize:16}}>← Game</Text></TouchableOpacity>
          <Text style={[ss.h1,{flex:1}]}>Colony Museum 🏛️</Text>
        </View>

        {/* Lifetime stats */}
        <View style={{backgroundColor:C.green900,borderRadius:14,borderWidth:1,borderColor:C.green700,padding:16,gap:8}}>
          <Text style={{color:C.green400,fontWeight:'700',fontSize:14,marginBottom:4}}>📊 All-Time Stats</Text>
          <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>
            {[
              ['🏛️','Colonies raised',retired.length+' retired + 1 active',C.green400],
              ['🧬','Total cells ever',totalEver,C.green300],
              ['💰','Total value'  ,`$${(totalEver/100).toFixed(2)}`,C.amber],
              ['💪','Willpower bonus',`${game.resistBonusThisGame||0}×`,C.purple],
            ].map(([icon,label,val,color])=>(
              <View key={label} style={{width:(SW-64)/2,backgroundColor:C.card,borderRadius:10,padding:10,borderWidth:1,borderColor:C.border,gap:3}}>
                <Text style={{fontSize:18}}>{icon}</Text>
                <Text style={{color,fontWeight:'800',fontSize:16}}>{val}</Text>
                <Text style={{fontSize:9,color:C.textMuted,letterSpacing:1}}>{label.toUpperCase()}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Dynasty stats */}
        {dynastyStatsView}

        {/* Generation groups */}
        {generationGroupsView}

        {/* Current active colony */}
        <View>
          <Text style={[ss.caption,{color:C.textMuted,marginBottom:10}]}>CURRENT COLONY</Text>
          <View style={{backgroundColor:C.card,borderRadius:12,borderWidth:2,borderColor:C.green500+'55',padding:14}}>
            <View style={{flexDirection:'row',alignItems:'center',gap:12,marginBottom:10}}>
              <View style={{width:44,height:44,borderRadius:22,backgroundColor:C.green900,alignItems:'center',justifyContent:'center',borderWidth:2,borderColor:C.green500}}>
                <Text style={{fontSize:22}}>🧬</Text>
              </View>
              <View style={{flex:1}}>
                <Text style={{color:C.green400,fontWeight:'800',fontSize:15}}>Colony #{current}</Text>
                <Text style={{color:C.textMuted,fontSize:12}}>{liveCount} cells · active now</Text>
              </View>
              <View style={{backgroundColor:C.green500+'33',borderRadius:8,paddingHorizontal:10,paddingVertical:5,borderWidth:1.5,borderColor:C.green500}}>
                <Text style={{color:C.green400,fontWeight:'800',fontSize:12}}>ACTIVE</Text>
              </View>
            </View>
            <View style={{height:6,backgroundColor:C.surface,borderRadius:3,overflow:'hidden',marginBottom:4}}>
              <View style={{height:6,backgroundColor:liveCount>=COLONY_WARN?C.amber:C.green500,borderRadius:3,width:`${(liveCount/COLONY_CAP)*100}%`}}/>
            </View>
            <View style={{flexDirection:'row',justifyContent:'space-between'}}>
              <Text style={{fontSize:10,color:C.textMuted}}>{liveCount}/{COLONY_CAP} cells</Text>
              <Text style={{fontSize:10,color:liveCount>=COLONY_WARN?C.amber:C.textMuted}}>
                {liveCount>=COLONY_WARN?`${COLONY_CAP-liveCount} until graduation!`:`${Math.round((liveCount/COLONY_CAP)*100)}%`}
              </Text>
            </View>
          </View>
        </View>

        {retired.length===0&&(
          <View style={{backgroundColor:C.surface,borderRadius:12,borderWidth:1,borderColor:C.border,padding:20,alignItems:'center',gap:8}}>
            <Text style={{fontSize:40}}>🌱</Text>
            <Text style={{color:C.textMuted,fontSize:13,textAlign:'center'}}>Grow your colony to {COLONY_CAP} cells to earn your first graduation badge!</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// 🧬 LIVING CELLS — 3-TIER PERFORMANCE RENDERING
// ══════════════════════════════════════════════════════════════════════════
function Particle({x,y,angle,speed,color,size,onDone}){
  const dist   =useRef(new Animated.Value(0)).current;
  const opacity=useRef(new Animated.Value(1)).current;
  const scale  =useRef(new Animated.Value(1)).current;
  useEffect(()=>{ // eslint-disable-line react-hooks/exhaustive-deps
    Animated.parallel([
      Animated.timing(dist,   {toValue:1,duration:400+Math.random()*180,useNativeDriver:true}),
      Animated.sequence([
        Animated.timing(opacity,{toValue:0.9,duration:80, useNativeDriver:true}),
        Animated.timing(opacity,{toValue:0,  duration:280,useNativeDriver:true}),
      ]),
      Animated.timing(scale,  {toValue:0.15,duration:360,useNativeDriver:true}),
    ]).start(()=>onDone&&onDone());
  },[]);// eslint-disable-line react-hooks/exhaustive-deps
  const tx=dist.interpolate({inputRange:[0,1],outputRange:[0,Math.cos(angle)*speed]});
  const ty=dist.interpolate({inputRange:[0,1],outputRange:[0,Math.sin(angle)*speed]});
  return(<Animated.View pointerEvents="none" style={{position:'absolute',left:x-size/2,top:y-size/2,width:size,height:size,borderRadius:size/2,backgroundColor:color,opacity,transform:[{translateX:tx},{translateY:ty},{scale}]}}/>);
}

// ══════════════════════════════════════════════════════════════════════════
// 🧬 CRISP BIOLOGICAL CELL — unified component, 2 animated values only
// ══════════════════════════════════════════════════════════════════════════
// ── CRISP CELL — biological elongation along random per-cell axis ──────────
// elongAngle stored in cell state (0–π), derived from seed → each cell has
// its own division axis that never changes.  elongation animates from game.timer.
// ── Split burst — particles + ripple that fire at the snap moment ─────────
function SplitBurst({x, y, active}){
  // 8 particles flying outward at different angles
  const particles = useRef(
    Array.from({length:8}, (_,i) => ({
      angle: (i / 8) * Math.PI * 2,
      dist:  new Animated.Value(0),
      opacity: new Animated.Value(0),
      scale:   new Animated.Value(1),
    }))
  ).current;

  // Ripple ring
  const rippleScale   = useRef(new Animated.Value(0.3)).current;
  const rippleOpacity = useRef(new Animated.Value(0)).current;

  // Score float
  const floatY   = useRef(new Animated.Value(0)).current;
  const floatOpa = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) return;

    // Reset all
    particles.forEach(p => { p.dist.setValue(0); p.opacity.setValue(0); p.scale.setValue(1); });
    rippleScale.setValue(0.3); rippleOpacity.setValue(0);
    floatY.setValue(0); floatOpa.setValue(0);

    // Fire particles outward
    const particleAnims = particles.map(p =>
      Animated.parallel([
        Animated.sequence([
          Animated.timing(p.opacity, {toValue:1, duration:60, useNativeDriver:true}),
          Animated.timing(p.opacity, {toValue:0, duration:260, useNativeDriver:true}),
        ]),
        Animated.timing(p.dist, {toValue:1, duration:340, useNativeDriver:true}),
        Animated.timing(p.scale, {toValue:0.3, duration:340, useNativeDriver:true}),
      ])
    );

    // Ripple ring
    const rippleAnim = Animated.parallel([
      Animated.timing(rippleScale,   {toValue:2.8, duration:420, useNativeDriver:true}),
      Animated.sequence([
        Animated.timing(rippleOpacity, {toValue:0.7, duration:80,  useNativeDriver:true}),
        Animated.timing(rippleOpacity, {toValue:0,   duration:340, useNativeDriver:true}),
      ]),
    ]);

    // Score float
    const floatAnim = Animated.parallel([
      Animated.timing(floatY,   {toValue:-32, duration:600, useNativeDriver:true}),
      Animated.sequence([
        Animated.timing(floatOpa, {toValue:1,  duration:80,  useNativeDriver:true}),
        Animated.delay(280),
        Animated.timing(floatOpa, {toValue:0,  duration:240, useNativeDriver:true}),
      ]),
    ]);

    Animated.parallel([...particleAnims, rippleAnim, floatAnim]).start();
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!active) return null;

  const BURST_RADIUS = CR * 2.2; // how far particles travel

  return (
    <View style={{position:'absolute', left:x - CR, top:y - CR,
      width:CR*2, height:CR*2, pointerEvents:'none', overflow:'visible', zIndex:20}}>

      {/* Particles */}
      {particles.map((p, i) => {
        const tx = p.dist.interpolate({inputRange:[0,1], outputRange:[0, Math.cos(p.angle)*BURST_RADIUS]});
        const ty = p.dist.interpolate({inputRange:[0,1], outputRange:[0, Math.sin(p.angle)*BURST_RADIUS]});
        return (
          <Animated.View key={i} style={{
            position:'absolute',
            left: CR - 4,
            top:  CR - 4,
            width: 8, height: 8, borderRadius: 4,
            backgroundColor: i % 2 === 0 ? C.green400 : C.amber,
            opacity: p.opacity,
            transform: [{translateX: tx}, {translateY: ty}, {scale: p.scale}],
          }}/>
        );
      })}

      {/* Ripple ring */}
      <Animated.View style={{
        position:'absolute',
        left: CR - CR,
        top:  CR - CR,
        width: CR*2, height: CR*2, borderRadius: CR,
        borderWidth: 2, borderColor: C.green400,
        opacity: rippleOpacity,
        transform: [{scale: rippleScale}],
        pointerEvents:'none',
      }}/>

      {/* +1 score float */}
      <Animated.Text style={{
        position:'absolute',
        left: CR - 10,
        top:  CR - 8,
        fontSize: 14, fontWeight:'800',
        color: C.greenL,
        opacity: floatOpa,
        transform: [{translateY: floatY}],
        textShadowColor: C.bg,
        textShadowOffset: {width:0, height:1},
        textShadowRadius: 3,
      }}>+1</Animated.Text>
    </View>
  );
}

function MoodBubble({emoji}){
  const s=useRef(new Animated.Value(0)).current;
  useEffect(()=>{
    Animated.sequence([
      Animated.spring(s,{toValue:1,friction:4,tension:90,useNativeDriver:true}),
      Animated.delay(800),
      Animated.timing(s,{toValue:0,duration:350,useNativeDriver:true}),
    ]).start();
  },[]);// eslint-disable-line react-hooks/exhaustive-deps
  return(
    <Animated.View pointerEvents="none" style={{position:'absolute',top:-22,left:-2,
      opacity:s,transform:[{scale:s}],zIndex:99}}>
      <Text style={{fontSize:15}}>{emoji}</Text>
    </Animated.View>
  );
}
function Cell({cell,onTap,interactive,totalLive,roundTimer,mood}){
  const breathAnim =useRef(new Animated.Value(1)).current;
  const floatX     =useRef(new Animated.Value(0)).current;
  const floatY     =useRef(new Animated.Value(0)).current;
  const birthAnim  =useRef(new Animated.Value(cell.isNew?0:1)).current;
  const opacityAnim=useRef(new Animated.Value(1)).current;
  const wobble     =useRef(new Animated.Value(0)).current;
  const staticScale=useRef(new Animated.Value(1)).current;
  const splitFlash =useRef(new Animated.Value(0)).current; // white flash at snap
  const snapScale  =useRef(new Animated.Value(1)).current; // scale pop at snap
  // Elongation: two values that scale along/across elongAngle axis
  const elongSX    =useRef(new Animated.Value(1)).current; // perpendicular axis (narrows)
  const elongSY    =useRef(new Animated.Value(1)).current; // division axis (grows)
  const[countdown,setCountdown]=useState(3);
  const[splitPhase,setSplitPhase]=useState('idle'); // 'idle'|'wobbling'|'stretching'|'snapping'
  const[burstActive,setBurstActive]=useState(false);

  const tier=totalLive<=TIER1_MAX?1:totalLive<=TIER2_MAX?2:3;

  // ── Breathing + floating ──────────────────────────────────────────────
  useEffect(()=>{ // eslint-disable-line react-hooks/exhaustive-deps
    if(tier===3)return;
    const bs=cell.breathSpeed;
    const bl=Animated.loop(Animated.sequence([
      Animated.timing(breathAnim,{toValue:1.13,duration:bs,useNativeDriver:true}),
      Animated.timing(breathAnim,{toValue:0.89,duration:bs*1.1,useNativeDriver:true}),
    ]));
    bl.start();
    if(tier===1){
      const fxl=Animated.loop(Animated.sequence([Animated.timing(floatX,{toValue:2.5,duration:cell.floatSpeedX,useNativeDriver:true}),Animated.timing(floatX,{toValue:-2.5,duration:cell.floatSpeedX,useNativeDriver:true})]));
      const fyl=Animated.loop(Animated.sequence([Animated.timing(floatY,{toValue:-3,duration:cell.floatSpeedY,useNativeDriver:true}),Animated.timing(floatY,{toValue:3,duration:cell.floatSpeedY,useNativeDriver:true})]));
      fxl.start();fyl.start();
      return()=>{bl.stop();fxl.stop();fyl.stop();};
    }
    return()=>bl.stop();
  },[tier]);// eslint-disable-line react-hooks/exhaustive-deps

  // ── Birth spring ──────────────────────────────────────────────────────
  useEffect(()=>{
    if(cell.isNew){
      elongSX.setValue(1);elongSY.setValue(1);
      splitFlash.setValue(0);snapScale.setValue(1);
      // Baby cells pop in with high energy overshoot
      Animated.spring(birthAnim,{toValue:1,friction:2.2,tension:180,useNativeDriver:true}).start();
    }
  },[cell.isNew]);// eslint-disable-line react-hooks/exhaustive-deps

  // ── Elongation driven by round timer (changes 1×/second) ─────────────
  // Each cell starts elongating at a different timer value (staggered by breathOffset)
  // so the dish looks chaotically biological rather than synchronized
  useEffect(()=>{ // eslint-disable-line react-hooks/exhaustive-deps
    if(tier===3||cell.spendState!=='none'||cell.burst||cell.isNew)return;
    // Cell starts elongating when timer drops below its personal threshold
    const elongStart=TIMER_MAX*(0.3+0.4*((cell.breathOffset||0)/(Math.PI*2)));
    const eF=roundTimer<elongStart?Math.min(1,1-(roundTimer/elongStart)):0;
    Animated.parallel([
      Animated.timing(elongSX,{toValue:1-eF*0.3, duration:850,useNativeDriver:true}),
      Animated.timing(elongSY,{toValue:1+eF*0.52,duration:850,useNativeDriver:true}),
    ]).start();
  },[roundTimer]);// eslint-disable-line react-hooks/exhaustive-deps

  // ── Spend state: wobble on pending, reset elongation ─────────────────
  useEffect(()=>{ // eslint-disable-line react-hooks/exhaustive-deps
    if(cell.spendState==='pending'){
      // Reset elongation when marked for spending
      Animated.parallel([
        Animated.timing(elongSX,{toValue:1,duration:180,useNativeDriver:true}),
        Animated.timing(elongSY,{toValue:1,duration:180,useNativeDriver:true}),
      ]).start();
      wobble.setValue(0);
      Animated.loop(Animated.sequence([
        Animated.timing(wobble,{toValue:1, duration:90,useNativeDriver:true}),
        Animated.timing(wobble,{toValue:-1,duration:90,useNativeDriver:true}),
      ])).start();
    } else if(cell.spendState==='confirmed'){
      elongSX.setValue(1);elongSY.setValue(1);
      wobble.stopAnimation();wobble.setValue(0);
    } else {
      wobble.stopAnimation();
      Animated.timing(wobble,{toValue:0,duration:80,useNativeDriver:true}).start();
    }
  },[cell.spendState]);// eslint-disable-line react-hooks/exhaustive-deps

  // ── Countdown display ─────────────────────────────────────────────────
  useEffect(()=>{
    if(cell.spendState!=='pending'||!cell.pendingAt){setCountdown(3);return;}
    const interval=setInterval(()=>{
      const e=(Date.now()-cell.pendingAt)/1000;
      setCountdown(Math.max(0,3-Math.floor(e)));
    },100);
    return()=>clearInterval(interval);
  },[cell.spendState,cell.pendingAt]);

  // ── Splitting: 3-phase wobble → stretch → snap ───────────────────────
  useEffect(()=>{ // eslint-disable-line react-hooks/exhaustive-deps
    if(!cell.splitting)return;
    setSplitPhase('wobbling');
    // Phase 1: Pre-split wobble — cell shakes like it can't hold itself together (320ms)
    Animated.sequence([
      Animated.timing(wobble,{toValue: 2.2,duration:70,useNativeDriver:true}),
      Animated.timing(wobble,{toValue:-2.2,duration:70,useNativeDriver:true}),
      Animated.timing(wobble,{toValue: 1.8,duration:60,useNativeDriver:true}),
      Animated.timing(wobble,{toValue:-1.8,duration:60,useNativeDriver:true}),
      Animated.timing(wobble,{toValue: 0,  duration:60,useNativeDriver:true}),
    ]).start(()=>{
      setSplitPhase('stretching');
      // Phase 2: Stretch — water balloon about to pop (380ms)
      Animated.parallel([
        Animated.sequence([
          Animated.timing(elongSY,{toValue:1.95,duration:260,useNativeDriver:true}),
          Animated.timing(elongSY,{toValue:1.6, duration:120,useNativeDriver:true}),
        ]),
        Animated.sequence([
          Animated.timing(elongSX,{toValue:0.42,duration:260,useNativeDriver:true}),
          Animated.timing(elongSX,{toValue:0.6, duration:120,useNativeDriver:true}),
        ]),
      ]).start(()=>{
        setSplitPhase('snapping');
        // Phase 3: Snap — dramatic pinch at waist + flash (200ms)
        Animated.parallel([
          Animated.timing(elongSX,{toValue:0.05,duration:130,useNativeDriver:true}),
          Animated.timing(elongSY,{toValue:0.15,duration:130,useNativeDriver:true}),
          Animated.sequence([
            Animated.timing(splitFlash,{toValue:1,duration:80,useNativeDriver:true}),
            Animated.timing(splitFlash,{toValue:0,duration:120,useNativeDriver:true}),
          ]),
          Animated.sequence([
            Animated.timing(snapScale,{toValue:1.6,duration:90,useNativeDriver:true}),
            Animated.timing(snapScale,{toValue:1,  duration:110,useNativeDriver:true}),
          ]),
        ]).start(()=>{
          setSplitPhase('idle');
          // Fire burst particles + ripple at the snap point
          setBurstActive(true);
          setTimeout(()=>setBurstActive(false), 450); // reset after animation
          // Satisfying snap haptic — heavier than a tap
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          elongSX.setValue(1);elongSY.setValue(1);wobble.setValue(0);
        });
      });
    });
  },[cell.splitting]);// eslint-disable-line react-hooks/exhaustive-deps

  // ── Burst fade ───────────────────────────────────────────────────────
  useEffect(()=>{ // eslint-disable-line react-hooks/exhaustive-deps
    if(cell.burst){
      elongSX.setValue(1);elongSY.setValue(1);
      Animated.parallel([
        Animated.timing(opacityAnim,{toValue:0,duration:220,useNativeDriver:true}),
        Animated.timing(breathAnim, {toValue:2.0,duration:180,useNativeDriver:true}),
      ]).start();
    }
  },[cell.burst]);// eslint-disable-line react-hooks/exhaustive-deps

  const isPending  =cell.spendState==='pending';
  const isConfirmed=cell.spendState==='confirmed';
  const wobbleRot  =wobble.interpolate({inputRange:[-1,1],outputRange:['-9deg','9deg']});

  // Elongation axis strings (fixed per cell — no re-computation on render)
  const eDeg  =`${((cell.elongAngle||0)*180/Math.PI).toFixed(1)}deg`;
  const eNegDeg=`${(-(cell.elongAngle||0)*180/Math.PI).toFixed(1)}deg`;

  const hue=cell.hue||138;

  // Age-based readiness — cells shift gold as they approach splitting
  // splitPhase drives visual state: idle→wobbling→stretching→snapping
  const isReady     = splitPhase==='stretching'||splitPhase==='snapping';
  const isWobbling  = splitPhase==='wobbling';
  const readyHue    = 48; // gold
  const effectiveHue= isReady?readyHue:isWobbling?Math.round(hue*0.6+readyHue*0.4):hue;
  const glowColor   = isReady?C.amber:isWobbling?C.green400:`hsl(${hue},78%,38%)`;

  const memStroke=cell.burst?C.red:isConfirmed?C.red:isPending?C.amber:
    isReady?C.amber:cell.splitting?`hsl(${effectiveHue},85%,42%)`:`hsl(${hue},78%,38%)`;
  const cytoFill  =cell.burst||isConfirmed?`${C.red}30`:isPending?`${C.amber}30`:
    isReady?`${C.amber}28`:`hsla(${hue},72%,90%,0.85)`;
  const nucleusFill=cell.burst||isConfirmed?`${C.red}99`:isPending?`${C.amber}88`:
    isReady?`${C.amber}cc`:`hsla(${hue},68%,48%,0.88)`;
  const nucleoFill =cell.burst||isConfirmed?`${C.red}dd`:isPending?`${C.amber}cc`:
    isReady?`#fff8cc`:`hsla(${hue},60%,82%,0.95)`;
  const orgFill    =cell.burst||isConfirmed?`${C.red}66`:isPending?`${C.amber}55`:
    isReady?`${C.amber}77`:`hsla(${hue},65%,65%,0.55)`;

  const R=CR;
  const nOX=cell.nucleusOX||0, nOY=cell.nucleusOY||0;
  const nR=Math.round(R*0.34);

  return(<>
    <Animated.View style={{position:'absolute',left:cell.x*DISH-R,top:cell.y*DISH-R,opacity:opacityAnim}}>
      {mood&&!cell.burst&&<MoodBubble key={mood+'_'+cell.id} emoji={mood}/>}
      <Animated.View style={{transform:[{translateX:floatX},{translateY:floatY},{rotate:wobbleRot}]}}>
        <Animated.View style={{transform:[{scale:birthAnim}]}}>
          <Animated.View style={{transform:[{scale:tier===3?staticScale:breathAnim}]}}>
            {/* Elongation wrapper — rotates to the cell's unique division axis */}
            <Animated.View style={{transform:[{rotate:eDeg},{scaleX:elongSX},{scaleY:elongSY},{rotate:eNegDeg}]}}>
              {/* Snap scale wrapper — pops outward at the snap moment */}
              <Animated.View style={{transform:[{scale:snapScale}]}}>
              {/* Split flash overlay — brief white glow at the snap */}
              {splitPhase!=='idle'&&<Animated.View style={{position:'absolute',
                width:R*2.8,height:R*2.8,borderRadius:R*1.4,
                left:-R*0.4,top:-R*0.4,zIndex:10,pointerEvents:'none',
                backgroundColor:'#ffffff',opacity:splitFlash}}/>}
              <TouchableOpacity onPress={interactive?()=>onTap(cell.id):undefined} activeOpacity={0.75}
                style={{width:R*2,height:R*2,borderRadius:R,backgroundColor:cytoFill,
                  borderWidth:isPending?2.5:isReady?2.5:2,borderColor:memStroke,
                  alignItems:'center',justifyContent:'center',overflow:'visible',
                  shadowColor:isPending?C.amber:isConfirmed?C.red:isReady?C.amber:memStroke,
                  shadowOffset:{width:0,height:0},
                  shadowOpacity:isPending?0.65:isReady?0.75:0.25,
                  shadowRadius:isPending?7:isReady?11:3,
                  elevation:isPending?5:isReady?8:3}}>

                {/* Crescent highlight */}
                <View style={{position:'absolute',top:R*0.08,left:R*0.08,
                  width:R*0.72,height:R*0.48,borderRadius:R*0.36,
                  backgroundColor:isPending?`${C.amber}18`:isConfirmed?`${C.red}18`:`hsla(${hue},70%,70%,0.13)`,
                  transform:[{rotate:'-30deg'}]}}/>

                {/* Organelles */}
                {tier<=2&&(cell.organelles||[]).map((org,i)=>(
                  <View key={i} style={{position:'absolute',
                    left:R+Math.cos(org.angle)*R*org.dist-2,
                    top: R+Math.sin(org.angle)*R*org.dist-2,
                    width:4,height:4,borderRadius:2,backgroundColor:orgFill}}/>
                ))}

                {/* Nucleus */}
                <View style={{position:'absolute',
                  left:R+nOX-nR,top:R+nOY-nR,
                  width:nR*2,height:nR*2,borderRadius:nR,
                  backgroundColor:nucleusFill,
                  borderWidth:0.8,borderColor:memStroke+'66'}}>
                  <View style={{position:'absolute',top:nR*0.18,left:nR*0.28,
                    width:nR*0.5,height:nR*0.5,borderRadius:nR*0.25,
                    backgroundColor:nucleoFill}}/>
                </View>

                {/* X when confirmed */}
                {isConfirmed&&!cell.burst&&<>
                  <View style={{position:'absolute',width:R*1.1,height:2,backgroundColor:C.red+'cc',transform:[{rotate:'45deg'}]}}/>
                  <View style={{position:'absolute',width:R*1.1,height:2,backgroundColor:C.red+'cc',transform:[{rotate:'-45deg'}]}}/>
                </>}
              </TouchableOpacity>
              </Animated.View>{/* close snapScale */}
            </Animated.View>{/* close elongation */}
            {/* Pending countdown dots */}
            {isPending&&!cell.burst&&(
              <View style={{position:'absolute',bottom:-8,left:0,right:0,flexDirection:'row',justifyContent:'center',gap:3}}>
                {[2,1,0].map(d=><View key={d} style={{width:4,height:4,borderRadius:2,backgroundColor:countdown>d?C.amber:C.amber+'33'}}/>)}
              </View>
            )}
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </Animated.View>
    {/* Split burst — particles + ripple at snap moment */}
    {burstActive && (
      <SplitBurst
        x={CR}
        y={CR}
        active={burstActive}
      />
    )}
  </>);
}

// ── Split-ready pulse ring — glows amber when cells are stretching ──────
function SplitReadyPulse({active}){
  const pulseAnim=useRef(new Animated.Value(0)).current;
  useEffect(()=>{
    if(active){
      const loop=Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim,{toValue:1,duration:420,useNativeDriver:true}),
        Animated.timing(pulseAnim,{toValue:0,duration:420,useNativeDriver:true}),
      ]));
      loop.start();
      return()=>loop.stop();
    } else {
      Animated.timing(pulseAnim,{toValue:0,duration:200,useNativeDriver:true}).start();
    }
  },[active]);// eslint-disable-line react-hooks/exhaustive-deps
  const opacity=pulseAnim.interpolate({inputRange:[0,1],outputRange:[0,0.55]});
  return(
    <Animated.View style={{position:'absolute',inset:-6,borderRadius:(DISH+12)/2,
      borderWidth:3,borderColor:C.amber,opacity,pointerEvents:'none'}}/>
  );
}

// Petri Dish with graduation ring color
function PetriDish({cells,onTap,interactive,phase,nearGrad,roundTimer,cellMoods={}}){
  const[particles,setParticles]=useState([]);
  const prevRef=useRef(new Map());
  const totalLive=useMemo(()=>cells.filter(c=>!c.burst).length,[cells]);

  useEffect(()=>{ // eslint-disable-line react-hooks/exhaustive-deps
    const newP=[];
    cells.forEach(cell=>{
      const prev=prevRef.current.get(cell.id)||{};
      const cx=cell.x*DISH, cy=cell.y*DISH;
      // Only spawn particles in tier 1 & 2
      if(totalLive<=TIER2_MAX){
        if(cell.splitting&&!prev.splitting){
          // Main burst ring — 12 green particles
          for(let i=0;i<12;i++)newP.push({id:`sp_${cell.id}_${i}_${Date.now()}`,x:cx,y:cy,angle:(i/12)*Math.PI*2,speed:24+Math.random()*16,color:C.green400,size:5+Math.random()*4});
          // Gold snap sparks — 6 fast bright particles
          for(let i=0;i<6;i++)newP.push({id:`sg_${cell.id}_${i}_${Date.now()}`,x:cx,y:cy,angle:(i/6)*Math.PI*2+0.26,speed:32+Math.random()*18,color:'#FFD700',size:3+Math.random()*2});
        }
        if(cell.burst&&!prev.burst)for(let i=0;i<12;i++)newP.push({id:`bp_${cell.id}_${i}_${Date.now()}`,x:cx,y:cy,angle:(i/12)*Math.PI*2,speed:22+Math.random()*14,color:C.red,size:3+Math.random()*4});
        if(cell.isNew&&!prev.isNew){
          // Baby cell birth sparkles
          for(let i=0;i<6;i++)newP.push({id:`nb_${cell.id}_${i}_${Date.now()}`,x:cx,y:cy,angle:(i/6)*Math.PI*2,speed:10+Math.random()*8,color:C.green300,size:2.5+Math.random()*2.5});
        }
      } else {
        // Tier 3: only burst particles
        if(cell.burst&&!prev.burst)for(let i=0;i<6;i++)newP.push({id:`bp3_${cell.id}_${i}_${Date.now()}`,x:cx,y:cy,angle:(i/6)*Math.PI*2,speed:14+Math.random()*8,color:C.red,size:3+Math.random()*2});
      }
      prevRef.current.set(cell.id,{splitting:cell.splitting,burst:cell.burst,isNew:cell.isNew});
    });
    const ids=new Set(cells.map(c=>c.id));for(const id of prevRef.current.keys())if(!ids.has(id))prevRef.current.delete(id);
    if(newP.length)setParticles(p=>[...p,...newP]);
  },[cells]);// eslint-disable-line react-hooks/exhaustive-deps

  const removeParticle=useCallback(id=>setParticles(p=>p.filter(x=>x.id!==id)),[]);
  const hasAny=s=>cells.some(c=>c.spendState===s);
  const ring=nearGrad?C.amber:phase==='splitting'?C.green500:hasAny('confirmed')?C.red:hasAny('pending')?C.amber:C.green700;

  return(
    <View style={{width:DISH,height:DISH,alignSelf:'center'}}>
      <View style={[ss.dish,{width:DISH,height:DISH,borderRadius:DISH/2,borderColor:ring+'88',
        shadowColor:nearGrad?C.amber:ring,shadowOffset:{width:0,height:0},
        shadowOpacity:nearGrad?0.5:0.3,shadowRadius:nearGrad?16:10,elevation:nearGrad?6:4}]}>
        {phase==='splitting'&&<View style={{position:'absolute',inset:6,borderRadius:(DISH-12)/2,borderWidth:1,borderColor:C.green500+'33'}}/>}
        <SplitReadyPulse active={phase==='splitting'}/>
        {nearGrad&&<View style={{position:'absolute',inset:4,borderRadius:(DISH-8)/2,borderWidth:1.5,borderColor:C.amber+'33'}}/>}
        {cells.map(c=><Cell key={c.id} cell={c} onTap={onTap} interactive={interactive} totalLive={totalLive} roundTimer={roundTimer} mood={cellMoods[c.id]}/>)}
        {particles.map(p=><Particle key={p.id} {...p} onDone={()=>removeParticle(p.id)}/>)}
      </View>
    </View>
  );
}

// ── Dish + Session Timer ───────────────────────────────────────────────────
function DishArea({cells,onTap,interactive,phase,sessionRemaining,sessionTotal,nearGrad,roundTimer,roundPct,roundColor,rateStory,colonyColor,cellMoods}){
  const idleColor=colonyColor||C.green400;
  const sc=sessionRemaining<=60?C.red:sessionRemaining<=120?C.amber:idleColor;
  const urgent=sessionRemaining<=120,critical=sessionRemaining<=30;
  const ringPulse=useRef(new Animated.Value(1)).current;
  useEffect(()=>{ // eslint-disable-line react-hooks/exhaustive-deps
    if(critical){Animated.loop(Animated.sequence([Animated.timing(ringPulse,{toValue:1.04,duration:350,useNativeDriver:true}),Animated.timing(ringPulse,{toValue:1,duration:350,useNativeDriver:true})])).start();}
    else{ringPulse.stopAnimation();ringPulse.setValue(1);}
  },[critical]);// eslint-disable-line react-hooks/exhaustive-deps
  const timerBarW=Math.min(DISH-32,220);
  return(
    <View style={{alignSelf:'center',width:DISH,height:DISH+54}}>
      <Animated.View style={{position:'absolute',top:-10,left:-10,right:-10,bottom:44,borderRadius:(DISH+20)/2,
        borderWidth:urgent?3:1.5,borderColor:sc+(urgent?'cc':'33'),
        shadowColor:sc,shadowOffset:{width:0,height:0},shadowOpacity:urgent?(critical?0.85:0.5):0,shadowRadius:12,elevation:urgent?8:0,
        transform:[{scale:ringPulse}]}}/>
      <PetriDish cells={cells} onTap={onTap} interactive={interactive} phase={phase} nearGrad={nearGrad} roundTimer={roundTimer} cellMoods={cellMoods}/>
      {/* Session timer — top-right corner, outside the ring */}
      <View pointerEvents="none" style={{position:'absolute',top:-8,right:-8,zIndex:20}}>
        <View style={{backgroundColor:sc+'44',borderRadius:10,paddingHorizontal:9,paddingVertical:5,borderWidth:1.5,borderColor:sc+'99',flexDirection:'row',alignItems:'center',gap:3}}>
          <Text style={{fontSize:10}}>⏱</Text>
          <Text style={{color:sc,fontWeight:'800',fontSize:13,letterSpacing:-0.5}}>{formatTime(sessionRemaining)}</Text>
        </View>
      </View>
      {/* Round split timer — below the circle in the extra 54px */}
      <View pointerEvents="none" style={{position:'absolute',bottom:0,left:0,right:0,alignItems:'center',gap:5}}>
        <Text style={{color:roundColor,fontSize:11,fontWeight:'700',letterSpacing:0.2}}>
          {phase==='splitting'?`${rateStory?.emoji||''}  Splitting! Baby cells being born...`:`Split in: ${roundTimer}s`}
        </Text>
        <View style={{width:timerBarW,height:4,backgroundColor:C.surface,borderRadius:2,overflow:'hidden'}}>
          <View style={{height:4,backgroundColor:roundColor,borderRadius:2,width:`${roundPct*100}%`}}/>
        </View>
      </View>
    </View>
  );
}
// ── Colony Progress Banner (shows at ≥ COLONY_WARN) ───────────────────────
function ColonyProgressBanner({count,colonyNum,onMuseum}){
  const pct=count/COLONY_CAP;
  const remaining=COLONY_CAP-count;
  const isWarn=count>=COLONY_WARN;
  const barColor=count>=45?C.red:isWarn?C.amber:C.green500;
  const bannerPulse=useRef(new Animated.Value(1)).current;
  useEffect(()=>{ // eslint-disable-line react-hooks/exhaustive-deps
    if(count>=45){Animated.loop(Animated.sequence([Animated.timing(bannerPulse,{toValue:1.02,duration:400,useNativeDriver:true}),Animated.timing(bannerPulse,{toValue:1,duration:400,useNativeDriver:true})])).start();}
    else{bannerPulse.stopAnimation();bannerPulse.setValue(1);}
  },[count>=45]);// eslint-disable-line react-hooks/exhaustive-deps

  return(
    <Animated.View style={{marginHorizontal:16,marginBottom:6,transform:[{scale:bannerPulse}]}}>
      <TouchableOpacity onPress={onMuseum}
        style={{backgroundColor:isWarn?'#fff7ed':C.surface,borderRadius:12,borderWidth:1.5,
          borderColor:barColor+'66',padding:10}}>
        <View style={{flexDirection:'row',alignItems:'center',gap:8,marginBottom:6}}>
          <Text style={{fontSize:14}}>🎓</Text>
          <Text style={{color:barColor,fontWeight:'700',fontSize:12,flex:1}}>
            Colony #{colonyNum} — {remaining===0?'Graduating!...':`${remaining} cells until graduation!`}
          </Text>
          <Text style={{fontSize:14}}>🏛️ ›</Text>
        </View>
        <View style={{height:5,backgroundColor:C.surface,borderRadius:3,overflow:'hidden'}}>
          <View style={{height:5,backgroundColor:barColor,borderRadius:3,width:`${pct*100}%`}}/>
        </View>
        <View style={{flexDirection:'row',justifyContent:'space-between',marginTop:3}}>
          <Text style={{fontSize:10,color:C.textMuted}}>{count}/{COLONY_CAP} cells</Text>
          <Text style={{fontSize:10,color:barColor}}>{Math.round(pct*100)}%</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Flash Deal ─────────────────────────────────────────────────────────────
function FlashDealBanner({deal,onBuy,onDismiss,cellCount}){
  const slideY=useRef(new Animated.Value(-100)).current;
  const pulse =useRef(new Animated.Value(1)).current;
  const canAfford=cellCount>=deal.dealCost;
  const urgency  =deal.secondsLeft<=5;
  const pct      =deal.secondsLeft/FLASH_DEAL_DURATION;
  const barColor =deal.secondsLeft<=5?C.red:deal.secondsLeft<=10?C.amber:C.orange;
  useEffect(()=>{ // eslint-disable-line react-hooks/exhaustive-deps
    Animated.spring(slideY,{toValue:0,friction:7,tension:80,useNativeDriver:true}).start();
  },[]);// eslint-disable-line react-hooks/exhaustive-deps
  useEffect(()=>{ // eslint-disable-line react-hooks/exhaustive-deps
    if(urgency){Animated.loop(Animated.sequence([Animated.timing(pulse,{toValue:1.04,duration:250,useNativeDriver:true}),Animated.timing(pulse,{toValue:1,duration:250,useNativeDriver:true})])).start();}
  },[urgency]);// eslint-disable-line react-hooks/exhaustive-deps
  return(
    <Animated.View style={{transform:[{translateY:slideY},{scale:pulse}],marginHorizontal:16,marginBottom:8,zIndex:50}}>
      <View style={{backgroundColor:'#1a0800',borderRadius:14,borderWidth:2,borderColor:C.orange+'cc',overflow:'hidden'}}>
        <View style={{height:4,backgroundColor:C.surface}}>
          <View style={{height:4,backgroundColor:barColor,width:`${pct*100}%`}}/>
        </View>
        <View style={{padding:12,gap:10}}>
          <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
            <Text style={{fontSize:11,letterSpacing:1.5,color:C.orange,fontWeight:'800'}}>🔥 FLASH DEAL</Text>
            <View style={{flex:1}}/>
            <View style={{backgroundColor:barColor+'33',borderRadius:8,paddingHorizontal:8,paddingVertical:3,borderWidth:1,borderColor:barColor+'66'}}>
              <Text style={{color:barColor,fontWeight:'800',fontSize:13}}>{deal.secondsLeft}s</Text>
            </View>
            <TouchableOpacity onPress={onDismiss} style={{padding:4}}><Text style={{color:C.textMuted,fontSize:16}}>×</Text></TouchableOpacity>
          </View>
          <View style={{flexDirection:'row',alignItems:'center',gap:12}}>
            <View style={{width:52,height:52,borderRadius:12,backgroundColor:deal.color+'22',borderWidth:1.5,borderColor:deal.color+'66',alignItems:'center',justifyContent:'center'}}>
              <Text style={{fontSize:28}}>{deal.emoji}</Text>
            </View>
            <View style={{flex:1}}>
              <Text style={{color:C.text,fontWeight:'800',fontSize:14}}>{deal.name}</Text>
              <View style={{flexDirection:'row',alignItems:'center',gap:8,marginTop:3}}>
                <Text style={{color:C.textMuted,fontSize:12,textDecorationLine:'line-through'}}>{deal.originalCost} cells</Text>
                <Text style={{color:C.orange,fontWeight:'800',fontSize:16}}>{deal.dealCost} cells</Text>
                <View style={{backgroundColor:C.orange+'22',borderRadius:6,paddingHorizontal:6,paddingVertical:2,borderWidth:1,borderColor:C.orange+'44'}}>
                  <Text style={{color:C.orange,fontSize:10,fontWeight:'700'}}>SAVE {deal.originalCost-deal.dealCost}!</Text>
                </View>
              </View>
            </View>
          </View>
          <View style={{backgroundColor:canAfford?C.green900+'88':C.surface,borderRadius:8,padding:8,borderWidth:1,borderColor:canAfford?C.green700:C.border}}>
            <Text style={{color:canAfford?C.green300:C.textMuted,fontSize:11,lineHeight:17,textAlign:'center'}}>
              {canAfford
                ?`⚡ You can afford! But those ${deal.dealCost} cells will grow to ~${Math.floor(deal.dealCost*Math.pow(1.05,3))} in 3 rounds!`
                :`💪 Need ${deal.dealCost-cellCount} more cells. Save and next deal you'll be ready!`}
            </Text>
          </View>
          <View style={{flexDirection:'row',gap:8}}>
            <TouchableOpacity onPress={onDismiss} style={{flex:1,backgroundColor:C.surface,borderRadius:9,padding:10,alignItems:'center',borderWidth:1,borderColor:C.border}}>
              <Text style={{color:C.green400,fontWeight:'700',fontSize:13}}>⏳ Skip & save</Text>
            </TouchableOpacity>
            {canAfford&&(
              <TouchableOpacity onPress={onBuy} style={{flex:1.3,backgroundColor:C.orange+'22',borderRadius:9,padding:10,alignItems:'center',borderWidth:2,borderColor:C.orange+'88'}}>
                <Text style={{color:C.orange,fontWeight:'800',fontSize:13}}>🔥 Grab deal!</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

// ── Resistance Meter ───────────────────────────────────────────────────────
function ResistanceMeter({value,justFilled}){
  const pct=Math.min(value/RESIST_MAX,1);
  const filledStars=Math.floor(pct*5);
  const barColor=pct>=1?C.green500:pct>=0.6?C.green400:pct>=0.3?C.amber:C.textMuted;
  const pulse=useRef(new Animated.Value(1)).current;
  const glow =useRef(new Animated.Value(0)).current;
  useEffect(()=>{ // eslint-disable-line react-hooks/exhaustive-deps
    if(justFilled){
      Animated.sequence([
        Animated.timing(glow, {toValue:1,duration:200,useNativeDriver:true}),
        Animated.spring(pulse,{toValue:1.06,friction:3,useNativeDriver:true}),
        Animated.delay(600),
        Animated.parallel([Animated.timing(glow, {toValue:0,duration:400,useNativeDriver:true}),Animated.spring(pulse,{toValue:1,friction:5,useNativeDriver:true})]),
      ]).start();
    }
  },[justFilled]);// eslint-disable-line react-hooks/exhaustive-deps
  const glowOpacity=glow.interpolate({inputRange:[0,1],outputRange:[0,0.4]});
  return(
    <Animated.View style={{marginHorizontal:16,marginBottom:6,transform:[{scale:pulse}]}}>
      <Animated.View style={{position:'absolute',inset:0,borderRadius:12,backgroundColor:C.green400,opacity:glowOpacity}}/>
      <View style={{backgroundColor:C.card,borderRadius:12,borderWidth:1.5,borderColor:pct>=1?C.green500:pct>=0.5?C.green700:C.border,padding:10}}>
        <View style={{flexDirection:'row',alignItems:'center',gap:6,marginBottom:7}}>
          <Text style={{fontSize:12}}>💪</Text>
          <Text style={{color:C.textMuted,fontSize:11,fontWeight:'700',letterSpacing:0.5}}>WILLPOWER METER</Text>
          <View style={{flex:1}}/>
          <View style={{flexDirection:'row',gap:2}}>
            {[0,1,2,3,4].map(i=><Text key={i} style={{fontSize:14,opacity:i<filledStars?1:0.2}}>⭐</Text>)}
          </View>
        </View>
        <View style={{height:7,backgroundColor:C.surface,borderRadius:4,overflow:'hidden'}}>
          <View style={{height:7,backgroundColor:barColor,borderRadius:4,width:`${pct*100}%`}}/>
        </View>
        <Text style={{color:C.textFaint,fontSize:10,marginTop:5,textAlign:'center'}}>
          {pct>=1?`🎉 BONUS CELLS! +${RESIST_BONUS_CELLS} cells!`:pct>=0.8?`⚡ Almost! Don't spend now!`:'Save without spending → fill stars → earn bonus cells!'}
        </Text>
      </View>
    </Animated.View>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// 🐇 SPLIT CELEBRATION OVERLAY — rotating multiplying-things theme
// ══════════════════════════════════════════════════════════════════════════
const SPLIT_THEMES = [
  {emoji:'🐰',title:'Bunnies multiplied!',   sub:'Save cells → they breed like bunnies!'},
  {emoji:'🍪',title:'Cookies made cookies!', sub:'Every saved cookie baked a new one!'},
  {emoji:'🐟',title:'Fish had babies!',      sub:'Your colony is spawning! 🌊'},
  {emoji:'⭐',title:'Stars multiplied!',     sub:'Each star lit up a new one!'},
  {emoji:'🌱',title:'Seeds sprouted!',       sub:'Every seed grew into two plants!'},
  {emoji:'🐝',title:'Bees swarmed!',         sub:'The hive just got bigger!'},
  {emoji:'🍄',title:'Mushrooms spread!',     sub:'Spores everywhere — new cells popped up!'},
  {emoji:'🐣',title:'Eggs hatched!',         sub:'New life emerged from every saved egg!'},
  {emoji:'🌊',title:'Waves multiplied!',     sub:'One wave became a whole ocean!'},
  {emoji:'🦠',title:'Microbes divided!',     sub:'Just like real biology — one becomes two!'},
];

function SplitCelebrationOverlay({gained,bonusCells,onDone,round}){
  const theme = SPLIT_THEMES[(round||0) % SPLIT_THEMES.length];
  const bgOpacity  =useRef(new Animated.Value(0)).current;
  const cardScale  =useRef(new Animated.Value(0.6)).current;
  const cardOpacity=useRef(new Animated.Value(0)).current;

  useEffect(()=>{ // eslint-disable-line react-hooks/exhaustive-deps
    // Animate in
    Animated.parallel([
      Animated.timing(bgOpacity,   {toValue:0.72,duration:180,useNativeDriver:true}),
      Animated.spring( cardScale,  {toValue:1,   friction:4, tension:120,useNativeDriver:true}),
      Animated.timing( cardOpacity,{toValue:1,   duration:200,useNativeDriver:true}),
    ]).start(()=>{
      // Hold for 1.3s then fade out
      setTimeout(()=>{
        Animated.parallel([
          Animated.timing(bgOpacity,   {toValue:0,duration:280,useNativeDriver:true}),
          Animated.timing(cardScale,   {toValue:1.1,duration:240,useNativeDriver:true}),
          Animated.timing(cardOpacity, {toValue:0,duration:280,useNativeDriver:true}),
        ]).start(()=>onDone&&onDone());
      },1300);
    });
  },[]);// eslint-disable-line react-hooks/exhaustive-deps

  const total=gained+(bonusCells||0);
  const hasBonusBonus=bonusCells>0;

  return(
    <View pointerEvents="none" style={{position:'absolute',inset:0,alignItems:'center',justifyContent:'center',zIndex:80}}>
      {/* Dimmed backdrop */}
      <Animated.View style={{position:'absolute',inset:0,backgroundColor:'#000',opacity:bgOpacity}}/>

      {/* Card */}
      <Animated.View style={{alignItems:'center',gap:10,opacity:cardOpacity,transform:[{scale:cardScale}]}}>
        <Text style={{fontSize:80}}>{theme.emoji}</Text>
        <View style={{backgroundColor:C.green900,borderRadius:20,borderWidth:2.5,
          borderColor:C.green500,paddingHorizontal:32,paddingVertical:20,alignItems:'center',gap:6,
          shadowColor:C.green500,shadowOffset:{width:0,height:0},shadowOpacity:0.6,shadowRadius:20,elevation:10}}>
          <Text style={{color:C.green400,fontWeight:'800',fontSize:22,letterSpacing:-0.5,textAlign:'center'}}>
            {theme.title}
          </Text>
          <Text style={{color:C.text,fontWeight:'800',fontSize:40,letterSpacing:-1}}>
            +{total}
          </Text>
          {hasBonusBonus&&(
            <View style={{backgroundColor:C.purple+'33',borderRadius:10,paddingHorizontal:14,paddingVertical:5,borderWidth:1,borderColor:C.purple+'66'}}>
              <Text style={{color:C.purple,fontWeight:'700',fontSize:12}}>
                includes +{bonusCells} willpower bonus! 💪
              </Text>
            </View>
          )}
          <Text style={{color:C.textMuted,fontSize:13}}>
            {theme.sub}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

function DealExpiredToast({message,onDone}){
  const opacity=useRef(new Animated.Value(0)).current;
  const slideY =useRef(new Animated.Value(20)).current;
  useEffect(()=>{ // eslint-disable-line react-hooks/exhaustive-deps
    Animated.parallel([Animated.timing(opacity,{toValue:1,duration:200,useNativeDriver:true}),Animated.timing(slideY,{toValue:0,duration:200,useNativeDriver:true})]).start(()=>{
      setTimeout(()=>Animated.parallel([Animated.timing(opacity,{toValue:0,duration:300,useNativeDriver:true}),Animated.timing(slideY,{toValue:-20,duration:300,useNativeDriver:true})]).start(()=>onDone&&onDone()),1800);
    });
  },[]);// eslint-disable-line react-hooks/exhaustive-deps
  return(
    <Animated.View pointerEvents="none" style={{position:'absolute',bottom:120,left:24,right:24,opacity,transform:[{translateY:slideY}],zIndex:99}}>
      <View style={{backgroundColor:C.card,borderRadius:12,borderWidth:1,borderColor:C.green700,padding:12}}>
        <Text style={{color:C.green300,fontSize:13,textAlign:'center',fontWeight:'600'}}>{message}</Text>
      </View>
    </Animated.View>
  );
}

// ── Buy Ceremony ───────────────────────────────────────────────────────────
function CeremonyParticle({x,y,angle,speed,color,size}){
  const dist   =useRef(new Animated.Value(0)).current;
  const opacity=useRef(new Animated.Value(1)).current;
  const scale  =useRef(new Animated.Value(1)).current;
  useEffect(()=>{ // eslint-disable-line react-hooks/exhaustive-deps
    Animated.parallel([Animated.timing(dist,{toValue:1,duration:500+Math.random()*200,useNativeDriver:true}),Animated.sequence([Animated.timing(opacity,{toValue:0.95,duration:100,useNativeDriver:true}),Animated.timing(opacity,{toValue:0,duration:380,useNativeDriver:true})]),Animated.timing(scale,{toValue:0.1,duration:480,useNativeDriver:true})]).start();
  },[]);// eslint-disable-line react-hooks/exhaustive-deps
  const tx=dist.interpolate({inputRange:[0,1],outputRange:[0,Math.cos(angle)*speed]});
  const ty=dist.interpolate({inputRange:[0,1],outputRange:[0,Math.sin(angle)*speed]});
  return(<Animated.View pointerEvents="none" style={{position:'absolute',left:x-size/2,top:y-size/2,width:size,height:size,borderRadius:size/2,backgroundColor:color,opacity,transform:[{translateX:tx},{translateY:ty},{scale}]}}/>);
}

function BuyCeremony({item,isDeal,onComplete,kidName,roundsEarned}){
  const bgOp  =useRef(new Animated.Value(0)).current;
  const iScale=useRef(new Animated.Value(0)).current;
  const rScale=useRef(new Animated.Value(0.4)).current;
  const rOp   =useRef(new Animated.Value(0.9)).current;
  const textY =useRef(new Animated.Value(60)).current;
  const textOp=useRef(new Animated.Value(0)).current;
  const CX=SW/2,CY=260,N=24;
  const particles=Array.from({length:N},(_,i)=>({key:i,x:CX,y:CY,angle:(i/N)*Math.PI*2,speed:45+Math.random()*50,color:i%4===0?(isDeal?C.orange:C.amber):i%4===1?C.green400:i%4===2?item.color:'#f0fdf4',size:5+Math.random()*7}));
  useEffect(()=>{ // eslint-disable-line react-hooks/exhaustive-deps
    Animated.sequence([Animated.timing(bgOp,{toValue:1,duration:220,useNativeDriver:false}),Animated.parallel([Animated.spring(iScale,{toValue:1,friction:3,tension:100,useNativeDriver:true}),Animated.timing(rScale,{toValue:2.2,duration:650,useNativeDriver:true}),Animated.timing(rOp,{toValue:0,duration:650,useNativeDriver:true})]),Animated.parallel([Animated.timing(textY,{toValue:0,duration:320,useNativeDriver:true}),Animated.timing(textOp,{toValue:1,duration:280,useNativeDriver:true})]),Animated.delay(1400)]).start(()=>onComplete());
  },[]);// eslint-disable-line react-hooks/exhaustive-deps
  const bgColor=bgOp.interpolate({inputRange:[0,1],outputRange:['rgba(10,15,10,0)','rgba(10,15,10,0.94)']});
  return(
    <View style={{flex:1,alignItems:'center',justifyContent:'center'}}>
      <Animated.View style={{position:'absolute',inset:0,backgroundColor:bgColor}}/>
      <Animated.View style={{position:'absolute',width:180,height:180,left:CX-90,top:CY-90,borderRadius:90,borderWidth:3,borderColor:isDeal?C.orange:item.color,opacity:rOp,transform:[{scale:rScale}]}}/>
      {particles.map(p=><CeremonyParticle key={p.key} {...p}/>)}
      <Animated.View style={{alignItems:'center',gap:14,transform:[{scale:iScale}]}}>
        {isDeal&&<View style={{backgroundColor:C.orange+'33',borderRadius:10,paddingHorizontal:14,paddingVertical:6,borderWidth:1.5,borderColor:C.orange}}><Text style={{color:C.orange,fontWeight:'800',fontSize:12}}>🔥 FLASH DEAL GRABBED!</Text></View>}
        <Text style={{fontSize:100}}>{item.emoji}</Text>
        <View style={{backgroundColor:item.color+'33',borderRadius:22,paddingHorizontal:22,paddingVertical:10,borderWidth:2,borderColor:item.color}}>
          <Text style={{color:item.color,fontWeight:'800',fontSize:18}}>{item.name}</Text>
        </View>
      </Animated.View>
      <Animated.View style={{position:'absolute',bottom:120,alignItems:'center',opacity:textOp,transform:[{translateY:textY}],paddingHorizontal:24}}>
        <Text style={{color:C.text,fontWeight:'800',fontSize:28,letterSpacing:-1,textAlign:'center'}}>
          {isDeal?'⚡ Deal grabbed!':'🎉 You earned it!'}
        </Text>
        {isDeal&&(
          <Text style={{color:C.orange,fontSize:14,marginTop:6,fontWeight:'700',textAlign:'center'}}>
            Saved {item.originalCost-item.dealCost} cells with the deal!
          </Text>
        )}
        {isDeal&&(
          <Text style={{color:C.textMuted,fontSize:12,marginTop:4,textAlign:'center'}}>
            Remember: those cells would have multiplied next round 🌱
          </Text>
        )}
        {!isDeal&&kidName&&(
          <Text style={{color:C.green300,fontSize:14,marginTop:6,fontWeight:'700',textAlign:'center'}}>
            {kidName} saved up for this — well done! 💪
          </Text>
        )}
        {!isDeal&&roundsEarned>0&&(
          <Text style={{color:C.textMuted,fontSize:12,marginTop:4,textAlign:'center'}}>
            {roundsEarned} rounds of saving made this possible
          </Text>
        )}
      </Animated.View>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// 😊 KID FEEDBACK SCREEN — 3 taps, shown after every session
// ══════════════════════════════════════════════════════════════════════════
const KID_MOODS=[
  {emoji:'😄',label:'Super fun!',   value:'great'},
  {emoji:'🙂',label:'Pretty good',  value:'good'},
  {emoji:'😐',label:'It was OK',    value:'ok'},
  {emoji:'😕',label:'Confusing',    value:'confusing'},
];
const KID_FAVS=[
  {emoji:'🧬',label:'Growing cells', value:'cells'},
  {emoji:'🔥',label:'Flash deals',   value:'deals'},
  {emoji:'🛍️',label:'Shopping',      value:'shop'},
  {emoji:'🏛️',label:'Museum',        value:'museum'},
];

function KidFeedbackScreen({kidId,sessionCells,onDone}){
  const{state,dispatch}=useApp();
  const[step,setStep]=useState(0);      // 0=mood, 1=favourite, 2=thanks
  const[mood,setMood]=useState(null);
  const[fav,setFav]=useState(null);
  const kid=state.parent?.kids?.find(k=>k.id===kidId);
  const bounceAnim=useRef(new Animated.Value(0)).current;

  useEffect(()=>{ // eslint-disable-line react-hooks/exhaustive-deps
    Animated.loop(Animated.sequence([
      Animated.timing(bounceAnim,{toValue:-8,duration:500,useNativeDriver:true}),
      Animated.timing(bounceAnim,{toValue:0, duration:500,useNativeDriver:true}),
    ])).start();
  },[]);// eslint-disable-line react-hooks/exhaustive-deps

  const handleMood=(m)=>{
    setMood(m);
    Animated.sequence([
      Animated.timing(bounceAnim,{toValue:-14,duration:150,useNativeDriver:true}),
      Animated.timing(bounceAnim,{toValue:0,  duration:150,useNativeDriver:true}),
    ]).start(()=>setStep(1));
  };
  const handleFav=async(f)=>{
    setFav(f);
    dispatch({type:'SAVE_KID_FEEDBACK',kidId,
      emoji:mood?.value,favourite:f?.value,sessionCells});
    // Also save to Supabase
    const userId=state.supabaseUser?.id||null;
    submitFeedback(userId,{
      category:'kid_session',
      text:`Mood: ${mood?.value||'none'} | Favourite: ${f?.value||'none'}`,
      rating:mood?.value==='great'?5:mood?.value==='good'?4:mood?.value==='ok'?3:2,
      source:'kid',
    });
    setStep(2);
    setTimeout(onDone, 1400);
  };
  const skip=()=>{
    if(mood)dispatch({type:'SAVE_KID_FEEDBACK',kidId,
      emoji:mood?.value,favourite:null,sessionCells});
    onDone();
  };

  return(
    <SafeAreaView style={{flex:1,backgroundColor:C.bg}}>
      <View style={{flex:1,padding:24,gap:20,justifyContent:'center'}}>

        {step===0&&(
          <>
            <Animated.Text style={{fontSize:64,textAlign:'center',
              transform:[{translateY:bounceAnim}]}}>
              {kid?.avatar||'🧬'}
            </Animated.Text>
            <Text style={{color:C.text,fontWeight:'800',fontSize:22,
              textAlign:'center',letterSpacing:-0.5}}>
              How was that, {kid?.name||'friend'}?
            </Text>
            <View style={{flexDirection:'row',flexWrap:'wrap',gap:10,
              justifyContent:'center'}}>
              {KID_MOODS.map(m=>(
                <TouchableOpacity key={m.value} onPress={()=>handleMood(m)}
                  style={{width:(SW-68)/2,backgroundColor:C.card,
                    borderRadius:14,borderWidth:1.5,borderColor:C.border,
                    padding:14,alignItems:'center',gap:6}}>
                  <Text style={{fontSize:36}}>{m.emoji}</Text>
                  <Text style={{color:C.text,fontSize:13,fontWeight:'600',
                    textAlign:'center'}}>{m.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity onPress={skip}
              style={{alignItems:'center',paddingVertical:8}}>
              <Text style={{color:C.textFaint,fontSize:13}}>Skip</Text>
            </TouchableOpacity>
          </>
        )}

        {step===1&&(
          <>
            <Text style={{fontSize:48,textAlign:'center'}}>{mood?.emoji}</Text>
            <Text style={{color:C.text,fontWeight:'800',fontSize:22,
              textAlign:'center',letterSpacing:-0.5}}>
              What was your favourite?
            </Text>
            <View style={{flexDirection:'row',flexWrap:'wrap',gap:10,
              justifyContent:'center'}}>
              {KID_FAVS.map(f=>(
                <TouchableOpacity key={f.value} onPress={()=>handleFav(f)}
                  style={{width:(SW-68)/2,backgroundColor:C.card,
                    borderRadius:14,borderWidth:1.5,borderColor:C.border,
                    padding:14,alignItems:'center',gap:6}}>
                  <Text style={{fontSize:32}}>{f.emoji}</Text>
                  <Text style={{color:C.text,fontSize:13,fontWeight:'600',
                    textAlign:'center'}}>{f.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity onPress={skip}
              style={{alignItems:'center',paddingVertical:8}}>
              <Text style={{color:C.textFaint,fontSize:13}}>Skip</Text>
            </TouchableOpacity>
          </>
        )}

        {step===2&&(
          <View style={{alignItems:'center',gap:16}}>
            <Text style={{fontSize:72}}>🙏</Text>
            <Text style={{color:C.green400,fontWeight:'800',fontSize:24,
              textAlign:'center'}}>Thanks!</Text>
            <Text style={{color:C.textMuted,fontSize:15,textAlign:'center',
              lineHeight:22}}>Your feedback helps make{'\n'}Money Cells better!</Text>
          </View>
        )}

      </View>
    </SafeAreaView>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// 💬 PARENT FEEDBACK SCREEN — detailed form, accessible from dashboard
// ══════════════════════════════════════════════════════════════════════════
const FB_CATS=[
  {id:'bug',     emoji:'🐛', label:'Something broken'},
  {id:'feature', emoji:'💡', label:'Feature idea'},
  {id:'content', emoji:'📚', label:'Content / lessons'},
  {id:'general', emoji:'💬', label:'General feedback'},
];

function ParentFeedbackScreen({onBack}){
  const{state,dispatch}=useApp();
  const[cat,setCat]=useState(null);
  const[text,setText]=useState('');
  const[rating,setRating]=useState(0);
  const[email,setEmail]=useState(state.parent?.email||'');
  const[sent,setSent]=useState(false);

  const canSend=cat&&(text.trim().length>5||rating>0);

  const handleSend=async()=>{
    if(!canSend)return;
    // Save locally first
    dispatch({type:'SAVE_PARENT_FEEDBACK',
      category:cat?.id,text:text.trim(),rating,email:email.trim()});

    // Send to Supabase — no share sheet (Apple Kids Category requirement)
    const userId=state.supabaseUser?.id||null;
    await submitFeedback(userId,{
      category:cat?.id,
      text:text.trim(),
      rating,
      email:email.trim()||state.parent?.email||null,
      source:'parent',
    });

    setSent(true);
  };

  if(sent){
    return(
      <SafeAreaView style={{flex:1,backgroundColor:C.bg}}>
        <View style={{flex:1,alignItems:'center',justifyContent:'center',
          padding:24,gap:20}}>
          <Text style={{fontSize:72}}>🙏</Text>
          <Text style={{color:C.green400,fontWeight:'800',fontSize:24,
            textAlign:'center'}}>Thank you!</Text>
          <Text style={{color:C.textMuted,fontSize:15,textAlign:'center',
            lineHeight:24}}>
            Your feedback has been sent to the Money Cells team.{'\n\n'}
            We read every message and use it to make the app better for kids and parents.
          </Text>
          <Btn label="← Back to Dashboard" onPress={onBack} primary/>
        </View>
      </SafeAreaView>
    );
  }

  return(
    <SafeAreaView style={{flex:1,backgroundColor:C.bg}}>
      <ScrollView contentContainerStyle={{padding:20,gap:16,paddingBottom:40}}>

        {/* Header */}
        <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
          <TouchableOpacity onPress={onBack}>
            <Text style={{color:C.green400,fontSize:16}}>←</Text>
          </TouchableOpacity>
          <Text style={[ss.h1,{flex:1}]}>Share Feedback 💬</Text>
        </View>

        <View style={{backgroundColor:C.card,borderRadius:12,borderWidth:1,
          borderColor:C.border,padding:14}}>
          <Text style={{color:C.textMuted,fontSize:13,lineHeight:20}}>
            We read every message. Your feedback directly shapes what we build next — new features, better lessons, bug fixes.
          </Text>
        </View>

        {/* Star rating */}
        <View style={{gap:8}}>
          <Text style={[ss.caption,{color:C.textMuted}]}>
            HOW WOULD YOU RATE MONEY CELLS?
          </Text>
          <View style={{flexDirection:'row',gap:8,justifyContent:'center',
            backgroundColor:C.card,borderRadius:12,padding:16,
            borderWidth:1,borderColor:C.border}}>
            {[1,2,3,4,5].map(star=>(
              <TouchableOpacity key={star} onPress={()=>setRating(star)}>
                <Text style={{fontSize:38,
                  opacity:star<=rating?1:0.25}}>⭐</Text>
              </TouchableOpacity>
            ))}
          </View>
          {rating>0&&(
            <Text style={{color:C.textMuted,fontSize:12,textAlign:'center'}}>
              {['','Really struggling 😕','Could be better 🤔',
                'Pretty good 🙂','Love it! 😄','Absolutely amazing! 🤩'][rating]}
            </Text>
          )}
        </View>

        {/* Category */}
        <View style={{gap:8}}>
          <Text style={[ss.caption,{color:C.textMuted}]}>
            WHAT'S YOUR FEEDBACK ABOUT?
          </Text>
          <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>
            {FB_CATS.map(c=>(
              <TouchableOpacity key={c.id} onPress={()=>setCat(c)}
                style={{flex:1,minWidth:(SW-56)/2,backgroundColor:
                  cat?.id===c.id?C.green900:C.card,
                  borderRadius:10,borderWidth:1.5,
                  borderColor:cat?.id===c.id?C.green400:C.border,
                  padding:12,alignItems:'center',gap:6}}>
                <Text style={{fontSize:22}}>{c.emoji}</Text>
                <Text style={{color:cat?.id===c.id?C.green400:C.textMuted,
                  fontSize:12,fontWeight:'600',textAlign:'center'}}>
                  {c.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Text input */}
        <View style={{gap:8}}>
          <Text style={[ss.caption,{color:C.textMuted}]}>
            TELL US MORE (OPTIONAL)
          </Text>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={
              cat?.id==='bug'?"What happened? What were you doing when it broke?"
              :cat?.id==='feature'?"What would you love to see in the app?"
              :cat?.id==='content'?"What would help kids understand saving better?"
              :"What's on your mind?"
            }
            placeholderTextColor={C.textFaint}
            multiline
            numberOfLines={5}
            style={[ss.input,{height:120,textAlignVertical:'top',
              paddingTop:12,fontSize:14}]}
          />
          <Text style={{color:C.textFaint,fontSize:11,textAlign:'right'}}>
            {text.length} characters
          </Text>
        </View>

        {/* Email */}
        <View style={{gap:8}}>
          <Text style={[ss.caption,{color:C.textMuted}]}>
            YOUR EMAIL (OPTIONAL — IF YOU WANT A REPLY)
          </Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="your@email.com"
            placeholderTextColor={C.textFaint}
            keyboardType="email-address"
            autoCapitalize="none"
            style={ss.input}
          />
        </View>

        {/* Send */}
        <View style={{gap:8}}>
          <Btn
            label={canSend?'📤 Send Feedback':'Select a category to send'}
            onPress={canSend?handleSend:undefined}
            primary={canSend}
            style={{opacity:canSend?1:0.5}}
          />
          <Text style={{color:C.textFaint,fontSize:11,textAlign:'center',
            lineHeight:17}}>
            Your feedback is sent securely to the Money Cells team.
          </Text>
        </View>

        {/* Previous feedback summary */}
        {(state.parent?.parentFeedback||[]).length>0&&(
          <View style={{gap:8,marginTop:8}}>
            <Text style={[ss.caption,{color:C.textMuted}]}>
              YOUR PREVIOUS FEEDBACK ({(state.parent?.parentFeedback||[]).length})
            </Text>
            {(state.parent?.parentFeedback||[]).slice(0,3).map((fb,i)=>(
              <View key={i} style={{backgroundColor:C.card,borderRadius:10,
                borderWidth:1,borderColor:C.border,padding:12,
                flexDirection:'row',gap:10,alignItems:'flex-start'}}>
                <Text style={{fontSize:20}}>
                  {FB_CATS.find(c=>c.id===fb.category)?.emoji||'💬'}
                </Text>
                <View style={{flex:1}}>
                  <View style={{flexDirection:'row',
                    justifyContent:'space-between',marginBottom:2}}>
                    <Text style={{color:C.textMuted,fontSize:11}}>{fb.date}</Text>
                    <Text style={{fontSize:11}}>
                      {'⭐'.repeat(fb.rating||0)}
                    </Text>
                  </View>
                  <Text style={{color:C.text,fontSize:13,lineHeight:18}}
                    numberOfLines={2}>
                    {fb.text||'(no text)'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

// ══════════════════════════════════════════════════════════════════════════
function TimesUpScreen({kidId,onUnlock}){
  const{state}=useApp();const[pin,setPin]=useState('');const[error,setError]=useState('');
  const kid=state.parent?.kids?.find(k=>k.id===kidId)||{id:kidId,name:'Friend',avatar:'🌟'};
  const bounce=useRef(new Animated.Value(0)).current;
  useEffect(()=>{ // eslint-disable-line react-hooks/exhaustive-deps
    Animated.loop(Animated.sequence([Animated.timing(bounce,{toValue:-12,duration:550,useNativeDriver:true}),Animated.timing(bounce,{toValue:0,duration:550,useNativeDriver:true})])).start();
  },[]);// eslint-disable-line react-hooks/exhaustive-deps
  const handle=()=>{if(pin!==state.parent?.pin){setError('Wrong PIN!');setPin('');return;}onUnlock();};
  return(
    <SafeAreaView style={{flex:1,backgroundColor:C.bg}}>
      <View style={{flex:1,alignItems:'center',justifyContent:'center',padding:24,gap:20}}>
        <Animated.Text style={{fontSize:80,transform:[{translateY:bounce}]}}>⏰</Animated.Text>
        <Text style={{fontSize:28,fontWeight:'800',color:C.amber,textAlign:'center'}}>Time's Up, {kid?.name||'Friend'}!</Text>
        <Text style={{color:C.textMuted,fontSize:14,textAlign:'center',lineHeight:22}}>Great playing! Colony safely saved 🧬{'\n\n'}Ask a parent to unlock!</Text>
        <View style={{backgroundColor:C.amber+'11',borderRadius:14,borderWidth:1,borderColor:C.amber+'44',padding:16,width:'100%'}}>
          <Text style={{color:C.amber,fontWeight:'700',fontSize:14,textAlign:'center',marginBottom:12}}>🔑 Parent PIN</Text>
          <PinInput value={pin} onChange={p=>{setPin(p);setError('');}} label=""/>
          {!!error&&<Text style={{color:C.red,fontSize:13,textAlign:'center',marginTop:8}}>{error}</Text>}
          <View style={{marginTop:16}}><Btn label="Unlock →" onPress={handle} primary/></View>
        </View>
      </View>
    </SafeAreaView>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// PARENT SCREENS
// ══════════════════════════════════════════════════════════════════════════
function ParentLoginScreen(){
  const{state,dispatch}=useApp();
  const[email,setEmail]=useState('');
  const[pin,setPin]=useState('');
  const[password,setPassword]=useState('');
  const[isSignUp,setIsSignUp]=useState(false);
  const[loading,setLoading]=useState(false);
  const[authError,setAuthError]=useState('');
  const[showReset,setShowReset]=useState(false);
  const[resetStep,setResetStep]=useState('send'); // 'send' | 'verify'
  const[resetOtp,setResetOtp]=useState('');
  return(
    <SafeAreaView style={{flex:1,backgroundColor:C.bg}}>
      <ScrollView contentContainerStyle={{flexGrow:1,padding:24,justifyContent:'center',gap:22}}>
        <View style={{alignItems:'center',gap:8}}>
          <Text style={{fontSize:52}}>🧬</Text>
          <Text style={[ss.display,{textAlign:'center'}]}>Money Cells</Text>
          <Text style={{color:C.textMuted,fontSize:13,textAlign:'center'}}>Parent login</Text>
        </View>
        {!!state.error&&<View style={{backgroundColor:C.red+'22',borderRadius:10,borderWidth:1,borderColor:C.red+'44',padding:12}}><Text style={{color:C.red,textAlign:'center',fontSize:13}}>{state.error}</Text></View>}
        <View style={{backgroundColor:C.green900,borderRadius:10,borderWidth:1,borderColor:C.green700,padding:12}}>
  
        </View>
        <TextInput value={email} onChangeText={e=>{setEmail(e);dispatch({type:'CLEAR_ERROR'});}} placeholder="Parent email" placeholderTextColor={C.textFaint} keyboardType="email-address" autoCapitalize="none" style={ss.input}/>
        <PinInput value={pin} onChange={p=>{setPin(p);dispatch({type:'CLEAR_ERROR'});}} label="Your 4-digit PIN"/>
        {/* Supabase Auth — email + password + PIN */}
        {/* Password field — always shown */}
        <View style={{gap:6}}>
          <Text style={{color:C.textMuted,fontSize:12,marginLeft:4}}>
            {isSignUp?'Password (min 6 chars)':'Password'}
          </Text>
          <TextInput
            value={password} onChangeText={setPassword}
            placeholder={isSignUp?'Create a password':'Your password'}
            placeholderTextColor={C.textFaint}
            secureTextEntry
            style={{backgroundColor:C.card,borderRadius:10,borderWidth:1.5,
              borderColor:C.border,padding:14,color:C.text,fontSize:15}}
          />
        </View>
        {!!authError&&(
          <Text style={{color:C.red,fontSize:13,textAlign:'center'}}>{authError}</Text>
        )}
        <TouchableOpacity
          onPress={async()=>{
            if(loading)return;
            setAuthError('');
            setLoading(true);
            try{
              // Demo account bypass
              if(email.trim().toLowerCase()==='parent@demo.com'&&pin==='1234'){
                dispatch({type:'LOGIN',email:'parent@demo.com',pin:'1234'});
                setLoading(false);return;
              }
              if(isSignUp){
                // New account — need password
                if(!password||password.length<6){setAuthError('Password must be at least 6 characters.');setLoading(false);return;}
                await supabaseSignUp(email.trim().toLowerCase(),password,pin);
                // After signup, sign in immediately
                const user=await supabaseSignIn(email.trim().toLowerCase(),password);
                dispatch({type:'LOGIN',email:email.trim().toLowerCase(),pin});
                logEvent(user.id,'signup',{platform:'ios'});
              } else {
                // Existing account
                const user=await supabaseSignIn(email.trim().toLowerCase(),password);
                dispatch({type:'LOGIN',email:email.trim().toLowerCase(),pin});
                updateLastLogin(user.id);
              }
            }catch(e){
              setAuthError(e.message||'Sign in failed. Check your email and password.');
            }
            setLoading(false);
          }}
          disabled={loading}
          style={{backgroundColor:loading?C.surface:C.green500,
            borderRadius:12,padding:16,alignItems:'center',opacity:loading?0.7:1}}>
          <Text style={{color:loading?C.textMuted:C.bg,fontWeight:'800',fontSize:16}}>
            {loading?'Please wait...':(isSignUp?'Create Account →':'Sign In →')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={()=>{setIsSignUp(!isSignUp);setAuthError('');setShowReset(false);}}
          style={{alignItems:'center',paddingVertical:6}}>
          <Text style={{color:C.green400,fontSize:13}}>
            {isSignUp?'Already have an account? Sign in':'New here? Create an account'}
          </Text>
        </TouchableOpacity>

        {/* Forgot password */}
        {!isSignUp&&!showReset&&(
          <TouchableOpacity onPress={()=>{setShowReset(true);setAuthError('');}}
            style={{alignItems:'center',paddingVertical:4}}>
            <Text style={{color:C.textMuted,fontSize:12}}>Forgot password?</Text>
          </TouchableOpacity>
        )}

        {/* Password reset form — OTP code flow (no deep links) */}
        {showReset&&(
          <View style={{backgroundColor:C.card,borderRadius:12,borderWidth:1,
            borderColor:C.border,padding:16,gap:12}}>
            {resetStep==='send'?(
              <>
                <View style={{gap:4}}>
                  <Text style={{color:C.text,fontWeight:'700',fontSize:13}}>
                    Reset your password
                  </Text>
                  <Text style={{color:C.textMuted,fontSize:12,lineHeight:17}}>
                    We'll send a 6-digit code to your email. No links to click — just type the code here.
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={async()=>{
                    if(!email.trim()){setAuthError('Enter your email first.');return;}
                    setLoading(true);setAuthError('');
                    try{
                      await supabaseSendResetOtp(email.trim().toLowerCase());
                      setResetStep('verify');setResetOtp('');
                    }catch(e){
                      setAuthError(e.message||'Could not send code. Check your email address.');
                    }
                    setLoading(false);
                  }}
                  disabled={loading}
                  style={{backgroundColor:loading?C.surface:C.green500,
                    borderRadius:10,padding:12,alignItems:'center',opacity:loading?0.6:1}}>
                  <Text style={{color:loading?C.textMuted:C.bg,fontWeight:'800',fontSize:14}}>
                    {loading?'Sending...':'Send 6-digit code'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={()=>{setShowReset(false);setAuthError('');}}
                  style={{alignItems:'center',paddingVertical:2}}>
                  <Text style={{color:C.textMuted,fontSize:12}}>Cancel</Text>
                </TouchableOpacity>
              </>
            ):(
              <>
                <View style={{gap:4}}>
                  <Text style={{fontSize:28,textAlign:'center'}}>📧</Text>
                  <Text style={{color:C.green400,fontWeight:'800',fontSize:14,textAlign:'center'}}>
                    Check your email
                  </Text>
                  <Text style={{color:C.textMuted,fontSize:12,textAlign:'center',lineHeight:17}}>
                    We sent a reset code to {email.trim()}. Find the code in the email and type it below.
                  </Text>
                  <Text style={{color:C.textMuted,fontSize:11,textAlign:'center',lineHeight:16,marginTop:2}}>
                    💡 Look for "Your confirmation code" in the email. Check spam if you don't see it.
                  </Text>
                </View>
                <TextInput
                  value={resetOtp} onChangeText={v=>setResetOtp(v.trim())}
                  placeholder="Paste code here"
                  placeholderTextColor={C.textFaint}
                  autoCapitalize="none"
                  autoCorrect={false}
                  textAlign="center"
                  style={{backgroundColor:C.bg,borderRadius:10,borderWidth:1.5,
                    borderColor:C.border,padding:14,color:C.text,
                    fontSize:20,fontWeight:'800',letterSpacing:4}}
                />
                <TouchableOpacity
                  onPress={async()=>{
                    if(!resetOtp.trim()){setAuthError('Paste the code from your email.');return;}
                    setLoading(true);setAuthError('');
                    try{
                      await supabaseVerifyResetOtp(email.trim().toLowerCase(),resetOtp);
                      dispatch({type:'SHOW_RESET_PASSWORD'});
                      setShowReset(false);setResetStep('send');setResetOtp('');
                    }catch(e){
                      setAuthError(e.message||'Invalid code. Copy it exactly from the email and try again.');
                    }
                    setLoading(false);
                  }}
                  disabled={loading||!resetOtp.trim()}
                  style={{backgroundColor:loading||!resetOtp.trim()?C.surface:C.green500,
                    borderRadius:10,padding:12,alignItems:'center',
                    opacity:loading||!resetOtp.trim()?0.5:1}}>
                  <Text style={{color:loading||!resetOtp.trim()?C.textMuted:C.bg,fontWeight:'800',fontSize:14}}>
                    {loading?'Verifying...':'Verify & reset password'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={()=>{setResetStep('send');setResetOtp('');setAuthError('');}}
                  style={{alignItems:'center',paddingVertical:2}}>
                  <Text style={{color:C.textMuted,fontSize:12}}>← Resend email</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ParentHomeScreen({onStartSession,onDashboard}){
  const{state,dispatch}=useApp();const[addingKid,setAddingKid]=useState(false);
  const[newName,setNewName]=useState('');const[newAvatar,setNewAvatar]=useState(KID_AVATARS[0]);
  const[editingKidId,setEditingKidId]=useState(null);
  const[editingName,setEditingName]=useState('');
  const[showChangePinModal,setShowChangePinModal]=useState(false);
  // cpStep: 'current' → 'new' → 'confirm' | 'password' (forgot-PIN path) → 'new' → 'confirm'
  const[cpStep,setCpStep]=useState('current');
  const[cpCurrent,setCpCurrent]=useState('');
  const[cpNew,setCpNew]=useState('');
  const[cpConfirm,setCpConfirm]=useState('');
  const[cpError,setCpError]=useState('');
  const[cpSuccess,setCpSuccess]=useState(false);
  const[cpPassword,setCpPassword]=useState('');
  const[cpPasswordLoading,setCpPasswordLoading]=useState(false);
  const resetChangePinModal=()=>{
    setShowChangePinModal(false);
    setCpStep('current');setCpCurrent('');setCpNew('');setCpConfirm('');
    setCpError('');setCpSuccess(false);setCpPassword('');setCpPasswordLoading(false);
  };
  const handleCpForgot=async()=>{
    if(!cpPassword){setCpError('Enter your account password.');return;}
    setCpPasswordLoading(true);setCpError('');
    const email=state.supabaseUser?.email;
    if(!email){setCpError('No account email found.');setCpPasswordLoading(false);return;}
    const{error:err}=await supabase.auth.signInWithPassword({email,password:cpPassword});
    setCpPasswordLoading(false);
    if(err){setCpError('Wrong password. Try again.');setCpPassword('');return;}
    setCpStep('new');setCpPassword('');
  };
  const kids=state.parent?.kids||[];
  if(addingKid){
    return(
      <SafeAreaView style={{flex:1,backgroundColor:C.bg}}>
        <ScrollView contentContainerStyle={{padding:24,gap:16}}>
          <View style={{flexDirection:'row',alignItems:'center',gap:8}}><TouchableOpacity onPress={()=>setAddingKid(false)}><Text style={{color:C.green400,fontSize:16}}>←</Text></TouchableOpacity><Text style={ss.h1}>Add a Child</Text></View>
          <View style={{flexDirection:'row',flexWrap:'wrap',gap:10}}>{KID_AVATARS.map(a=>(<TouchableOpacity key={a} onPress={()=>setNewAvatar(a)} style={{width:56,height:56,borderRadius:28,backgroundColor:newAvatar===a?C.green900:C.card,borderWidth:2,borderColor:newAvatar===a?C.green400:C.border,alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:28}}>{a}</Text></TouchableOpacity>))}</View>
          <TextInput value={newName} onChangeText={setNewName} placeholder={`Kid ${kids.length+1} (optional)`} placeholderTextColor={C.textFaint} style={ss.input} autoFocus/>
          <Btn label="Add Child →" onPress={()=>{dispatch({type:'ADD_KID',name:newName.trim(),avatar:newAvatar,age:8});setAddingKid(false);setNewName('');}} primary/>
        </ScrollView>
      </SafeAreaView>
    );
  }
  return(
    <SafeAreaView style={{flex:1,backgroundColor:C.bg}}>
      <ScrollView contentContainerStyle={{padding:24,gap:18}}>
        <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
          <View><Text style={ss.h1}>Welcome! 👋</Text><Text style={{color:C.textMuted,fontSize:12,marginTop:2}}>{state.parent?.email}</Text></View>
          <TouchableOpacity onPress={onDashboard} style={{backgroundColor:C.card,borderRadius:10,padding:10,borderWidth:1,borderColor:C.border,alignItems:'center'}}><Text style={{fontSize:18}}>📊</Text><Text style={{color:C.textMuted,fontSize:9,marginTop:2}}>Dashboard</Text></TouchableOpacity>
        </View>
        <Text style={[ss.caption,{color:C.textMuted}]}>WHO'S PLAYING TODAY?</Text>
        {kids.length===0&&<View style={{backgroundColor:C.card,borderRadius:14,borderWidth:1,borderColor:C.border,padding:24,alignItems:'center'}}><Text style={{fontSize:40}}>👶</Text><Text style={{color:C.textMuted,fontSize:13,textAlign:'center',marginTop:8}}>No kids added yet!</Text></View>}
        {kids.map(kid=>{
          const g=kid.game;const retired=(g?.retiredColonies||[]).length;
          const isEditing=editingKidId===kid.id;
          if(isEditing){
            return(
              <View key={kid.id} style={{backgroundColor:C.card,borderRadius:14,borderWidth:1.5,borderColor:C.green700,padding:16,gap:12}}>
                <View style={{flexDirection:'row',alignItems:'center',gap:12}}>
                  <View style={{width:48,height:48,borderRadius:24,backgroundColor:C.green900,alignItems:'center',justifyContent:'center',borderWidth:2,borderColor:C.green700}}>
                    <Text style={{fontSize:26}}>{kid.avatar}</Text>
                  </View>
                  <TextInput
                    value={editingName}
                    onChangeText={setEditingName}
                    placeholder="Kid's name"
                    placeholderTextColor={C.textFaint}
                    autoFocus
                    style={{flex:1,backgroundColor:C.bg,borderRadius:8,borderWidth:1.5,
                      borderColor:C.green700,padding:10,color:C.text,fontSize:15,fontWeight:'700'}}
                  />
                </View>
                <View style={{flexDirection:'row',gap:8}}>
                  <TouchableOpacity
                    onPress={()=>{
                      const trimmed=editingName.trim();
                      if(trimmed){dispatch({type:'RENAME_KID',kidId:kid.id,name:trimmed});}
                      setEditingKidId(null);setEditingName('');
                    }}
                    style={{flex:1,backgroundColor:C.green500,borderRadius:10,padding:11,alignItems:'center'}}>
                    <Text style={{color:C.bg,fontWeight:'800',fontSize:14}}>✅ Save</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={()=>{setEditingKidId(null);setEditingName('');}}
                    style={{flex:1,backgroundColor:C.surface,borderRadius:10,padding:11,alignItems:'center',borderWidth:1,borderColor:C.border}}>
                    <Text style={{color:C.textMuted,fontWeight:'700',fontSize:14}}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={()=>Alert.alert(
                      `Remove ${kid.name}?`,
                      'This removes the kid profile and all their game data. This cannot be undone.',
                      [{text:'Cancel',style:'cancel'},
                       {text:'Remove',style:'destructive',onPress:()=>{
                         dispatch({type:'REMOVE_KID',kidId:kid.id});
                         setEditingKidId(null);setEditingName('');
                       }}]
                    )}
                    style={{backgroundColor:'#3a0d0d',borderRadius:10,padding:11,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:C.red+'44',paddingHorizontal:14}}>
                    <Text style={{fontSize:16}}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }
          return(
            <View key={kid.id} style={{backgroundColor:C.card,borderRadius:14,borderWidth:1.5,borderColor:C.border}}>
              <View style={{flexDirection:'row',alignItems:'center',gap:14,padding:16}}>
                <View style={{width:56,height:56,borderRadius:28,backgroundColor:C.green900,alignItems:'center',justifyContent:'center',borderWidth:2,borderColor:C.green700}}><Text style={{fontSize:30}}>{kid.avatar}</Text></View>
                <View style={{flex:1}}>
                  <Text style={{color:C.text,fontWeight:'800',fontSize:16}}>{kid.name}</Text>
                  <Text style={{color:C.textMuted,fontSize:12,marginTop:2}}>{g?`Colony #${g.colonyNumber||1} · ${g.cells?.filter(c=>!c.burst).length??0}/${COLONY_CAP} cells`:'New player'}</Text>
                  {retired>0&&<Text style={{color:C.green400,fontSize:11,marginTop:1}}>🏛️ {retired} retired {retired===1?'colony':'colonies'} in museum</Text>}
                </View>
                <TouchableOpacity onPress={()=>{setEditingKidId(kid.id);setEditingName(kid.name);}}
                  style={{padding:8,marginRight:4}}>
                  <Text style={{fontSize:16,color:C.textMuted}}>✏️</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={()=>onStartSession(kid.id)}
                  style={{backgroundColor:C.green500,borderRadius:10,paddingHorizontal:14,paddingVertical:8}}>
                  <Text style={{color:C.bg,fontWeight:'800',fontSize:13}}>Play ▶</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
        <TouchableOpacity onPress={()=>setAddingKid(true)} style={{backgroundColor:C.surface,borderRadius:14,borderWidth:1.5,borderColor:C.border,borderStyle:'dashed',padding:16,alignItems:'center',flexDirection:'row',justifyContent:'center',gap:8}}>
          <Text style={{color:C.textMuted,fontSize:24}}>+</Text><Text style={{color:C.textMuted,fontSize:14,fontWeight:'600'}}>Add another child</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={()=>setShowChangePinModal(true)}
          style={{alignItems:'center',paddingVertical:8}}>
          <Text style={{color:C.textMuted,fontSize:12}}>🔒 Change PIN</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={()=>dispatch({type:'LOGOUT'})} style={{alignItems:'center',paddingVertical:8}}><Text style={{color:C.textFaint,fontSize:12}}>Sign out</Text></TouchableOpacity>
        <TouchableOpacity
          onPress={()=>Alert.alert(
            'Delete Account',
            'This permanently deletes your account, all kid profiles, session history and game data. This cannot be undone.\n\nAre you sure?',
            [
              {text:'Cancel',style:'cancel'},
              {text:'Delete Forever',style:'destructive',onPress:()=>
                Alert.alert(
                  'Final confirmation',
                  'Type DELETE to confirm — all your data will be erased.',
                  [
                    {text:'Cancel',style:'cancel'},
                    {text:'Yes, delete everything',style:'destructive',
                      onPress:()=>dispatch({type:'DELETE_ACCOUNT'})},
                  ]
                )
              },
            ]
          )}
          style={{alignItems:'center',paddingVertical:8}}>
          <Text style={{color:C.red+'88',fontSize:11}}>Delete account & all data</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ── Change PIN modal ─────────────────────────────────────────── */}
      <Modal visible={showChangePinModal} transparent animationType="fade" statusBarTranslucent>
        <View style={{flex:1,backgroundColor:'rgba(0,0,0,0.7)',justifyContent:'center',padding:24}}>
          <View style={{backgroundColor:C.card,borderRadius:16,borderWidth:1.5,
            borderColor:C.border,padding:24,gap:14}}>
            <View style={{alignItems:'center',gap:4}}>
              <Text style={{fontSize:36}}>{cpSuccess?'✅':cpStep==='password'?'🔑':'🔒'}</Text>
              <Text style={{color:C.text,fontWeight:'800',fontSize:18}}>
                {cpSuccess?'PIN updated!'
                  :cpStep==='current'?'Enter current PIN'
                  :cpStep==='password'?'Verify with password'
                  :cpStep==='new'?'Enter new PIN'
                  :'Confirm new PIN'}
              </Text>
              {cpStep==='password'&&(
                <Text style={{color:C.textMuted,fontSize:12,textAlign:'center'}}>
                  Enter your account password to reset your PIN
                </Text>
              )}
            </View>
            {cpSuccess?(
              <Text style={{color:C.textMuted,fontSize:13,textAlign:'center'}}>
                Use your new PIN next time you start a session.
              </Text>
            ):(
              <>
                {/* Step: enter current PIN */}
                {cpStep==='current'&&(<>
                  <PinInput label="" value={cpCurrent} onChange={v=>{
                    setCpError('');setCpCurrent(v);
                    if(v.length===4){
                      if(v===state.parent?.pin){setCpStep('new');setCpCurrent('');}
                      else{setCpError('Wrong PIN. Try again.');setTimeout(()=>setCpCurrent(''),300);}
                    }
                  }}/>
                  <TouchableOpacity onPress={()=>{setCpError('');setCpCurrent('');setCpStep('password');}}
                    style={{alignItems:'center',paddingVertical:4}}>
                    <Text style={{color:C.blue,fontSize:13}}>Forgot PIN? Verify with password →</Text>
                  </TouchableOpacity>
                </>)}

                {/* Step: verify via account password (forgot-PIN path) */}
                {cpStep==='password'&&(<>
                  <TextInput
                    value={cpPassword} onChangeText={v=>{setCpPassword(v);setCpError('');}}
                    placeholder="Account password"
                    placeholderTextColor={C.textFaint}
                    secureTextEntry autoFocus
                    style={{backgroundColor:C.bg,borderRadius:10,borderWidth:1.5,
                      borderColor:cpError?C.red:C.border,padding:14,color:C.text,fontSize:15}}
                  />
                  <TouchableOpacity onPress={handleCpForgot} disabled={cpPasswordLoading}
                    style={{backgroundColor:cpPasswordLoading?C.surface:C.green500,
                      borderRadius:10,padding:14,alignItems:'center',opacity:cpPasswordLoading?0.6:1}}>
                    <Text style={{color:cpPasswordLoading?C.textMuted:C.bg,fontWeight:'800',fontSize:15}}>
                      {cpPasswordLoading?'Verifying...':'Verify & continue →'}
                    </Text>
                  </TouchableOpacity>
                </>)}

                {/* Step: enter new PIN */}
                {cpStep==='new'&&(
                  <PinInput label="" value={cpNew} onChange={v=>{
                    setCpError('');setCpNew(v);
                    if(v.length===4){setCpStep('confirm');}
                  }}/>
                )}

                {/* Step: confirm new PIN */}
                {cpStep==='confirm'&&(
                  <PinInput label="" value={cpConfirm} onChange={v=>{
                    setCpError('');setCpConfirm(v);
                    if(v.length===4){
                      if(v===cpNew){
                        dispatch({type:'SET_PIN',pin:cpNew});
                        setCpSuccess(true);
                        setTimeout(resetChangePinModal,1800);
                      }else{
                        setCpError("PINs don't match. Try again.");
                        setTimeout(()=>setCpConfirm(''),300);
                      }
                    }
                  }}/>
                )}

                {!!cpError&&<Text style={{color:C.red,fontSize:12,textAlign:'center',marginTop:4}}>{cpError}</Text>}

                <View style={{flexDirection:'row',gap:8,marginTop:4}}>
                  {(cpStep==='password'||cpStep==='new'||cpStep==='confirm')&&(
                    <TouchableOpacity onPress={()=>{
                      setCpError('');setCpPassword('');
                      if(cpStep==='confirm'){setCpStep('new');setCpConfirm('');}
                      else if(cpStep==='new'){setCpStep('current');setCpNew('');}
                      else{setCpStep('current');}
                    }} style={{flex:1,backgroundColor:C.surface,borderRadius:10,padding:12,alignItems:'center',borderWidth:1,borderColor:C.border}}>
                      <Text style={{color:C.textMuted,fontWeight:'700',fontSize:13}}>← Back</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={resetChangePinModal}
                    style={{flex:1,alignItems:'center',paddingVertical:12}}>
                    <Text style={{color:C.textMuted,fontSize:13}}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function StartSessionScreen({kidId,onConfirm,onBack}){
  const{state,dispatch}=useApp();const[pin,setPin]=useState('');const[duration,setDuration]=useState(TIMER_OPTIONS[1]);const[error,setError]=useState('');
  const kid=state.parent?.kids?.find(k=>k.id===kidId)||{id:kidId,name:'Kid',avatar:'🌟',age:8};
  const handle=()=>{
    // If no PIN set yet (new Supabase accounts), any 4-digit PIN works as first-time setup
    const storedPin=state.parent?.pin;
    if(storedPin&&pin!==storedPin){setError('Wrong PIN.');setPin('');return;}
    if(!storedPin&&pin.length<4){setError('Enter a 4-digit PIN.');return;}
    // If no PIN was stored, save this as the PIN going forward
    if(!storedPin){dispatch({type:'SET_PIN',pin});}
    dispatch({type:'START_SESSION',kidId,duration:duration.value});
    onConfirm(duration.value);
  };
  if(!kid)return null;
  return(
    <SafeAreaView style={{flex:1,backgroundColor:C.bg}}>
      <ScrollView contentContainerStyle={{padding:24,gap:20}}>
        <View style={{flexDirection:'row',alignItems:'center',gap:8}}><TouchableOpacity onPress={onBack}><Text style={{color:C.green400,fontSize:16}}>←</Text></TouchableOpacity><Text style={ss.h1}>Start Session</Text></View>
        <View style={{backgroundColor:C.green900,borderRadius:14,borderWidth:1,borderColor:C.green700,padding:20,alignItems:'center',gap:8}}>
          <Text style={{fontSize:52}}>{kid.avatar}</Text>
          <Text style={{color:C.text,fontWeight:'800',fontSize:20}}>{kid.name}'s Turn!</Text>
          <Text style={{color:C.textMuted,fontSize:13}}>{kid.game?`Colony #${kid.game.colonyNumber||1} · ${(kid.game.retiredColonies||[]).length} retired`:'New player'}</Text>
        </View>
        <View><Text style={[ss.caption,{color:C.textMuted,marginBottom:10}]}>⏱ HOW LONG?</Text>
          <View style={{flexDirection:'row',gap:8}}>{TIMER_OPTIONS.map(o=>(<TouchableOpacity key={o.value} onPress={()=>setDuration(o)} style={{flex:1,paddingVertical:10,backgroundColor:duration.value===o.value?C.green900:C.card,borderRadius:10,borderWidth:1.5,borderColor:duration.value===o.value?C.green400:C.border,alignItems:'center'}}><Text style={{color:duration.value===o.value?C.green400:C.textMuted,fontWeight:'700',fontSize:13}}>{o.label}</Text></TouchableOpacity>))}</View>
        </View>
        {!!error&&<View style={{backgroundColor:C.red+'22',borderRadius:10,borderWidth:1,borderColor:C.red+'44',padding:12}}><Text style={{color:C.red,textAlign:'center'}}>{error}</Text></View>}
        <PinInput value={pin} onChange={p=>{setPin(p);setError('');}} label="Parent PIN to start"/>
        <Btn label={`▶  Hand to ${kid.name}!`} onPress={handle} primary/>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── CoachingCard — live parent coaching from Cellie ─────────────────────
function CoachingCard({userId, kids}){
  const[loading,setLoading]=useState(false);
  const[insight,setInsight]=useState(null);
  const[error,setError]=useState(null);

  const fetchInsight=async()=>{
    setLoading(true);setError(null);
    try{
      // Build session context from kids data
      const totalSessions=kids.reduce((a,k)=>(a+(k.sessions?.length||0)),0);
      const totalPlayTime=kids.reduce((a,k)=>(a+(k.totalPlayTime||0)),0);
      const kidNames=kids.map(k=>k.name).join(', ');
      const question=`Give me coaching insights for a parent with ${kids.length} child(ren) named ${kidNames||'my kids'}. They have completed ${totalSessions} sessions with ${Math.round(totalPlayTime/60)} total minutes of play. What financial literacy concepts should I reinforce at home this week?`;

      const resp=await fetch('https://wztykysqvnngsnmadrdt.supabase.co/functions/v1/cellie',{
        method:'POST',
        headers:await cellieHeaders(),
        body:JSON.stringify({
          mode:'parent',
          question,
          kidName:kidNames||'my child',
          kidAge:10,
          sessionCells:20,
          round:totalSessions,
          totalSessions,
          totalPlayTime,
        }),
      });
      const data=await resp.json();
      setInsight(data.answer||'Unable to generate insight right now.');
    }catch(e){
      setError('Could not load insights. Check your connection.');
    }
    setLoading(false);
  };

  if(insight){
    return(
      <View style={{backgroundColor:C.purple+'15',borderRadius:14,
        borderWidth:1,borderColor:C.purple+'44',padding:16,gap:12}}>
        <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
          <Text style={{fontSize:20}}>🧠</Text>
          <Text style={{color:C.purple,fontWeight:'800',fontSize:14}}>
            Cellie's Coaching Insight
          </Text>
        </View>
        <Text style={{color:C.text,fontSize:13,lineHeight:20}}>{insight}</Text>
        <TouchableOpacity onPress={()=>setInsight(null)}
          style={{alignSelf:'flex-start',paddingVertical:4}}>
          <Text style={{color:C.textMuted,fontSize:12}}>Get new insight</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return(
    <TouchableOpacity
      onPress={fetchInsight}
      disabled={loading}
      style={{backgroundColor:C.purple+'15',borderRadius:14,
        borderWidth:1,borderColor:C.purple+'44',
        padding:16,gap:10,opacity:loading?0.7:1}}>
      <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
        <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
          <Text style={{fontSize:20}}>🧠</Text>
          <View>
            <Text style={{color:C.purple,fontWeight:'800',fontSize:14}}>
              {loading?'Thinking...':'Get coaching insight'}
            </Text>
            <Text style={{color:C.textMuted,fontSize:11}}>
              {loading?'Cellie is reviewing your sessions...':'Tap for AI-powered parenting tips'}
            </Text>
          </View>
        </View>
        {!loading&&<Text style={{fontSize:20}}>→</Text>}
      </View>
      {error&&<Text style={{color:C.red,fontSize:12}}>{error}</Text>}
    </TouchableOpacity>
  );
}

function ParentDashboardScreen({onBack}){
  const{state}=useApp();
  const[sel,setSel]=useState(null);
  const[showFeedback,setShowFeedback]=useState(false);
  const kids=state.parent?.kids||[];

  if(showFeedback)return<ParentFeedbackScreen onBack={()=>setShowFeedback(false)}/>;

  if(sel){
    const kid=kids.find(k=>k.id===sel);if(!kid){setSel(null);return null;}
    const g=kid.game;const count=g?.cells?.filter(c=>!c.burst).length??0;
    const totalR=g?.totalRounds??0;const saveR=g?.history?.filter(r=>r.spent===0).length??0;
    const pct=totalR>0?Math.round((saveR/totalR)*100):0;
    const retired=g?.retiredColonies||[];

    // Kid feedback summary
    const kfb=kid.kidFeedback||[];
    const moodCounts=kfb.reduce((acc,f)=>{
      if(f.emoji)acc[f.emoji]=(acc[f.emoji]||0)+1;return acc;
    },{});
    const favCounts=kfb.reduce((acc,f)=>{
      if(f.favourite)acc[f.favourite]=(acc[f.favourite]||0)+1;return acc;
    },{});
    const topMood=Object.entries(moodCounts).sort((a,b)=>b[1]-a[1])[0];
    const topFav =Object.entries(favCounts).sort((a,b)=>b[1]-a[1])[0];
    const moodEmoji={great:'😄',good:'🙂',ok:'😐',confusing:'😕'};
    const favEmoji ={cells:'🧬',deals:'🔥',shop:'🛍️',museum:'🏛️'};
    const favLabel ={cells:'Growing cells',deals:'Flash deals',
                     shop:'Shopping',museum:'Museum'};

    // Pre-compute dashboard sections (Hermes-safe — no IIFEs in JSX)
    let quizPerformanceView=null;
    if(g){
      const seen=(g.seenQuestions||[]).length;
      const totalQ=30;
      if(seen>0){
        quizPerformanceView=(
          <View style={{backgroundColor:C.card,borderRadius:12,
            borderWidth:1,borderColor:C.border,padding:14,gap:10}}>
            <Text style={{color:C.text,fontWeight:'700',fontSize:14}}>
              🧬 Cellie Challenge Progress
            </Text>
            <View style={{flexDirection:'row',gap:10}}>
              <View style={{flex:1,backgroundColor:C.green900,borderRadius:10,
                padding:10,alignItems:'center',gap:3,borderWidth:1,borderColor:C.green700}}>
                <Text style={{color:C.green400,fontWeight:'800',fontSize:22}}>{seen}</Text>
                <Text style={{color:C.textMuted,fontSize:10,textAlign:'center'}}>QUESTIONS SEEN</Text>
              </View>
              <View style={{flex:1,backgroundColor:C.surface,borderRadius:10,
                padding:10,alignItems:'center',gap:3,borderWidth:1,borderColor:C.border}}>
                <Text style={{color:C.text,fontWeight:'800',fontSize:22}}>{totalQ-seen}</Text>
                <Text style={{color:C.textMuted,fontSize:10,textAlign:'center'}}>REMAINING</Text>
              </View>
            </View>
            <View style={{height:6,backgroundColor:C.surface,borderRadius:3,overflow:'hidden'}}>
              <View style={{height:6,backgroundColor:C.green500,borderRadius:3,
                width:`${(seen/totalQ)*100}%`}}/>
            </View>
            <Text style={{color:C.textMuted,fontSize:11}}>
              {seen>=totalQ?'🎉 All questions answered! More coming soon.':`${Math.round((seen/totalQ)*100)}% of the Cellie Challenge complete`}
            </Text>
          </View>
        );
      }
    }

    let savingTrendView=null;
    if(g&&g.totalRounds>=3){
      const history=g.history||[];
      const recentSpend=history.slice(-5).map(r=>r.spent||0);
      const avgSpend=recentSpend.length>0
        ? Math.round(recentSpend.reduce((a,b)=>a+b,0)/recentSpend.length)
        : 0;
      const trend=recentSpend.length>=3
        ? recentSpend[recentSpend.length-1]<recentSpend[0]?'improving'
        : recentSpend[recentSpend.length-1]>recentSpend[0]?'spending more':'steady'
        : 'steady';
      const trendEmoji=trend==='improving'?'📈':trend==='spending more'?'📉':'➡️';
      const insight=trend==='improving'
        ? `${kid.name} is spending LESS over the last 5 rounds — great progress! 🌱`
        : trend==='spending more'
        ? `${kid.name} has been spending a bit more lately. Try talking about what they're saving toward!`
        : `${kid.name} is consistent — averaging ${avgSpend} cells spent per round.`;
      savingTrendView=(
        <View style={{backgroundColor:C.card,borderRadius:12,
          borderWidth:1,borderColor:C.border,padding:14,gap:8}}>
          <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
            <Text style={{fontSize:20}}>{trendEmoji}</Text>
            <Text style={{color:C.text,fontWeight:'700',fontSize:14}}>Saving Trend</Text>
          </View>
          <Text style={{color:C.textMuted,fontSize:13,lineHeight:20}}>{insight}</Text>
          <View style={{flexDirection:'row',gap:4,alignItems:'flex-end',height:28}}>
            {history.slice(-8).map((r,i)=>{
              const spendPct=r.kept>0?r.spent/r.kept:0;
              const h=Math.max(4,Math.round((1-spendPct)*28));
              return(
                <View key={i} style={{flex:1,height:h,borderRadius:3,
                  backgroundColor:spendPct>0.3?C.red+'88':C.green500+'88'}}/>
              );
            })}
          </View>
          <Text style={{color:C.textFaint,fontSize:10}}>
            Green = mostly saved · Red = mostly spent (last 8 rounds)
          </Text>
        </View>
      );
    }

    let conversationStarterView=null;
    if(g){
      const starters=[
        `Ask ${kid.name}: "What would happen if you saved for 10 rounds without spending?"`,
        `Try: "If each cell is $1 and you have ${g.cells?.filter(c=>!c.burst).length||0} cells, how much is that?"`,
        `Talk about: "Why do you think cells multiply when you save them?"`,
        `Ask: "What would you do if a Flash Deal appeared and you really wanted it?"`,
      ];
      const starter=starters[(g.round||0)%starters.length];
      conversationStarterView=(
        <View style={{backgroundColor:C.green900+'88',borderRadius:12,
          borderWidth:1,borderColor:C.green700,padding:14,gap:8}}>
          <Text style={{color:C.green400,fontWeight:'700',fontSize:13}}>
            💬 Conversation Starter
          </Text>
          <Text style={{color:C.text,fontSize:13,lineHeight:20,fontStyle:'italic'}}>
            "{starter}"
          </Text>
        </View>
      );
    }

    return(
      <SafeAreaView style={{flex:1,backgroundColor:C.bg}}>
        <ScrollView contentContainerStyle={{padding:20,gap:14}}>
          <TouchableOpacity onPress={()=>setSel(null)}><Text style={{color:C.green400,fontSize:16}}>← All Kids</Text></TouchableOpacity>
          <View style={{backgroundColor:C.green900,borderRadius:14,borderWidth:1,borderColor:C.green700,padding:16,flexDirection:'row',alignItems:'center',gap:14}}>
            <Text style={{fontSize:44}}>{kid.avatar}</Text>
            <View><Text style={{color:C.green400,fontWeight:'800',fontSize:20}}>{kid.name}</Text>
              <Text style={{color:C.textMuted,fontSize:13}}>{g?`Colony #${g.colonyNumber||1} · ${count}/${COLONY_CAP} cells`:'No games yet'}</Text>
              {retired.length>0&&<Text style={{color:C.green300,fontSize:12,marginTop:2}}>🏛️ {retired.length} retired {retired.length===1?'colony':'colonies'}</Text>}
            </View>
          </View>
          {g&&<View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>
            {[['🧬','Colony',`#${g.colonyNumber||1}`,C.green400],['🔢','Cells',count,C.green300],['💾','Save%',`${pct}%`,pct>=70?C.green500:pct>=40?C.amber:C.red],['🔥','Streak',g.bestStreak??0,C.amber],['🏛️','Retired',retired.length,C.blue],['💪','Willpower',`${g.resistBonusThisGame||0}×`,C.purple]].map(([icon,label,val,color])=>(
              <View key={label} style={{width:(SW-64)/3,backgroundColor:C.card,borderRadius:10,borderWidth:1,borderColor:C.border,padding:10,alignItems:'center'}}>
                <Text style={{fontSize:18,marginBottom:2}}>{icon}</Text>
                <Text style={{fontSize:18,fontWeight:'800',color}}>{val}</Text>
                <Text style={{fontSize:9,color:C.textMuted,letterSpacing:1,marginTop:2}}>{label.toUpperCase()}</Text>
              </View>
            ))}
          </View>}
          {!g&&<View style={{alignItems:'center',padding:32}}><Text style={{fontSize:48}}>🌱</Text><Text style={{color:C.textMuted,textAlign:'center',fontSize:13,marginTop:8}}>No games yet!</Text></View>}

          {/* Quiz performance */}
          {quizPerformanceView}

          {/* Saving trend */}
          {savingTrendView}

          {/* Conversation starter */}
          {conversationStarterView}

          {/* ── Coming soon: Cellie Pro ───────────────────────────── */}
          <View style={{backgroundColor:C.card,borderRadius:14,
            borderWidth:2,borderColor:C.purple+'44',padding:16,gap:10}}>
            <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
              <Text style={{fontSize:28}}>🚀</Text>
              <View style={{flex:1}}>
                <Text style={{color:C.purple,fontWeight:'800',fontSize:15}}>
                  AI Parent Coaching
                </Text>
                <Text style={{color:C.textMuted,fontSize:12}}>
                  Powered by Claude — based on your sessions
                </Text>
              </View>
            </View>
            <CoachingCard userId={state.supabaseUser?.id} kids={state.parent?.kids||[]}/>
            <View style={{backgroundColor:C.purple+'22',borderRadius:12,
              padding:14,alignItems:'center',marginTop:4,
              borderWidth:1,borderColor:C.purple+'44'}}>
              <Text style={{color:C.purple,fontWeight:'800',fontSize:15}}>
                Coming soon — Cellie Pro 🚀
              </Text>
              <Text style={{color:C.textMuted,fontSize:11,marginTop:4}}>
                We'll notify you when it's ready!
              </Text>
            </View>
          </View>

          {/* Kid feedback summary */}
          {kfb.length>0&&(
            <View style={{backgroundColor:C.card,borderRadius:12,
              borderWidth:1,borderColor:C.border,padding:14,gap:10}}>
              <Text style={{color:C.text,fontWeight:'700',fontSize:14}}>
                😊 {kid.name}'s feedback ({kfb.length} sessions)
              </Text>
              <View style={{flexDirection:'row',gap:10}}>
                {topMood&&(
                  <View style={{flex:1,backgroundColor:C.green900,
                    borderRadius:8,padding:10,alignItems:'center',gap:4,
                    borderWidth:1,borderColor:C.green700}}>
                    <Text style={{fontSize:28}}>
                      {moodEmoji[topMood[0]]||'😊'}
                    </Text>
                    <Text style={{color:C.green400,fontSize:11,
                      fontWeight:'700',textAlign:'center'}}>
                      Most common mood
                    </Text>
                    <Text style={{color:C.textMuted,fontSize:10,
                      textAlign:'center'}}>
                      {topMood[1]} of {kfb.length} sessions
                    </Text>
                  </View>
                )}
                {topFav&&(
                  <View style={{flex:1,backgroundColor:C.green900,
                    borderRadius:8,padding:10,alignItems:'center',gap:4,
                    borderWidth:1,borderColor:C.green700}}>
                    <Text style={{fontSize:28}}>
                      {favEmoji[topFav[0]]||'🎮'}
                    </Text>
                    <Text style={{color:C.green400,fontSize:11,
                      fontWeight:'700',textAlign:'center'}}>
                      Favourite feature
                    </Text>
                    <Text style={{color:C.textMuted,fontSize:10,
                      textAlign:'center'}}>
                      {favLabel[topFav[0]]||topFav[0]}
                    </Text>
                  </View>
                )}
              </View>
              {/* Recent mood history */}
              <View style={{flexDirection:'row',gap:4,flexWrap:'wrap'}}>
                {kfb.slice(0,10).map((f,i)=>(
                  <Text key={i} style={{fontSize:18,opacity:1-(i*0.06)}}>
                    {moodEmoji[f.emoji]||'😶'}
                  </Text>
                ))}
                {kfb.length>10&&<Text style={{color:C.textFaint,fontSize:12,
                  alignSelf:'center'}}>+{kfb.length-10} more</Text>}
              </View>
            </View>
          )}
          {kfb.length===0&&(
            <View style={{backgroundColor:C.surface,borderRadius:10,
              padding:12,borderWidth:1,borderColor:C.border}}>
              <Text style={{color:C.textMuted,fontSize:13,textAlign:'center'}}>
                😊 Kid feedback appears here after each session
              </Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }
  return(
    <SafeAreaView style={{flex:1,backgroundColor:C.bg}}>
      <ScrollView contentContainerStyle={{padding:20,gap:16}}>
        <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
          <TouchableOpacity onPress={onBack}>
            <Text style={{color:C.green400,fontSize:16}}>←</Text>
          </TouchableOpacity>
          <Text style={[ss.h1,{flex:1}]}>Dashboard 📊</Text>
          <TouchableOpacity onPress={()=>setShowFeedback(true)}
            style={{backgroundColor:C.card,borderRadius:10,padding:10,
              borderWidth:1,borderColor:C.border,alignItems:'center'}}>
            <Text style={{fontSize:18}}>💬</Text>
            <Text style={{color:C.textMuted,fontSize:9,marginTop:2}}>Feedback</Text>
          </TouchableOpacity>
        </View>
        {kids.length===0?<View style={{alignItems:'center',padding:40}}><Text style={{fontSize:48}}>👨‍👩‍👧</Text><Text style={{color:C.textMuted,textAlign:'center',marginTop:8}}>No kids added yet!</Text></View>:
          kids.map(kid=>{
            const g=kid.game;const count=g?.cells?.filter(c=>!c.burst).length??0;
            const totalR=g?.totalRounds??0;const saveR=g?.history?.filter(r=>r.spent===0).length??0;
            const pct=totalR>0?Math.round((saveR/totalR)*100):0;
            const retired=(g?.retiredColonies||[]).length;
            return(
              <TouchableOpacity key={kid.id} onPress={()=>setSel(kid.id)} style={{backgroundColor:C.card,borderRadius:14,borderWidth:1.5,borderColor:C.border,padding:16}}>
                <View style={{flexDirection:'row',alignItems:'center',gap:12,marginBottom:g?10:0}}>
                  <Text style={{fontSize:36}}>{kid.avatar}</Text>
                  <View style={{flex:1}}>
                    <Text style={{color:C.text,fontWeight:'800',fontSize:16}}>{kid.name}</Text>
                    <Text style={{color:C.textMuted,fontSize:12}}>{g?`Colony #${g.colonyNumber||1} · ${count}/${COLONY_CAP}`:'Not played yet'}</Text>
                    {retired>0&&<Text style={{color:C.green400,fontSize:11,marginTop:1}}>🏛️ {retired} retired</Text>}
                  </View>
                  <Text style={{color:C.textMuted,fontSize:20}}>›</Text>
                </View>
                {g&&<View style={{flexDirection:'row',gap:8}}>
                  {[['⏱',formatPlayTime(kid.totalPlayTime)],['💾',`${pct}%`],['🏛️',`${retired}`],['🔥',`${g.bestStreak||0}`]].map(([icon,val])=>(
                    <View key={icon} style={{flex:1,backgroundColor:C.surface,borderRadius:8,padding:6,alignItems:'center'}}><Text style={{fontSize:12}}>{icon}</Text><Text style={{color:C.text,fontSize:12,fontWeight:'700'}}>{val}</Text></View>
                  ))}
                </View>}
              </TouchableOpacity>
            );
          })}
      </ScrollView>
    </SafeAreaView>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// KID GAME FLOW
// ══════════════════════════════════════════════════════════════════════════
function KidGameFlow({kidId,sessionDuration,onSessionEnd}){
  const{state,dispatch:appDispatch}=useApp();
  const{game,dispatch:gameDispatch}=useGame();
  const[screen,setScreen]=useState(null);
  const[expired,setExpired]=useState(false);
  const[cellieOpen,setCellieOpen]=useState(false);
  const[cellieBubble,setCellieBubble]=useState(false); // animated "Ask me!" prompt
  const cellieBubbleAnim=useRef(new Animated.Value(0)).current;
  const cellieBubblePulse=useRef(new Animated.Value(1)).current;

  // Show animated bubble after round 3 if Cellie hasn't been used
  useEffect(()=>{
    if(!game)return;
    if(game.round>=3&&!cellieBubble&&!cellieOpen){
      setCellieBubble(true);
      // Slide in
      Animated.spring(cellieBubbleAnim,{toValue:1,useNativeDriver:true,tension:60,friction:8}).start();
      // Pulse loop
      Animated.loop(
        Animated.sequence([
          Animated.timing(cellieBubblePulse,{toValue:1.06,duration:700,useNativeDriver:true}),
          Animated.timing(cellieBubblePulse,{toValue:1.0, duration:700,useNativeDriver:true}),
        ])
      ).start();
      // Auto-dismiss after 6 seconds
      setTimeout(()=>{
        Animated.timing(cellieBubbleAnim,{toValue:0,duration:300,useNativeDriver:true}).start(()=>setCellieBubble(false));
      },6000);
    }
  },[game?.round]);// eslint-disable-line react-hooks/exhaustive-deps
  const[sessionRemaining,setSessionRemaining]=useState(sessionDuration);
  const kid=state.parent?.kids?.find(k=>k.id===kidId);

  // Guard — if parent state not yet loaded, wait
  if(!state._loaded){
    return(
      <SafeAreaView style={{flex:1,backgroundColor:C.bg,alignItems:'center',justifyContent:'center',gap:12}}>
        <Text style={{fontSize:48}}>🧬</Text>
        <Text style={{color:C.textMuted,fontSize:14}}>Loading...</Text>
      </SafeAreaView>
    );
  }

  // If kid not found in parent state, rebuild from DEMO_PARENT or create minimal kid
  const resolvedKid = kid || {id:kidId,name:'Friend',avatar:'🌟',age:8,game:null,sessions:[],totalPlayTime:0};

  useEffect(()=>{
    // Timer runs normally — but expiry waits until Cellie is closed.
    // Kids can finish their question; keeping Cellie open doesn't extend play time.
    if(sessionRemaining<=0){if(!cellieOpen)setExpired(true);return;}
    if(expired)return;
    const t=setTimeout(()=>setSessionRemaining(r=>r-1),1000);
    return()=>clearTimeout(t);
  },[sessionRemaining,expired,cellieOpen]);// eslint-disable-line react-hooks/exhaustive-deps
  // Trigger expiry the moment Cellie closes if timer already hit 0
  useEffect(()=>{
    if(!cellieOpen&&sessionRemaining<=0&&!expired)setExpired(true);
  },[cellieOpen]);// eslint-disable-line react-hooks/exhaustive-deps
  useEffect(()=>{ // eslint-disable-line react-hooks/exhaustive-deps
    if(!resolvedKid)return;
    if(resolvedKid.game&&resolvedKid.game.phase&&resolvedKid.game.cells){
      gameDispatch({type:'LOAD',game:resolvedKid.game});
      if(!resolvedKid.game.hasSeenOnboarding)setScreen('onboard');
      else setScreen('game');
    }else setScreen('setup');
  },[]);// eslint-disable-line react-hooks/exhaustive-deps
  useEffect(()=>{if(game)appDispatch({type:'SAVE_GAME',game});},[game]);// eslint-disable-line react-hooks/exhaustive-deps
  const handleQuit=useCallback(()=>setExpired(true),[]);
  const[kidFeedbackDone,setKidFeedbackDone]=useState(false);
  const[inGamePinGate,setInGamePinGate]=useState(null); // {url, itemName}
  const liveCount=game?.cells?.filter(c=>!c.burst).length||0;

  if(!screen)return<SafeAreaView style={{flex:1,backgroundColor:C.bg,alignItems:'center',justifyContent:'center'}}><Text style={{color:C.textMuted}}>Loading...</Text></SafeAreaView>;

  // In-game parental gate — fires when kid taps "Buy" on Amazon goal
  if(inGamePinGate){
    return(
      <SafeAreaView style={{flex:1,backgroundColor:C.bg}}>
        <ParentPinGateModal
          visible={true}
          title={`Buy the ${inGamePinGate.itemName}!`}
          subtitle={'Enter your parent PIN to open Amazon and complete this purchase.'}
          onUnlock={()=>{
            Linking.openURL(inGamePinGate.url).catch(()=>{});
            setInGamePinGate(null);
          }}
          onCancel={()=>setInGamePinGate(null)}
        />
      </SafeAreaView>
    );
  }

  if(expired&&!kidFeedbackDone){
    return<KidFeedbackScreen kidId={kidId} sessionCells={liveCount}
      onDone={()=>setKidFeedbackDone(true)}/>;
  }
  if(expired)return<TimesUpScreen kidId={kidId} onUnlock={()=>{appDispatch({type:'END_SESSION'});onSessionEnd();}}/>;

  const handleGraduate=()=>{
    gameDispatch({type:'GRADUATE'});
    setScreen('game'); // will re-render with new colony
  };

  return(
    <View style={{flex:1}}>
      {screen==='setup'     &&<KidSetupScreen kidName={kid?.name||'Friend'} onDone={(nm,p,r,w,g)=>{gameDispatch({type:'INIT',name:nm,principal:p,rate:r,wishId:w,goal:g});setScreen('onboard');}}/>}
      {screen==='onboard'   &&<OnboardingScreen kidName={kid?.name||'Friend'} onDone={()=>{gameDispatch({type:'SEEN_ONBOARDING'});setScreen('game');}}/>}
      {screen==='game'      &&game&&<KidGameScreen sessionRemaining={sessionRemaining} sessionTotal={sessionDuration} cellieOpen={cellieOpen} setCellieOpen={(v)=>{setCellieOpen(v);if(v){setCellieBubble(false);}}} cellieBubble={cellieBubble} cellieBubbleAnim={cellieBubbleAnim} cellieBubblePulse={cellieBubblePulse} setCellieBubble={setCellieBubble} onResults={()=>setScreen('results')} onLevelUp={()=>setScreen('levelup')} onShop={()=>setScreen('shop')} onMuseum={()=>setScreen('museum')} onQuit={handleQuit} onPinGate={setInGamePinGate}/>}
      {screen==='results'   &&<KidResultsScreen onNext={()=>setScreen('game')} onShop={()=>setScreen('shop')}/>}
      {screen==='levelup'   &&<KidLevelUpScreen onContinue={()=>setScreen('game')}/>}
      {screen==='graduating'&&game&&<ColonyGraduationScreen game={game} onContinue={handleGraduate}/>}
      {screen==='extinct'   &&game&&<ColonyExtinctScreen    game={game} onContinue={handleGraduate}/>}
      {screen==='shop'      &&<KidShopScreen onBack={()=>setScreen('game')} kidName={kid?.name||'friend'}/>}
      {screen==='museum'    &&game&&<ColonyMuseumScreen game={game} onBack={()=>setScreen('game')}/>}
    </View>
  );
}

// ── Kid Onboarding — 3 swipeable cards shown once ─────────────────────────
const ONBOARD_CARDS = [
  {
    bg:'#051a0a',
    emoji:'🔬',
    title:"What's a petri dish?",
    body:"Scientists use a tiny round dish — called a petri dish — to grow living things too small to see! It's like a little swimming pool for tiny life.",
    analogy:'Think of it like a snow globe for microscopic creatures!',
    color:'#4ade80',
    accentBg:'#0d2a0d',
    accentBorder:'#1e3a28',
    // Interactive: animated petri dish sketch
    anim:'dish',
  },
  {
    bg:'#0a1020',
    emoji:'🧬',
    title:'What is a cell?',
    body:"Every living thing — you, me, plants, animals — is made of tiny building blocks called cells. Your body has 37 TRILLION of them!",
    analogy:'A cell is like a tiny room in a huge building. Your body is the building!',
    color:'#60a5fa',
    accentBg:'#0d1829',
    accentBorder:'#1e3a4a',
    anim:'body',
  },
  {
    bg:'#100a1a',
    emoji:'💰',
    title:'Cells = your money!',
    body:"In this game, each cell is $1. When you SAVE your cells, they split and multiply — like a cookie that magically clones itself every night!",
    analogy:'Interest = the bank saying THANK YOU for saving with an extra cookie 🍪',
    color:'#f59e0b',
    accentBg:'#1a1200',
    accentBorder:'#f59e0b44',
    anim:'split',
  },
];

function OnboardingScreen({kidName,onDone}){
  const[card,setCard]=useState(0);
  const slideAnim=useRef(new Animated.Value(0)).current;
  const fadeAnim =useRef(new Animated.Value(1)).current;
  // Canvas ref for the animated illustration on each card
  const[animTick,setAnimTick]=useState(0);
  useEffect(()=>{
    const t=setInterval(()=>setAnimTick(v=>v+1),50);
    return()=>clearInterval(t);
  },[]);

  const goNext=()=>{
    if(card>=ONBOARD_CARDS.length-1){onDone();return;}
    Animated.sequence([
      Animated.timing(fadeAnim,{toValue:0,duration:150,useNativeDriver:true}),
    ]).start(()=>{
      setCard(c=>c+1);
      slideAnim.setValue(30);
      Animated.parallel([
        Animated.timing(fadeAnim,{toValue:1,duration:200,useNativeDriver:true}),
        Animated.timing(slideAnim,{toValue:0,duration:200,useNativeDriver:true}),
      ]).start();
    });
  };

  const c=ONBOARD_CARDS[card];
  const isLast=card===ONBOARD_CARDS.length-1;

  return(
    <SafeAreaView style={{flex:1,backgroundColor:c.bg}}>
      <View style={{flex:1,padding:24,gap:16}}>
        {/* Skip */}
        <View style={{flexDirection:'row',justifyContent:'flex-end'}}>
          <TouchableOpacity onPress={onDone} style={{padding:6}}>
            <Text style={{color:C.textFaint,fontSize:13}}>Skip</Text>
          </TouchableOpacity>
        </View>

        <Animated.View style={{flex:1,gap:16,opacity:fadeAnim,transform:[{translateY:slideAnim}]}}>
          {/* Illustration area */}
          <View style={{alignItems:'center',justifyContent:'center',height:160}}>
            {c.anim==='dish'&&<OnboardDishAnim tick={animTick} color={c.color}/>}
            {c.anim==='body'&&<OnboardBodyAnim tick={animTick} color={c.color}/>}
            {c.anim==='split'&&<OnboardSplitAnim tick={animTick} color={c.color}/>}
          </View>

          {/* Title */}
          <Text style={{color:c.color,fontWeight:'800',fontSize:24,textAlign:'center',letterSpacing:-0.5}}>
            {c.title}
          </Text>

          {/* Body */}
          <View style={{backgroundColor:c.accentBg,borderRadius:14,borderWidth:1,borderColor:c.accentBorder,padding:16}}>
            <Text style={{color:C.text,fontSize:15,lineHeight:23,textAlign:'center'}}>{c.body}</Text>
          </View>

          {/* Analogy bubble */}
          <View style={{flexDirection:'row',gap:10,alignItems:'flex-start',backgroundColor:C.surface,borderRadius:12,padding:12,borderWidth:1,borderColor:C.border}}>
            <Text style={{fontSize:20}}>💡</Text>
            <Text style={{color:C.textMuted,fontSize:13,lineHeight:20,flex:1,fontStyle:'italic'}}>{c.analogy}</Text>
          </View>
        </Animated.View>

        {/* Progress dots */}
        <View style={{flexDirection:'row',justifyContent:'center',gap:8,marginBottom:4}}>
          {ONBOARD_CARDS.map((_,i)=>(
            <View key={i} style={{width:i===card?20:7,height:7,borderRadius:4,backgroundColor:i===card?c.color:C.textFaint,transition:'width 0.3s'}}/>
          ))}
        </View>

        {/* Next / Start button */}
        <TouchableOpacity onPress={goNext}
          style={{backgroundColor:c.color,borderRadius:14,padding:16,alignItems:'center'}}>
          <Text style={{color:c.bg==='#051a0a'?'#052e16':'#0a0f0a',fontWeight:'800',fontSize:16}}>
            {isLast?`🧬 Grow some cells, ${kidName}!`:'Next →'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ── Onboarding animations (pure RN, no canvas) ────────────────────────────
function OnboardDishAnim({tick,color}){
  // Animated petri dish sketch — 6 cells floating
  const cells=useMemo(()=>Array.from({length:6},(_,i)=>({
    x:0.2+Math.random()*0.6, y:0.2+Math.random()*0.6,
    phase:Math.random()*Math.PI*2,
    hue:130+i*8,
  })),[]);// eslint-disable-line react-hooks/exhaustive-deps
  return(
    <View style={{width:150,height:150,borderRadius:75,backgroundColor:C.surface,borderWidth:2.5,borderColor:color+'88',alignItems:'center',justifyContent:'center',overflow:'hidden'}}>
      <View style={{position:'absolute',inset:6,borderRadius:69,borderWidth:1,borderColor:color+'22'}}/>
      {cells.map((c,i)=>{
        const scale=1+Math.sin(tick*0.12+c.phase)*0.1;
        const fx=Math.sin(tick*0.05+c.phase)*3;
        const fy=Math.cos(tick*0.04+c.phase+1)*3;
        return(
          <View key={i} style={{position:'absolute',
            left:c.x*130-10+fx, top:c.y*130-10+fy,
            width:20,height:20,borderRadius:10,
            backgroundColor:`hsla(${c.hue},65%,35%,0.4)`,
            borderWidth:1.8,borderColor:`hsl(${c.hue},70%,58%)`,
            transform:[{scale}],alignItems:'center',justifyContent:'center'}}>
            <View style={{width:6,height:6,borderRadius:3,backgroundColor:`hsla(${c.hue},55%,22%,0.8)`}}/>
          </View>
        );
      })}
      <Text style={{position:'absolute',bottom:6,fontSize:9,color:color+'88',letterSpacing:1}}>PETRI DISH</Text>
    </View>
  );
}

function OnboardBodyAnim({tick,color}){
  // Body outline with cells zooming in
  const zoom=0.8+Math.sin(tick*0.04)*0.08;
  return(
    <View style={{alignItems:'center',gap:8}}>
      <View style={{width:90,height:130,borderRadius:45,borderWidth:2,borderColor:color+'55',backgroundColor:color+'11',alignItems:'center',justifyContent:'center',transform:[{scale:zoom}]}}>
        <Text style={{fontSize:42}}>🧒</Text>
      </View>
      <View style={{flexDirection:'row',gap:6,alignItems:'center'}}>
        <Text style={{color:C.textMuted,fontSize:11}}>made of</Text>
        {[0,1,2,3,4].map(i=>(
          <View key={i} style={{width:12,height:12,borderRadius:6,backgroundColor:`hsla(${130+i*8},65%,35%,0.5)`,borderWidth:1.2,borderColor:`hsl(${130+i*8},70%,58%)`,transform:[{scale:1+Math.sin(tick*0.1+i)*0.15}]}}/>
        ))}
        <Text style={{color:color,fontSize:11,fontWeight:'700'}}>37 trillion cells!</Text>
      </View>
    </View>
  );
}

function OnboardSplitAnim({tick,color}){
  // One cell → splits → two cells
  const phase=(tick*0.03)%(Math.PI*2);
  const isSplitting=phase>Math.PI*1.4;
  const splitProgress=isSplitting?(phase-Math.PI*1.4)/(Math.PI*0.6):0;
  const offset=splitProgress*28;
  const baseScale=isSplitting?1-splitProgress*0.2:0.9+Math.sin(phase)*0.12;
  return(
    <View style={{alignItems:'center',justifyContent:'center',height:120}}>
      {!isSplitting?(
        <View style={{width:54,height:54,borderRadius:27,
          backgroundColor:`hsla(138,65%,35%,0.4)`,
          borderWidth:2.5,borderColor:`hsl(138,70%,58%)`,
          transform:[{scale:baseScale}],alignItems:'center',justifyContent:'center'}}>
          <View style={{width:17,height:17,borderRadius:9,backgroundColor:`hsla(138,55%,22%,0.8)`}}>
            <View style={{width:6,height:6,borderRadius:3,backgroundColor:`hsla(138,75%,70%,0.9)`,marginTop:2,marginLeft:2}}/>
          </View>
        </View>
      ):(
        <View style={{flexDirection:'row',alignItems:'center',gap:4}}>
          <View style={{width:44,height:44,borderRadius:22,
            backgroundColor:`hsla(138,65%,35%,0.4)`,
            borderWidth:2,borderColor:`hsl(138,70%,58%)`,
            transform:[{translateX:-offset}],alignItems:'center',justifyContent:'center'}}>
            <View style={{width:13,height:13,borderRadius:7,backgroundColor:`hsla(138,55%,22%,0.8)`}}/>
          </View>
          <View style={{width:44,height:44,borderRadius:22,
            backgroundColor:`hsla(148,65%,35%,0.4)`,
            borderWidth:2,borderColor:`hsl(148,70%,58%)`,
            transform:[{translateX:offset}],alignItems:'center',justifyContent:'center'}}>
            <View style={{width:13,height:13,borderRadius:7,backgroundColor:`hsla(148,55%,22%,0.8)`}}/>
          </View>
        </View>
      )}
      <Text style={{color:C.textMuted,fontSize:12,marginTop:12,textAlign:'center'}}>
        {isSplitting?'💸 spending = cells disappear':'💾 saving = cells split into 2!'}
      </Text>
      {/* Dollar labels */}
      <View style={{flexDirection:'row',gap:6,marginTop:6}}>
        <View style={{backgroundColor:color+'22',borderRadius:8,paddingHorizontal:10,paddingVertical:4,borderWidth:1,borderColor:color+'44'}}>
          <Text style={{color,fontWeight:'700',fontSize:12}}>1 cell = $1</Text>
        </View>
        {isSplitting&&splitProgress>0.5&&(
          <View style={{backgroundColor:C.green500+'22',borderRadius:8,paddingHorizontal:10,paddingVertical:4,borderWidth:1,borderColor:C.green500+'44'}}>
            <Text style={{color:C.green400,fontWeight:'700',fontSize:12}}>→ 2 cells = $2! 🎉</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ── Kid Setup ──────────────────────────────────────────────────────────────

// ══════════════════════════════════════════════════════════════════════════
// 🧬 CELLIE — In-game RAG tutor (keyword mock in Snack; swap URL for prod)
// ══════════════════════════════════════════════════════════════════════════
const CELLIE_KB = {
  "petri dish":     "A petri dish is a tiny round dish scientists use to grow living things! 🔬 Think of it like a snow globe for microscopic creatures. Your game screen IS a petri dish — you're the scientist growing a money colony! Tip: real petri dishes are only about 10cm wide but powerful enough to change science!",
  "cell":           "Cells are the tiniest building blocks of ALL living things 🧬 Imagine your body is a huge LEGO castle — cells are the individual LEGO bricks! Your body has 37 TRILLION of them. In Money Cells, each cell = $1. Save them and they split — just like real biology!",
  "split":          "When cells split, one becomes TWO — like magic! 🍼 Imagine one cookie that clones itself into two cookies overnight. Scientists call this mitosis. In Money Cells: save your cells → they split next round → you end up with MORE than you started! That's your money making more money!",
  "compound":       "Compound interest is like a snowball rolling downhill 🌱 Start with a tiny snowball (your savings). As it rolls, it picks up more snow. The BIGGER it gets, the FASTER it grows! $10 grows to $11, then $11 grows to $12.10 — it earns on ALL of it, not just the original. Every cell split in your game IS this snowball rolling!",
  "interest":       "Interest is like a thank-you gift for letting the bank borrow your money 💰 You put $10 in a piggy bank at the bank → they lend it to someone → they give you back $10.50 as a thank you! The extra 50 cents = interest. In Money Cells, the new baby cells after each round = the thank-you gift for saving!",
  "save":           "Saving is like planting seeds 🌱 You plant 1 seed → it grows into a tree with 100 seeds. Plant THOSE → now you have 10,000! $1 saved at age 8 could become $50+ by the time you're an adult — just by waiting. In Money Cells: every cell you DON'T spend multiplies every single round!",
  "spend":          "Every time you spend, you're not just losing the money — you're losing everything it COULD have grown into 💸 It's like cutting down a fruit tree to eat one apple. The apple is gone AND all the future apples it would have made! In Money Cells, 3 spent cells = 3 fewer cells making babies next round!",
  "flash deal":     "Flash Deals are like someone yelling FIRE in a shop — they want you to panic and grab stuff without thinking! ⏰ Shops do this on purpose. The trick: ask yourself 'Would I want this tomorrow?' If the answer is no, it's the deal doing the wanting — not you! Save your cells and let them multiply instead!",
  "resistance":     "The Resistance Meter is your superpower trainer ⭐ Every time you choose NOT to spend, you get stronger — like a muscle that grows the more you use it! Scientists gave kids one marshmallow and said 'wait 15 minutes and you get TWO.' Kids who waited grew up happier and wealthier. You're doing the same thing right now!",
  "museum":         "The Colony Museum is your personal Hall of Fame! 🏛️ Each graduated colony is like finishing a school year — you learned, you grew, you levelled up! The next colony gets bonus starter cells, like a head start passed down from your previous hard work. That's exactly how real family wealth works across generations!",
  "money":          "Money is a tool — like a hammer 💰 A hammer doesn't do anything by itself, but in the right hands it builds houses! The secret: money can BUILD MORE money if you let it grow. In Money Cells, each cell = $1. Let your cells multiply and your tool gets more powerful every single round!",
  "earn":           "You earn more cells by SAVING them — it sounds backwards but it's the #1 money secret! 🌱 The more cells you keep, the more split next round. It's like compound interest — your money makes money, then THAT money makes money too! Keep saving every round and watch the snowball grow bigger and faster!",
  "why":            "Great question! 💡 Everything in Money Cells teaches a real skill. Cells splitting = money growing (interest). Spending cells = losing future growth (opportunity cost). Flash Deals = impulse buys (marketing tricks). The Resistance Meter = willpower training. You're learning real money superpowers — just way more fun than a textbook!",
  "how":            "Here's how Money Cells works! 🎮 Each cell = $1. Timer counts down → saved cells split and multiply! Tap once to think about spending (amber), tap again to confirm (red X). Saved cells multiply. Spent ones disappear. Fill the Resistance Meter for bonus cells. Reach 50 cells → your colony GRADUATES!",
  "opportunity cost": "Opportunity cost means every time you spend money, you give up what it COULD have become 🤔 Spend $5 on candy = give up $5 that could grow to $10. It's like trading a puppy for a cookie — the puppy would have grown into a dog! Ask: 'Is this thing worth more to me than what my cells could multiply into?'",
  "inflation":      "Inflation means prices slowly go up over time 📈 A candy bar that cost 50 cents when your parents were kids might cost $1.50 today! So money sitting still actually gets WEAKER over time — like ice cream melting. That's why growing your money through saving is so important. Saving beats the ice cream melting!",
  "principal":      "Principal is the original money you started with — like your starter seeds 🌱 If you plant 10 seeds, 10 is your principal. Everything that grows on top is the bonus! Warren Buffett's rule: NEVER lose your principal. In Money Cells, your starting cells are your principal — protect them and let them multiply!",
};

function cellieLookup(question){
  const q = question.toLowerCase();
  for(const [key,answer] of Object.entries(CELLIE_KB)){
    if(q.includes(key)) return answer;
  }
  // Fallback
  return `Great question! 🧬 Keep saving your cells and they'll keep multiplying! The more you save, the faster your colony grows. Remember: every cell = $1, and saved cells split into MORE cells next round. Ask me about cells, interest, splits, deals, or saving!`;
}

const CELLIE_SUGGESTIONS = [
  "What is a petri dish?","Why do cells split?","What is interest?",
  "What is compound interest?","Why should I save?","What is opportunity cost?",
  "How does the Flash Deal work?","What is the Resistance Meter?",
  "What is inflation?","What is principal?","How do I get more cells?",
];

// ══════════════════════════════════════════════════════════════════════════
// 📷 CELLIE VISION — full-screen camera overlay (Option B flow)
// In Snack/Expo Go: shows a placeholder card. In EAS build: real camera.
// ══════════════════════════════════════════════════════════════════════════

// CameraView is null in Snack/Expo Go — CameraOverlay shows a placeholder.
// In the EAS build, swap this line: import {CameraView} from 'expo-camera';
function CameraOverlay({onCapture,onCancel}){
  const cameraRef=useRef(null);
  const[ready,setReady]=useState(false);
  const[permission,requestPermission]=useCameraPermissions();

  // Auto-request on mount — skips the extra tap
  useEffect(()=>{
    if(permission===null)return;           // still loading
    if(!permission.granted&&permission.canAskAgain){requestPermission();}
  },[permission?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Loading (permission state not yet known) ───────────────────────────────
  if(permission===null){
    return(
      <View style={{flex:1,backgroundColor:'#000',alignItems:'center',justifyContent:'center'}}>
        <ActivityIndicator size="large" color={C.green400}/>
        <Text style={{color:'#aaa',marginTop:12,fontSize:13}}>Checking camera access…</Text>
      </View>
    );
  }

  // ── Permanently denied — send to Settings ──────────────────────────────────
  if(!permission.granted&&!permission.canAskAgain){
    return(
      <View style={{flex:1,backgroundColor:'#000',alignItems:'center',justifyContent:'center',padding:32}}>
        <Text style={{fontSize:64,marginBottom:16}}>📷</Text>
        <Text style={{color:'#fff',fontWeight:'800',fontSize:18,textAlign:'center',marginBottom:12}}>
          Camera access blocked
        </Text>
        <Text style={{color:'#aaa',fontSize:14,textAlign:'center',marginBottom:28,lineHeight:22}}>
          Go to iPhone Settings → Money Cells → Camera and turn it on.
        </Text>
        <TouchableOpacity onPress={()=>Linking.openSettings()}
          style={{backgroundColor:C.green500,borderRadius:14,paddingHorizontal:28,paddingVertical:14,marginBottom:12}}>
          <Text style={{color:C.bg,fontWeight:'800',fontSize:16}}>Open Settings</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onCancel} style={{paddingVertical:8}}>
          <Text style={{color:'#aaa',fontSize:14}}>Not now</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Can still ask — show button (auto-triggered by useEffect above) ────────
  if(!permission.granted){
    return(
      <View style={{flex:1,backgroundColor:'#000',alignItems:'center',justifyContent:'center',padding:32}}>
        <Text style={{fontSize:64,marginBottom:16}}>📷</Text>
        <Text style={{color:'#fff',fontWeight:'800',fontSize:18,textAlign:'center',marginBottom:16}}>
          Cellie needs camera access
        </Text>
        <TouchableOpacity onPress={requestPermission}
          style={{backgroundColor:C.green500,borderRadius:14,paddingHorizontal:28,paddingVertical:14,marginBottom:12}}>
          <Text style={{color:C.bg,fontWeight:'800',fontSize:16}}>Allow Camera</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onCancel} style={{paddingVertical:8}}>
          <Text style={{color:'#aaa',fontSize:14}}>Not now</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const ActiveCamera=CameraView;

  const takePicture=async()=>{
    if(!cameraRef.current||!ready)return;
    try{
      const photo=await cameraRef.current.takePictureAsync({
        base64:true,
        quality:0.3,           // low quality = small base64 (<500KB) — Claude identifies items fine at this res
        // skipProcessing omitted — it prevents base64 from being populated on iOS
      });
      if(!photo?.base64){
        console.warn('Camera: base64 empty — retrying');
        const retry=await cameraRef.current.takePictureAsync({base64:true});
        if(retry?.base64)onCapture(retry.base64);
        return;
      }
      onCapture(photo.base64);
    }catch(e){console.warn('Camera error',e);}
  };

  return(
    <View style={{flex:1,backgroundColor:'#000'}}>
      <ActiveCamera ref={cameraRef} style={{flex:1}} facing="back"
        onCameraReady={()=>setReady(true)}>
        {/* Viewfinder guide */}
        <View style={{flex:1,alignItems:'center',justifyContent:'center'}}>
          <View style={{width:240,height:240,borderRadius:16,borderWidth:2,
            borderColor:'rgba(255,255,255,0.6)',
            shadowColor:'#fff',shadowOffset:{width:0,height:0},
            shadowOpacity:0.3,shadowRadius:10}}/>
          <Text style={{color:'rgba(255,255,255,0.8)',marginTop:16,fontSize:13,
            textAlign:'center',paddingHorizontal:32}}>
            Point at the item you want Cellie to check 🧬
          </Text>
        </View>
      </ActiveCamera>

      {/* Controls */}
      <View style={{position:'absolute',bottom:0,left:0,right:0,
        paddingBottom:40,paddingHorizontal:32,
        flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
        <TouchableOpacity onPress={onCancel}
          style={{width:52,height:52,borderRadius:26,backgroundColor:'rgba(0,0,0,0.6)',
            borderWidth:1.5,borderColor:'rgba(255,255,255,0.3)',
            alignItems:'center',justifyContent:'center'}}>
          <Text style={{color:'#fff',fontSize:22}}>✕</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={takePicture} disabled={!ready}
          style={{width:72,height:72,borderRadius:36,
            backgroundColor:ready?'#fff':'rgba(255,255,255,0.3)',
            borderWidth:4,borderColor:'rgba(255,255,255,0.6)',
            alignItems:'center',justifyContent:'center',
            shadowColor:'#fff',shadowOffset:{width:0,height:0},
            shadowOpacity:ready?0.6:0,shadowRadius:12}}>
          <View style={{width:56,height:56,borderRadius:28,
            backgroundColor:ready?C.green500:'rgba(100,200,100,0.3)'}}/>
        </TouchableOpacity>

        <View style={{width:52}}/>
      </View>
    </View>
  );
}

// ── Cellie vision analysis — calls Claude vision API via Edge Function ──────
const CELLIE_ENDPOINT='https://wztykysqvnngsnmadrdt.supabase.co/functions/v1/cellie';
async function analysePurchase(base64Image,kidName,kidAge,sessionCells,wishItem){
  if(!base64Image)return defaultVisionResponse(wishItem); // guard — empty image
  // Use env var if baked in, otherwise fall back to hardcoded endpoint
  // (EXPO_PUBLIC_* inlining from eas.json is unreliable; hardcode is safe — URL is not a secret)
  const url=CELLIE_VISION_URL||CELLIE_ENDPOINT;
  try{
    const res=await fetch(url,{
      method:'POST',
      headers:await cellieHeaders(),
      body:JSON.stringify({
        mode:'vision',
        image:base64Image,
        question:'Is this worth buying with my cells?',
        kidName,kidAge,sessionCells,
        wishItemName:wishItem?.name,wishItemCost:wishItem?.cost,
      }),
    });
    if(res.ok){
      const data=await res.json();
      return data.answer||defaultVisionResponse(wishItem);
    }
    const errText=await res.text().catch(()=>res.status);
    console.warn('Cellie Vision HTTP error:',res.status,errText);
  }catch(e){
    console.warn('Cellie Vision failed:',e);
  }
  return defaultVisionResponse(wishItem);
}
function defaultVisionResponse(wishItem){
  if(wishItem){
    return `I can see you're thinking about buying something! 🧬 You're saving up for ${wishItem.name} (${wishItem.cost} cells). Is this the item you're looking at? Remember: every cell you spend now can't multiply next round. Is it worth it, or can you wait a little longer?`;
  }
  return "Interesting item! 🔬 Before you decide, ask yourself: is this something I really need, or is it something I just want right now? Your cells could keep multiplying if you wait — like seeds growing into a tree! What do you think?";
}


function CellieModal({visible,onClose,kidName,kidAge,sessionCells,round,streak,resistMeter,wishItem}){
  const[messages,setMessages]=useState([
    {role:'cellie',text:`Hi ${kidName}! I'm Cellie 🧬 — your Money Cells science buddy! Ask me anything, or tap 📷 to show me something you want to buy!`}
  ]);
  const[input,setInput]=useState('');
  const[loading,setLoading]=useState(false);
  const[cameraOpen,setCameraOpen]=useState(false);
  const scrollRef=useRef(null);

  useEffect(()=>{
    if(visible){
      setMessages([{role:'cellie',text:`Hi ${kidName}! I'm Cellie 🧬 — ask me anything, or tap 📷 to show me something and I'll tell you if it's worth your cells!`}]);
      setInput('');
      setCameraOpen(false);
    }
  },[visible]);// eslint-disable-line react-hooks/exhaustive-deps

  // ── Text question handler ─────────────────────────────────────────────
  const ask=useCallback(async(q)=>{
    const question=q||input.trim();
    if(!question||loading)return;
    setInput('');
    setMessages(m=>[...m,{role:'kid',text:question}]);
    setLoading(true);
    let answer;
    {
      // ── Live Claude via Supabase Edge Function (hardcoded fallback if env var missing) ──
      try{
        const res=await fetch(CELLIE_URL||CELLIE_ENDPOINT,{
          method:'POST',
          headers:await cellieHeaders(),
          body:JSON.stringify({question,kidName,kidAge,
            sessionCells,round:round||1,streak:streak||0,
            resistMeter:resistMeter||0}),
        });
        const data=await res.json();
        answer=data.answer||cellieLookup(question);
      }catch(e){
        console.warn('Cellie API error, falling back to keyword mode',e);
        // ── Keyword fallback (offline / error) ───────────────────────
        await new Promise(r=>setTimeout(r,600+Math.random()*400));
        answer=cellieLookup(question);
      }
    }
    setMessages(m=>[...m,{role:'cellie',text:answer}]);
    setLoading(false);
  },[input,loading,kidName,kidAge,sessionCells,round,streak,resistMeter]);// eslint-disable-line react-hooks/exhaustive-deps

  // ── Photo handler — Option B flow: camera opens full-screen, returns here ─
  const handlePhotoCapture=useCallback(async(base64)=>{
    setCameraOpen(false);
    // Show photo thumbnail in chat as kid message
    setMessages(m=>[...m,{role:'kid',text:'📷 Is this worth buying?',photo:base64}]);
    setLoading(true);
    const answer=await analysePurchase(base64,kidName,kidAge,sessionCells,wishItem);
    setMessages(m=>[...m,{role:'cellie',text:answer}]);
    setLoading(false);
  },[kidName,kidAge,sessionCells,wishItem]);// eslint-disable-line react-hooks/exhaustive-deps

  const showSuggestions=messages.length<3;

  // ── Full-screen camera overlay (Option B) ────────────────────────────
  if(cameraOpen&&visible){
    return(
      <Modal visible={visible} transparent={false} animationType="slide" statusBarTranslucent>
        <CameraOverlay
          onCapture={handlePhotoCapture}
          onCancel={()=>setCameraOpen(false)}
        />
      </Modal>
    );
  }

  return(
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent>
      <View style={{flex:1,backgroundColor:'rgba(0,0,0,0.85)',justifyContent:'flex-end'}}>
        <SafeAreaView style={{backgroundColor:C.bg,borderTopLeftRadius:20,borderTopRightRadius:20,
          maxHeight:'85%',overflow:'hidden'}}>

          {/* Header */}
          <View style={{flexDirection:'row',alignItems:'center',gap:10,padding:16,
            borderBottomWidth:1,borderBottomColor:C.border}}>
            <View style={{width:38,height:38,borderRadius:19,backgroundColor:C.green900,
              borderWidth:2,borderColor:C.green500,alignItems:'center',justifyContent:'center'}}>
              <Text style={{fontSize:20}}>🧬</Text>
            </View>
            <View style={{flex:1}}>
              <Text style={{color:C.green400,fontWeight:'800',fontSize:15}}>Cellie</Text>
              <Text style={{color:C.textMuted,fontSize:11}}>Your Money Cells science buddy</Text>
            </View>
            {/* Back to game button — primary action */}
            <TouchableOpacity onPress={onClose}
              style={{backgroundColor:C.green500,borderRadius:10,
                paddingHorizontal:12,paddingVertical:8,
                flexDirection:'row',alignItems:'center',gap:5}}>
              <Text style={{color:C.bg,fontWeight:'800',fontSize:13}}>▶ Back</Text>
            </TouchableOpacity>
          </View>

          {/* Messages */}
          <ScrollView ref={scrollRef} contentContainerStyle={{padding:16,gap:10}}
            onContentSizeChange={()=>scrollRef.current?.scrollToEnd({animated:true})}>

            {messages.map((m,i)=>(
              <View key={i} style={{flexDirection:'row',
                justifyContent:m.role==='kid'?'flex-end':'flex-start',gap:8}}>
                {m.role==='cellie'&&(
                  <View style={{width:26,height:26,borderRadius:13,backgroundColor:C.green900,
                    borderWidth:1.5,borderColor:C.green500,alignItems:'center',
                    justifyContent:'center',flexShrink:0,marginTop:2}}>
                    <Text style={{fontSize:13}}>🧬</Text>
                  </View>
                )}
                <View style={{maxWidth:'78%',backgroundColor:m.role==='kid'?C.green900:C.card,
                  borderRadius:14,
                  borderTopRightRadius:m.role==='kid'?4:14,
                  borderTopLeftRadius:m.role==='kid'?14:4,
                  borderWidth:1,borderColor:m.role==='kid'?C.green700:C.border,
                  overflow:'hidden'}}>
                  {m.photo&&(
                    <View style={{backgroundColor:C.surface,padding:8,paddingBottom:4}}>
                      <View style={{width:160,height:120,borderRadius:8,backgroundColor:C.border,
                        alignItems:'center',justifyContent:'center',overflow:'hidden'}}>
                        {/* In EAS build: <Image source={{uri:`data:image/jpeg;base64,${m.photo}`}} style={{width:160,height:120}}/> */}
                        <Text style={{fontSize:32}}>📷</Text>
                        <Text style={{color:C.textMuted,fontSize:10,marginTop:4}}>Photo captured</Text>
                      </View>
                    </View>
                  )}
                  <View style={{padding:10}}>
                    <Text style={{color:C.text,fontSize:14,lineHeight:21}}>{m.text}</Text>
                  </View>
                </View>
              </View>
            ))}

            {loading&&(
              <View style={{flexDirection:'row',gap:8,alignItems:'center'}}>
                <View style={{width:26,height:26,borderRadius:13,backgroundColor:C.green900,
                  borderWidth:1.5,borderColor:C.green500,alignItems:'center',justifyContent:'center'}}>
                  <Text style={{fontSize:13}}>🧬</Text>
                </View>
                <View style={{backgroundColor:C.card,borderRadius:14,borderWidth:1,
                  borderColor:C.border,padding:10}}>
                  <Text style={{color:C.green400,fontSize:13}}>Cellie is thinking... 🧬</Text>
                </View>
              </View>
            )}

            {/* Suggested questions */}
            {showSuggestions&&!loading&&(
              <View style={{gap:6,marginTop:4}}>
                <Text style={{color:C.textFaint,fontSize:11,marginBottom:2}}>
                  Try asking:
                </Text>
                <View style={{flexDirection:'row',flexWrap:'wrap',gap:6}}>
                  {CELLIE_SUGGESTIONS.map(q=>(
                    <TouchableOpacity key={q} onPress={()=>ask(q)}
                      style={{backgroundColor:C.surface,borderRadius:14,
                        paddingHorizontal:10,paddingVertical:5,
                        borderWidth:1,borderColor:C.border}}>
                      <Text style={{color:C.textMuted,fontSize:11}}>{q}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </ScrollView>

          {/* Input */}
          <View style={{flexDirection:'row',gap:8,padding:12,
            borderTopWidth:1,borderTopColor:C.border,alignItems:'center'}}>
            {/* Camera button — full-screen Option B flow */}
            <TouchableOpacity onPress={()=>setCameraOpen(true)}
              disabled={loading}
              style={{width:40,height:40,borderRadius:20,
                backgroundColor:C.green900,alignItems:'center',justifyContent:'center',
                borderWidth:1.5,borderColor:C.green700,opacity:loading?0.4:1}}>
              <Text style={{fontSize:18}}>📷</Text>
            </TouchableOpacity>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Ask Cellie anything..."
              placeholderTextColor={C.textFaint}
              style={[ss.input,{flex:1,paddingVertical:10,fontSize:14}]}
              returnKeyType="send"
              onSubmitEditing={()=>ask()}
              editable={!loading}
            />
            <TouchableOpacity onPress={()=>ask()}
              disabled={!input.trim()||loading}
              style={{width:40,height:40,borderRadius:20,
                backgroundColor:input.trim()&&!loading?C.green500:C.surface,
                alignItems:'center',justifyContent:'center',
                borderWidth:1,borderColor:input.trim()&&!loading?C.green400:C.border}}>
              <Text style={{fontSize:18}}>→</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

// ── Kid Setup ──────────────────────────────────────────────────────────────
function KidSetupScreen({kidName,onDone}){
  const[step,setStep]=useState(0);
  const[principal,setPrincipal]=useState(10);
  const[rate,setRate]=useState('medium');
  const[selectedGoal,setSelectedGoal]=useState(null); // full goal object
  const[goalQuery,setGoalQuery]=useState('');
  const[showCustom,setShowCustom]=useState(false);
  const[showVision,setShowVision]=useState(false);
  const[visionLoading,setVisionLoading]=useState(false);
  const[showCatalog,setShowCatalog]=useState(false);
  const[pendingGoal,setPendingGoal]=useState(null);  // parsed from vision, awaiting kid confirmation
  const[editName,setEditName]=useState('');           // editable name on verdict screen
  const[editCost,setEditCost]=useState('');           // editable cost (cells) on verdict screen
  const AMOUNTS=[1,5,10,20,50]; // max 50 = colony cap
  const ROPTS=[{id:'slow',...RATE_STORIES.slow,locked:false},{id:'medium',...RATE_STORIES.medium,locked:false},{id:'fast',...RATE_STORIES.fast,locked:true}];

  // Combined catalog — same as UnifiedShopScreen
  const catalog=[
    ...SHOP_ITEMS.map(i=>({...i,isAmazon:false})),
    ...AMAZON_CATALOG.map(i=>({...i,isAmazon:true,
      cost:Math.round(i.priceUsd*100),color:C.orange})),
  ];
  const filteredCatalog=goalQuery.trim()
    ?catalog.filter(i=>i.name.toLowerCase().includes(goalQuery.toLowerCase())||
        (i.category||'').toLowerCase().includes(goalQuery.toLowerCase()))
    :catalog;

  return(
    <SafeAreaView style={{flex:1,backgroundColor:C.bg}}>
      {/* Custom item modal */}
      <AddCustomItemModal
        visible={showCustom}
        cellToDollar={100}
        onClose={()=>setShowCustom(false)}
        onAdd={(item)=>{setSelectedGoal(item);setShowCustom(false);setStep(1);}}
      />

      <ScrollView contentContainerStyle={{padding:20,gap:16,flexGrow:1}}
        keyboardShouldPersistTaps="handled">
        {/* Progress bar */}
        <View style={{marginBottom:4}}>
          <Text style={[ss.caption,{color:C.textMuted,marginBottom:6}]}>
            STEP {step+1} OF 3 — Hi, {kidName}! 👋
          </Text>
          <View style={{height:4,backgroundColor:C.surface,borderRadius:2}}>
            <View style={{height:4,backgroundColor:C.green500,borderRadius:2,
              width:`${((step+1)/3)*100}%`}}/>
          </View>
        </View>

        {/* ── STEP 0: Cellie Vision — front and centre ────────────────── */}
        {step===0&&(
          <View style={{gap:16}}>

            {/* Cellie speech bubble */}
            <View style={{backgroundColor:C.green900,borderRadius:16,borderWidth:1.5,
              borderColor:C.green700,padding:16,
              flexDirection:'row',alignItems:'flex-start',gap:12}}>
              <Text style={{fontSize:34,lineHeight:40}}>🧬</Text>
              <View style={{flex:1}}>
                <Text style={{color:C.green400,fontWeight:'800',fontSize:13,marginBottom:4,
                  letterSpacing:0.5}}>CELLIE SAYS</Text>
                <Text style={{color:C.text,fontSize:14,lineHeight:22}}>
                  Hey {kidName}! 👋 See something you want? Take a photo and I'll tell you
                  if it's worth saving your cells for!
                </Text>
              </View>
            </View>

            {/* ── VERDICT VIEW: shown after photo is taken ──────────── */}
            {pendingGoal&&(
              <View style={{gap:14}}>
                {/* Cellie's full analysis */}
                <View style={{backgroundColor:C.green900,borderRadius:16,borderWidth:1.5,
                  borderColor:C.green700,padding:16,
                  flexDirection:'row',alignItems:'flex-start',gap:12}}>
                  <Text style={{fontSize:30,lineHeight:36}}>🧬</Text>
                  <View style={{flex:1}}>
                    <Text style={{color:C.green400,fontWeight:'800',fontSize:12,
                      marginBottom:6,letterSpacing:0.5}}>CELLIE SAYS</Text>
                    <Text style={{color:C.text,fontSize:14,lineHeight:22}}>
                      {pendingGoal.visionAnswer}
                    </Text>
                  </View>
                </View>

                {/* Editable goal details */}
                <View style={{backgroundColor:C.card,borderRadius:14,borderWidth:1.5,
                  borderColor:C.border,padding:16,gap:12}}>
                  <Text style={{color:C.textMuted,fontSize:11,fontWeight:'700',
                    letterSpacing:0.5}}>GOAL DETAILS — tap to edit</Text>

                  {/* Emoji + Name row */}
                  <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
                    <Text style={{fontSize:28}}>{pendingGoal.emoji}</Text>
                    <View style={{flex:1,backgroundColor:C.surface,borderRadius:10,
                      borderWidth:1.5,borderColor:C.border,paddingHorizontal:12}}>
                      <TextInput
                        value={editName}
                        onChangeText={setEditName}
                        placeholder="Item name..."
                        placeholderTextColor={C.textFaint}
                        style={{color:C.text,fontSize:15,fontWeight:'700',paddingVertical:10}}
                        maxLength={40}
                      />
                    </View>
                  </View>

                  {/* Cost row */}
                  <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
                    <View style={{flex:1,backgroundColor:C.surface,borderRadius:10,
                      borderWidth:1.5,borderColor:C.border,paddingHorizontal:12,
                      flexDirection:'row',alignItems:'center',gap:6}}>
                      <Text style={{color:C.textMuted,fontSize:14}}>$</Text>
                      <TextInput
                        value={editCost}
                        onChangeText={v=>setEditCost(v.replace(/[^0-9]/g,''))}
                        placeholder="20"
                        placeholderTextColor={C.textFaint}
                        keyboardType="number-pad"
                        style={{color:C.text,fontSize:15,fontWeight:'700',
                          paddingVertical:10,flex:1}}
                        maxLength={4}
                      />
                    </View>
                    <View style={{flex:1,backgroundColor:C.green900+'88',borderRadius:10,
                      padding:10,alignItems:'center'}}>
                      <Text style={{color:C.green400,fontWeight:'800',fontSize:14}}>
                        {editCost||'0'} cells
                      </Text>
                      <Text style={{color:C.textMuted,fontSize:11,marginTop:1}}>
                        to save
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Confirm CTA */}
                <TouchableOpacity
                  onPress={()=>{
                    const finalCost=Math.max(1,parseInt(editCost,10)||pendingGoal.cost);
                    const finalName=editName.trim()||pendingGoal.name;
                    setSelectedGoal({...pendingGoal,name:finalName,cost:finalCost,
                      priceUsd:finalCost,searchQ:finalName});
                    setPendingGoal(null);
                    setEditName('');setEditCost('');
                    setStep(1);
                  }}
                  style={{backgroundColor:C.green500,borderRadius:14,padding:18,
                    alignItems:'center',
                    shadowColor:C.green500,shadowOffset:{width:0,height:3},
                    shadowOpacity:0.35,shadowRadius:8}}>
                  <Text style={{color:C.bg,fontWeight:'800',fontSize:17}}>
                    Set this as my goal! 🎯
                  </Text>
                </TouchableOpacity>

                {/* Retry / dismiss */}
                <View style={{flexDirection:'row',gap:10}}>
                  <TouchableOpacity
                    onPress={()=>{setPendingGoal(null);setEditName('');setEditCost('');setShowVision(true);}}
                    style={{flex:1,backgroundColor:C.surface,borderRadius:12,
                      borderWidth:1.5,borderColor:C.border,padding:14,alignItems:'center'}}>
                    <Text style={{color:C.text,fontWeight:'700',fontSize:14}}>📷 Retake</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={()=>{setPendingGoal(null);setEditName('');setEditCost('');setShowCatalog(true);}}
                    style={{flex:1,backgroundColor:C.surface,borderRadius:12,
                      borderWidth:1.5,borderColor:C.border,padding:14,alignItems:'center'}}>
                    <Text style={{color:C.text,fontWeight:'700',fontSize:14}}>📋 Browse list</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ── INITIAL STATE: hero camera + browse ──────────────── */}
            {!pendingGoal&&(
              <View style={{gap:14}}>
                {/* Selected goal preview (from catalog pick) */}
                {selectedGoal&&(
                  <View style={{backgroundColor:C.green900,borderRadius:14,
                    borderWidth:2,borderColor:C.green500,padding:14,
                    flexDirection:'row',alignItems:'center',gap:12}}>
                    <Text style={{fontSize:32}}>{selectedGoal.emoji}</Text>
                    <View style={{flex:1}}>
                      <Text style={{color:C.green400,fontWeight:'800',fontSize:15}}>
                        {selectedGoal.name}
                      </Text>
                      <Text style={{color:C.textMuted,fontSize:12,marginTop:2}}>
                        {selectedGoal.cost} cells needed
                      </Text>
                    </View>
                    <TouchableOpacity onPress={()=>setSelectedGoal(null)}>
                      <Text style={{color:C.textFaint,fontSize:22}}>×</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Hero take a photo CTA */}
                {!selectedGoal&&(
                  <TouchableOpacity onPress={()=>setShowVision(true)}
                    activeOpacity={0.85}
                    style={{backgroundColor:C.green500,borderRadius:18,padding:28,
                      alignItems:'center',gap:10,
                      shadowColor:C.green500,shadowOffset:{width:0,height:4},
                      shadowOpacity:0.4,shadowRadius:12}}>
                    <Text style={{fontSize:56}}>📷</Text>
                    <Text style={{color:C.bg,fontWeight:'800',fontSize:20,textAlign:'center'}}>
                      Take a photo
                    </Text>
                    <Text style={{color:C.bg+'bb',fontSize:13,textAlign:'center',lineHeight:19}}>
                      Point at anything you want and{'\n'}Cellie will tell you if it's worth saving for!
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Browse toggle */}
                <TouchableOpacity onPress={()=>setShowCatalog(s=>!s)}
                  style={{flexDirection:'row',alignItems:'center',justifyContent:'center',
                    gap:6,paddingVertical:10}}>
                  <Text style={{color:C.textMuted,fontSize:13}}>
                    {showCatalog?'Hide goal list ▲':'Browse goal list instead ▼'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {showCatalog&&(
              <View style={{gap:12}}>
                {/* Search */}
                <View style={{backgroundColor:C.card,borderRadius:10,borderWidth:1.5,
                  borderColor:C.border,flexDirection:'row',alignItems:'center',
                  paddingHorizontal:12,gap:8}}>
                  <Text style={{fontSize:16}}>🔍</Text>
                  <TextInput
                    value={goalQuery}
                    onChangeText={setGoalQuery}
                    placeholder="Search toys, games, sets..."
                    placeholderTextColor={C.textFaint}
                    style={{flex:1,color:C.text,fontSize:14,paddingVertical:10}}
                    autoCapitalize="none"
                  />
                  {!!goalQuery&&(
                    <TouchableOpacity onPress={()=>setGoalQuery('')}>
                      <Text style={{color:C.textMuted,fontSize:18}}>×</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Catalog */}
                {filteredCatalog.map(item=>{
                  const isSelected=selectedGoal?.id===item.id;
                  return(
                    <TouchableOpacity key={item.id}
                      onPress={()=>{setSelectedGoal(item);setShowCatalog(false);}}
                      style={{flexDirection:'row',alignItems:'center',gap:12,
                        backgroundColor:isSelected?C.green900:C.card,
                        borderRadius:12,borderWidth:1.5,
                        borderColor:isSelected?C.green400:C.border,padding:12}}>
                      <View style={{width:44,height:44,borderRadius:22,
                        backgroundColor:item.color+'22',alignItems:'center',justifyContent:'center',
                        borderWidth:1,borderColor:item.color+'44'}}>
                        <Text style={{fontSize:24}}>{item.emoji}</Text>
                      </View>
                      <View style={{flex:1}}>
                        <Text style={{color:C.text,fontWeight:'700',fontSize:14}}>
                          {item.name}
                        </Text>
                        <Text style={{color:C.textMuted,fontSize:12,marginTop:1}}>
                          {item.cost} cells{item.isAmazon?'  🛒':''}
                        </Text>
                      </View>
                      {isSelected&&<Text style={{color:C.green400,fontSize:22}}>⭐</Text>}
                    </TouchableOpacity>
                  );
                })}

                {/* Add custom item */}
                <TouchableOpacity onPress={()=>setShowCustom(true)}
                  style={{flexDirection:'row',alignItems:'center',gap:12,
                    backgroundColor:C.surface,borderRadius:12,
                    borderWidth:1.5,borderColor:C.border,borderStyle:'dashed',padding:14}}>
                  <View style={{width:44,height:44,borderRadius:22,
                    backgroundColor:C.green900,alignItems:'center',justifyContent:'center'}}>
                    <Text style={{fontSize:22}}>➕</Text>
                  </View>
                  <View style={{flex:1}}>
                    <Text style={{color:C.green400,fontWeight:'700',fontSize:14}}>
                      Add your own item
                    </Text>
                    <Text style={{color:C.textMuted,fontSize:12}}>Any toy from Amazon</Text>
                  </View>
                </TouchableOpacity>
              </View>
            )}

            {/* Cellie Vision camera modal */}
            {showVision&&(
              <Modal visible statusBarTranslucent animationType="slide">
                <CameraOverlay
                  onCancel={()=>{setShowVision(false);setVisionLoading(false);}}
                  onCapture={async(base64)=>{
                    setShowVision(false);
                    setVisionLoading(true);
                    try{
                      const url=CELLIE_VISION_URL||'https://wztykysqvnngsnmadrdt.supabase.co/functions/v1/cellie';
                      const resp=await fetch(url,{
                        method:'POST',
                        headers:await cellieHeaders(),
                        body:JSON.stringify({
                          mode:'vision',image:base64,
                          question:'What is this item and is it worth saving for?',
                          kidName:kidName||'friend',kidAge:8,sessionCells:20,
                          goalSetup:true,
                        }),
                      });
                      const data=await resp.json();
                      if(!resp.ok||data.error){
                        console.warn('Cellie Vision error:',data.error||resp.status);
                        // Still show the fallback answer if the API provided one
                      }
                      const answer=data.answer||'';
                      // Parse header line: **Name** emoji · $price
                      // Search entire answer for the structured fields
                      const nameMatch=answer.match(/\*\*([^*\n]+)\*\*/);
                      // Match price: plain number after · , OR any currency symbol ($₹€£¥) + number
                      const priceMatch=answer.match(/·\s*[\$₹€£¥]?\s*(\d+(?:\.\d+)?)/)||answer.match(/[\$₹€£¥]\s*(\d+(?:\.\d+)?)/);
                      const emojiMatch=answer.match(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u);
                      const name=nameMatch
                        ?nameMatch[1].trim()
                        :answer.split('\n')[0].replace(/[\$₹€£¥][\d.]+/g,'').replace(/[*·]/g,'').trim().slice(0,40)||'My Goal';
                      const price=priceMatch?parseFloat(priceMatch[1]):20;
                      const emoji=emojiMatch?emojiMatch[0]:'🎯';
                      const cost=Math.max(1,Math.round(price));
                      const goal={
                        id:'vision_'+Date.now(),
                        name,emoji,cost,priceUsd:price,
                        isAmazon:true,searchQ:name,
                        color:C.blue,fromVision:true,
                        visionAnswer:answer||"I can see you found something interesting! 🧬 Check the details below and edit if needed.",
                      };
                      setPendingGoal(goal);
                      setEditName(name);
                      setEditCost(String(cost));
                    }catch(e){
                      console.warn('Vision goal setup failed:',e);
                      const fallback={id:'vision_'+Date.now(),name:'My Goal',emoji:'🎯',
                        cost:20,priceUsd:20,isAmazon:true,searchQ:'',color:C.blue,fromVision:true,
                        visionAnswer:"I had trouble reading that photo! 🧬 Try better lighting or get closer. You can also type the item name below."};
                      setPendingGoal(fallback);
                      setEditName('My Goal');
                      setEditCost('20');
                    }
                    setVisionLoading(false);
                  }}
                />
              </Modal>
            )}

            {/* Vision loading overlay */}
            {visionLoading&&(
              <View style={{position:'absolute',top:0,left:0,right:0,bottom:0,
                backgroundColor:'rgba(0,0,0,0.75)',
                alignItems:'center',justifyContent:'center',zIndex:99,borderRadius:12}}>
                <Text style={{fontSize:52,marginBottom:12}}>🧬</Text>
                <Text style={{color:C.green400,fontWeight:'800',fontSize:17}}>
                  Cellie is checking it out...
                </Text>
                <Text style={{color:C.textMuted,fontSize:13,marginTop:6}}>
                  This takes a few seconds ✨
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ── STEP 1: Starter cells ────────────────────────────────── */}
        {step===1&&(
          <View style={{gap:14}}>
            <Text style={ss.h1}>Starter cells?</Text>
            <View style={{backgroundColor:C.card,borderRadius:14,borderWidth:1.5,
              borderColor:C.border,padding:20,alignItems:'center'}}>
              <Text style={{fontSize:48,fontWeight:'800',color:C.text}}>${principal}</Text>
              <Text style={{color:C.textMuted,marginTop:4}}>= {Math.min(principal,COLONY_CAP-1)} cells 🌱{principal>=COLONY_CAP?' (colony max)':''}</Text>
            </View>
            <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>
              {AMOUNTS.map(a=>(
                <TouchableOpacity key={a} onPress={()=>setPrincipal(a)}
                  style={{flex:1,minWidth:70,paddingVertical:10,
                    backgroundColor:principal===a?C.green900:C.card,
                    borderRadius:8,borderWidth:1,
                    borderColor:principal===a?C.green400:C.border,
                    alignItems:'center'}}>
                  <Text style={{fontWeight:'700',color:principal===a?C.green400:C.textMuted}}>
                    ${a}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* ── STEP 2: Split speed ──────────────────────────────────── */}
        {step===2&&(
          <View style={{gap:12}}>
            <Text style={ss.h1}>Split speed?</Text>
            <Text style={{color:C.textMuted,fontSize:13,lineHeight:20}}>
              How fast do your cells make babies each round.{' '}
              <Text style={{color:C.green400,fontWeight:'700'}}>
                Faster = more new cells, but less time to decide what to spend!
              </Text>
            </Text>
            {ROPTS.map(o=>(
              <TouchableOpacity key={o.id} onPress={()=>!o.locked&&setRate(o.id)}
                style={{backgroundColor:rate===o.id?C.green900:C.card,
                  borderRadius:12,borderWidth:1.5,
                  borderColor:rate===o.id?C.green400:C.border,
                  padding:14,opacity:o.locked?0.5:1}}>
                <View style={{flexDirection:'row',alignItems:'center',marginBottom:4}}>
                  <Text style={{fontSize:22,marginRight:8}}>{o.emoji}</Text>
                  <Text style={{fontSize:16,fontWeight:'800',
                    color:o.locked?C.textFaint:C.text}}>
                    {o.speed} {o.locked?'🔒':''}
                  </Text>
                  {rate===o.id&&!o.locked&&(
                    <Text style={{color:C.green400,fontSize:18,marginLeft:'auto'}}>✓</Text>
                  )}
                </View>
                <Text style={{color:C.green300,fontSize:12}}>{o.desc}</Text>
                <Text style={{color:C.textMuted,fontSize:11,fontStyle:'italic'}}>
                  {o.analogy}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={{flexDirection:'row',gap:12,padding:20,paddingTop:0}}>
        {step>0&&(
          <Btn label="← Back" onPress={()=>setStep(s=>s-1)} style={{flex:1}}/>
        )}
        <View style={{flex:2}}>
          {step<2
            ? <Btn label="Next →"
                onPress={()=>setStep(s=>s+1)}
                primary
                style={{opacity:(step===0&&!selectedGoal)||pendingGoal?0.4:1}}
              />
            : <Btn label="🧬 Grow!"
                onPress={()=>onDone(kidName+"'s Colony",principal,rate,
                  selectedGoal?.id||null, selectedGoal)}
                primary
              />
          }
        </View>
      </View>
    </SafeAreaView>
  );
}

// ── Kid Game Screen ────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════
// ⏸ PAUSE MODAL — slide-up sheet, replaces status bar icon buttons
// ══════════════════════════════════════════════════════════════════════════
function PauseModal({visible,onResume,onShop,onMuseum,onCellie,onQuit}){
  const slideY  =useRef(new Animated.Value(400)).current;
  const bgOpacity=useRef(new Animated.Value(0)).current;

  useEffect(()=>{ // eslint-disable-line react-hooks/exhaustive-deps
    if(visible){
      Animated.parallel([
        Animated.spring(slideY,   {toValue:0,  friction:8,tension:80,useNativeDriver:true}),
        Animated.timing(bgOpacity,{toValue:1,  duration:200,          useNativeDriver:true}),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideY,   {toValue:400,duration:220,useNativeDriver:true}),
        Animated.timing(bgOpacity,{toValue:0,  duration:180,useNativeDriver:true}),
      ]).start();
    }
  },[visible]);// eslint-disable-line react-hooks/exhaustive-deps

  const ITEMS=[
    {emoji:'▶',  label:'Resume game',    color:C.green400, onPress:onResume,   primary:true},
    {emoji:'🛍️', label:'Shop',           color:C.text,     onPress:onShop},
    {emoji:'🏛️', label:'Colony Museum',  color:C.text,     onPress:onMuseum},
    {emoji:'🧬', label:'Ask Cellie',     color:C.green400, onPress:onCellie},
    {emoji:'⏹',  label:'End session',   color:C.red,      onPress:onQuit},
  ];

  if(!visible)return null;
  return(
    <View style={{position:'absolute',inset:0,zIndex:100}}>
      {/* Dimmed backdrop — tap to resume */}
      <Animated.View style={{position:'absolute',inset:0,backgroundColor:'rgba(0,0,0,0.6)',opacity:bgOpacity}}>
        <TouchableOpacity style={{flex:1}} onPress={onResume} activeOpacity={1}/>
      </Animated.View>

      {/* Sheet */}
      <Animated.View style={{position:'absolute',bottom:0,left:0,right:0,
        transform:[{translateY:slideY}],
        backgroundColor:C.card,borderTopLeftRadius:22,borderTopRightRadius:22,
        borderWidth:1,borderColor:C.border,paddingBottom:32}}>

        {/* Handle */}
        <View style={{alignItems:'center',paddingTop:12,paddingBottom:8}}>
          <View style={{width:40,height:4,borderRadius:2,backgroundColor:C.border}}/>
        </View>

        {ITEMS.map((item,i)=>(
          <TouchableOpacity key={i} onPress={item.onPress}
            style={{flexDirection:'row',alignItems:'center',gap:16,
              paddingHorizontal:24,paddingVertical:16,
              borderTopWidth:i===0?0:0.5,borderTopColor:C.border,
              backgroundColor:item.primary?C.green900:'transparent'}}>
            <Text style={{fontSize:22,width:28,textAlign:'center'}}>{item.emoji}</Text>
            <Text style={{color:item.color,fontSize:17,
              fontWeight:item.primary?'800':'500'}}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </Animated.View>
    </View>
  );
}

function KidGameScreen({sessionRemaining,sessionTotal,cellieOpen,setCellieOpen,cellieBubble,cellieBubbleAnim,cellieBubblePulse,setCellieBubble,onResults,onLevelUp,onShop,onMuseum,onQuit,onPinGate}){
  const{game,dispatch}=useGame();
  const{state:appState}=useApp();
  const[dealExpiredMsg,setDealExpiredMsg]=useState(null);
  const[ceremonyItem,setCeremonyItem]=useState(null);
  const[prevResist,setPrevResist]=useState(0);
  const[goalJustMet,setGoalJustMet]=useState(false);
  const[goalMetDismissed,setGoalMetDismissed]=useState(false);
  const[paused,setPaused]=useState(false);
  const[showSaveConfirm,setShowSaveConfirm]=useState(false);
  const[showDealConfirm,setShowDealConfirm]=useState(false);
  const[splitCelebration,setSplitCelebration]=useState(null); // {gained, bonusCells, nextPhase}
  const[starToast,setStarToast]=useState(null);  // {stars:N, message:str}
  const[cheerEnergy,setCheerEnergy]=useState(0); // 0-100, fills as kid taps
  const[cheerDone,setCheerDone]=useState(false);  // true once bonus earned this round
  const[cellMoods,setCellMoods]=useState({});     // {cellId: emoji}
  const prevStarsRef=useRef(0);
  const starBounce =useRef(new Animated.Value(1)).current;
  const starToastOp=useRef(new Animated.Value(0)).current;
  const starToastY =useRef(new Animated.Value(8)).current;
  // cellieOpen/setCellieOpen are lifted to KidGameFlow so the session timer
  // can see them and delay expiry while Cellie is open

  const phase       =game?.phase;
  const cellsRef    =useRef(game?.cells);
  useEffect(()=>{cellsRef.current=game?.cells;},[game?.cells]);

  const justFilled=prevResist<RESIST_MAX&&(game?.resistMeter||0)===0&&(game?.resistBonusThisGame||0)>0;
  useEffect(()=>{if(game?.resistMeter!==undefined)setPrevResist(game.resistMeter);},[game?.resistMeter]);// eslint-disable-line react-hooks/exhaustive-deps

  // ── Star gain detection — bounce + toast when a new star fills ─────────
  useEffect(()=>{ // eslint-disable-line react-hooks/exhaustive-deps
    const STAR_MSGS=["Great start! 🌱","Keep saving! ✨","Halfway there! 💪","One more! 🔥","ALL STARS! +3 bonus cells! 🎉"];
    const newStars=Math.floor((game?.resistMeter||0)/(RESIST_MAX/5));
    if(newStars>prevStarsRef.current&&newStars>0){
      prevStarsRef.current=newStars;
      setStarToast({stars:newStars,message:STAR_MSGS[newStars-1]});
      // Bounce the new star
      starBounce.setValue(1);
      Animated.sequence([
        Animated.spring(starBounce,{toValue:1.7,friction:2,tension:200,useNativeDriver:true}),
        Animated.spring(starBounce,{toValue:1,friction:4,useNativeDriver:true}),
      ]).start();
      // Toast slides up then fades
      starToastOp.setValue(0);starToastY.setValue(-10);
      Animated.parallel([
        Animated.timing(starToastOp,{toValue:1,duration:200,useNativeDriver:true}),
        Animated.timing(starToastY, {toValue:0,duration:200,useNativeDriver:true}),
      ]).start(()=>{
        setTimeout(()=>{
          Animated.timing(starToastOp,{toValue:0,duration:300,useNativeDriver:true}).start(()=>setStarToast(null));
        },1600);
      });
    } else if(newStars<prevStarsRef.current){
      prevStarsRef.current=newStars; // resistance meter dropped (spent cells)
    }
  },[game?.resistMeter]);// eslint-disable-line react-hooks/exhaustive-deps
  useEffect(()=>{if(game?.flashDealExpiredMsg)setDealExpiredMsg(game.flashDealExpiredMsg);},[game?.flashDealExpiredMsg]);

  useEffect(()=>{
    // Pause round timer when Cellie is open — kid needs time to read
    if(!game||phase!=='active'||cellieOpen)return;
    const t=setInterval(()=>dispatch({type:'TICK'}),1000);
    return()=>clearInterval(t);
  },[phase,dispatch,cellieOpen]);// eslint-disable-line react-hooks/exhaustive-deps

  useEffect(()=>{ // eslint-disable-line react-hooks/exhaustive-deps
    const interval=setInterval(()=>{
      const now=Date.now();
      cellsRef.current?.forEach(c=>{if(c.spendState==='pending'&&c.pendingAt&&(now-c.pendingAt)>3000)dispatch({type:'HEAL_PENDING',cellId:c.id});});
    },300);
    return()=>clearInterval(interval);
  },[]);// eslint-disable-line react-hooks/exhaustive-deps

  // Reset cheer bar each new active round
  useEffect(()=>{if(phase==='active'){setCheerEnergy(0);setCheerDone(false);}},[phase]);// eslint-disable-line react-hooks/exhaustive-deps

  // Cell mood bubbles — every 1.8s pick a random live cell and give it a personality
  const MOOD_POOL=['🌱','⚡','✨','💪','🔥','💫','😄','🎵','🌟','🤩'];
  useEffect(()=>{
    if(phase!=='active')return;
    const interval=setInterval(()=>{
      if(!game?.cells)return;
      const live=game.cells.filter(c=>!c.burst);
      if(live.length===0)return;
      const pick=live[Math.floor(Math.random()*live.length)];
      const emoji=MOOD_POOL[Math.floor(Math.random()*MOOD_POOL.length)];
      setCellMoods(m=>({...m,[pick.id]:emoji}));
      setTimeout(()=>setCellMoods(m=>{const n={...m};delete n[pick.id];return n;}),1700);
    },1800);
    return()=>clearInterval(interval);
  },[phase]);// eslint-disable-line react-hooks/exhaustive-deps

  useEffect(()=>{if(phase==='splitting'){dispatch({type:'MARK_SPLITTING'});setTimeout(()=>dispatch({type:'RESOLVE'}),650);}},[phase,dispatch]);
  useEffect(()=>{
    if(phase==='results'||phase==='levelup'||phase==='graduating'||phase==='extinct'){
      const latest=game?.history?.[game.history.length-1];
      const gained=(latest?.gained||0)+(latest?.bonusCells||0);
      if(gained>0){
        // Show celebration overlay first, then route after it auto-dismisses
        setSplitCelebration({
          gained:latest?.gained||0,
          bonusCells:latest?.bonusCells||0,
          nextPhase:phase,
        });
      } else {
        // No new cells — skip celebration, route immediately
        if(phase==='results')   onResults();
        if(phase==='levelup')   onLevelUp();
        if(phase==='graduating')onLevelUp();
        if(phase==='extinct')   onLevelUp();
      }
    }
  },[phase]);// eslint-disable-line react-hooks/exhaustive-deps


  // Compute early so handleCheer can reference them without TDZ issues
  const pendingCountEarly  =(game?.cells||[]).filter(c=>c.spendState==='pending').length;
  const confirmedCountEarly=(game?.cells||[]).filter(c=>c.spendState==='confirmed').length;

  const handleCheer=useCallback(()=>{
    if(cheerDone||phase!=='active'||confirmedCountEarly>0||pendingCountEarly>0)return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCheerEnergy(e=>{
      const next=Math.min(100,e+7);
      if(next>=100&&!cheerDone){
        setCheerDone(true);
        dispatch({type:'CHEER_BONUS'});
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      return next;
    });
  },[cheerDone,phase,confirmedCountEarly,pendingCountEarly,dispatch]);// eslint-disable-line react-hooks/exhaustive-deps

  const handleBuyDeal=()=>{
    // Show "are you sure?" before purchasing — teaches impulse control
    setShowDealConfirm(true);
  };
  const handleConfirmDeal=()=>{
    setShowDealConfirm(false);
    if(!game?.flashDeal)return;
    const item=SHOP_ITEMS.find(i=>i.id===game.flashDeal.itemId);
    if(!item)return;
    dispatch({type:'BUY_FLASH_DEAL'});
    setCeremonyItem({...item,isDeal:true,originalCost:game.flashDeal.originalCost,dealCost:game.flashDeal.dealCost});
  };

  if(!game)return null;
  const pendingCount  =game.cells.filter(c=>c.spendState==='pending').length;
  const confirmedCount=game.cells.filter(c=>c.spendState==='confirmed').length;
  const count         =game.cells.filter(c=>!c.burst).length;
  const pct=game.timer/TIMER_MAX;
  const tc =game.timer<=3?C.red:game.timer<=6?C.amber:C.green500;
  const rs =RATE_STORIES[game.rate];
  // Active goal — first item in goals array with status 'saving'
  const wishItem=(game.goals||[]).find(g=>g.status==='saving')||null;
  // Total cells ever earned = principal + all splits across every colony
  // This carries through graduation so progress never resets
  const totalCellsEarned=(game.principal||0)+(game.lifetimeCellsGained||0);
  const wishProg=wishItem?Math.min(totalCellsEarned/wishItem.cost,1):0;
  // "Ready" differs by goal type:
  // Amazon goals → cumulative is enough (share sheet, no cells removed)
  // Built-in goals → need live cells to spend right now
  const wishReady=wishItem
    ?(wishItem.isAmazon
      ? totalCellsEarned>=wishItem.cost
      : count>=wishItem.cost)
    :false;

  // ── Detect goal just met (fires once when threshold first crossed) ─────
  const prevWishReadyRef=useRef(false);
  useEffect(()=>{
    if(wishReady&&!prevWishReadyRef.current&&!goalMetDismissed){
      setGoalJustMet(true);
    }
    prevWishReadyRef.current=wishReady;
  },[wishReady,goalMetDismissed]);// eslint-disable-line react-hooks/exhaustive-deps

  // Also check immediately on mount — catches the "goal already affordable" case
  useEffect(()=>{
    if(wishItem&&wishReady&&!goalMetDismissed){
      setGoalJustMet(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  const nearGrad=count>=COLONY_WARN;
  const colonyNum=game.colonyNumber||1;
  const cHue=colonyAccent(game.colonyNumber||1);
  const cHex=colonyHex(game.colonyNumber||1);
  const instrText=confirmedCount>0?`😬 ${confirmedCount} confirmed · Tap again to undo!`:pendingCount>0?`⚡ Tap again to confirm · wait 3s to change your mind!`:'✨ Tap a cell to think about spending · leave them to multiply! 🧬';
  const instrColor=confirmedCount>0?C.red:pendingCount>0?C.amber:`hsl(${cHue},75%,30%)`;
  const instrBg   =confirmedCount>0?C.red+'11':pendingCount>0?C.amber+'11':`hsla(${cHue},65%,94%,0.9)`;
  const instrBorder=confirmedCount>0?C.red+'44':pendingCount>0?C.amber+'33':`hsla(${cHue},55%,65%,0.5)`;

  // ── Context slot priority ─────────────────────────────────────────────
  // Only ONE of these renders at a time — highest priority wins
  const showFlashDeal  = !!(game.flashDeal && phase==='active');
  const showGrad       = nearGrad && !showFlashDeal;
  const showUrgent     = sessionRemaining<=90 && sessionRemaining>0 && !showFlashDeal && !showGrad;
  const showInstruction= !showFlashDeal && !showGrad && !showUrgent;

  // ── 5 binary stars ─────────────────────────────────────────────────────
  const filledStars = Math.floor((game.resistMeter||0) / (RESIST_MAX/5));

  // ── Sorted cell IDs for stepper (outermost → center, stable per round) ──
  const sortedCellIds = useMemo(()=>{
    return game.cells
      .filter(c=>!c.burst)
      .map(c=>({id:c.id, dist:Math.sqrt((c.x-0.5)**2+(c.y-0.5)**2)}))
      .sort((a,b)=>b.dist-a.dist)
      .map(c=>c.id);
  },[game.round]);// eslint-disable-line react-hooks/exhaustive-deps

  // Stepper handlers — outer-to-center selection
  const handleStepperPlus=useCallback(()=>{
    const nextId=sortedCellIds.find(id=>{
      const c=game.cells.find(cell=>cell.id===id);
      return c&&!c.burst&&c.spendState==='none';
    });
    if(nextId){dispatch({type:'CONFIRM_CELL',id:nextId});dispatch({type:'CELL_INTERACTED'});}
  },[sortedCellIds,game.cells,dispatch]);// eslint-disable-line react-hooks/exhaustive-deps

  const handleStepperMinus=useCallback(()=>{
    // Unmark the innermost confirmed/pending cell (reverse of selection order)
    const lastId=[...sortedCellIds].reverse().find(id=>{
      const c=game.cells.find(cell=>cell.id===id);
      return c&&(c.spendState==='confirmed'||c.spendState==='pending');
    });
    if(lastId){dispatch({type:'UNCONFIRM_CELL',id:lastId});dispatch({type:'CELL_INTERACTED'});}
  },[sortedCellIds,game.cells,dispatch]);// eslint-disable-line react-hooks/exhaustive-deps

  // Total cells currently marked for spending (confirmed + pending)
  const totalSpending = confirmedCount + pendingCount;
  const canStepMinus  = totalSpending > 0;
  const canStepPlus   = game.cells.filter(c=>!c.burst&&c.spendState==='none').length > 0;

  // One-click: select cells for built-in goals, or fire share for Amazon goals
  const canBuyWish = wishItem && wishReady && phase === 'active';

  // ── Goal Already Met notification component ───────────────────────────
  const GoalMetBanner = goalJustMet && wishItem && !goalMetDismissed ? (
    <View style={{
      position:'absolute', top:0, left:0, right:0, bottom:0,
      backgroundColor:'rgba(0,0,0,0.75)',
      alignItems:'center', justifyContent:'center',
      zIndex:50, padding:24,
    }}>
      <View style={{
        backgroundColor:C.card, borderRadius:20,
        borderWidth:2, borderColor:C.green500,
        padding:24, width:'100%', gap:16, alignItems:'center',
      }}>
        <Text style={{fontSize:56}}>{wishItem.emoji||'🎯'}</Text>
        <Text style={{color:C.greenL, fontWeight:'800', fontSize:22,
          textAlign:'center'}}>
          You can already afford it! 🎉
        </Text>
        <Text style={{color:C.text, fontSize:15, textAlign:'center',
          lineHeight:22}}>
          {'Your starting cells are enough to get the '}
          <Text style={{fontWeight:'800', color:C.green400}}>{wishItem.name}</Text>{'!'}
        </Text>
        <View style={{backgroundColor:C.greenD, borderRadius:12,
          borderWidth:1, borderColor:C.green700,
          padding:12, width:'100%', alignItems:'center', gap:4}}>
          <Text style={{color:C.muted, fontSize:12}}>But here's the thing:</Text>
          <Text style={{color:C.white, fontSize:13, textAlign:'center', lineHeight:19}}>
            {'If you keep saving instead of spending, your cells will keep splitting and multiplying! 🧬'}
            <Text style={{color:C.amber, fontWeight:'700'}}>
              Could you save for something even bigger?
            </Text>
          </Text>
        </View>
        <View style={{flexDirection:'row', gap:12, width:'100%'}}>
          <TouchableOpacity
            onPress={()=>{setGoalJustMet(false);setGoalMetDismissed(true);handleBuyWishItem();}}
            style={{flex:1, backgroundColor:C.green500, borderRadius:12,
              padding:14, alignItems:'center'}}>
            <Text style={{color:C.bg, fontWeight:'800', fontSize:14}}>
              {wishItem.isAmazon?'Buy it now 🛒':'Spend cells 💸'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={()=>{setGoalJustMet(false);setGoalMetDismissed(true);}}
            style={{flex:1, backgroundColor:C.surface, borderRadius:12,
              borderWidth:1, borderColor:C.border,
              padding:14, alignItems:'center'}}>
            <Text style={{color:C.greenL, fontWeight:'800', fontSize:14}}>
              Keep saving! 🌱
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  ) : null;
  const handleBuyWishItem = useCallback(()=>{
    if(!wishItem||!canBuyWish)return;
    if(wishItem.isAmazon){
      // Amazon goal — requires parental PIN before opening Amazon
      const tag=appState.parent?.settings?.affiliateTag||'moneycells-20';
      const url=`https://www.amazon.com/s?k=${encodeURIComponent(wishItem.searchQ||wishItem.name)}&tag=${tag}&linkCode=ur2`;
      onPinGate&&onPinGate({url, itemName:wishItem.name});
      return;
    }
    // Built-in: select cells outer→center
    const needed = Math.max(0, wishItem.cost - totalSpending);
    const available = sortedCellIds.filter(id=>{
      const c = game.cells.find(cell=>cell.id===id);
      return c && !c.burst && c.spendState==='none';
    });
    available.slice(0, needed).forEach(id=>dispatch({type:'CONFIRM_CELL', id}));
    dispatch({type:'CELL_INTERACTED'});
  },[wishItem, canBuyWish, totalSpending, sortedCellIds, game.cells, dispatch, appState]);// eslint-disable-line react-hooks/exhaustive-deps

  const kidName = appState.parent?.kids?.find(k=>k.id===appState.activeKidId)?.name||'friend';

  return(
    <SafeAreaView style={{flex:1,backgroundColor:C.bg}}>
      {ceremonyItem&&(<Modal transparent animationType="none" statusBarTranslucent><BuyCeremony item={ceremonyItem} isDeal={!!ceremonyItem.isDeal} onComplete={()=>setCeremonyItem(null)}/></Modal>)}

      {/* Cellie "Ask me something!" animated bubble */}
      {cellieBubble&&(
        <Animated.View style={{
          position:'absolute', bottom:88, right:14,
          opacity:cellieBubbleAnim,
          transform:[{scale:cellieBubblePulse},{translateY:cellieBubbleAnim.interpolate({inputRange:[0,1],outputRange:[20,0]})}],
          zIndex:30,
        }}>
          <TouchableOpacity
            onPress={()=>{setCellieOpen(true);setCellieBubble(false);}}
            style={{flexDirection:'row',alignItems:'center',gap:8,
              backgroundColor:C.blue,borderRadius:20,
              paddingHorizontal:14,paddingVertical:10,
              shadowColor:'#000',shadowOffset:{width:0,height:2},shadowOpacity:0.3,shadowRadius:6,
            }}>
            <Text style={{fontSize:18}}>🧬</Text>
            <Text style={{color:'#fff',fontWeight:'800',fontSize:13}}>
              Ask me something! ✨
            </Text>
          </TouchableOpacity>
          {/* Speech bubble tail */}
          <View style={{position:'absolute',bottom:-7,right:20,
            width:0,height:0,
            borderLeftWidth:8,borderRightWidth:8,borderTopWidth:8,
            borderLeftColor:'transparent',borderRightColor:'transparent',
            borderTopColor:C.blue,
          }}/>
        </Animated.View>
      )}

      {/* ── Pause modal ──────────────────────────────────────────────── */}
      <PauseModal
        visible={paused}
        onResume={()=>setPaused(false)}
        onShop={()=>{setPaused(false);onShop();}}
        onMuseum={()=>{setPaused(false);onMuseum();}}
        onCellie={()=>{setPaused(false);setCellieOpen(true);}}
        onQuit={()=>{setPaused(false);onQuit();}}
      />

      {/* ── Goal already met notification */}
      {GoalMetBanner}

      {/* ── Cellie modal ─────────────────────────────────────────────── */}
      <CellieModal
        visible={cellieOpen}
        onClose={()=>setCellieOpen(false)}
        kidName={kidName}
        kidAge={8}
        sessionCells={count}
        round={game?.round||1}
        streak={game?.streak||0}
        resistMeter={Math.round((game?.resistMeter||0)/RESIST_MAX*100)}
        wishItem={wishItem}
      />

      {/* ── ZONE 1: Status bar — count + streak + pause only ─────────── */}
      <View style={{flexDirection:'row',backgroundColor:C.surface,
        borderBottomWidth:1,borderBottomColor:C.border,
        paddingHorizontal:16,paddingVertical:10,alignItems:'center'}}>
        <Text style={{color:C.text,fontWeight:'800',fontSize:16,letterSpacing:-0.5}}>
          🧬 {count}
          <Text style={{color:C.textMuted,fontWeight:'400',fontSize:12}}>/{COLONY_CAP}</Text>
        </Text>
        <View style={{flex:1}}/>
        {/* 5 gem stars — each a different colour, glows when filled */}
        <View style={{flexDirection:'row',gap:4,alignItems:'center',marginRight:10}}>
          {[0,1,2,3,4].map(i=>{
            const filled=i<filledStars;
            const gemColor=GEM_COLORS[i];
            const isNewStar=i===filledStars-1&&!!starToast;
            const gem=(
              <View key={i} style={{
                width:filled?20:16,height:filled?20:16,
                borderRadius:4,
                backgroundColor:filled?gemColor:'transparent',
                borderWidth:1.5,borderColor:filled?gemColor:C.textFaint,
                alignItems:'center',justifyContent:'center',
                shadowColor:filled?gemColor:'transparent',
                shadowOffset:{width:0,height:0},
                shadowOpacity:filled?0.9:0,shadowRadius:6,elevation:filled?4:0,
              }}/>
            );
            return isNewStar?(
              <Animated.View key={i} style={{transform:[{scale:starBounce}]}}>
                <View style={{
                  width:22,height:22,borderRadius:5,
                  backgroundColor:gemColor,
                  borderWidth:2,borderColor:'#fff',
                  shadowColor:gemColor,shadowOffset:{width:0,height:0},
                  shadowOpacity:1,shadowRadius:8,elevation:6,
                }}/>
              </Animated.View>
            ):gem;
          })}
        </View>
        {/* Star gain toast — slides up above status bar */}
{/* Star toast — positioned BELOW status bar to avoid Dynamic Island */}
        {game.streak>0&&(
          <Text style={{color:C.amber,fontWeight:'700',fontSize:14,marginRight:10}}>
            🔥 {game.streak}
          </Text>
        )}
        <TouchableOpacity onPress={()=>setPaused(true)}
          style={{backgroundColor:C.card,borderRadius:8,paddingHorizontal:12,
            paddingVertical:6,borderWidth:1,borderColor:C.border}}>
          <Text style={{color:C.textMuted,fontSize:15}}>⏸</Text>
        </TouchableOpacity>
      </View>

      {/* ── ZONE 2: Dish ─────────────────────────────────────────────── */}
      <View style={{flex:1,alignItems:'center',justifyContent:'center'}}>
        <View style={{position:'relative'}}>
          <DishArea
            cells={game.cells}
            onTap={id=>{
              const cell=game.cells.find(c=>c.id===id);
              if(!cell||cell.burst)return;
              // Haptic intensity matches commitment level
              if(cell.spendState==='none'){
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              } else if(cell.spendState==='pending'){
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              } else {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); // undo
              }
              dispatch({type:'TOGGLE',id});
            }}
            interactive={phase==='active'}
            phase={phase}
            sessionRemaining={sessionRemaining}
            sessionTotal={sessionTotal}
            nearGrad={nearGrad}
            roundTimer={game.timer}
            roundPct={pct}
            roundColor={tc}
            rateStory={rs}
            colonyColor={cHex}
            cellMoods={cellMoods}
          />

        </View>

        {/* Spending counter — between dish and stepper, always visible when cells selected */}
        {totalSpending>0&&(
          <View style={{alignItems:'center',marginTop:6,marginBottom:2}}>
            <View style={{backgroundColor:C.amber+'33',borderRadius:14,
              paddingHorizontal:14,paddingVertical:6,
              borderWidth:1.5,borderColor:C.amber+'88',
              flexDirection:'row',alignItems:'center',gap:7}}>
              <Text style={{color:C.amber,fontWeight:'700',fontSize:13}}>
                Spending {totalSpending}
              </Text>
              <Text style={{color:C.textMuted,fontSize:12}}>·</Text>
              {wishItem?(
                <>
                  <Text style={{fontSize:20}}>{wishItem.emoji}</Text>
                  <Text style={{color:C.amber,fontSize:13,fontWeight:'700'}}>
                    {totalSpending}/{wishItem.cost}
                  </Text>
                </>
              ):(
                <Text style={{color:C.amber,fontSize:13}}>${totalSpending}</Text>
              )}
            </View>
          </View>
        )}

        {/* One-click buy wish item — appears when you can afford it */}
        {canBuyWish&&(
          <TouchableOpacity onPress={handleBuyWishItem}
            style={{alignSelf:'center',marginTop:6,marginBottom:2,
              backgroundColor:wishItem.color+'22',borderRadius:14,
              borderWidth:2,borderColor:wishItem.color+'88',
              paddingHorizontal:18,paddingVertical:9,
              flexDirection:'row',alignItems:'center',gap:8}}>
            <GoalImage goal={wishItem} size={40} borderRadius={10}/>
            <View>
              <Text style={{color:wishItem.color,fontWeight:'800',fontSize:14}}>
                Buy {wishItem.name}!
              </Text>
              <Text style={{color:C.textMuted,fontSize:11}}>
                Select {wishItem.cost - totalSpending} more cells
              </Text>
            </View>
            <Text style={{color:wishItem.color,fontWeight:'800',fontSize:18}}>→</Text>
          </TouchableOpacity>
        )}

        {/* Stepper — centred below dish */}
        <View style={{alignItems:'center',marginTop:4}}>
          <View style={{flexDirection:'row',alignItems:'center',gap:0,
            backgroundColor:C.surface,borderRadius:12,
            borderWidth:1,borderColor:C.border,overflow:'hidden'}}>
            <TouchableOpacity onPress={handleStepperMinus} disabled={!canStepMinus}
              style={{paddingHorizontal:18,paddingVertical:10,
                borderRightWidth:1,borderRightColor:C.border,
                opacity:canStepMinus?1:0.3}}>
              <Text style={{color:C.red,fontWeight:'800',fontSize:20,lineHeight:22}}>−</Text>
            </TouchableOpacity>
            <View style={{paddingHorizontal:16,minWidth:72,alignItems:'center'}}>
              <Text style={{color:C.textMuted,fontSize:11,lineHeight:13}}>spend</Text>
              <Text style={{color:C.text,fontWeight:'800',fontSize:18,lineHeight:21}}>
                {totalSpending}
              </Text>
            </View>
            <TouchableOpacity onPress={handleStepperPlus} disabled={!canStepPlus}
              style={{paddingHorizontal:18,paddingVertical:10,
                borderLeftWidth:1,borderLeftColor:C.border,
                opacity:canStepPlus?1:0.3}}>
              <Text style={{color:C.green400,fontWeight:'800',fontSize:20,lineHeight:22}}>+</Text>
            </TouchableOpacity>
          </View>
          {filledStars===5&&(
            <Text style={{color:C.green400,fontWeight:'700',fontSize:11,marginTop:4}}>
              +{RESIST_BONUS_CELLS} bonus cells! ⭐
            </Text>
          )}
        </View>
      </View>

      {/* ── GOAL PROGRESS METER — always visible when a goal is set ──── */}
      {wishItem&&(
        <View style={{marginHorizontal:16,marginBottom:6,marginTop:2}}>
          <View style={{
            backgroundColor:wishReady?C.green900:wishItem.color+'15',
            borderRadius:12,borderWidth:1.5,
            borderColor:wishReady?C.green500+'88':wishItem.color+'44',
            paddingHorizontal:12,paddingVertical:9,gap:6,
          }}>
            {/* Row: emoji · name · cells count */}
            <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
              <Text style={{fontSize:22}}>{wishItem.emoji}</Text>
              <Text style={{color:C.text,fontWeight:'700',fontSize:12,flex:1}}
                numberOfLines={1}>{wishItem.name}</Text>
              {wishReady?(
                <Text style={{color:C.green400,fontWeight:'800',fontSize:12}}>
                  ✅ Goal reached!
                </Text>
              ):(
                <View style={{alignItems:'flex-end'}}>
                  <Text style={{color:wishItem.color,fontWeight:'800',fontSize:13}}>
                    {totalCellsEarned}
                    <Text style={{color:C.textMuted,fontWeight:'400',fontSize:11}}>
                      {' '}/ {wishItem.cost} 🧬
                    </Text>
                  </Text>
                  <Text style={{color:C.textMuted,fontSize:10}}>
                    {wishItem.cost - totalCellsEarned} cells to go
                  </Text>
                </View>
              )}
            </View>
            {/* Progress bar */}
            <View style={{height:8,backgroundColor:C.surface,borderRadius:4,overflow:'hidden'}}>
              <View style={{
                height:8,borderRadius:4,
                backgroundColor:wishReady?C.green500:wishItem.color,
                width:`${Math.round(wishProg*100)}%`,
              }}/>
            </View>
          </View>
        </View>
      )}

      {/* ── ZONE 3: Context slot — ONE thing at a time ───────────────── */}
      <View style={{marginHorizontal:16,marginBottom:8,minHeight:52}}>
        {showFlashDeal&&(
          <FlashDealBanner
            deal={game.flashDeal}
            cellCount={count}
            onBuy={handleBuyDeal}
            onDismiss={()=>dispatch({type:'DISMISS_FLASH_DEAL'})}
          />
        )}
        {showGrad&&(
          <ColonyProgressBanner count={count} colonyNum={colonyNum} onMuseum={onMuseum}/>
        )}
        {showUrgent&&(
          <View style={{backgroundColor:C.red+'11',borderRadius:10,borderWidth:1.5,
            borderColor:C.red+'44',padding:10,alignItems:'center'}}>
            <Text style={{color:C.red,fontWeight:'800',fontSize:15}}>
              ⚠️ {formatTime(sessionRemaining)} left!
            </Text>
          </View>
        )}
        {showInstruction&&confirmedCount===0&&pendingCount===0&&phase==='active'&&(
          <View style={{backgroundColor:instrBg,borderRadius:10,borderWidth:1,
            borderColor:instrBorder,padding:10,gap:8}}>
            <Text style={{color:instrColor,fontSize:12,textAlign:'center'}}>{instrText}</Text>
            {/* Cheer bar — tap rapidly to power up cells and earn +1 bonus cell */}
            <TouchableOpacity onPress={handleCheer} activeOpacity={0.85}
              style={{height:38,backgroundColor:C.surface,borderRadius:8,overflow:'hidden',
                borderWidth:1.5,borderColor:cheerDone?C.green400:`hsl(${cHue},60%,70%)`}}>
              <View style={{position:'absolute',left:0,top:0,bottom:0,
                width:`${cheerEnergy}%`,
                backgroundColor:cheerDone?C.green400:`hsl(${cHue},72%,55%)`,
                borderRadius:8}}/>
              <View style={{position:'absolute',top:0,right:0,bottom:0,left:0,flexDirection:'row',
                alignItems:'center',justifyContent:'center',gap:6}}>
                <Text style={{fontSize:16}}>{cheerDone?'🎉':'⚡'}</Text>
                <Text style={{color:cheerDone?C.green400:instrColor,fontWeight:'800',fontSize:12}}>
                  {cheerDone?'+1 BONUS CELL!':'TAP TO POWER UP YOUR CELLS!'}
                </Text>
                {!cheerDone&&<Text style={{color:C.textFaint,fontSize:11}}>{cheerEnergy}%</Text>}
              </View>
            </TouchableOpacity>
          </View>
        )}
        {showInstruction&&(confirmedCount>0||pendingCount>0||phase!=='active')&&(
          <View style={{backgroundColor:instrBg,borderRadius:8,borderWidth:1,
            borderColor:instrBorder,padding:10}}>
            <Text style={{color:instrColor,fontSize:13,textAlign:'center'}}>{instrText}</Text>
          </View>
        )}
      </View>

      {/* ── ZONE 4: Save button — gated for engagement ────────────── */}
      <View style={{paddingHorizontal:16,paddingBottom:20}}>
        <Btn
          label={phase==='splitting'?'✂️  Splitting...':'✅  Save All & Split!'}
          onPress={phase==='active'
            ? (count>=10&&(game.roundInteractions||0)===0)
              ? undefined  // no-op — nudge shown above
              : (game.round>1&&game.round%5===0&&confirmedCount===0&&pendingCount===0)
                ? ()=>setShowSaveConfirm(true)  // every 5th round — confirm saving all
                : ()=>dispatch({type:'RESOLVE'})
            : undefined}
          primary
          style={{opacity:phase==='active'
            ? (count>=10&&(game.roundInteractions||0)===0)?0.4:1
            : 0.5}}
        />
      </View>

      {/* Flash Deal "are you sure?" modal */}
      {showDealConfirm&&game?.flashDeal&&(
        <View style={{position:'absolute',inset:0,backgroundColor:'rgba(0,0,0,0.75)',
          alignItems:'center',justifyContent:'center',zIndex:90}}>
          <View style={{backgroundColor:C.card,borderRadius:20,margin:24,padding:24,
            borderWidth:2,borderColor:C.orange+'88',gap:14,alignItems:'center'}}>
            <Text style={{fontSize:52}}>
              {SHOP_ITEMS.find(i=>i.id===game.flashDeal.itemId)?.emoji||'🛍️'}
            </Text>
            <Text style={{color:C.orange,fontWeight:'800',fontSize:18,textAlign:'center'}}>
              Hold on! 🤔
            </Text>
            <Text style={{color:C.text,fontSize:14,textAlign:'center',lineHeight:22}}>
              Those {game.flashDeal.dealCost} cells would grow to ~{Math.floor(game.flashDeal.dealCost*Math.pow(1.05,3))} cells in just 3 rounds!
            </Text>
            <Text style={{color:C.textMuted,fontSize:13,textAlign:'center',lineHeight:20}}>
              Do you really need {SHOP_ITEMS.find(i=>i.id===game.flashDeal.itemId)?.name||'this'} right now?
            </Text>
            <View style={{flexDirection:'row',gap:10,width:'100%'}}>
              <TouchableOpacity onPress={()=>{
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setShowDealConfirm(false);
              }}
                style={{flex:1.2,backgroundColor:C.green900,borderRadius:12,padding:14,
                  alignItems:'center',borderWidth:2,borderColor:C.green500}}>
                <Text style={{color:C.green400,fontWeight:'800',fontSize:14}}>
                  Keep saving! 💪
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleConfirmDeal}
                style={{flex:1,backgroundColor:C.orange+'22',borderRadius:12,padding:14,
                  alignItems:'center',borderWidth:1,borderColor:C.orange+'66'}}>
                <Text style={{color:C.orange,fontWeight:'700',fontSize:13}}>
                  Buy anyway
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Save-all confirmation modal — every 5th round */}
      {showSaveConfirm&&(
        <View style={{position:'absolute',inset:0,backgroundColor:'rgba(0,0,0,0.7)',
          alignItems:'center',justifyContent:'center',zIndex:90}}>
          <View style={{backgroundColor:C.card,borderRadius:20,margin:24,padding:24,
            borderWidth:2,borderColor:C.green700,gap:14,alignItems:'center'}}>
            <Text style={{fontSize:44}}>💪</Text>
            <Text style={{color:C.green400,fontWeight:'800',fontSize:18,textAlign:'center'}}>
              Saving everything?
            </Text>
            <Text style={{color:C.textMuted,fontSize:13,textAlign:'center',lineHeight:20}}>
              You chose to save ALL {count} cells this round. That's willpower! Your colony will grow faster.
            </Text>
            <View style={{flexDirection:'row',gap:10,width:'100%'}}>
              <TouchableOpacity onPress={()=>setShowSaveConfirm(false)}
                style={{flex:1,backgroundColor:C.surface,borderRadius:12,padding:14,
                  alignItems:'center',borderWidth:1,borderColor:C.border}}>
                <Text style={{color:C.textMuted,fontWeight:'700'}}>← Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={()=>{setShowSaveConfirm(false);dispatch({type:'RESOLVE'});}}
                style={{flex:2,backgroundColor:C.green500,borderRadius:12,padding:14,
                  alignItems:'center'}}>
                <Text style={{color:C.bg,fontWeight:'800',fontSize:15}}>
                  Yes, save all! ✅
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {dealExpiredMsg&&<DealExpiredToast message={dealExpiredMsg} onDone={()=>setDealExpiredMsg(null)}/>}

      {/* Star toast — floats just below the status bar, safe from Dynamic Island */}
      {starToast&&(
        <Animated.View pointerEvents="none" style={{
          position:'absolute',top:64,left:0,right:0,alignItems:'center',
          opacity:starToastOp,transform:[{translateY:starToastY}],zIndex:50}}>
          <View style={{backgroundColor:C.amber+'f0',borderRadius:20,
            paddingHorizontal:16,paddingVertical:7,
            borderWidth:1.5,borderColor:C.amber,
            shadowColor:C.amber,shadowOffset:{width:0,height:2},
            shadowOpacity:0.4,shadowRadius:8,elevation:6}}>
            <Text style={{color:'#1a0a00',fontWeight:'800',fontSize:13}}>
              ⭐ {starToast.message}
            </Text>
          </View>
        </Animated.View>
      )}

      {splitCelebration&&(
        <SplitCelebrationOverlay
          gained={splitCelebration.gained}
          bonusCells={splitCelebration.bonusCells}
          round={game?.round||0}
          onDone={()=>{
            const p=splitCelebration.nextPhase;
            setSplitCelebration(null);
            if(p==='results')   onResults();
            if(p==='levelup')   onLevelUp();
            if(p==='graduating')onLevelUp();
            if(p==='extinct')   onLevelUp();
          }}
        />
      )}
    </SafeAreaView>
  );
}

// ── Kid Results ────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════
// 🧬 CELLIE QUIZ CARD — shown every 3rd round on results screen
// ══════════════════════════════════════════════════════════════════════════
function CellieQuizCard({question,onAnswer,onSkip}){
  const[selected,setSelected]=useState(null); // index of tapped answer
  const[revealed,setRevealed]=useState(false);
  const cardAnim =useRef(new Animated.Value(0)).current;
  const bonusAnim=useRef(new Animated.Value(0)).current;

  useEffect(()=>{ // eslint-disable-line react-hooks/exhaustive-deps
    Animated.spring(cardAnim,{toValue:1,friction:6,tension:80,useNativeDriver:true}).start();
  },[]);// eslint-disable-line react-hooks/exhaustive-deps

  const handleTap=(idx)=>{
    if(revealed)return;
    setSelected(idx);
    setRevealed(true);
    const correct=idx===question.answer;
    if(correct){
      Animated.sequence([
        Animated.delay(400),
        Animated.spring(bonusAnim,{toValue:1,friction:4,useNativeDriver:true}),
      ]).start();
    }
    // Route after a brief pause to let kid read the feedback
    setTimeout(()=>onAnswer(correct,question.reward,question.id),correct?2200:2000);
  };

  const TOPIC_LABEL={
    cell_biology:'🧬 Cell Biology',
    compound_growth:'🌱 Compound Growth',
    money_science:'💰 Money Science',
    game_mechanics:'🎮 Game Skills',
    saving_habits:'🐷 Saving Habits',
  };

  const choiceBg=(idx)=>{
    if(!revealed)return C.card;
    if(idx===question.answer)return C.green900;
    if(idx===selected&&idx!==question.answer)return C.red+'22';
    return C.card;
  };
  const choiceBorder=(idx)=>{
    if(!revealed)return C.border;
    if(idx===question.answer)return C.green500;
    if(idx===selected&&idx!==question.answer)return C.red+'66';
    return C.border;
  };
  const choiceIcon=(idx)=>{
    if(!revealed)return null;
    if(idx===question.answer)return'✓';
    if(idx===selected&&idx!==question.answer)return'✗';
    return null;
  };

  const correct=revealed&&selected===question.answer;

  return(
    <Animated.View style={{
      opacity:cardAnim,
      transform:[{scale:cardAnim.interpolate({inputRange:[0,1],outputRange:[0.9,1]})}],
    }}>
      <View style={{backgroundColor:C.card,borderRadius:16,borderWidth:2,
        borderColor:revealed?(correct?C.green500:C.red+'88'):C.green700,
        overflow:'hidden',marginBottom:12}}>

        {/* Header */}
        <View style={{backgroundColor:C.green900,paddingHorizontal:16,paddingVertical:10,
          flexDirection:'row',alignItems:'center',gap:10}}>
          <View style={{width:34,height:34,borderRadius:17,backgroundColor:C.surface,
            borderWidth:2,borderColor:C.green500,alignItems:'center',justifyContent:'center'}}>
            <Text style={{fontSize:18}}>🧬</Text>
          </View>
          <View style={{flex:1}}>
            <Text style={{color:C.green400,fontWeight:'800',fontSize:13}}>
              Cellie Challenge!
            </Text>
            <Text style={{color:C.textMuted,fontSize:10}}>
              {TOPIC_LABEL[question.topic]} · +{question.reward} {question.reward===1?'cell':'cells'} if correct
            </Text>
          </View>
          {!revealed&&(
            <TouchableOpacity onPress={onSkip}
              style={{paddingHorizontal:8,paddingVertical:4}}>
              <Text style={{color:C.textFaint,fontSize:12}}>Skip</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Question */}
        <View style={{padding:16,paddingBottom:12}}>
          <Text style={{color:C.text,fontWeight:'700',fontSize:15,lineHeight:22,marginBottom:14}}>
            {question.q}
          </Text>

          {/* Answer choices */}
          {question.choices.map((choice,idx)=>(
            <TouchableOpacity key={idx} onPress={()=>handleTap(idx)}
              disabled={revealed}
              style={{backgroundColor:choiceBg(idx),borderRadius:10,
                borderWidth:1.5,borderColor:choiceBorder(idx),
                padding:12,marginBottom:8,
                flexDirection:'row',alignItems:'center',gap:10}}>
              <View style={{width:22,height:22,borderRadius:11,
                backgroundColor:revealed&&idx===question.answer?C.green500:
                  revealed&&idx===selected?C.red+'66':C.surface,
                borderWidth:1,borderColor:
                  revealed&&idx===question.answer?C.green400:C.border,
                alignItems:'center',justifyContent:'center'}}>
                {choiceIcon(idx)?(
                  <Text style={{fontSize:11,fontWeight:'800',
                    color:idx===question.answer?C.bg:C.red}}>
                    {choiceIcon(idx)}
                  </Text>
                ):(
                  <Text style={{fontSize:10,color:C.textMuted,fontWeight:'700'}}>
                    {['A','B','C'][idx]}
                  </Text>
                )}
              </View>
              <Text style={{color:revealed&&idx===question.answer?C.green300:C.text,
                fontSize:13,flex:1,lineHeight:19}}>
                {choice}
              </Text>
            </TouchableOpacity>
          ))}

          {/* Because explanation — shown after answering */}
          {revealed&&(
            <View style={{backgroundColor:correct?C.green900:C.red+'18',
              borderRadius:10,padding:12,marginTop:4,
              borderWidth:1,borderColor:correct?C.green700:C.red+'44'}}>
              <Text style={{color:correct?C.green300:C.red+'cc',
                fontSize:12,lineHeight:18}}>
                {correct?'🎉 ':'💡 '}{question.because}
              </Text>
            </View>
          )}
        </View>

        {/* Bonus cells earned — animates in on correct */}
        {correct&&(
          <Animated.View style={{alignItems:'center',paddingBottom:14,
            opacity:bonusAnim,
            transform:[{scale:bonusAnim.interpolate({inputRange:[0,1],outputRange:[0.5,1]})}]}}>
            <View style={{backgroundColor:C.green500,borderRadius:20,
              paddingHorizontal:20,paddingVertical:8}}>
              <Text style={{color:C.bg,fontWeight:'800',fontSize:15}}>
                +{question.reward} bonus {question.reward===1?'cell':'cells'}! 🧬
              </Text>
            </View>
          </Animated.View>
        )}
      </View>
    </Animated.View>
  );
}

function KidResultsScreen({onNext,onShop}){
  const{game,dispatch}=useGame();const[showLesson,setShowLesson]=useState(null);
  const scaleA=useRef(new Animated.Value(0.85)).current;const fadeA=useRef(new Animated.Value(0)).current;
  useEffect(()=>{ // eslint-disable-line react-hooks/exhaustive-deps
    Animated.parallel([Animated.spring(scaleA,{toValue:1,friction:5,useNativeDriver:true}),Animated.timing(fadeA,{toValue:1,duration:400,useNativeDriver:true})]).start();
  },[]);// eslint-disable-line react-hooks/exhaustive-deps
  if(!game)return null;

  // ── Quiz selection — show every 3rd round, pick unseen question ────────
  const round=game.round||1;
  const showQuiz=(round%3===0)&&round>1;
  const seen=game.seenQuestions||[];
  const eligible=QUIZ_QUESTIONS.filter(q=>{
    if(seen.includes(q.id))return false;
    if(round<=6)return q.difficulty==='easy';
    return true;
  });
  const topics=['cell_biology','compound_growth','money_science','game_mechanics','saving_habits'];
  const topicIdx=Math.floor(round/3)%3;
  const topicFiltered=eligible.filter(q=>q.topic===topics[topicIdx]);
  const pool=topicFiltered.length>0?topicFiltered:eligible;
  // Snapshot quizQ once — never changes while this screen is open
  const[quizQ]=useState(()=>pool.length>0?pool[round%pool.length]:null);

  // Buffer quiz result — dispatch ONLY when Next Round is pressed
  // This prevents re-render from picking a new question and auto-answering it
  const[quizResult,setQuizResult]=useState(null); // {correct,reward,questionId}|null

  const handleQuizAnswer=(correct,reward,questionId)=>{
    setQuizResult({correct,reward,questionId});
    // No dispatch here — fired on Next Round press instead
  };
  const handleQuizSkip=()=>{
    // Mark seen on skip so it never re-appears
    if(quizQ)setQuizResult({correct:false,reward:0,questionId:quizQ.id});
  };

  // Called by Next Round button — dispatches buffered quiz result then navigates
  const handleNextRound=()=>{
    if(quizResult){
      dispatch({type:'QUIZ_BONUS',cells:quizResult.correct?quizResult.reward:0,
        questionId:quizResult.questionId});
    }
    dispatch({type:'NEXT'});
    onNext();
  };
  const latest  =game.history[game.history.length-1];
  const count   =game.cells.filter(c=>!c.burst).length;
  const gained  =(latest?.gained||0)+(latest?.bonusCells||0);
  // Only show a "cells grew" story if cells actually grew this round
  const story = gained>0
    ? ROUND_STORIES[(game.round-2)%ROUND_STORIES.length]
    : NO_GROWTH_STORIES[(game.round-2)%NO_GROWTH_STORIES.length];
  const wishItem=(game.goals||[]).find(g=>g.status==='saving')||null;
  const totalCellsEarned=(game.principal||0)+(game.lifetimeCellsGained||0);
  const canBuy=wishItem&&(wishItem.isAmazon
    ? totalCellsEarned>=wishItem.cost   // Amazon: cumulative is enough
    : count>=wishItem.cost);            // built-in: need live cells to spend
  const hadBonus=(latest?.bonusCells||0)>0;
  const nearGrad=count>=COLONY_WARN;
  return(
    <SafeAreaView style={{flex:1,backgroundColor:C.bg}}>
      <ScrollView contentContainerStyle={{padding:16,gap:12,paddingBottom:24}}>
        <Animated.View style={{backgroundColor:C.green900,borderRadius:14,borderWidth:2,borderColor:nearGrad?C.amber:C.green700,padding:20,alignItems:'center',transform:[{scale:scaleA}]}}>
          <Text style={{fontSize:10,letterSpacing:2,color:C.green500,marginBottom:4}}>COLONY #{game.colonyNumber||1}</Text>
          <Text style={{fontSize:48,fontWeight:'800',color:nearGrad?C.amber:C.green400,letterSpacing:-2}}>{count}<Text style={{fontSize:20,color:C.textMuted}}>/{COLONY_CAP}</Text></Text>
          <Text style={{color:C.green300,marginTop:4,fontSize:13}}>= ${count} in your jar 🫙</Text>
          {(latest?.gained||0)>0&&<View style={{marginTop:8,backgroundColor:C.green700+'44',borderRadius:8,padding:6}}><Text style={{color:C.green300,fontWeight:'700',fontSize:12}}>+{latest.gained} cells divided this round! ✂️</Text></View>}
          {hadBonus&&<View style={{marginTop:6,backgroundColor:C.purple+'22',borderRadius:8,padding:6,borderWidth:1,borderColor:C.purple+'44'}}><Text style={{color:C.purple,fontWeight:'700',fontSize:12}}>💪 +{latest.bonusCells} WILLPOWER BONUS cells! ⭐</Text></View>}
          {nearGrad&&<View style={{marginTop:8,backgroundColor:C.amber+'22',borderRadius:8,padding:6,borderWidth:1,borderColor:C.amber+'44'}}><Text style={{color:C.amber,fontWeight:'700',fontSize:12}}>🎓 {COLONY_CAP-count} cells until graduation!</Text></View>}
        </Animated.View>

        {wishItem&&!canBuy&&(
          <View style={{backgroundColor:wishItem.color+'11',borderRadius:12,borderWidth:1,
            borderColor:wishItem.color+'44',padding:14,flexDirection:'row',
            alignItems:'center',gap:12}}>
            <Text style={{fontSize:32}}>{wishItem.emoji}</Text>
            <View style={{flex:1}}>
              <Text style={{color:wishItem.color,fontWeight:'800',fontSize:14}}>
                {Math.max(0,wishItem.cost-totalCellsEarned)} more cells to earn for the {wishItem.name}!
              </Text>
              <View style={{height:4,backgroundColor:C.surface,borderRadius:2,
                overflow:'hidden',marginTop:6}}>
                <View style={{height:4,backgroundColor:wishItem.color,borderRadius:2,
                  width:`${Math.min((totalCellsEarned/wishItem.cost)*100,100)}%`}}/>
              </View>
              <Text style={{color:C.textMuted,fontSize:11,marginTop:3}}>
                {Math.min(totalCellsEarned,wishItem.cost)}/{wishItem.cost} cells saved
                {wishItem.isAmazon?' (across all colonies)':''}
              </Text>
            </View>
          </View>
        )}
        {wishItem&&canBuy&&(
          <TouchableOpacity onPress={onShop}
            style={{backgroundColor:C.green900,borderRadius:12,borderWidth:2,
              borderColor:C.green500,padding:14,flexDirection:'row',
              alignItems:'center',gap:12}}>
            <Text style={{fontSize:32}}>{wishItem.emoji}</Text>
            <View style={{flex:1}}>
              <Text style={{color:C.green400,fontWeight:'800',fontSize:15}}>
                ✅ Buy the {wishItem.name}!
              </Text>
              <Text style={{color:C.textMuted,fontSize:12,marginTop:2}}>
                You have enough cells — tap to visit the shop!
              </Text>
            </View>
            <Text style={{fontSize:22}}>🎉</Text>
          </TouchableOpacity>
        )}

        {game.badges.length>0&&game.badges.slice(-1).map(b=>BADGE_INFO[b]?(
          <TouchableOpacity key={b} onPress={()=>setShowLesson(showLesson===b?null:b)}
            style={{backgroundColor:C.card,borderRadius:12,borderWidth:1,
              borderColor:showLesson===b?C.amber:C.border,padding:12}}>
            <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
              <Text style={{fontSize:28}}>{BADGE_INFO[b].emoji}</Text>
              <View style={{flex:1}}>
                <Text style={{color:C.text,fontWeight:'700'}}>{BADGE_INFO[b].label}</Text>
                <Text style={{color:C.textMuted,fontSize:11}}>Tap to learn! 👆</Text>
              </View>
            </View>
            {showLesson===b&&(
              <View style={{marginTop:10,backgroundColor:C.amber+'11',borderRadius:8,padding:10,borderWidth:1,borderColor:C.amber+'44'}}>
                <Text style={{color:C.amber,fontSize:12,lineHeight:18}}>{BADGE_INFO[b].kidLesson}</Text>
              </View>
            )}
          </TouchableOpacity>
        ):null)}

        {gained>0?(
          <View style={{backgroundColor:C.green900,borderRadius:12,borderWidth:1,borderColor:C.green700,padding:12,gap:6}}>
            <Text style={{color:C.green400,fontWeight:'700',fontSize:12,marginBottom:4}}>🔢 What just happened?</Text>
            {[
              ['🧬',`Started with ${latest?.before} cells`],
              ['💾',`${latest?.kept??count} cells saved`],
              ['✂️',`${latest?.gained} new cells appeared from splitting!`],
              ...(hadBonus?[['💪',`Willpower bonus! +${latest?.bonusCells} extra cells!`]]:[]),
              ['✅',`Colony is now ${count}/${COLONY_CAP} cells`],
            ].map(([n,t])=>(
              <View key={n} style={{flexDirection:'row',alignItems:'center',gap:8}}>
                <Text style={{fontSize:16}}>{n}</Text>
                <Text style={{color:C.text,fontSize:12,flex:1}}>{t}</Text>
              </View>
            ))}
          </View>
        ):(latest?.kept>0)?(
          <View style={{backgroundColor:C.surface,borderRadius:12,borderWidth:1,borderColor:C.border,padding:12,gap:6}}>
            <Text style={{color:C.textMuted,fontWeight:'700',fontSize:12,marginBottom:4}}>🔢 What just happened?</Text>
            {[
              ['🧬',`Started with ${latest?.before} cells`],
              ['💾',`${latest?.kept} cells saved — colony holding steady`],
              ['⏳',`Slow rate needs more cells to split. Keep saving!`],
              ['💡',`Try medium rate or save more cells to grow faster`],
            ].map(([n,t])=>(
              <View key={n} style={{flexDirection:'row',alignItems:'center',gap:8}}>
                <Text style={{fontSize:16}}>{n}</Text>
                <Text style={{color:C.textMuted,fontSize:12,flex:1}}>{t}</Text>
              </View>
            ))}
          </View>
        ):null}

        {/* 🧬 Cellie Challenge — every 3rd round */}
        {showQuiz&&quizQ&&(
          <CellieQuizCard
            question={quizQ}
            onAnswer={handleQuizAnswer}
            onSkip={handleQuizSkip}
          />
        )}
      </ScrollView>
      <View style={{flexDirection:'row',gap:10,padding:16,paddingTop:0}}>
        <Btn label="🛍️ Shop" onPress={onShop} style={{flex:1}}/>
        <Btn label="Next Round →" onPress={handleNextRound} primary style={{flex:2}}/>
      </View>
    </SafeAreaView>
  );
}

function ColonyExtinctScreen({game,onContinue}){
  const colonyNum=game?.colonyNumber||1;
  const totalSpent=game?.history?.reduce((a,r)=>a+(r.spent||0),0)||0;
  const rounds=game?.totalRounds||0;
  const pulseA=useRef(new Animated.Value(1)).current;
  const fadeA =useRef(new Animated.Value(0)).current;

  useEffect(()=>{ // eslint-disable-line react-hooks/exhaustive-deps
    // Sad pulse then fade in lesson
    Animated.sequence([
      Animated.timing(fadeA,{toValue:1,duration:600,useNativeDriver:true}),
      Animated.loop(Animated.sequence([
        Animated.timing(pulseA,{toValue:0.92,duration:800,useNativeDriver:true}),
        Animated.timing(pulseA,{toValue:1,   duration:800,useNativeDriver:true}),
      ]),{iterations:3}),
    ]).start();
  },[]);// eslint-disable-line react-hooks/exhaustive-deps

  return(
    <SafeAreaView style={{flex:1,backgroundColor:C.bg}}>
      <ScrollView contentContainerStyle={{padding:24,gap:20,alignItems:'center',paddingBottom:40}}>

        {/* Extinct animation */}
        <Animated.View style={{alignItems:'center',gap:12,opacity:fadeA,
          transform:[{scale:pulseA}]}}>
          <Text style={{fontSize:72}}>💀</Text>
          <Text style={{color:'#ef4444',fontWeight:'800',fontSize:26,
            letterSpacing:-0.5,textAlign:'center'}}>
            Colony #{colonyNum} Extinct
          </Text>
          <Text style={{color:'#fca5a5',fontSize:14,textAlign:'center',lineHeight:22}}>
            You spent every last cell. Nothing was left to multiply.
          </Text>
        </Animated.View>

        {/* What happened */}
        <View style={{backgroundColor:C.red+'11',borderRadius:16,
          borderWidth:1.5,borderColor:C.red+'44',padding:20,gap:14,width:'100%'}}>
          <Text style={{color:C.red,fontWeight:'800',fontSize:15}}>
            📉 What happened?
          </Text>
          <View style={{gap:10}}>
            {[
              ['💸', `You spent all ${totalSpent} cells this colony`],
              ['⏹️', 'With 0 cells left, nothing could multiply'],
              ['🧬', 'Cells need to survive to split and grow'],
              ['💡', 'Even saving just 1 cell keeps the colony alive'],
            ].map(([icon,text])=>(
              <View key={text} style={{flexDirection:'row',gap:12,alignItems:'flex-start'}}>
                <Text style={{fontSize:18}}>{icon}</Text>
                <Text style={{color:C.red,fontSize:13,flex:1,lineHeight:20}}>{text}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* The lesson */}
        <View style={{backgroundColor:C.green900,borderRadius:16,
          borderWidth:1.5,borderColor:C.green700,padding:20,gap:10,width:'100%'}}>
          <Text style={{color:C.green400,fontWeight:'800',fontSize:15}}>
            🌱 The lesson
          </Text>
          <Text style={{color:C.text,fontSize:14,lineHeight:22}}>
            Real savings work the same way. If you spend everything, your money can't grow. Even saving a tiny bit - just $1 - means you'll have more next time. Warren Buffett's rule: <Text style={{color:C.green400,fontWeight:'700'}}>never lose your starter seeds.</Text> (Grown-ups call those seeds your "principal" — the original money you started with!)
          </Text>
        </View>

        {/* Stats */}
        <View style={{flexDirection:'row',gap:10,width:'100%'}}>
          {[
            ['🏛️', 'Colony', `#${colonyNum}`],
            ['🔄', 'Rounds', rounds],
            ['💸', 'Spent', totalSpent],
          ].map(([icon,label,val])=>(
            <View key={label} style={{flex:1,backgroundColor:C.card,borderRadius:10,
              borderWidth:1,borderColor:C.border,padding:12,alignItems:'center',gap:4}}>
              <Text style={{fontSize:20}}>{icon}</Text>
              <Text style={{color:C.text,fontWeight:'800',fontSize:16}}>{val}</Text>
              <Text style={{color:C.textMuted,fontSize:10,letterSpacing:1}}>{label.toUpperCase()}</Text>
            </View>
          ))}
        </View>

        {/* Try again button */}
        <TouchableOpacity onPress={onContinue}
          style={{backgroundColor:C.green500,borderRadius:14,padding:18,
            width:'100%',alignItems:'center',gap:4}}>
          <Text style={{color:C.bg,fontWeight:'800',fontSize:17}}>
            🧬 Start Colony #{colonyNum+1}
          </Text>
          <Text style={{color:C.bg+'cc',fontSize:12}}>
            You get {BONUS_CARRY} starter cells to try again
          </Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

function KidLevelUpScreen({onContinue}){
  const{game,dispatch}=useGame();
  // Hooks must be called before any conditional return
  const scaleA=useRef(new Animated.Value(0)).current;
  const isGraduating=game?.phase==='graduating';
  const isExtinct   =game?.phase==='extinct';
  useEffect(()=>{
    if(!isGraduating&&!isExtinct)Animated.spring(scaleA,{toValue:1,friction:4,useNativeDriver:true}).start();
  },[isGraduating,isExtinct]);// eslint-disable-line react-hooks/exhaustive-deps
  // Delegate to specialist screens
  if(isExtinct)   {return<ColonyExtinctScreen game={game} onContinue={()=>{dispatch({type:'GRADUATE'});onContinue();}}/>;}
  if(isGraduating){return<ColonyGraduationScreen game={game} onContinue={()=>{dispatch({type:'GRADUATE'});onContinue();}}/>;}
  return(
    <SafeAreaView style={{flex:1,backgroundColor:C.bg}}>
      <View style={{flex:1,alignItems:'center',justifyContent:'center',padding:24,gap:16}}>
        <Animated.View style={{alignItems:'center',transform:[{scale:scaleA}]}}><Text style={{fontSize:72}}>⭐</Text><Text style={{fontSize:28,fontWeight:'800',color:C.green400,textAlign:'center'}}>LEVEL {game?.level}!</Text><Text style={{color:C.textMuted,marginTop:6,fontSize:14,textAlign:'center'}}>Your colony is thriving! 🎉</Text></Animated.View>
        <View style={{backgroundColor:C.green900,borderRadius:12,borderWidth:1,borderColor:C.green500+'44',padding:16,width:'100%'}}><Text style={{color:C.green400,fontWeight:'700',fontSize:13,marginBottom:6}}>🤯 Keep growing!</Text><Text style={{color:C.green300,fontSize:13,lineHeight:20}}>Reach {COLONY_CAP} cells and your colony GRADUATES to the museum!</Text></View>
        <Btn label={`🚀 Keep Going (Level ${game?.level})!`} onPress={()=>{dispatch({type:'NEXT'});onContinue();}} primary style={{width:'100%'}}/>
      </View>
    </SafeAreaView>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// 🛒 AMAZON WISH LIST SCREEN
// ══════════════════════════════════════════════════════════════════════════
// ── Generate goal image via DALL-E 3 Edge Function ────────────────────────
// Returns a base64 data URI or null if unavailable / generation fails.
// Image generation disabled — returns null, GoalImage shows emoji fallback
async function generateGoalImage(_itemName){ return null; }


// ══════════════════════════════════════════════════════════════════════════
// ➕ ADD CUSTOM ITEM MODAL — lets kids add any Amazon item by name + price
// ══════════════════════════════════════════════════════════════════════════
const EMOJI_OPTIONS=['🎮','🧸','🚗','🎨','🎯','🤖','🦕','🎸','🔭','🧩','🏄','🎪',
  '🦄','🏗️','🚂','🎃','🪀','🪆','🎭','🌍','🏆','🎲','🎵','🎬','🤿','🛹','🪁','🎻'];

function AddCustomItemModal({visible,onAdd,onClose,cellToDollar}){
  const[name,setName]=useState('');
  const[price,setPrice]=useState('');
  const[emoji,setEmoji]=useState('🎮');
  const slideY=useRef(new Animated.Value(400)).current;
  const bgOp  =useRef(new Animated.Value(0)).current;

  useEffect(()=>{ // eslint-disable-line react-hooks/exhaustive-deps
    if(visible){
      setName('');setPrice('');setEmoji('🎮');
      Animated.parallel([
        Animated.spring(slideY,{toValue:0,friction:8,tension:80,useNativeDriver:true}),
        Animated.timing(bgOp,  {toValue:1,duration:200,useNativeDriver:true}),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideY,{toValue:400,duration:220,useNativeDriver:true}),
        Animated.timing(bgOp,  {toValue:0,  duration:180,useNativeDriver:true}),
      ]).start();
    }
  },[visible]);// eslint-disable-line react-hooks/exhaustive-deps

  if(!visible)return null;

  const priceNum=parseFloat(price)||0;
  const cellsNeeded=priceNum>0?Math.max(1,Math.round(priceNum*(cellToDollar||100))):0;
  const canAdd=name.trim().length>=2&&priceNum>0;

  const handleAdd=()=>{
    if(!canAdd)return;
    const id=`custom_${Date.now()}`;
    onAdd({
      id,name:name.trim(),emoji,cost:cellsNeeded,
      color:C.orange,isAmazon:true,priceUsd:priceNum,
      searchQ:name.trim(),isCustom:true,imageUri:null,
    });
    onClose();
  };

  return(
    <View style={{position:'absolute',inset:0,zIndex:200}}>
      <Animated.View style={{position:'absolute',inset:0,backgroundColor:'rgba(0,0,0,0.6)',opacity:bgOp}}>
        <TouchableOpacity style={{flex:1}} onPress={onClose} activeOpacity={1}/>
      </Animated.View>
      <Animated.View style={{position:'absolute',bottom:0,left:0,right:0,
        transform:[{translateY:slideY}],
        backgroundColor:C.card,borderTopLeftRadius:24,borderTopRightRadius:24,
        borderWidth:1,borderColor:C.border,paddingBottom:34}}>

        {/* Handle */}
        <View style={{alignItems:'center',paddingTop:12,paddingBottom:4}}>
          <View style={{width:40,height:4,borderRadius:2,backgroundColor:C.border}}/>
        </View>

        <ScrollView contentContainerStyle={{padding:20,gap:16}} keyboardShouldPersistTaps="handled">
          <Text style={{color:C.text,fontWeight:'800',fontSize:18}}>Add Any Item 🛒</Text>

          {/* Item name */}
          <View style={{gap:6}}>
            <Text style={{color:C.textMuted,fontSize:12,fontWeight:'700',letterSpacing:0.5}}>
              WHAT IS IT CALLED?
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. LEGO Technic Car"
              placeholderTextColor={C.textFaint}
              style={[ss.input,{fontSize:15}]}
              autoFocus
              returnKeyType="next"
            />
          </View>

          {/* Price */}
          <View style={{gap:6}}>
            <Text style={{color:C.textMuted,fontSize:12,fontWeight:'700',letterSpacing:0.5}}>
              HOW MANY CELLS DOES IT COST?
            </Text>
            <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
              <View style={[ss.input,{flex:1,flexDirection:'row',alignItems:'center',gap:6,paddingVertical:0}]}>
                <Text style={{color:C.textMuted,fontSize:17,fontWeight:'700'}}>$</Text>
                <TextInput
                  value={price}
                  onChangeText={setPrice}
                  placeholder="0.00"
                  placeholderTextColor={C.textFaint}
                  keyboardType="decimal-pad"
                  style={{flex:1,color:C.text,fontSize:16,fontWeight:'600',paddingVertical:14}}
                  returnKeyType="done"
                />
              </View>
              {cellsNeeded>0&&(
                <View style={{backgroundColor:C.orange+'22',borderRadius:10,
                  paddingHorizontal:12,paddingVertical:10,borderWidth:1,borderColor:C.orange+'44'}}>
                  <Text style={{color:C.orange,fontWeight:'800',fontSize:13}}>{cellsNeeded}</Text>
                  <Text style={{color:C.textMuted,fontSize:9,marginTop:1}}>cells</Text>
                </View>
              )}
            </View>
          </View>

          {/* Emoji picker */}
          <View style={{gap:8}}>
            <Text style={{color:C.textMuted,fontSize:12,fontWeight:'700',letterSpacing:0.5}}>
              PICK AN EMOJI
            </Text>
            <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>
              {EMOJI_OPTIONS.map(e=>(
                <TouchableOpacity key={e} onPress={()=>setEmoji(e)}
                  style={{width:44,height:44,borderRadius:10,
                    backgroundColor:emoji===e?C.orange+'33':C.surface,
                    borderWidth:emoji===e?2:1,
                    borderColor:emoji===e?C.orange:C.border,
                    alignItems:'center',justifyContent:'center'}}>
                  <Text style={{fontSize:22}}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Preview */}
          {canAdd&&(
            <View style={{backgroundColor:C.green900,borderRadius:12,
              borderWidth:1.5,borderColor:C.green700,padding:14,
              flexDirection:'row',alignItems:'center',gap:12}}>
              <Text style={{fontSize:32}}>{emoji}</Text>
              <View style={{flex:1}}>
                <Text style={{color:C.green400,fontWeight:'800',fontSize:14}}>{name}</Text>
                <Text style={{color:C.textMuted,fontSize:12,marginTop:2}}>
                  Save {cellsNeeded} cells · ${priceNum.toFixed(2)} on Amazon
                </Text>
              </View>
            </View>
          )}

          {/* Add button */}
          <TouchableOpacity onPress={handleAdd} disabled={!canAdd}
            style={{backgroundColor:canAdd?C.green500:C.surface,
              borderRadius:14,padding:16,alignItems:'center',
              borderWidth:1,borderColor:canAdd?C.green400:C.border,
              opacity:canAdd?1:0.5}}>
            <Text style={{color:canAdd?C.bg:C.textMuted,fontWeight:'800',fontSize:16}}>
              Add to My Goals →
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>
    </View>
  );
}


// ── GoalImage — shows AI-generated image or emoji fallback ────────────────
function GoalImage({goal, size=52, borderRadius=12}){
  if(goal?.imageUri){
    return(
      <View style={{width:size,height:size,borderRadius,overflow:'hidden',
        borderWidth:1.5,borderColor:goal.color+'66'}}>
        <Image source={{uri:goal.imageUri}}
          style={{width:size,height:size}}
          resizeMode="cover"/>
        <View style={{position:'absolute',bottom:2,right:2,
          backgroundColor:C.green500,borderRadius:4,paddingHorizontal:3,paddingVertical:1}}>
          <Text style={{color:C.bg,fontSize:7,fontWeight:'800'}}>AI</Text>
        </View>
      </View>
    );
  }
  return(
    <View style={{width:size,height:size,borderRadius,
      backgroundColor:goal.color+'22',borderWidth:1.5,borderColor:goal.color+'66',
      alignItems:'center',justifyContent:'center'}}>
      <Text style={{fontSize:size*0.5}}>{goal.emoji||'🎯'}</Text>
    </View>
  );
}


// ══════════════════════════════════════════════════════════════════════════
// 🔑 PARENT PIN GATE MODAL — shown before any action that leaves the app
// ══════════════════════════════════════════════════════════════════════════
function ParentPinGateModal({visible, title, subtitle, onUnlock, onCancel}){
  const{state}=useApp();
  const[pin,setPin]=useState('');
  const[error,setError]=useState('');

  // Reset on open
  useEffect(()=>{
    if(visible){setPin('');setError('');}
  },[visible]);

  const handle=()=>{
    if(pin===state.parent?.pin){
      setPin('');setError('');
      onUnlock();
    } else {
      setError('Wrong PIN — try again');
      setPin('');
    }
  };

  return(
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={{flex:1,backgroundColor:'rgba(0,0,0,0.75)',
        alignItems:'center',justifyContent:'center',padding:24}}>
        <View style={{backgroundColor:C.card,borderRadius:20,
          borderWidth:1.5,borderColor:C.amber+'66',
          padding:24,width:'100%',maxWidth:360,gap:16}}>
          {/* Header */}
          <View style={{alignItems:'center',gap:8}}>
            <Text style={{fontSize:44}}>🔑</Text>
            <Text style={{color:C.amber,fontWeight:'800',fontSize:18,
              textAlign:'center'}}>{title||'Parent Check'}</Text>
            {!!subtitle&&(
              <Text style={{color:C.textMuted,fontSize:13,textAlign:'center',
                lineHeight:19}}>{subtitle}</Text>
            )}
          </View>
          {/* PIN input */}
          <View style={{backgroundColor:C.amber+'11',borderRadius:12,
            borderWidth:1,borderColor:C.amber+'44',padding:16,gap:10}}>
            <Text style={{color:C.amber,fontWeight:'700',fontSize:13,
              textAlign:'center'}}>Enter Parent PIN</Text>
            <PinInput value={pin} onChange={p=>{setPin(p);setError('');}}
              label=""/>
            {!!error&&(
              <Text style={{color:C.red,fontSize:13,
                textAlign:'center'}}>{error}</Text>
            )}
          </View>
          {/* Buttons */}
          <View style={{gap:10}}>
            <Btn label="Unlock →" onPress={handle} primary/>
            <TouchableOpacity onPress={()=>{setPin('');setError('');onCancel();}}
              style={{alignItems:'center',paddingVertical:8}}>
              <Text style={{color:C.textMuted,fontSize:13}}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}


// ══════════════════════════════════════════════════════════════════════════
// 🛍️ UNIFIED SHOP — ranked wish list + combined catalog (built-in + Amazon)
// ══════════════════════════════════════════════════════════════════════════
function UnifiedShopScreen({onBack,kidName}){
  const{game,dispatch}=useGame();
  const{state:appState}=useApp();
  const[view,setView]=useState('goals'); // 'goals' | 'add'
  const[query,setQuery]=useState('');
  const[ceremonyItem,setCeremonyItem]=useState(null);
  const[shareItem,setShareItem]=useState(null);
  const[showCustomModal,setShowCustomModal]=useState(false);
  const[pinGate,setPinGate]=useState(null); // {action:fn, title, subtitle} | null
  const[showVisionCamera,setShowVisionCamera]=useState(false);
  const[visionLoading,setVisionLoading]=useState(false);
  const[pendingVisionGoal,setPendingVisionGoal]=useState(null);
  const[visionEditName,setVisionEditName]=useState('');
  const[visionEditCost,setVisionEditCost]=useState('');
  if(!game)return null;

  const count=game.cells.filter(c=>!c.burst).length;
  // Cumulative cells earned across ALL colonies — carries through graduation
  const totalCellsEarned=(game.principal||0)+(game.lifetimeCellsGained||0);
  const goals=game.goals||[];
  const savingGoals=goals.filter(g=>g.status==='saving');
  const gotGoals   =goals.filter(g=>g.status==='got');
  const activeGoal =savingGoals[0]||null;
  const settings   =appState.parent?.settings||{affiliateTag:'moneycells-20'};
  const roundsEarned=game.totalRounds||0;

  // Combined catalog — normalise both sources to same shape
  const catalog=[
    ...SHOP_ITEMS.map(i=>({...i,isAmazon:false,
      inGoals:goals.some(g=>g.id===i.id)})),
    ...AMAZON_CATALOG.map(i=>({...i,isAmazon:true,
      cost:Math.round(i.priceUsd*(settings.cellToDollar||100)),
      color:C.orange,inGoals:goals.some(g=>g.id===i.id)})),
  ];
  const filtered=query.trim()
    ?catalog.filter(i=>i.name.toLowerCase().includes(query.toLowerCase())||
        (i.category||'').toLowerCase().includes(query.toLowerCase()))
    :catalog;

  const handleAddGoal=(item,makeActive=false)=>{
    dispatch({type:'ADD_GOAL',goal:{
      id:item.id,name:item.name,emoji:item.emoji,cost:item.cost,
      color:item.color,isAmazon:item.isAmazon,
      priceUsd:item.priceUsd,searchQ:item.searchQ,
    },makeActive});
    if(savingGoals.length===0||makeActive)setView('goals');
  };

  const handleShareWithParent=(item)=>{
    // Open Amazon directly — parental PIN already verified before this is called
    const tag=settings.affiliateTag||'moneycells-20';
    const url=`https://www.amazon.com/s?k=${encodeURIComponent(item.searchQ||item.name)}&tag=${tag}&linkCode=ur2`;
    Linking.openURL(url).catch(()=>{});
  };

  const handleGotIt=(item)=>{
    if(item.isAmazon){
      // Require parent PIN before sharing Amazon link
      setPinGate({
        title:`Buy the ${item.name}!`,
        subtitle:'Enter your PIN to share this with a parent and mark it as purchased.',
        action:()=>{
          handleShareWithParent(item);
          dispatch({type:'MARK_GOAL_GOT',id:item.id});
        },
      });
    } else {
      // Built-in: fire purchase ceremony (removes cells)
      setCeremonyItem(item);
    }
  };

  // ── PIN Gate modal ───────────────────────────────────────────────────────
  // Shown before any action that leaves the app (Amazon links)

  // ── Ceremony modal ──────────────────────────────────────────────────────
  if(ceremonyItem){
    return(
      <Modal visible transparent animationType="none" statusBarTranslucent>
        <BuyCeremony item={ceremonyItem} isDeal={false} kidName={kidName} roundsEarned={roundsEarned}
          onComplete={()=>{
            dispatch({type:'BUY_ITEM',itemId:ceremonyItem.id});
            dispatch({type:'MARK_GOAL_GOT',id:ceremonyItem.id});
            setCeremonyItem(null);
          }}/>
      </Modal>
    );
  }

  // ── Add Goal view ───────────────────────────────────────────────────────
  if(view==='add'){
    return(
      <SafeAreaView style={{flex:1,backgroundColor:C.bg}}>
        <View style={{padding:16,paddingBottom:8,gap:10}}>
          <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
            <TouchableOpacity onPress={()=>{setQuery('');setView('goals');}}>
              <Text style={{color:C.green400,fontSize:16}}>← My Goals</Text>
            </TouchableOpacity>
            <Text style={[ss.h1,{flex:1}]}>Add a Goal</Text>
            <Text style={{color:C.green300,fontWeight:'700',fontSize:13}}>🧬 {count}</Text>
          </View>
          <View style={{backgroundColor:C.card,borderRadius:10,borderWidth:1.5,
            borderColor:C.border,flexDirection:'row',alignItems:'center',
            paddingHorizontal:12,gap:8}}>
            <Text style={{fontSize:16}}>🔍</Text>
            <TextInput value={query} onChangeText={setQuery}
              placeholder="Search toys, games, sets..."
              placeholderTextColor={C.textFaint}
              style={{flex:1,color:C.text,fontSize:14,paddingVertical:10}}
              autoCapitalize="none"/>
            {!!query&&<TouchableOpacity onPress={()=>setQuery('')}>
              <Text style={{color:C.textMuted,fontSize:18}}>×</Text>
            </TouchableOpacity>}
          </View>
        </View>
        <ScrollView contentContainerStyle={{padding:16,paddingTop:4,gap:8,paddingBottom:32}}>
          {filtered.length===0&&(
            <View style={{alignItems:'center',padding:40,gap:8}}>
              <Text style={{fontSize:48}}>🔍</Text>
              <Text style={{color:C.textMuted,textAlign:'center'}}>Nothing found for "{query}"</Text>
            </View>
          )}
          {filtered.map(item=>{
            const ready=item.isAmazon?totalCellsEarned>=item.cost:count>=item.cost;
            const inGoals=item.inGoals;
            return(
              <View key={item.id} style={{backgroundColor:C.card,borderRadius:12,
                borderWidth:1.5,borderColor:inGoals?C.amber+'66':ready?C.green500+'44':C.border,
                padding:14}}>
                <View style={{flexDirection:'row',gap:10,alignItems:'center'}}>
                  <View style={{width:48,height:48,borderRadius:12,
                    backgroundColor:item.color+'22',borderWidth:1,borderColor:item.color+'44',
                    alignItems:'center',justifyContent:'center'}}>
                    <Text style={{fontSize:26}}>{item.emoji}</Text>
                  </View>
                  <View style={{flex:1}}>
                    <Text style={{color:C.text,fontWeight:'800',fontSize:13}}>{item.name}</Text>
                    <View style={{flexDirection:'row',alignItems:'center',gap:6,marginTop:2}}>
                      <Text style={{color:C.textMuted,fontSize:12}}>{item.cost} cells</Text>
                      {ready&&<View style={{backgroundColor:C.green900,borderRadius:4,
                        paddingHorizontal:6,paddingVertical:1,borderWidth:1,borderColor:C.green700}}>
                        <Text style={{color:C.green400,fontSize:9,fontWeight:'700'}}>✓ ENOUGH!</Text>
                      </View>}
                    </View>
                    <View style={{height:3,backgroundColor:C.surface,borderRadius:2,
                      overflow:'hidden',marginTop:4,width:'100%'}}>
                      <View style={{height:3,backgroundColor:ready?C.green500:item.color,
                        borderRadius:2,width:`${Math.min(totalCellsEarned/item.cost,1)*100}%`}}/>
                    </View>
                  </View>
                  {inGoals
                    ?<View style={{backgroundColor:C.amber+'22',borderRadius:8,
                      paddingHorizontal:8,paddingVertical:5,borderWidth:1,borderColor:C.amber+'44'}}>
                      <Text style={{color:C.amber,fontSize:11,fontWeight:'700'}}>In goals</Text>
                    </View>
                    :<TouchableOpacity onPress={()=>handleAddGoal(item,savingGoals.length===0)}
                      style={{backgroundColor:C.green900,borderRadius:8,
                        paddingHorizontal:10,paddingVertical:6,
                        borderWidth:1.5,borderColor:C.green700}}>
                      <Text style={{color:C.green400,fontWeight:'800',fontSize:12}}>+ Add</Text>
                    </TouchableOpacity>
                  }
                </View>
                {item.isAmazon&&(
                  <TouchableOpacity onPress={()=>setPinGate({
                      title:'View on Amazon',
                      subtitle:'A parent PIN is required before leaving the app.',
                      action:()=>openAmazon(item.searchQ,settings.affiliateTag),
                    })}
                    style={{marginTop:8,flexDirection:'row',alignItems:'center',gap:6,
                      backgroundColor:C.orange+'11',borderRadius:8,padding:7,
                      borderWidth:1,borderColor:C.orange+'33'}}>
                    <Text style={{fontSize:14}}>🛒</Text>
                    <Text style={{color:C.orange,fontSize:12,fontWeight:'600'}}>View on Amazon 🔑</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        <TouchableOpacity onPress={()=>setShowCustomModal(true)}
          style={{backgroundColor:C.green900,borderRadius:12,borderWidth:2,
            borderColor:C.green700,padding:16,alignItems:'center',gap:6,marginTop:4}}>
          <Text style={{fontSize:28}}>➕</Text>
          <Text style={{color:C.green400,fontWeight:'800',fontSize:14}}>
            Add any item from Amazon
          </Text>
          <Text style={{color:C.textMuted,fontSize:12,textAlign:'center'}}>
            Enter the name and price — we'll build the search link automatically
          </Text>
        </TouchableOpacity>

        {/* ── Cellie Vision: photo → goal ────────────────────────────── */}
        {pendingVisionGoal?(
          <View style={{backgroundColor:C.card,borderRadius:16,borderWidth:2,
            borderColor:C.blue+'66',padding:16,gap:12,marginTop:4}}>
            <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
              <Text style={{fontSize:28}}>{pendingVisionGoal.emoji}</Text>
              <View style={{flex:1}}>
                <Text style={{color:C.text,fontWeight:'800',fontSize:13}}>Cellie spotted this!</Text>
                <Text style={{color:C.textMuted,fontSize:11,marginTop:2}}>Edit if needed, then add to goals</Text>
              </View>
              <TouchableOpacity onPress={()=>{setPendingVisionGoal(null);setVisionEditName('');setVisionEditCost('');}}>
                <Text style={{color:C.textMuted,fontSize:22}}>×</Text>
              </TouchableOpacity>
            </View>
            {/* Cellie's verdict */}
            <View style={{backgroundColor:C.surface,borderRadius:10,padding:12,borderLeftWidth:3,borderLeftColor:C.blue}}>
              <Text style={{color:C.text,fontSize:12,lineHeight:18}}>{pendingVisionGoal.visionAnswer}</Text>
            </View>
            {/* Editable name */}
            <View style={{gap:4}}>
              <Text style={{color:C.textMuted,fontSize:11,fontWeight:'700'}}>ITEM NAME</Text>
              <TextInput value={visionEditName} onChangeText={setVisionEditName}
                style={{backgroundColor:C.surface,borderRadius:10,borderWidth:1.5,
                  borderColor:C.border,color:C.text,fontSize:14,
                  paddingHorizontal:12,paddingVertical:10}}
                placeholderTextColor={C.textFaint} placeholder="Item name"/>
            </View>
            {/* Editable cost */}
            <View style={{gap:4}}>
              <Text style={{color:C.textMuted,fontSize:11,fontWeight:'700'}}>CELLS NEEDED (= $ price)</Text>
              <TextInput value={visionEditCost} onChangeText={setVisionEditCost}
                keyboardType="number-pad"
                style={{backgroundColor:C.surface,borderRadius:10,borderWidth:1.5,
                  borderColor:C.border,color:C.text,fontSize:14,
                  paddingHorizontal:12,paddingVertical:10}}
                placeholderTextColor={C.textFaint} placeholder="e.g. 25"/>
            </View>
            <View style={{flexDirection:'row',gap:8}}>
              <TouchableOpacity onPress={()=>setShowVisionCamera(true)}
                style={{flex:1,backgroundColor:C.surface,borderRadius:10,
                  padding:12,alignItems:'center',borderWidth:1.5,borderColor:C.border}}>
                <Text style={{color:C.textMuted,fontWeight:'700',fontSize:13}}>📷 Retake</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={()=>{
                  const finalName=visionEditName.trim()||pendingVisionGoal.name;
                  const finalCost=Math.max(1,parseInt(visionEditCost,10)||pendingVisionGoal.cost);
                  handleAddGoal({
                    id:'vision_'+Date.now(),
                    name:finalName,emoji:pendingVisionGoal.emoji,
                    cost:finalCost,color:C.blue,
                    isAmazon:true,priceUsd:finalCost,searchQ:finalName,
                    fromVision:true,
                  },savingGoals.length===0);
                  setPendingVisionGoal(null);setVisionEditName('');setVisionEditCost('');
                }}
                style={{flex:2,backgroundColor:C.blue,borderRadius:10,
                  padding:12,alignItems:'center'}}>
                <Text style={{color:'#fff',fontWeight:'800',fontSize:14}}>Add to Goals 🎯</Text>
              </TouchableOpacity>
            </View>
          </View>
        ):(
          <TouchableOpacity onPress={()=>setShowVisionCamera(true)}
            disabled={visionLoading}
            style={{backgroundColor:C.green900,borderRadius:12,borderWidth:2,
              borderColor:C.blue+'66',padding:16,alignItems:'center',gap:6,marginTop:4}}>
            {visionLoading?(
              <ActivityIndicator color={C.blue} size="large"/>
            ):(
              <>
                <Text style={{fontSize:28}}>📷</Text>
                <Text style={{color:C.blue,fontWeight:'800',fontSize:14}}>
                  Take a photo to add a goal
                </Text>
                <Text style={{color:C.textMuted,fontSize:12,textAlign:'center'}}>
                  Point at anything — Cellie will identify it and set up your savings goal
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
      {/* Parent PIN gate — required before leaving app to Amazon */}
      <ParentPinGateModal
        visible={!!pinGate}
        title={pinGate?.title}
        subtitle={pinGate?.subtitle}
        onUnlock={()=>{pinGate?.action?.();setPinGate(null);}}
        onCancel={()=>setPinGate(null)}
      />
      <AddCustomItemModal
        visible={showCustomModal}
        cellToDollar={settings.cellToDollar||100}
        onClose={()=>setShowCustomModal(false)}
        onAdd={(item)=>handleAddGoal(item,savingGoals.length===0)}
      />
      {/* Cellie Vision camera modal */}
      {showVisionCamera&&(
        <Modal visible statusBarTranslucent animationType="slide">
          <CameraOverlay
            onCancel={()=>setShowVisionCamera(false)}
            onCapture={async(base64)=>{
              setShowVisionCamera(false);
              setVisionLoading(true);
              setPendingVisionGoal(null);
              try{
                const url=CELLIE_VISION_URL||CELLIE_ENDPOINT;
                const resp=await fetch(url,{
                  method:'POST',
                  headers:await cellieHeaders(),
                  body:JSON.stringify({
                    mode:'vision',image:base64,
                    question:'What is this item and is it worth saving for?',
                    kidName:kidName||'friend',kidAge:8,sessionCells:20,
                    goalSetup:true,
                  }),
                });
                const data=await resp.json();
                const answer=data.answer||'';
                const nameMatch=answer.match(/\*\*([^*\n]+)\*\*/);
                const priceMatch=answer.match(/·\s*[\$₹€£¥]?\s*(\d+(?:\.\d+)?)/)||answer.match(/[\$₹€£¥]\s*(\d+(?:\.\d+)?)/);
                const emojiMatch=answer.match(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u);
                const name=nameMatch?nameMatch[1].trim()
                  :answer.split('\n')[0].replace(/[\$₹€£¥][\d.]+/g,'').replace(/[*·]/g,'').trim().slice(0,40)||'My Goal';
                const price=priceMatch?parseFloat(priceMatch[1]):20;
                const emoji=emojiMatch?emojiMatch[0]:'🎯';
                const cost=Math.max(1,Math.round(price));
                setPendingVisionGoal({name,emoji,cost,visionAnswer:answer});
                setVisionEditName(name);
                setVisionEditCost(String(cost));
              }catch(e){
                console.warn('Shop vision error:',e);
              }finally{
                setVisionLoading(false);
              }
            }}
          />
        </Modal>
      )}
    </SafeAreaView>
  );
  }

  // ── My Goals view (default) ─────────────────────────────────────────────
  return(
    <SafeAreaView style={{flex:1,backgroundColor:C.bg}}>
      <View style={{flexDirection:'row',alignItems:'center',padding:16,paddingBottom:8,gap:8}}>
        <TouchableOpacity onPress={onBack}>
          <Text style={{color:C.green400,fontSize:16}}>← Game</Text>
        </TouchableOpacity>
        <Text style={[ss.h1,{flex:1}]}>My Goals 🎯</Text>
        <Text style={{color:C.green300,fontWeight:'700',fontSize:13}}>🧬 {count}</Text>
        <TouchableOpacity onPress={()=>setView('add')}
          style={{backgroundColor:C.green900,borderRadius:10,
            paddingHorizontal:12,paddingVertical:7,
            borderWidth:1.5,borderColor:C.green700,marginLeft:4}}>
          <Text style={{color:C.green400,fontWeight:'800',fontSize:13}}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{padding:16,gap:10,paddingBottom:32}}>

        {savingGoals.length===0&&(
          <TouchableOpacity onPress={()=>setView('add')}
            style={{backgroundColor:C.green900,borderRadius:16,
              borderWidth:2,borderColor:C.green700,borderStyle:'dashed',
              padding:32,alignItems:'center',gap:10}}>
            <Text style={{fontSize:48}}>🎯</Text>
            <Text style={{color:C.green400,fontWeight:'800',fontSize:16}}>
              Add your first goal!
            </Text>
            <Text style={{color:C.textMuted,fontSize:13,textAlign:'center'}}>
              Pick something to save for and watch your cells work toward it every round.
            </Text>
          </TouchableOpacity>
        )}

        {savingGoals.length>0&&(
          <View style={{gap:8}}>
            {savingGoals.map((goal,idx)=>{
              const isActive=idx===0;
              const ready=goal.isAmazon
                ? totalCellsEarned>=goal.cost   // Amazon: cumulative counts
                : count>=goal.cost;             // built-in: need live cells
              const prog=Math.min(totalCellsEarned/goal.cost,1);
              return(
                <TouchableOpacity key={goal.id}
                  onPress={()=>idx>0&&dispatch({type:'PROMOTE_GOAL',id:goal.id})}
                  activeOpacity={idx===0?1:0.7}
                  style={{backgroundColor:isActive?C.green900:C.card,
                    borderRadius:14,borderWidth:isActive?2:1.5,
                    borderColor:isActive?(ready?C.green500:C.green700):C.border,
                    padding:14,gap:10}}>

                  {/* Active indicator */}
                  {isActive&&(
                    <View style={{flexDirection:'row',alignItems:'center',gap:6,marginBottom:2}}>
                      <View style={{width:8,height:8,borderRadius:4,backgroundColor:C.green500}}/>
                      <Text style={{color:C.green400,fontWeight:'700',fontSize:11,letterSpacing:0.5}}>
                        SAVING FOR NOW
                      </Text>
                    </View>
                  )}
                  {!isActive&&(
                    <Text style={{color:C.textFaint,fontSize:10,marginBottom:2}}>
                      TAP TO MAKE ACTIVE
                    </Text>
                  )}

                  <View style={{flexDirection:'row',alignItems:'center',gap:12}}>
                    <GoalImage goal={goal} size={52} borderRadius={12}/>
                    <View style={{flex:1}}>
                      <Text style={{color:isActive?C.text:C.textMuted,
                        fontWeight:'800',fontSize:15}}>{goal.name}</Text>
                      <View style={{flexDirection:'row',alignItems:'center',gap:6,marginTop:2}}>
                        <Text style={{color:C.textMuted,fontSize:12}}>{goal.cost} cells needed</Text>
                      </View>
                      {/* Progress bar */}
                      <View style={{height:5,backgroundColor:C.surface,borderRadius:3,
                        overflow:'hidden',marginTop:6}}>
                        <View style={{height:5,backgroundColor:ready?C.green500:goal.color,
                          borderRadius:3,width:`${prog*100}%`}}/>
                      </View>
                      <View style={{flexDirection:'row',justifyContent:'space-between',marginTop:2}}>
                        <Text style={{fontSize:10,color:C.textMuted}}>{Math.min(totalCellsEarned,goal.cost)}/{goal.cost} cells saved</Text>
                        <Text style={{fontSize:10,color:ready?C.green400:C.textMuted}}>
                          {Math.round(prog*100)}%
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity onPress={()=>dispatch({type:'REMOVE_GOAL',id:goal.id})}
                      style={{padding:6}}>
                      <Text style={{color:C.textFaint,fontSize:18}}>×</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Ready to buy — CTA */}
                  {isActive&&ready&&(
                    <TouchableOpacity onPress={()=>handleGotIt(goal)}
                      style={{backgroundColor:C.green500,borderRadius:12,
                        padding:12,flexDirection:'row',alignItems:'center',
                        gap:10,marginTop:2}}>
                      <Text style={{fontSize:20}}>
                        {goal.isAmazon?'📣':'🎉'}
                      </Text>
                      <View style={{flex:1}}>
                        <Text style={{color:C.bg,fontWeight:'800',fontSize:15}}>
                          {goal.isAmazon?'Tell your parent!':'Buy it!'}
                        </Text>
                        <Text style={{color:C.bg+'cc',fontSize:11,marginTop:1}}>
                          {goal.isAmazon
                            ?'Share the Amazon link so they can buy it'
                            :'You have enough cells — go for it!'}
                        </Text>
                      </View>
                      <Text style={{color:C.bg,fontSize:18}}>→</Text>
                    </TouchableOpacity>
                  )}
                  {isActive&&!ready&&(
                    <View style={{backgroundColor:goal.color+'11',borderRadius:8,
                      padding:8,borderWidth:1,borderColor:goal.color+'33'}}>
                      <Text style={{color:goal.color,fontSize:12,textAlign:'center'}}>
                        {Math.max(0,goal.cost-totalCellsEarned)} more cells to earn! Keep saving 💪
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Completed goals */}
        {gotGoals.length>0&&(
          <View style={{marginTop:8}}>
            <Text style={[ss.caption,{color:C.textMuted,marginBottom:8}]}>
              GOT IT! ✓ ({gotGoals.length})
            </Text>
            {gotGoals.map(goal=>(
              <View key={goal.id} style={{backgroundColor:C.surface,borderRadius:10,
                borderWidth:1,borderColor:C.border,padding:12,marginBottom:6,
                flexDirection:'row',alignItems:'center',gap:10,opacity:0.7}}>
                <Text style={{fontSize:28}}>{goal.emoji}</Text>
                <View style={{flex:1}}>
                  <Text style={{color:C.textMuted,fontWeight:'700',fontSize:13,
                    textDecorationLine:'line-through'}}>{goal.name}</Text>
                  <Text style={{color:C.green400,fontSize:11,marginTop:2}}>✓ Saved for and got it!</Text>
                </View>
                <TouchableOpacity onPress={()=>dispatch({type:'REMOVE_GOAL',id:goal.id})}>
                  <Text style={{color:C.textFaint,fontSize:16}}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

// Legacy alias — keep KidShopScreen name so KidGameFlow still works
function KidShopScreen({onBack,kidName}){
  return <UnifiedShopScreen onBack={onBack} kidName={kidName}/>;
}


// ── Styles ─────────────────────────────────────────────────────────────────
const ss=StyleSheet.create({
  display:    {fontSize:32,fontWeight:'800',color:C.text,letterSpacing:-1},
  h1:         {fontSize:22,fontWeight:'800',color:C.text,letterSpacing:-0.5},
  caption:    {fontSize:10,letterSpacing:1.5,fontWeight:'700'},
  input:      {backgroundColor:C.card,borderRadius:10,borderWidth:1.5,borderColor:C.border,color:C.text,padding:14,fontSize:16,fontWeight:'600'},
  btn:        {borderRadius:10,paddingVertical:14,paddingHorizontal:20,alignItems:'center',borderWidth:1.5},
  btnText:    {fontSize:15,fontWeight:'700'},
  dish:       {borderWidth:2,backgroundColor:C.surface,overflow:'hidden',position:'relative'},
});

// ── Root ───────────────────────────────────────────────────────────────────
const APP={welcome:'welcome',login:'login',home:'home',start:'start',play:'play',dash:'dash'};

// ══════════════════════════════════════════════════════════════════════════
// 🎓 PARENT WELCOME — shown once on first launch, explains the game to parents
// ══════════════════════════════════════════════════════════════════════════
const WELCOME_CARDS = [
  {
    emoji: '🧬',
    color: C.green400,
    bg: '#051a0a',
    border: C.green700,
    title: 'Welcome to Money Cells',
    subtitle: 'A financial literacy game for kids ages 6–12',
    body: 'Money Cells teaches your child how saving and compound interest work  -  not through lectures, but through a living petri dish where every dollar is a cell.',
    highlight: 'No ads. No purchases required. Just genuine financial education.',
  },
  {
    emoji: '💰',
    color: C.amber,
    bg: '#1a1200',
    border: '#b45309',
    title: 'How the game works',
    subtitle: 'Every cell = $1',
    body: 'Your child grows a colony of living cells in a petri dish. Each round, saved cells split and multiply  -  that\'s compound interest made visible. Spent cells disappear forever - that\'s opportunity cost made real.',
    bullets: [
      'Save Save cells -> they multiply next round',
      '💸 Spend cells -> they\'re gone forever',
      '🎓 Fill the dish to 50 cells -> colony graduates!',
      '⭐ Resist Flash Deals -> earn bonus cells',
    ],
  },
  {
    emoji: '👨‍👩‍👧',
    color: C.blue,
    bg: '#0a1020',
    border: '#1e3a5f',
    title: 'Your role as a parent',
    subtitle: 'You set the stage  -  your child plays',
    body: 'You control session length, starting amount, and savings goals. After each session you\'ll see exactly what happened  -  how many cells were saved, spent, and split  -  plus conversation starters to extend the learning at home.',
    bullets: [
      '⏱️ Set session durations (10–60 minutes)',
      '🎯 Connect savings goals to real Amazon items',
      '📊 Read session insights in the Parent Dashboard',
      '💬 Get AI-powered conversation starters',
    ],
  },
  {
    emoji: '🚀',
    color: C.purple,
    bg: '#0f0a1a',
    border: '#4c1d95',
    title: 'What your child will learn',
    subtitle: 'Real skills, real analogies, real fun',
    body: 'Every mechanic maps to a real financial concept. Flash Deals teach impulse control. Resistance Meter builds delayed gratification. Colony graduation shows compound growth over time.',
    bullets: [
      '🧬 Compound interest = cells splitting and multiplying',
      '💡 Opportunity cost = spent cells that can\'t grow back',
      '🤔 Impulse control = resisting Flash Deals',
      '🎯 Goal-setting = saving toward a real wish item',
    ],
    cta: 'Set up your family and start playing!',
  },
];

function ParentWelcomeScreen({onDone}){
  const[card,setCard]=useState(0);
  const slideX=useRef(new Animated.Value(0)).current;
  const totalCards=WELCOME_CARDS.length;
  const isLast=card===totalCards-1;
  const current=WELCOME_CARDS[card];

  const goNext=()=>{
    if(isLast){onDone();return;}
    Animated.timing(slideX,{toValue:-20,duration:80,useNativeDriver:true}).start(()=>{
      setCard(c=>c+1);
      slideX.setValue(20);
      Animated.timing(slideX,{toValue:0,duration:150,useNativeDriver:true}).start();
    });
  };
  const goPrev=()=>{
    if(card===0)return;
    Animated.timing(slideX,{toValue:20,duration:80,useNativeDriver:true}).start(()=>{
      setCard(c=>c-1);
      slideX.setValue(-20);
      Animated.timing(slideX,{toValue:0,duration:150,useNativeDriver:true}).start();
    });
  };

  return(
    <SafeAreaView style={{flex:1,backgroundColor:current.bg}}>
      {/* Progress dots */}
      <View style={{flexDirection:'row',justifyContent:'center',gap:8,paddingTop:16,paddingBottom:8}}>
        {WELCOME_CARDS.map((_,i)=>(
          <View key={i} style={{width:i===card?24:8,height:8,borderRadius:4,
            backgroundColor:i===card?current.color:current.color+'33',
            transition:'width 0.2s'}}/>
        ))}
      </View>

      <ScrollView contentContainerStyle={{padding:24,gap:20,flexGrow:1}} showsVerticalScrollIndicator={false}>
        <Animated.View style={{transform:[{translateX:slideX}],gap:20}}>
          {/* Emoji hero */}
          <View style={{alignItems:'center',paddingVertical:8}}>
            <View style={{width:100,height:100,borderRadius:50,
              backgroundColor:current.color+'22',borderWidth:2,borderColor:current.color+'55',
              alignItems:'center',justifyContent:'center'}}>
              <Text style={{fontSize:52}}>{current.emoji}</Text>
            </View>
          </View>

          {/* Title block */}
          <View style={{gap:6}}>
            <Text style={{color:current.color,fontWeight:'800',fontSize:24,
              textAlign:'center',letterSpacing:-0.5}}>
              {current.title}
            </Text>
            <Text style={{color:current.color+'99',fontSize:14,textAlign:'center',
              fontWeight:'600'}}>
              {current.subtitle}
            </Text>
          </View>

          {/* Body */}
          <View style={{backgroundColor:current.color+'11',borderRadius:14,
            borderWidth:1,borderColor:current.border,padding:18}}>
            <Text style={{color:'#e2e8f0',fontSize:15,lineHeight:24,textAlign:'center'}}>
              {current.body}
            </Text>
          </View>

          {/* Bullets */}
          {current.bullets&&(
            <View style={{gap:10}}>
              {current.bullets.map((b,i)=>(
                <View key={i} style={{flexDirection:'row',alignItems:'flex-start',
                  gap:10,backgroundColor:current.color+'0d',borderRadius:10,
                  borderWidth:1,borderColor:current.color+'22',padding:12}}>
                  <Text style={{fontSize:16,lineHeight:22}}>{b.slice(0,2)}</Text>
                  <Text style={{color:'#cbd5e1',fontSize:14,lineHeight:22,flex:1}}>
                    {b.slice(2).trim()}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Highlight pill */}
          {current.highlight&&(
            <View style={{backgroundColor:C.green900,borderRadius:20,
              borderWidth:1.5,borderColor:C.green700,padding:14,alignItems:'center'}}>
              <Text style={{color:C.green300,fontWeight:'700',fontSize:13,
                textAlign:'center'}}>
                {current.highlight}
              </Text>
            </View>
          )}

          {/* CTA text on last card */}
          {current.cta&&(
            <Text style={{color:current.color,fontWeight:'800',fontSize:16,
              textAlign:'center'}}>
              {current.cta}
            </Text>
          )}
        </Animated.View>
      </ScrollView>

      {/* Navigation */}
      <View style={{flexDirection:'row',gap:12,padding:20,paddingTop:8}}>
        {card>0&&(
          <TouchableOpacity onPress={goPrev}
            style={{flex:1,backgroundColor:current.color+'22',borderRadius:14,
              padding:16,alignItems:'center',borderWidth:1,borderColor:current.color+'44'}}>
            <Text style={{color:current.color,fontWeight:'700',fontSize:15}}>← Back</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={goNext}
          style={{flex:2,backgroundColor:current.color,borderRadius:14,
            padding:16,alignItems:'center',
            shadowColor:current.color,shadowOffset:{width:0,height:4},
            shadowOpacity:0.4,shadowRadius:12}}>
          <Text style={{color:current.bg||'#0a0a0a',fontWeight:'800',fontSize:16}}>
            {isLast?'Set up my family →':'Next →'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Skip link */}
      {!isLast&&(
        <TouchableOpacity onPress={onDone}
          style={{alignItems:'center',paddingBottom:12,paddingTop:0}}>
          <Text style={{color:current.color+'66',fontSize:13}}>Skip intro</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}


// ── Set New Password Screen — shown after tapping reset link in email ──────
function SetNewPasswordScreen({onDone}){
  const{dispatch}=useApp();
  const[password,setPassword]=useState('');
  const[confirm,setConfirm]=useState('');
  const[loading,setLoading]=useState(false);
  const[error,setError]=useState('');
  // step: 'password' → 'pin' → 'pinConfirm' → 'done'
  const[step,setStep]=useState('password');
  const[newPin,setNewPin]=useState('');
  const[pinConfirm,setPinConfirm]=useState('');
  const[pinError,setPinError]=useState('');

  const handleSet=async()=>{
    if(!password||password.length<6){setError('Password must be at least 6 characters.');return;}
    if(password!==confirm){setError('Passwords do not match.');return;}
    setLoading(true);setError('');
    try{
      const{error:err}=await supabase.auth.updateUser({password});
      if(err)throw err;
      // Move to PIN reset step — sign out happens after PIN is optionally set
      setStep('pin');
    }catch(e){
      setError(e.message||'Could not update password. Try again.');
    }
    setLoading(false);
  };

  const handleSkipPin=async()=>{
    await supabase.auth.signOut();
    dispatch({type:'RESET_AUTH_STATE'});
    onDone();
  };

  return(
    <SafeAreaView style={{flex:1,backgroundColor:C.bg,justifyContent:'center',padding:24}}>
      <View style={{backgroundColor:C.card,borderRadius:16,borderWidth:1.5,
        borderColor:C.border,padding:24,gap:16}}>

        {/* Header */}
        <View style={{alignItems:'center',gap:8}}>
          <Text style={{fontSize:48}}>
            {step==='done'?'🎉':step==='pin'||step==='pinConfirm'?'🔒':'🔑'}
          </Text>
          <Text style={{color:C.green400,fontWeight:'800',fontSize:22,textAlign:'center'}}>
            {step==='done'?'All done!'
              :step==='pin'?'Reset your PIN too?'
              :step==='pinConfirm'?'Confirm new PIN'
              :'Set new password'}
          </Text>
          <Text style={{color:C.textMuted,fontSize:13,textAlign:'center'}}>
            {step==='done'
              ?'Sign in with your new password to continue.'
              :step==='pin'
              ?'Since you\'re here, set a new PIN too — or skip.'
              :step==='pinConfirm'
              ?'Enter the same PIN again to confirm.'
              :'Choose a new password for your Money Cells account'}
          </Text>
        </View>

        {/* ── Step: set password ── */}
        {step==='password'&&(
          <>
            <View style={{gap:6}}>
              <Text style={{color:C.textMuted,fontSize:12,marginLeft:4}}>New password</Text>
              <TextInput
                value={password} onChangeText={setPassword}
                placeholder="At least 6 characters"
                placeholderTextColor={C.textFaint}
                secureTextEntry
                style={{backgroundColor:C.bg,borderRadius:10,borderWidth:1.5,
                  borderColor:C.border,padding:14,color:C.text,fontSize:15}}
              />
            </View>
            <View style={{gap:6}}>
              <Text style={{color:C.textMuted,fontSize:12,marginLeft:4}}>Confirm password</Text>
              <TextInput
                value={confirm} onChangeText={setConfirm}
                placeholder="Type it again"
                placeholderTextColor={C.textFaint}
                secureTextEntry
                style={{backgroundColor:C.bg,borderRadius:10,borderWidth:1.5,
                  borderColor:confirm&&confirm!==password?C.red:C.border,
                  padding:14,color:C.text,fontSize:15}}
              />
              {confirm&&confirm!==password&&(
                <Text style={{color:C.red,fontSize:11,marginLeft:4}}>Passwords do not match</Text>
              )}
            </View>
            {!!error&&<Text style={{color:C.red,fontSize:13,textAlign:'center'}}>{error}</Text>}
            <TouchableOpacity onPress={handleSet} disabled={loading}
              style={{backgroundColor:loading?C.surface:C.green500,
                borderRadius:12,padding:16,alignItems:'center',opacity:loading?0.6:1}}>
              <Text style={{color:loading?C.textMuted:C.bg,fontWeight:'800',fontSize:16}}>
                {loading?'Updating...':'Update password →'}
              </Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── Step: set new PIN ── */}
        {step==='pin'&&(
          <>
            <PinInput label="" value={newPin} onChange={v=>{
              setPinError('');setNewPin(v);
              if(v.length===4){setStep('pinConfirm');}
            }}/>
            {!!pinError&&<Text style={{color:C.red,fontSize:12,textAlign:'center'}}>{pinError}</Text>}
            <TouchableOpacity onPress={handleSkipPin}
              style={{alignItems:'center',paddingVertical:8}}>
              <Text style={{color:C.textMuted,fontSize:13}}>Skip — keep my existing PIN</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── Step: confirm new PIN ── */}
        {step==='pinConfirm'&&(
          <>
            <PinInput label="" value={pinConfirm} onChange={async v=>{
              setPinError('');setPinConfirm(v);
              if(v.length===4){
                if(v===newPin){
                  dispatch({type:'SET_PIN',pin:newPin});
                  setStep('done');
                  await supabase.auth.signOut();
                  setTimeout(()=>{dispatch({type:'RESET_AUTH_STATE'});onDone();},2000);
                }else{
                  setPinError("PINs don't match. Try again.");
                  setTimeout(()=>setPinConfirm(''),300);
                }
              }
            }}/>
            {!!pinError&&<Text style={{color:C.red,fontSize:12,textAlign:'center'}}>{pinError}</Text>}
            <TouchableOpacity onPress={()=>{setPinError('');setPinConfirm('');setStep('pin');setNewPin('');}}
              style={{alignItems:'center',paddingVertical:8}}>
              <Text style={{color:C.textMuted,fontSize:13}}>← Back</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── Step: done ── */}
        {step==='done'&&(
          <Text style={{color:C.textMuted,fontSize:13,textAlign:'center'}}>
            Signing you out… sign in with your new password.
          </Text>
        )}

      </View>
    </SafeAreaView>
  );
}


function RootApp(){
  const{state,dispatch}=useApp();
  const[screen,setScreen]=useState(APP.login);const[kidId,setKidId]=useState(null);const[duration,setDuration]=useState(10*60);
  useEffect(()=>{
    if(!state._loaded)return; // wait for AsyncStorage hydration
    if(!state.hasSeenParentWelcome){setScreen(APP.welcome);}
    else if(state.loggedIn){setScreen(APP.home);}
    else{setScreen(APP.login);}
  },[state.loggedIn,state.hasSeenParentWelcome,state._loaded]);// eslint-disable-line react-hooks/exhaustive-deps

  // Deep link handler — kept for future use (Amazon, other schemes)
  useEffect(()=>{
    const sub=Linking.addEventListener('url',()=>{});
    return()=>sub.remove();
  },[]);

  // Show splash while loading from storage (prevents flash of login screen)
  if(!state._loaded)return(
    <SafeAreaView style={{flex:1,backgroundColor:C.bg,alignItems:'center',justifyContent:'center',gap:16}}>
      <Text style={{fontSize:64}}>🧬</Text>
      <Text style={{color:C.green400,fontWeight:'800',fontSize:22}}>Money Cells</Text>
      <Text style={{color:C.textMuted,fontSize:13}}>Loading your colony...</Text>
    </SafeAreaView>
  );
  // Password reset takes priority over everything else
  if(state.pendingPasswordReset)return(
    <SetNewPasswordScreen onDone={()=>setScreen(APP.login)}/>
  );
  if(screen===APP.welcome)return<ParentWelcomeScreen onDone={()=>{dispatch({type:'SET_PARENT_WELCOME_SEEN'});setScreen(APP.login);}}/>;
  if(screen===APP.login) return<ParentLoginScreen/>;
  if(screen===APP.home)  return<ParentHomeScreen onStartSession={id=>{setKidId(id);setScreen(APP.start);}} onDashboard={()=>setScreen(APP.dash)}/>;
  if(screen===APP.start) return<StartSessionScreen kidId={kidId} onConfirm={d=>{setDuration(d);setScreen(APP.play);}} onBack={()=>setScreen(APP.home)}/>;
  if(screen===APP.dash)  return<ParentDashboardScreen onBack={()=>setScreen(APP.home)}/>;
  if(screen===APP.play&&kidId) return(<GameProvider kidId={kidId}><KidGameFlow kidId={kidId} sessionDuration={duration} onSessionEnd={(finalGame)=>{
          const userId=state.supabaseUser?.id;
          if(userId&&finalGame){
            const kid=state.parent?.kids?.find(k=>k.id===kidId);
            logSession(userId,{
              kidName:kid?.name||'Kid',kidAge:kid?.age||8,
              durationSecs:duration,
              totalRounds:finalGame.totalRounds,
              lifetimeCellsGained:finalGame.lifetimeCellsGained,
              totalSpent:finalGame.totalSpent,
              resistBonusThisGame:finalGame.resistBonusThisGame,
              colonyNumber:finalGame.colonyNumber,
              rate:finalGame.rate,phase:finalGame.phase,
            });
          }
          setScreen(APP.home);setKidId(null);
        }}/></GameProvider>);
  return<ParentLoginScreen/>;
}

class ErrorBoundary extends React.Component {
  constructor(props){super(props);this.state={error:null};}
  static getDerivedStateFromError(error){return{error};}
  componentDidCatch(error,info){console.error('CRASH:',error?.message,'\n',info?.componentStack?.split('\n').slice(0,8).join('\n'));}
  render(){
    if(this.state.error){
      return(
        <SafeAreaView style={{flex:1,backgroundColor:C.bg,padding:24,justifyContent:'center'}}>
          <Text style={{color:'#ef4444',fontWeight:'800',fontSize:18,marginBottom:16}}>💥 App Crashed</Text>
          <Text style={{color:'#fca5a5',fontSize:13,fontFamily:'monospace',lineHeight:20,marginBottom:16}}>
            {this.state.error?.message}
          </Text>
          <Text style={{color:'#4d7c5f',fontSize:11,fontFamily:'monospace',lineHeight:18}}>
            {this.state.error?.stack?.split('\n').slice(0,10).join('\n')}
          </Text>
        </SafeAreaView>
      );
    }
    return this.props.children;
  }
}

export default function App(){return<ErrorBoundary><AppProvider><RootApp/></AppProvider></ErrorBoundary>;}
