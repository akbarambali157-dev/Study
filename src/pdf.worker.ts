import { installPdfCompatibility } from './lib/pdfCompatibility'

// The worker has its own global realm, so the main-thread polyfill is not
// visible here. Install it before evaluating PDF.js worker code.
installPdfCompatibility()
await import('pdfjs-dist/build/pdf.worker.mjs')
