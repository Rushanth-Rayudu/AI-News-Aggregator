/**
 * Mirrored from server/feeds/registry.json (read-only copy for the landing
 * page so the source network renders even when the API is unreachable).
 * The live dashboard and the landing page both prefer /api/sources at
 * runtime; this static list is a truthful fallback, not invented data.
 */
export const SOURCE_REGISTRY = [
  {
    "name": "OpenAI Blog",
    "type": "primary",
    "tier": 1,
    "enabled": true,
    "category": "AI Companies"
  },
  {
    "name": "Google DeepMind Blog",
    "type": "primary",
    "tier": 1,
    "enabled": true,
    "category": "AI Research"
  },
  {
    "name": "Anthropic News",
    "type": "primary",
    "tier": 1,
    "enabled": false,
    "category": "AI Safety"
  },
  {
    "name": "Meta AI Blog",
    "type": "primary",
    "tier": 1,
    "enabled": true,
    "category": "AI Research"
  },
  {
    "name": "Hugging Face Blog",
    "type": "primary",
    "tier": 1,
    "enabled": true,
    "category": "Open Source AI"
  },
  {
    "name": "Microsoft Research Blog",
    "type": "primary",
    "tier": 1,
    "enabled": true,
    "category": "AI Research"
  },
  {
    "name": "NVIDIA AI Blog",
    "type": "primary",
    "tier": 1,
    "enabled": true,
    "category": "AI Chips / Hardware"
  },
  {
    "name": "MIT News - AI",
    "type": "research",
    "tier": 2,
    "enabled": true,
    "category": "AI Research"
  },
  {
    "name": "arXiv AI (cs.AI)",
    "type": "research",
    "tier": 2,
    "enabled": true,
    "category": "AI Research"
  },
  {
    "name": "arXiv ML (cs.LG)",
    "type": "research",
    "tier": 2,
    "enabled": true,
    "category": "AI Research"
  },
  {
    "name": "TechCrunch AI",
    "type": "journalism",
    "tier": 3,
    "enabled": true,
    "category": "AI News"
  },
  {
    "name": "VentureBeat AI",
    "type": "journalism",
    "tier": 3,
    "enabled": false,
    "category": "AI News"
  },
  {
    "name": "The Verge AI",
    "type": "journalism",
    "tier": 3,
    "enabled": true,
    "category": "AI News"
  },
  {
    "name": "Ars Technica AI",
    "type": "journalism",
    "tier": 3,
    "enabled": true,
    "category": "AI News"
  },
  {
    "name": "IEEE Spectrum",
    "type": "journalism",
    "tier": 2,
    "enabled": true,
    "category": "AI Research"
  },
  {
    "name": "arXiv NLP (cs.CL)",
    "type": "research",
    "tier": 2,
    "enabled": true,
    "category": "AI Research"
  },
  {
    "name": "arXiv Vision (cs.CV)",
    "type": "research",
    "tier": 2,
    "enabled": true,
    "category": "AI Research"
  },
  {
    "name": "Berkeley AI Research (BAIR)",
    "type": "research",
    "tier": 1,
    "enabled": false,
    "category": "AI Research"
  },
  {
    "name": "Stanford HAI",
    "type": "research",
    "tier": 2,
    "enabled": false,
    "category": "AI Research"
  },
  {
    "name": "MIT Technology Review",
    "type": "journalism",
    "tier": 2,
    "enabled": true,
    "category": "AI News"
  },
  {
    "name": "AWS Machine Learning Blog",
    "type": "primary",
    "tier": 1,
    "enabled": true,
    "category": "AI Infrastructure"
  },
  {
    "name": "Google Research Blog",
    "type": "primary",
    "tier": 1,
    "enabled": true,
    "category": "AI Research"
  },
  {
    "name": "NVIDIA Developer Blog",
    "type": "primary",
    "tier": 1,
    "enabled": true,
    "category": "AI Infrastructure"
  },
  {
    "name": "Apple Machine Learning Research",
    "type": "research",
    "tier": 2,
    "enabled": true,
    "category": "AI Research"
  },
  {
    "name": "NVIDIA Newsroom",
    "type": "primary",
    "tier": 1,
    "enabled": true,
    "category": "AI Infrastructure"
  },
  {
    "name": "Google Research",
    "type": "research",
    "tier": 2,
    "enabled": true,
    "category": "AI Research"
  },
  {
    "name": "Amazon Science",
    "type": "research",
    "tier": 2,
    "enabled": true,
    "category": "AI Research"
  },
  {
    "name": "Microsoft Azure AI",
    "type": "primary",
    "tier": 1,
    "enabled": true,
    "category": "AI Infrastructure"
  },
  {
    "name": "ML@CMU",
    "type": "research",
    "tier": 2,
    "enabled": true,
    "category": "AI Research"
  },
  {
    "name": "Simon Willison",
    "type": "research",
    "tier": 2,
    "enabled": true,
    "category": "AI Research"
  },
  {
    "name": "WIRED AI",
    "type": "journalism",
    "tier": 2,
    "enabled": true,
    "category": "AI News"
  },
  {
    "name": "Sebastian Raschka",
    "type": "research",
    "tier": 2,
    "enabled": true,
    "category": "AI Research"
  },
  {
    "name": "O’Reilly Radar",
    "type": "research",
    "tier": 2,
    "enabled": true,
    "category": "AI Research"
  },
  {
    "name": "The Register AI",
    "type": "journalism",
    "tier": 2,
    "enabled": true,
    "category": "AI News"
  },
  {
    "name": "Databricks Blog",
    "type": "primary",
    "tier": 1,
    "enabled": true,
    "category": "AI Infrastructure"
  },
  {
    "name": "Google Cloud AI",
    "type": "primary",
    "tier": 1,
    "enabled": true,
    "category": "AI Infrastructure"
  }
];

/** Registry-backed display groups. Classification follows each feed's real
 * sourceType / category — no invented beats. */
export const SOURCE_GROUPS = [
  {
    label: 'Labs & Industry',
    note: 'First-party announcements',
    filter: s => s.type === 'primary' && !['Open Source AI', 'AI Infrastructure'].includes(s.category),
  },
  { label: 'Research', note: 'Papers & academic labs', filter: s => s.type === 'research' },
  { label: 'Publications', note: 'Technology journalism', filter: s => s.type === 'journalism' },
  { label: 'Open Source', note: 'Community & model hubs', filter: s => s.category === 'Open Source AI' },
  { label: 'Infrastructure', note: 'Cloud & platform engineering', filter: s => s.category === 'AI Infrastructure' },
].map(group => ({
  label: group.label,
  note: group.note,
  sources: SOURCE_REGISTRY.filter(group.filter),
}));

export const STATIC_SOURCE_COUNT = SOURCE_REGISTRY.length;
