// Known corporate entities with subsidiaries/brands that should be co-searched
// when scanning for signals. Key is the normalized company name the user enters.
const ENTITY_MAP: Record<string, string[]> = {
  // Finance / Banking
  'jpmorgan':         ['Chase', 'JPMorgan Chase', 'JPMC', 'J.P. Morgan'],
  'jpmorgan chase':   ['Chase', 'JPMorgan', 'JPMC'],
  'chase':            ['JPMorgan Chase', 'JPMorgan'],
  'goldman sachs':    ['Goldman'],
  'morgan stanley':   ['Morgan Stanley Wealth'],
  'bank of america':  ['BofA', 'Merrill Lynch'],
  'wells fargo':      ['Wells Fargo Bank'],
  'blackrock':        ['BlackRock Investments'],
  'citadel':          ['Citadel Securities', 'Citadel LLC'],
  'visa':             ['Visa Inc', 'Visa Worldwide'],
  'mastercard':       ['Mastercard International'],

  // Big Tech
  'alphabet':         ['Google', 'YouTube', 'DeepMind', 'Waymo', 'Google Cloud'],
  'google':           ['Alphabet', 'Google Cloud', 'YouTube', 'DeepMind'],
  'meta':             ['Facebook', 'Instagram', 'WhatsApp', 'Oculus', 'Meta Platforms'],
  'facebook':         ['Meta', 'Instagram', 'WhatsApp'],
  'microsoft':        ['Azure', 'GitHub', 'LinkedIn', 'Xbox'],
  'amazon':           ['AWS', 'Amazon Web Services', 'Whole Foods', 'Twitch', 'Ring'],
  'apple':            ['Apple Inc', 'App Store'],

  // AI
  'openai':           ['ChatGPT', 'OpenAI Inc'],
  'anthropic':        ['Claude'],
  'google deepmind':  ['DeepMind', 'Google DeepMind'],

  // Enterprise SaaS
  'salesforce':       ['Slack', 'MuleSoft', 'Tableau'],
  'servicenow':       ['ServiceNow Inc'],
  'workday':          ['Workday Inc'],
  'sap':              ['SAP SE', 'Qualtrics'],

  // Fintech
  'stripe':           ['Stripe Inc', 'Stripe Payments'],
  'paypal':           ['Venmo', 'PayPal Holdings', 'Braintree'],
  'square':           ['Block', 'Cash App', 'Block Inc'],
  'block':            ['Square', 'Cash App', 'Spiral'],

  // HR Tech
  'rippling':         ['Rippling Inc'],
  'gusto':            ['Gusto Inc'],

  // Telecoms / Infrastructure
  'at&t':             ['AT&T Inc', 'DirecTV'],
  'verizon':          ['Verizon Communications'],
  't-mobile':         ['T-Mobile US'],

  // Healthcare
  'unitedhealth':     ['UnitedHealthcare', 'Optum'],
  'cvs':              ['CVS Health', 'Aetna'],
  'johnson & johnson': ['J&J', 'Janssen', 'Kenvue'],
  'pfizer':           ['Pfizer Inc'],

  // Retail / Consumer
  'walmart':          ['Sam\'s Club', 'Flipkart'],
  'target':           ['Target Corporation'],

  // Media
  'disney':           ['Walt Disney', 'Hulu', 'ESPN', 'Marvel', 'Pixar', 'Lucasfilm'],
  'netflix':          ['Netflix Inc'],
  'comcast':          ['NBCUniversal', 'Xfinity', 'Peacock'],
  'warner bros':      ['WBD', 'Warner Bros Discovery', 'HBO', 'CNN'],
}

export function getSearchTerms(companyName: string): string[] {
  const slug = companyName.toLowerCase().trim()
  const extra = ENTITY_MAP[slug] ?? []
  // Return primary name first, then up to 2 aliases (avoid API overload)
  return [companyName, ...extra.slice(0, 2)]
}
