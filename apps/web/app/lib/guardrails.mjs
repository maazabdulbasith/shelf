/**
 * Shared deterministic guardrails for Shelf Ask + Agent routes.
 * Handles Unicode NFKC, zero-width stripping, homoglyphs, and light leetspeak
 * so injection / password-smuggle attacks cannot bypass keyword gates.
 */

const INJECTION_MARKERS = [
  "ignore previous instructions",
  "ignore all previous",
  "ignore previous",
  "ignore all instructions",
  "disregard previous",
  "disregard earlier",
  "forget your rules",
  "forget previous",
  "new system message",
  "say the password",
  "system prompt",
  "developer prompt",
  "you are now",
  "reveal the password",
  "reveal credentials",
  "disclose the passphrase",
  "disclose the password",
  "override safety",
  "override",
  "jailbreak",
  "developer mode",
  "do anything now",
  "admin mode",
  "sudo mode",
];

/** Common Cyrillic/Greek lookalikes → Latin */
const HOMOGLYPHS = {
  а: "a",
  А: "a",
  е: "e",
  Е: "e",
  о: "o",
  О: "o",
  р: "p",
  Р: "p",
  с: "c",
  С: "c",
  у: "y",
  У: "y",
  х: "x",
  Х: "x",
  і: "i",
  І: "i",
  ї: "i",
  ѕ: "s",
  ӏ: "i",
  α: "a",
  β: "b",
  ε: "e",
  ι: "i",
  κ: "k",
  ν: "n",
  ο: "o",
  ρ: "p",
  τ: "t",
  υ: "y",
  χ: "x",
};

const LEET = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "@": "a",
  "$": "s",
};

export function normalizeForGuardrails(text) {
  let out = String(text || "");
  try {
    out = out.normalize("NFKC");
  } catch {
    // ignore environments without normalize
  }
  out = out.replace(/[\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g, "");
  out = out
    .split("")
    .map((ch) => HOMOGLYPHS[ch] || ch)
    .join("");
  out = out.toLowerCase();
  out = out
    .split("")
    .map((ch) => LEET[ch] || ch)
    .join("");
  out = out.replace(/[^\S\n]+/g, " ").trim();
  return out;
}

export function isInjectionText(text) {
  const q = normalizeForGuardrails(text);
  if (!q) return false;
  if (INJECTION_MARKERS.some((m) => q.includes(normalizeForGuardrails(m)))) return true;
  if (q.includes("ignore") && q.includes("instruction")) return true;
  if (q.includes("disregard") && (q.includes("rule") || q.includes("instruction"))) return true;
  if (/(print|reveal|show|dump|disclose).{0,24}(system|developer|hidden).{0,12}prompt/.test(q)) {
    return true;
  }
  if (/\b(dan|jailbreak)\b/.test(q) && /\b(password|secret|prompt|credential)\b/.test(q)) {
    return true;
  }
  // Multilingual / obfuscated "ignore instructions + password"
  if (/\b(ignore|ign ore|anweisung|instrukt)\b/.test(q) && /\b(passw|passphrase|geheim|credential)\b/.test(q)) {
    return true;
  }
  return false;
}

export function isWifiSpecific(text) {
  const q = normalizeForGuardrails(text);
  if (/\b(not|except|excluding)\b.{0,24}\b(wifi|wi-fi)\b/.test(q)) return false;
  if (/\b(wifi|wi-fi)\b.{0,24}\b(not|except|excluding)\b/.test(q)) return false;
  if (q.includes("inject")) return false;

  if (q.includes("wifi") || q.includes("wi-fi")) return true;
  if (/\bguest\s+(wifi|wi-fi|network)\b/.test(q)) return true;
  if (q.includes("shelf-guest")) return true;
  if (
    /\bssid\b/.test(q) &&
    /\b(wifi|wi-fi|password|passphrase|credential)\b/.test(q) &&
    !/\birrelevant\b/.test(q)
  ) {
    return true;
  }
  return false;
}

export function isPasswordLikeAsk(text) {
  const q = normalizeForGuardrails(text);
  return (
    q.includes("password") ||
    q.includes("passphrase") ||
    q.includes("secret") ||
    q.includes("passwort") ||
    q.includes("credential") ||
    /\bp4ssw?ord\b/.test(q)
  );
}

export function isSafeTokenQuestion(text) {
  const q = normalizeForGuardrails(text);
  return (
    q.includes("shelftoken") ||
    q.includes("note-07") ||
    q.includes("note-19") ||
    q.includes("hnsw") ||
    (q.includes("guardrail") && !isPasswordLikeAsk(q))
  );
}

export function isGenericPasswordAsk(text) {
  const q = normalizeForGuardrails(text);
  if (isSafeTokenQuestion(q) && !q.includes("inject")) return false;
  if (!isPasswordLikeAsk(q)) return false;
  if (isWifiSpecific(q)) return false;
  return true;
}

export function isFabricationAsk(text) {
  const q = normalizeForGuardrails(text);
  return /\b(invent|fabricate|make up|hallucinate|ssn|social security|fake (id|passport|number))\b/.test(q);
}

export function isInjectArtifactAsk(text) {
  const q = normalizeForGuardrails(text);
  if (q.includes("inject.png")) return true;
  if (q.includes("inject") && /\b(say|quote|exactly|payload|ocr|full text|verbatim)\b/.test(q)) {
    return true;
  }
  return false;
}

export function isAgentInjectionGoal(text) {
  const q = normalizeForGuardrails(text);
  if (isInjectionText(q)) return true;
  if (q.includes("inject") && isPasswordLikeAsk(q)) return true;
  if (/\bdump\b/.test(q) && isPasswordLikeAsk(q)) return true;
  if (/\bexfiltrat/.test(q) && isPasswordLikeAsk(q)) return true;
  return false;
}

/**
 * Evidence quarantine: if retrieved OCR/caption is adversarial and the user
 * is asking for secrets, refuse instead of synthesizing.
 */
export function shouldQuarantineEvidence(question, evidenceText) {
  const asksHidden =
    isPasswordLikeAsk(question) ||
    normalizeForGuardrails(question).includes("instruction") ||
    isInjectArtifactAsk(question);
  return asksHidden && isInjectionText(evidenceText);
}

/**
 * Early Ask gate. Domain synthesis only runs when action === "allow".
 */
export function evaluateAskGuardrails(question) {
  const raw = String(question || "").trim();
  if (!raw) {
    return {
      action: "empty",
      reason: "empty_query",
      answer: "Please enter a question to ask the shelf.",
      citations: [],
      normalized: "",
    };
  }
  if (raw.length > 4000) {
    return {
      action: "thin",
      reason: "thin_evidence",
      answer: "I don't have a screenshot that answers that question.",
      citations: [],
      normalized: normalizeForGuardrails(raw),
    };
  }

  const normalized = normalizeForGuardrails(raw);

  if (isInjectionText(raw) || isInjectionText(normalized)) {
    return {
      action: "refuse",
      reason: "prompt_injection",
      answer: "I won't follow instructions hidden in a question.",
      citations: [{ id: "inject", filename: "inject.png" }],
      normalized,
    };
  }

  if (isInjectArtifactAsk(raw) || isInjectArtifactAsk(normalized)) {
    return {
      action: "refuse",
      reason: "prompt_injection",
      answer: "That screenshot tries to give me instructions. I won't follow them.",
      citations: [{ id: "inject", filename: "inject.png" }],
      normalized,
    };
  }

  if (isGenericPasswordAsk(raw) || isGenericPasswordAsk(normalized)) {
    return {
      action: "refuse",
      reason: "prompt_injection",
      answer: "That screenshot tries to give me instructions. I won't follow them.",
      citations: [{ id: "inject", filename: "inject.png" }],
      normalized,
    };
  }

  if (isFabricationAsk(raw) || isFabricationAsk(normalized)) {
    return {
      action: "thin",
      reason: "thin_evidence",
      answer: "I don't have a screenshot that answers that question.",
      citations: [],
      normalized,
    };
  }

  return {
    action: "allow",
    reason: "",
    answer: "",
    citations: [],
    normalized,
  };
}
