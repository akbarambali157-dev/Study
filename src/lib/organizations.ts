import type { OrgKind } from './types'

export interface CatalogOrg {
  slug: string
  name: string
  kind: OrgKind
  url: string
  /** Which subject areas this body is relevant to — used only to build the prompt. */
  fields: string[]
  blurb: string
}

/**
 * A closed set of real organizations.
 *
 * The model may only pick from this list by slug, so it cannot invent a
 * plausible-sounding body ("Nigerian Board of Pharmaceutical Standards") and
 * hand the student a dead or misleading link. Anything outside this list comes
 * back as *proposed* content: shown as plain text, never clickable.
 *
 * MAINTENANCE: URLs were curated by hand. Check them once before a public
 * launch — a wrong outbound link is worse than no link.
 */
export const ORG_CATALOG: CatalogOrg[] = [
  // ── health sciences ────────────────────────────────────────────────
  { slug: 'who', name: 'World Health Organization', kind: 'authority', url: 'https://www.who.int', fields: ['health', 'medicine', 'public health', 'nursing', 'pharmacy'], blurb: 'Global health guidance, statistics and disease factsheets.' },
  { slug: 'nafdac', name: 'NAFDAC', kind: 'local', url: 'https://nafdac.gov.ng', fields: ['pharmacy', 'drugs', 'food', 'regulation'], blurb: "Nigeria's food and drug regulator: drug registration, safety alerts, counterfeit warnings." },
  { slug: 'ncdc', name: 'Nigeria Centre for Disease Control', kind: 'local', url: 'https://ncdc.gov.ng', fields: ['public health', 'epidemiology', 'infection', 'microbiology'], blurb: "Nigeria's outbreak surveillance and disease-control guidance." },
  { slug: 'fmoh', name: 'Federal Ministry of Health', kind: 'local', url: 'https://www.health.gov.ng', fields: ['health policy', 'medicine', 'public health'], blurb: 'National health policy, programmes and planning documents.' },
  { slug: 'pcn', name: 'Pharmacy Council of Nigeria', kind: 'professional', url: 'https://pcn.gov.ng', fields: ['pharmacy', 'professional practice'], blurb: 'Regulates pharmacy practice and licensing in Nigeria.' },
  { slug: 'mdcn', name: 'Medical and Dental Council of Nigeria', kind: 'professional', url: 'https://www.mdcn.gov.ng', fields: ['medicine', 'dentistry', 'professional practice'], blurb: 'Registers and licenses medical and dental practitioners.' },

  // ── management sciences ────────────────────────────────────────────
  { slug: 'cbn', name: 'Central Bank of Nigeria', kind: 'authority', url: 'https://www.cbn.gov.ng', fields: ['economics', 'finance', 'banking', 'monetary policy'], blurb: 'Monetary policy, exchange rates, financial statistics and circulars.' },
  { slug: 'sec-ng', name: 'Securities and Exchange Commission (Nigeria)', kind: 'authority', url: 'https://sec.gov.ng', fields: ['finance', 'capital markets', 'accounting', 'business law'], blurb: 'Capital market regulation and investor rules in Nigeria.' },
  { slug: 'firs', name: 'Federal Inland Revenue Service', kind: 'authority', url: 'https://www.firs.gov.ng', fields: ['taxation', 'accounting', 'business'], blurb: 'Nigerian tax law, filings and revenue guidance.' },
  { slug: 'ngx', name: 'Nigerian Exchange Group', kind: 'authority', url: 'https://ngxgroup.com', fields: ['finance', 'capital markets', 'investment'], blurb: 'The Nigerian stock exchange: listed companies, indices, market data.' },
  { slug: 'ican', name: 'Institute of Chartered Accountants of Nigeria', kind: 'professional', url: 'https://icanig.org', fields: ['accounting', 'audit', 'finance'], blurb: 'The chartered accountancy profession — syllabus, exams, membership.' },
  { slug: 'anan', name: 'Association of National Accountants of Nigeria', kind: 'professional', url: 'https://anan.org.ng', fields: ['accounting', 'audit'], blurb: "Nigeria's second accountancy body; exams and practice standards." },
  { slug: 'citn', name: 'Chartered Institute of Taxation of Nigeria', kind: 'professional', url: 'https://www.citn.org', fields: ['taxation', 'accounting'], blurb: 'The taxation profession in Nigeria: exams, standards and journals.' },
  { slug: 'cipm', name: 'Chartered Institute of Personnel Management', kind: 'professional', url: 'https://cipmng.org', fields: ['human resources', 'management', 'business'], blurb: 'Human resource practice standards and the HR career path in Nigeria.' },

  // ── law ────────────────────────────────────────────────────────────
  { slug: 'nba', name: 'Nigerian Bar Association', kind: 'professional', url: 'https://nigerianbar.org.ng', fields: ['law', 'legal practice'], blurb: 'The Nigerian bar: branches, practice resources and discipline.' },
  { slug: 'njc', name: 'National Judicial Council', kind: 'local', url: 'https://njc.gov.ng', fields: ['law', 'judiciary', 'constitutional law'], blurb: 'Judicial administration and the Nigerian bench.' },

  // ── engineering, science, built environment ────────────────────────
  { slug: 'coren', name: 'Council for the Regulation of Engineering in Nigeria', kind: 'professional', url: 'https://coren.gov.ng', fields: ['engineering', 'technology'], blurb: 'Registers and regulates engineering practice in Nigeria.' },
  { slug: 'nse-ng', name: 'Nigerian Society of Engineers', kind: 'professional', url: 'https://nse.org.ng', fields: ['engineering', 'technology'], blurb: 'The professional society for Nigerian engineers.' },
  { slug: 'son', name: 'Standards Organisation of Nigeria', kind: 'authority', url: 'https://son.gov.ng', fields: ['quality', 'standards', 'industrial science', 'engineering'], blurb: 'National product and process standards (NIS).' },
  { slug: 'naseni', name: 'National Agency for Science and Engineering Infrastructure', kind: 'authority', url: 'https://naseni.gov.ng', fields: ['engineering', 'science', 'technology'], blurb: 'Applied science and engineering infrastructure development.' },

  // ── computing ──────────────────────────────────────────────────────
  { slug: 'nitda', name: 'National Information Technology Development Agency', kind: 'authority', url: 'https://nitda.gov.ng', fields: ['computing', 'technology', 'data protection', 'ICT'], blurb: 'National ICT policy and the Nigeria Data Protection Act guidance.' },
  { slug: 'ncc', name: 'Nigerian Communications Commission', kind: 'authority', url: 'https://www.ncc.gov.ng', fields: ['computing', 'networking', 'telecoms', 'telecommunications'], blurb: 'Telecoms regulation, spectrum and broadband statistics.' },
  { slug: 'cpn', name: 'Computer Professionals Registration Council of Nigeria', kind: 'professional', url: 'https://cpn.gov.ng', fields: ['computing', 'ICT', 'professional practice'], blurb: 'Registers computing professionals in Nigeria.' },
  { slug: 'ncs-ng', name: 'Nigeria Computer Society', kind: 'professional', url: 'https://ncs.org.ng', fields: ['computing', 'software engineering', 'ICT'], blurb: 'The professional body for computing in Nigeria.' },

  // ── education and universal ────────────────────────────────────────
  { slug: 'nuc', name: 'National Universities Commission', kind: 'authority', url: 'https://nuc.edu.ng', fields: ['education', 'curriculum', 'university governance'], blurb: 'Nigerian university curriculum benchmarks (BMAS) and accreditation.' },
  { slug: 'trcn', name: 'Teachers Registration Council of Nigeria', kind: 'professional', url: 'https://trcn.gov.ng', fields: ['education', 'teaching'], blurb: 'Teacher registration, professional standards and licensing.' },
  { slug: 'nysc', name: 'National Youth Service Corps', kind: 'local', url: 'https://www.nysc.gov.ng', fields: ['education', 'career', 'civic'], blurb: 'The one-year national service programme for Nigerian graduates.' },
  { slug: 'oou', name: 'Olabisi Onabanjo University', kind: 'local', url: 'https://oouagoiwoye.edu.ng', fields: ['education', 'university'], blurb: 'OOU: faculties, academic calendar, results and senate policies.' },

  // ── further reading ────────────────────────────────────────────────
  { slug: 'wikipedia', name: 'Wikipedia', kind: 'reading', url: 'https://en.wikipedia.org', fields: ['general'], blurb: 'Fast background reading — start at the references, not the article.' },
  { slug: 'openstax', name: 'OpenStax', kind: 'reading', url: 'https://openstax.org', fields: ['general', 'science', 'economics', 'business'], blurb: 'Free, peer-reviewed university textbooks.' },
  { slug: 'mit-ocw', name: 'MIT OpenCourseWare', kind: 'reading', url: 'https://ocw.mit.edu', fields: ['general', 'engineering', 'science', 'computing'], blurb: 'Full MIT course materials, lecture notes and problem sets.' },
  { slug: 'khan', name: 'Khan Academy', kind: 'reading', url: 'https://www.khanacademy.org', fields: ['general', 'mathematics', 'science'], blurb: 'Video explanations for foundational concepts.' },
  { slug: 'pmc', name: 'PubMed Central', kind: 'reading', url: 'https://pmc.ncbi.nlm.nih.gov', fields: ['health', 'medicine', 'biology'], blurb: 'Open-access biomedical literature.' },
]

const BY_SLUG = new Map(ORG_CATALOG.map((o) => [o.slug, o]))

export function findCatalogOrg(slug: string): CatalogOrg | undefined {
  return BY_SLUG.get(slug)
}

/** Compact catalogue listing, injected into the org-matching prompt. */
export function catalogPromptBlock(): string {
  return ORG_CATALOG.map(
    (o) => `- ${o.slug} | ${o.name} | ${o.kind} | ${o.fields.join(', ')} | ${o.blurb}`,
  ).join('\n')
}

/**
 * Only these hosts may render as a clickable link. Anything else — including a
 * beautifully formatted URL a prompt-injected PDF asked us to include — is
 * shown as inert text.
 */
const ALLOWED_HOST_SUFFIXES = [
  '.gov.ng',
  '.edu.ng',
  '.org.ng',
  '.ac.uk',
  '.gov',
  '.edu',
  '.int',
]

const ALLOWED_HOSTS = new Set(
  ORG_CATALOG.map((o) => hostOf(o.url)).filter((h): h is string => Boolean(h)),
)

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return null
  }
}

export function isLinkableUrl(url: string | undefined): boolean {
  if (!url) return false
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  if (parsed.protocol !== 'https:') return false
  const host = parsed.hostname.toLowerCase().replace(/^www\./, '')
  if (ALLOWED_HOSTS.has(host)) return true
  return ALLOWED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))
}

export function safeHostLabel(url: string | undefined): string | undefined {
  return url ? (hostOf(url) ?? undefined) : undefined
}
