import { db } from './db'
import { deleteDocument } from './store'
import { freshReview } from './srs'
import type { Card, Deck, DocumentRec, KeyPoint, Note, Org, QuizQuestion } from './types'
import { uid } from './utils'

/**
 * A demo study set so the whole app — notes, citations, flashcards, the game,
 * tests, the trail — is usable before a student has an API key or an upload.
 *
 * The content is real (NAFDAC and drug regulation in Nigeria) and deliberately
 * OOU-flavoured, so it doubles as a worked example of what the pipeline
 * produces from a real lecture PDF.
 */

const PAGES: string[] = [
  `NAFDAC AND DRUG REGULATION IN NIGERIA
Lecture 1: The mandate

The National Agency for Food and Drug Administration and Control (NAFDAC) was established by Decree 20 of 1993, as amended by Decree 19 of 1999. It is a federal agency under the Federal Ministry of Health.

NAFDAC's mandate covers food, drugs, cosmetics, medical devices, bottled and packaged water, and chemicals. For each of these categories the agency is responsible for registration, inspection, laboratory testing, and post-marketing surveillance.

The agency's authority is exercised through marketing authorisation: no regulated product may be manufactured, imported, advertised, sold or distributed in Nigeria unless it has been registered by NAFDAC and carries a valid registration number.

Two terms are often confused. Regulation is the setting and enforcement of rules for a product category. Registration is the product-specific approval granted after a dossier has been assessed. A product can be in a regulated category and still be unregistered — and therefore illegal to sell.`,

  `Lecture 2: The registration pathway

Applications are submitted through the NAFDAC online portal by the manufacturer or an authorised local agent. The applicant pays a prescribed fee and submits a dossier.

The dossier typically contains: evidence of product formulation, details of the manufacturing site, a certificate of free sale from the country of origin, results of laboratory analysis, labelling artwork, and evidence of good manufacturing practice (GMP).

For locally manufactured products there is a compulsory factory inspection. Inspectors assess premises, equipment, personnel, and quality control systems against GMP requirements. Where a site fails inspection, registration is withheld until the deficiencies are corrected.

Once approved, the product receives a NAFDAC registration number. The number identifies the product category and the approval record; it appears on the product label and should be printed, not stickered over, on genuine packaging.

Registration is not permanent. Products are subject to renewal, and the agency may suspend or cancel a registration where new safety information emerges or where the product is found to be substandard.`,

  `Lecture 3: Pharmacovigilance

Pharmacovigilance is the science of detecting, assessing, understanding and preventing adverse effects or any other drug-related problem.

An adverse drug reaction (ADR) is a response to a medicine which is noxious and unintended, occurring at doses normally used in humans. This definition excludes overdose and administration error, which are separate categories.

In Nigeria, ADR reports are collected by the National Pharmacovigilance Centre (NPC) hosted by NAFDAC, using the national ADR reporting form, commonly called the yellow form. Health professionals and patients may both report.

Reported cases are screened for seriousness, coded, and entered into a national database. Causality is then assessed — commonly using the WHO-UMC scale, which classifies a relationship as certain, probable, possible, unlikely, conditional, or unassessable.

The purpose is not to blame a prescriber. A single report can be the first signal that a product causes harm in a population; the value of the system depends on the number of reports received, so under-reporting is the central weakness of every pharmacovigilance system.`,

  `Lecture 4: Counterfeit and substandard medicines

A counterfeit medicine is one deliberately and fraudulently mislabelled with respect to identity, composition or source. A substandard medicine is a genuine product that fails to meet quality specifications.

The distinction matters legally. Counterfeiting is a deliberate crime; substandard production may result from poor manufacturing practice, storage failure, or degradation.

Common signals on packaging include: a registration number that does not match the product name in the NAFDAC database, misspelt manufacturer names, broken or stickered security seals, and expiry dates that are printed in the wrong format for the country of origin.

NAFDAC advises consumers to verify a product using the agency's mobile verification app or the short-code service before purchase, and to report suspected products to the nearest NAFDAC office.

Penalties under the enabling law include fines, seizure and destruction of the product, closure of premises, and imprisonment. Cross-border enforcement depends on cooperation with customs and with counterpart agencies in neighbouring countries, since a large share of counterfeit medicines enters through informal trade routes.`,
]

interface SeedKeyPoint {
  heading: string
  body: string
  example: string
  page: number
  tags: string[]
}

const KEY_POINTS: SeedKeyPoint[] = [
  {
    heading: 'NAFDAC regulates six product categories',
    body:
      'NAFDAC is responsible for food, drugs, cosmetics, medical devices, packaged water and chemicals. For each category it registers products, inspects premises, tests in laboratories and carries out post-marketing surveillance.',
    example:
      'A sachet of table water and a box of antimalarial tablets fall under the same agency but different directorates. Both need a registration number before sale.',
    page: 1,
    tags: ['nafdac', 'regulation', 'scope'],
  },
  {
    heading: 'Regulation is not the same as registration',
    body:
      'Regulation is the rule-setting and enforcement for a whole product category. Registration is the approval of one specific product after its dossier is assessed. A product can sit in a regulated category and still be unregistered, which makes selling it illegal.',
    example:
      'Herbal bitters are in a regulated category. If the particular brand has no NAFDAC number, it is an unregistered product even though herbal products as a class are regulated.',
    page: 1,
    tags: ['nafdac', 'registration', 'definitions'],
  },
  {
    heading: 'Registration requires a dossier and a GMP inspection',
    body:
      'Applicants submit a dossier covering formulation, manufacturing site, certificate of free sale, laboratory results, labelling and evidence of good manufacturing practice. Local manufacturers additionally face a compulsory factory inspection before approval.',
    example:
      'A Lagos manufacturer applying for a cough syrup fails inspection because the quality-control laboratory has no calibrated balance. Registration is withheld until the balance is calibrated and the site re-inspected.',
    page: 2,
    tags: ['registration', 'gmp', 'inspection'],
  },
  {
    heading: 'Pharmacovigilance exists to catch harm after approval',
    body:
      'Pharmacovigilance is the detection, assessment, understanding and prevention of adverse effects. In Nigeria reports go to the National Pharmacovigilance Centre using the yellow form, and causality is assessed on the WHO-UMC scale from certain down to unassessable.',
    example:
      'Thirty patients at a teaching hospital report severe rash after a newly introduced antibiotic. The cluster is reported on yellow forms, entered nationally, and the product is reviewed — possibly suspended.',
    page: 3,
    tags: ['pharmacovigilance', 'adr', 'safety'],
  },
  {
    heading: 'Counterfeit and substandard are different offences',
    body:
      'A counterfeit medicine is deliberately mislabelled as to identity, composition or source — a fraud. A substandard medicine is a genuine product that fails quality specifications, which may be an accident of manufacture or storage. The legal consequences differ accordingly.',
    example:
      'A box labelled "Paracetamol 500mg" that actually contains chalk is counterfeit. A genuine paracetamol brand that lost potency because it was stored in a hot warehouse is substandard.',
    page: 4,
    tags: ['counterfeit', 'substandard', 'quality'],
  },
  {
    heading: 'Verification before purchase is the practical defence',
    body:
      'Consumers are advised to verify a product against the NAFDAC database — by app or short code — before buying, and to report suspected products. Red flags include mismatched registration numbers, misspelt manufacturers, and resealed packaging.',
    example:
      'A pharmacist scans a pack and finds the registration number belongs to a different product name in the database. That mismatch alone justifies quarantine and a report.',
    page: 4,
    tags: ['counterfeit', 'verification', 'consumer'],
  },
]

const CARDS: { kp: number; front: string; back: string; example: string }[] = [
  {
    kp: 0,
    front: 'Name the six product categories NAFDAC regulates.',
    back: 'Food, drugs, cosmetics, medical devices, packaged water, and chemicals.',
    example: 'Table water and antimalarials are both regulated, by different directorates.',
  },
  {
    kp: 1,
    front: 'Distinguish regulation from registration.',
    back: 'Regulation sets and enforces rules for a whole product category; registration approves one specific product after its dossier is assessed.',
    example: 'Herbal bitters are regulated as a category, but each brand still needs its own NAFDAC number.',
  },
  {
    kp: 1,
    front: 'Can a product be in a regulated category and still be illegal to sell?',
    back: 'Yes — if that specific product is unregistered. Category regulation does not equal product approval.',
    example: 'An unregistered brand of bottled water is illegal even though bottled water is regulated.',
  },
  {
    kp: 2,
    front: 'What does the registration dossier normally contain?',
    back: 'Formulation, manufacturing site details, certificate of free sale, laboratory results, labelling artwork, and evidence of GMP.',
    example: 'A dossier missing the certificate of free sale stalls at the first review.',
  },
  {
    kp: 2,
    front: 'Why is a factory inspection compulsory for local manufacturers?',
    back: 'To verify premises, equipment, personnel and quality-control systems against GMP before a product is approved.',
    example: 'An uncalibrated balance in the QC lab is enough to fail inspection.',
  },
  {
    kp: 3,
    front: 'Define an adverse drug reaction (ADR).',
    back: 'A noxious and unintended response to a medicine at doses normally used in humans. Overdose and administration error are excluded.',
    example: 'A normal-dose rash is an ADR; a rash after a tenfold overdose is not, under this definition.',
  },
  {
    kp: 3,
    front: 'Which form and which centre handle ADR reporting in Nigeria?',
    back: 'The national ADR (yellow) form, submitted to the National Pharmacovigilance Centre hosted by NAFDAC.',
    example: 'Both health professionals and patients may submit a yellow form.',
  },
  {
    kp: 3,
    front: 'What is the central weakness of any pharmacovigilance system?',
    back: 'Under-reporting. The system only detects signals that are actually reported.',
    example: 'A rare reaction seen by one clinician is invisible unless that clinician reports it.',
  },
  {
    kp: 4,
    front: 'Counterfeit versus substandard medicine — what is the difference?',
    back: 'Counterfeit is deliberate fraudulent mislabelling of identity, composition or source. Substandard is a genuine product that fails quality specifications.',
    example: 'Chalk sold as paracetamol is counterfeit; heat-damaged genuine paracetamol is substandard.',
  },
  {
    kp: 4,
    front: 'Give three packaging red flags for a counterfeit medicine.',
    back: 'Registration number not matching the product in the NAFDAC database, misspelt manufacturer name, and broken or stickered security seals.',
    example: 'A registration number belonging to a different product name is a mismatch worth reporting.',
  },
  {
    kp: 5,
    front: 'What should a consumer do before buying a regulated product?',
    back: 'Verify it against the NAFDAC database using the app or short code, and report anything that fails verification.',
    example: 'Scan first, buy second — the check takes seconds.',
  },
]

const QUESTIONS: {
  kp: number
  stem: string
  options: string[]
  answerIndex: number
  explanation: string
  page: number
}[] = [
  {
    kp: 1,
    stem: 'A product belongs to a regulated category but has no NAFDAC number. What is its legal status?',
    options: [
      'It is legal, because the category itself is regulated',
      'It is unregistered, and therefore illegal to sell',
      'It is legal only if manufactured in Nigeria',
      'It is legal if sold in open markets rather than pharmacies',
    ],
    answerIndex: 1,
    explanation:
      'Regulation applies to the category; registration applies to the individual product. An unregistered product in a regulated category cannot lawfully be sold. The "open market" option is a common but false belief.',
    page: 1,
  },
  {
    kp: 2,
    stem: 'Which document proves a foreign product is lawfully sold in its country of origin?',
    options: [
      'Certificate of free sale',
      'Yellow form',
      'Good manufacturing practice certificate',
      'Registration renewal receipt',
    ],
    answerIndex: 0,
    explanation:
      'The certificate of free sale is issued by the exporting country\'s authority. A GMP certificate speaks to the site, not to market authorisation, which is why it cannot substitute.',
    page: 2,
  },
  {
    kp: 3,
    stem: 'Which of these is NOT an adverse drug reaction as defined in the lecture?',
    options: [
      'A rash appearing at the recommended dose',
      'Liver injury at the recommended dose',
      'Harm following a tenfold overdose',
      'Anaphylaxis at the recommended dose',
    ],
    answerIndex: 2,
    explanation:
      'The definition requires doses normally used in humans. Harm after a tenfold overdose is overdose, not an ADR — a distinction that changes how the case is reported and analysed.',
    page: 3,
  },
  {
    kp: 3,
    stem: 'On the WHO-UMC causality scale, which category indicates the strongest link between drug and reaction?',
    options: ['Possible', 'Probable', 'Certain', 'Conditional'],
    answerIndex: 2,
    explanation:
      'The scale runs certain, probable, possible, unlikely, conditional, unassessable. "Conditional" requires more data before assessment, so it is not a strength rating at all.',
    page: 3,
  },
  {
    kp: 4,
    stem: 'Genuine paracetamol tablets that lost potency after storage in a hot warehouse are best described as:',
    options: ['Counterfeit', 'Substandard', 'Adulterated by design', 'Unregistered'],
    answerIndex: 1,
    explanation:
      'There is no fraudulent intent and the product identity is genuine, so it is not counterfeit. It fails specifications, which makes it substandard. This distinction drives whether the case is treated as a crime or a quality failure.',
    page: 4,
  },
  {
    kp: 4,
    stem: 'A pack\'s NAFDAC number belongs to a different product name in the agency database. This most strongly suggests:',
    options: [
      'A normal clerical error by the pharmacy',
      'A counterfeit product',
      'A product awaiting renewal',
      'A product imported for personal use',
    ],
    answerIndex: 1,
    explanation:
      'A registration number that resolves to another product means the label is misrepresenting identity — the definition of counterfeiting. Renewal status does not change which product a number belongs to.',
    page: 4,
  },
  {
    kp: 0,
    stem: 'Which of the following is NOT one of the six categories NAFDAC regulates?',
    options: ['Packaged water', 'Medical devices', 'Motor vehicle spare parts', 'Cosmetics'],
    answerIndex: 2,
    explanation:
      'Spare parts fall under SON and consumer-protection bodies, not NAFDAC. The six categories are food, drugs, cosmetics, medical devices, packaged water and chemicals.',
    page: 1,
  },
  {
    kp: 5,
    stem: 'What is the most practical action a student can take to avoid a counterfeit medicine?',
    options: [
      'Buy only the cheapest available brand',
      'Verify the product against the NAFDAC database before purchase',
      'Rely on the pharmacy\'s reputation alone',
      'Buy in bulk to reduce exposure to fake batches',
    ],
    answerIndex: 1,
    explanation:
      'Verification against the agency database catches mismatched registration numbers, which is the single strongest cheap signal. Price and reputation are heuristics that counterfeiters specifically exploit.',
    page: 4,
  },
]

export async function seedDemo(): Promise<string> {
  const existing = await db.documents.where('source').equals('demo').first()
  if (existing) {
    const [note, deck] = await Promise.all([
      db.notes.where('documentId').equals(existing.id).first(),
      db.decks.where('documentId').equals(existing.id).first(),
    ])
    const [keyPoints, cards, questions] = deck
      ? await Promise.all([
          db.keyPoints.where('documentId').equals(existing.id).count(),
          db.cards.where('deckId').equals(deck.id).count(),
          db.questions.where('deckId').equals(deck.id).count(),
        ])
      : [0, 0, 0]

    // Repair an older/partially seeded demo instead of navigating to an empty
    // document. Keep its document ID so existing links remain stable.
    if (note && deck && keyPoints > 0 && cards > 0 && questions > 0) return existing.id
    await deleteDocument(existing.id)
  }

  const documentId = existing?.id ?? uid('doc')
  const noteId = uid('note')
  const deckId = uid('deck')
  const now = new Date().toISOString()

  const doc: DocumentRec = {
    id: documentId,
    title: 'NAFDAC and Drug Regulation in Nigeria',
    fileName: 'demo-nafdac.pdf',
    pageCount: PAGES.length,
    pages: PAGES,
    createdAt: now,
    status: 'ready',
    source: 'demo',
  }

  const note: Note = {
    id: noteId,
    documentId,
    title: 'NAFDAC and Drug Regulation in Nigeria',
    summary: `## The agency and what it controls

NAFDAC was created by Decree 20 of 1993 and sits under the Federal Ministry of Health. It regulates **six categories**: food, drugs, cosmetics, medical devices, packaged water and chemicals. For each, it registers products, inspects premises, tests samples and watches the market after approval.

The distinction students lose marks on is **regulation vs registration**. Regulation is the rulebook for a whole category. Registration is the approval of one product. A regulated category is full of products that were never registered — and selling those is illegal.

## Getting a product approved

Registration runs on a dossier: formulation, manufacturing site, certificate of free sale, laboratory results, labelling and GMP evidence. Local manufacturers face a compulsory factory inspection. Approval produces a NAFDAC number that must appear printed on the pack, and it must be renewed.

## Watching for harm

Pharmacovigilance is how harm is caught after approval. ADRs are reported on the yellow form to the National Pharmacovigilance Centre, and causality is graded on the WHO-UMC scale. The system's weak point is under-reporting, not the analysis.

## Fake and failing medicines

Counterfeit means deliberate mislabelling of identity, composition or source. Substandard means a genuine product that fails specifications. The practical defence for a consumer is verification against the NAFDAC database before purchase.`,
    takeaways: [
      'Regulation covers a category; registration approves a product.',
      'A NAFDAC number that does not match the product is strong evidence of counterfeiting.',
      'An ADR is harm at normal doses — overdose and error are separate categories.',
      'Counterfeit = fraud; substandard = failing specifications. Different offences, different penalties.',
      'Pharmacovigilance fails through under-reporting, not through weak analysis.',
    ],
    model: 'demo',
    createdAt: now,
  }

  const keyPoints: KeyPoint[] = KEY_POINTS.map((kp, index) => ({
    id: uid('kp'),
    documentId,
    noteId,
    position: index,
    heading: kp.heading,
    body: kp.body,
    example: kp.example,
    page: kp.page,
    confidence: 0.95,
    snippet: PAGES[kp.page - 1].split('\n').filter(Boolean)[1]?.slice(0, 120),
    tags: kp.tags,
  }))

  const orgPlan: { kp: number; slug: string; why: string }[] = [
    { kp: 0, slug: 'nafdac', why: 'The regulator itself — read the actual mandate and current guidelines rather than a summary of them.' },
    { kp: 1, slug: 'nafdac', why: 'The registered-products database is where "is this product registered?" is actually answered.' },
    { kp: 2, slug: 'nafdac', why: 'Registration guidelines and GMP requirements are published here, including the current fee schedule.' },
    { kp: 2, slug: 'son', why: 'Standards Organisation of Nigeria publishes the product standards that dossiers are tested against.' },
    { kp: 3, slug: 'who', why: 'WHO hosts the international ADR database and the UMC causality scale used in the lecture.' },
    { kp: 3, slug: 'ncdc', why: 'Useful contrast: how Nigeria runs surveillance for disease versus for medicines.' },
    { kp: 3, slug: 'pcn', why: 'Pharmacists carry the reporting duty in practice; PCN sets the professional standard.' },
    { kp: 4, slug: 'who', why: 'WHO publishes the global definition of counterfeit medical products and prevalence estimates.' },
    { kp: 4, slug: 'fmoh', why: 'National policy documents on medicine quality sit with the Federal Ministry of Health.' },
    { kp: 5, slug: 'wikipedia', why: 'Background on counterfeit medicines as a global public-health problem.' },
    { kp: 5, slug: 'pmc', why: 'Open-access studies on counterfeit prevalence in West Africa.' },
  ]

  const orgs: Org[] = orgPlan.map((entry) => {
    const catalog = [
      { slug: 'nafdac', name: 'NAFDAC', kind: 'local' as const, url: 'https://nafdac.gov.ng' },
      { slug: 'son', name: 'Standards Organisation of Nigeria', kind: 'authority' as const, url: 'https://son.gov.ng' },
      { slug: 'who', name: 'World Health Organization', kind: 'authority' as const, url: 'https://www.who.int' },
      { slug: 'ncdc', name: 'Nigeria Centre for Disease Control', kind: 'local' as const, url: 'https://ncdc.gov.ng' },
      { slug: 'pcn', name: 'Pharmacy Council of Nigeria', kind: 'professional' as const, url: 'https://pcn.gov.ng' },
      { slug: 'fmoh', name: 'Federal Ministry of Health', kind: 'local' as const, url: 'https://www.health.gov.ng' },
      { slug: 'wikipedia', name: 'Wikipedia', kind: 'reading' as const, url: 'https://en.wikipedia.org' },
      { slug: 'pmc', name: 'PubMed Central', kind: 'reading' as const, url: 'https://pmc.ncbi.nlm.nih.gov' },
    ].find((c) => c.slug === entry.slug)!

    return {
      id: uid('org'),
      keyPointId: keyPoints[entry.kp].id,
      documentId,
      name: catalog.name,
      kind: catalog.kind,
      url: catalog.url,
      why: entry.why,
      verified: true,
    }
  })

  const deck: Deck = { id: deckId, documentId, title: note.title, createdAt: now }

  const cards: Card[] = CARDS.map((card) => ({
    id: uid('card'),
    deckId,
    documentId,
    keyPointId: keyPoints[card.kp].id,
    front: card.front,
    back: card.back,
    example: card.example,
    page: KEY_POINTS[card.kp].page,
    tags: KEY_POINTS[card.kp].tags,
  }))

  const questions: QuizQuestion[] = QUESTIONS.map((q) => ({
    id: uid('q'),
    deckId,
    documentId,
    keyPointId: keyPoints[q.kp].id,
    stem: q.stem,
    options: q.options,
    answerIndex: q.answerIndex,
    explanation: q.explanation,
    page: q.page,
  }))

  await db.transaction(
    'rw',
    [db.documents, db.notes, db.keyPoints, db.orgs, db.decks, db.cards, db.questions, db.reviews],
    async () => {
      await db.documents.put(doc)
      await db.notes.put(note)
      await db.keyPoints.bulkPut(keyPoints)
      await db.orgs.bulkPut(orgs)
      await db.decks.put(deck)
      await db.cards.bulkPut(cards)
      await db.questions.bulkPut(questions)
      await db.reviews.bulkPut(cards.map((c) => freshReview(c.id)))
    },
  )

  return documentId
}

export const DEMO_DECK_ID_HINT = 'created by seedDemo'
