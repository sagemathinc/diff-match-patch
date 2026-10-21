// Shared by the comparison scripts: a deterministic random corpus.

// mulberry32.
function rng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function text(random, n, alphabet) {
  let s = "";
  for (let i = 0; i < n; i++)
    s += alphabet[Math.floor(random() * alphabet.length)];
  return s;
}

// Up to `edits` random replacements, insertions and deletions.
function edit(random, s, alphabet, edits = 30) {
  for (let e = Math.floor(random() * edits); e >= 0; e--) {
    const at = Math.floor(random() * (s.length + 1));
    s =
      s.slice(0, at) +
      text(random, Math.floor(random() * 12), alphabet) +
      s.slice(at + Math.floor(random() * 12));
  }
  return s;
}

module.exports = { rng, text, edit };
