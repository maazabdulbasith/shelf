// High-Performance Semantic & Keyword Search Engine for Shelf

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "in", "on", "at", "to", "for", "of", "with",
  "by", "from", "up", "about", "into", "over", "after", "is", "are", "was",
  "were", "be", "been", "being", "have", "has", "had", "do", "does", "did",
  "photo", "photos", "picture", "pictures", "image", "images", "screenshot",
  "screenshots", "shot", "shots", "ss", "pic", "pics", "show", "me", "my",
  "find", "look", "get", "all", "some", "this", "that"
]);

const SYNONYMS = {
  family: [
    "family", "relatives", "parents", "children", "kids", "mom", "dad",
    "mother", "father", "son", "daughter", "brother", "sister", "siblings",
    "grandparents", "grandma", "grandpa", "household", "reunion", "home"
  ],
  group: [
    "group", "people", "friends", "crowd", "team", "colleagues", "gathering",
    "together", "party", "crew", "squad", "trio", "duo", "bunch", "celebration"
  ],
  people: [
    "people", "person", "human", "face", "portrait", "selfie", "crowd",
    "man", "woman", "boy", "girl", "guys", "friends"
  ],
  food: [
    "food", "dinner", "lunch", "breakfast", "meal", "restaurant", "cafe",
    "dish", "plate", "eating", "cooking", "snack", "coffee", "tea", "drink",
    "burger", "pizza", "dessert", "cake", "salad", "tasty", "menu"
  ],
  receipt: [
    "receipt", "bill", "invoice", "payment", "transaction", "order",
    "purchase", "expense", "checkout", "total", "price", "cost", "tax",
    "amount", "paid", "slip", "store"
  ],
  code: [
    "code", "programming", "coding", "developer", "terminal", "github",
    "git", "python", "javascript", "typescript", "react", "html", "css",
    "function", "bug", "script", "vscode", "ide", "syntax", "api"
  ],
  dashboard: [
    "dashboard", "analytics", "stats", "statistics", "metrics", "chart",
    "graph", "sales", "revenue", "panel", "ui", "admin", "interface", "crm"
  ],
  chat: [
    "chat", "message", "messages", "whatsapp", "slack", "discord", "text",
    "conversation", "dm", "inbox", "reply", "telegram", "sms"
  ],
  nature: [
    "nature", "landscape", "outdoors", "sky", "mountain", "mountains",
    "beach", "sea", "ocean", "water", "lake", "river", "trees", "forest",
    "sunset", "sunrise", "green", "park", "garden", "scenery"
  ],
  car: [
    "car", "cars", "vehicle", "vehicles", "automobile", "drive", "driving",
    "road", "traffic", "parking", "auto", "ride", "truck", "bike"
  ],
  pet: [
    "pet", "pets", "dog", "dogs", "cat", "cats", "puppy", "kitten",
    "animal", "animals", "doggo", "bark", "kitty"
  ],
  document: [
    "document", "doc", "pdf", "contract", "letter", "agreement", "form",
    "paper", "id", "passport", "license", "card", "text", "file"
  ],
  ticket: [
    "ticket", "tickets", "flight", "boarding", "train", "bus", "movie",
    "cinema", "concert", "event", "booking", "pass", "airline", "travel"
  ],
  meeting: [
    "meeting", "zoom", "teams", "meet", "call", "conference", "presentation",
    "slides", "webinar", "discussion"
  ],
};

// Expand a term with its known semantic synonyms
function expandSynonyms(term) {
  const t = term.toLowerCase().trim();
  const set = new Set([t]);

  // Direct match in synonyms
  for (const [key, list] of Object.entries(SYNONYMS)) {
    if (key === t || list.includes(t)) {
      for (const synonym of list) {
        set.add(synonym);
      }
    }
  }

  // Singular / Plural simple stemming
  if (t.endsWith("s") && t.length > 3) set.add(t.slice(0, -1));
  else if (t.endsWith("es") && t.length > 4) set.add(t.slice(0, -2));
  else set.add(`${t}s`);

  return Array.from(set);
}

// Tokenize natural query into search tokens
export function tokenizeQuery(query) {
  if (!query) return [];
  const rawWords = query
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  // If query is short, keep all words
  if (rawWords.length <= 2) {
    return rawWords;
  }

  // Otherwise, filter stop words
  const meaningful = rawWords.filter((w) => !STOP_WORDS.has(w));
  return meaningful.length > 0 ? meaningful : rawWords;
}

// Score a shot against a set of query tokens with multi-field weighting
export function scoreShot(shot, query) {
  const qClean = query.trim().toLowerCase();
  if (!qClean) return 1.0;

  let totalScore = 0.0;
  const tokens = tokenizeQuery(qClean);
  if (!tokens.length) return 0.0;

  // Pre-normalized shot fields
  const title = (shot.title || "").toLowerCase();
  const filename = (shot.filename || "").toLowerCase();
  const caption = (shot.caption || "").toLowerCase();
  const text = (shot.text || "").toLowerCase();
  const kind = (shot.kind || shot.status || "").toLowerCase();
  const tags = Array.isArray(shot.tags)
    ? shot.tags.map((t) => String(t).toLowerCase())
    : [];

  // Exact phrase match bonus across caption, filename, or text
  if (filename.includes(qClean) || title.includes(qClean)) {
    totalScore += 8.0;
  }
  if (caption.includes(qClean)) {
    totalScore += 6.0;
  }
  if (text.includes(qClean)) {
    totalScore += 5.0;
  }

  // Token-by-token evaluation with semantic expansion
  let matchedTokensCount = 0;

  for (const token of tokens) {
    let tokenScore = 0.0;
    const expandedTerms = expandSynonyms(token);

    for (const term of expandedTerms) {
      // 1. Kind match
      if (kind === term || kind.includes(term)) {
        tokenScore = Math.max(tokenScore, 4.5);
      }

      // 2. Tags match
      for (const tag of tags) {
        if (tag === term) {
          tokenScore = Math.max(tokenScore, 4.0);
        } else if (tag.includes(term) || term.includes(tag)) {
          tokenScore = Math.max(tokenScore, 2.5);
        }
      }

      // 3. Caption match
      if (caption.includes(term)) {
        tokenScore = Math.max(tokenScore, 3.0);
      }

      // 4. Title / Filename match
      if (title.includes(term) || filename.includes(term)) {
        tokenScore = Math.max(tokenScore, 3.5);
      }

      // 5. Extracted OCR text match
      if (text.includes(term)) {
        tokenScore = Math.max(tokenScore, 2.0);
      }
    }

    if (tokenScore > 0) {
      matchedTokensCount++;
      totalScore += tokenScore;
    }
  }

  // Bonus if all tokens in the query matched
  if (tokens.length > 1 && matchedTokensCount === tokens.length) {
    totalScore += 5.0; // Co-occurrence boost (e.g. "family" + "beach")
  }

  return totalScore;
}

// Perform intelligent multi-attribute search and return ranked results
export function searchShots(shots, query) {
  if (!query || !query.trim()) {
    return shots;
  }

  const scored = [];
  for (const shot of shots) {
    const score = scoreShot(shot, query);
    if (score > 0) {
      scored.push({ shot, score });
    }
  }

  // Sort descending by relevance score
  scored.sort((a, b) => b.score - a.score);

  return scored.map((item) => item.shot);
}
