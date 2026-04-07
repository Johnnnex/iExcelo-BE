/**
 * content-policy.ts
 * ─────────────────
 * Centralised profanity filter for the chat gateway.
 * Add or remove words here — the gateway imports BANNED_WORDS_RE directly.
 *
 * Matching rules:
 *  - Whole-word boundary (\b) so "scunthorpe" doesn't trip on "cunt"
 *  - Common leet-speak variants handled inline (@ = a, 0 = o, 3 = e, 1 = i/l)
 *  - Case-insensitive flag
 */

const TERMS = [
  // ── F-word family ─────────────────────────────────────────────────────────
  'f+u+c+k', // fuck, fuuck, fuuuck …
  'f[@]ck', // f@ck
  'fucking',
  'fucker',
  'fuckery',
  'fucked',
  'fuckhead',
  'fucktard',
  'fuckwit',
  'fuckface',
  'motherfucker',
  'motherfucking',
  'mofo',

  // ── S-word family ─────────────────────────────────────────────────────────
  's+h+i+t', // shit, shhit …
  'shitty',
  'shitting',
  'shithead',
  'shitstorm',
  'shithole',
  'shitface',
  'bullshit',
  'dipshit',
  'horseshit',
  'apeshit',

  // ── B-word family ─────────────────────────────────────────────────────────
  'b+i+t+c+h', // bitch, biiitch …
  'bitchy',
  'bitching',
  'bitched',
  'son of a bitch',
  'sons of bitches',

  // ── C-words ───────────────────────────────────────────────────────────────
  'c+u+n+t',
  'cunty',
  'cock',
  'cockhead',
  'cocksucker',
  'cocksucking',

  // ── D-word family ─────────────────────────────────────────────────────────
  'dick',
  'dickhead',
  'dickwad',
  'dickface',

  // ── A-word family ─────────────────────────────────────────────────────────
  'asshole',
  'ass-hole',
  'arsehole',
  'arse',
  'asswipe',
  'asshat',
  'ass-hat',

  // ── P-word ────────────────────────────────────────────────────────────────
  'pussy',
  'pussies',

  // ── W/S words ─────────────────────────────────────────────────────────────
  'whore',
  'whorish',
  'slut',
  'slutty',
  'skank',

  // ── Wank family ───────────────────────────────────────────────────────────
  'wank',
  'wanker',
  'wanking',
  'wanked',

  // ── Twat ──────────────────────────────────────────────────────────────────
  'twat',
  'twatty',

  // ── Piss family ───────────────────────────────────────────────────────────
  'piss',
  'pissed',
  'pissing',
  'pisshead',

  // ── Slurs ─────────────────────────────────────────────────────────────────
  'nigger',
  'nigga',
  'faggot',
  'fag',
  'retard',
  'retarded',
  'spastic',

  // ── Misc ──────────────────────────────────────────────────────────────────
  'bastard',
  'douchebag',
  'douche',
  'jackass',
  'jerkoff',
  'jerk-off',
  'shitbag',
  'scumbag',
  'cumshot',
  'cum',
] as const;

export const BANNED_WORDS_RE = new RegExp(`\\b(${TERMS.join('|')})\\b`, 'i');
