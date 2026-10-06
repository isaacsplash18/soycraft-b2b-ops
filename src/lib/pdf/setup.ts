// One-time @react-pdf/renderer setup, imported as a side effect by every
// PDF template in this app.
//
// react-pdf uses its hyphenation algorithm to break long words across lines.
// That's what causes SKUs like "CLD01BLS-LILAC-CUSH" to wrap at the hyphens
// inside table cells. Returning the word as a single token disables mid-word
// breaks entirely — multi-word strings still wrap at spaces, just not inside
// a single token like an SKU.
//
// Side effect: any pathologically long unbroken word (no spaces, no hyphens
// the algorithm would have used) can overflow its container. Mitigated by
// giving SKU columns enough horizontal room.
import { Font } from "@react-pdf/renderer";

Font.registerHyphenationCallback((word: string) => [word]);
