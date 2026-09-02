import { createTreemapData, parseLinkmap } from '../utils/linkmapParser';
import { encodeReport, type ReportPayload } from '../utils/reportPayload';
import { applyDemangledNames, collectSwiftSymbolNames } from '../utils/swiftSymbols';

// Everything the CLI needs from the app's own logic, bundled to plain JS for Node by
// vite.cli.config.ts. This is what lets a report ship without a parser or a wasm demangler:
// bin/linkmapviz.mjs parses here, demangles with the Node build of swift-demangle-wasm,
// and embeds only the encoded treemap.

/** Parses a linkmap and encodes it for embedding, given a demangler for its Swift symbols. */
export async function buildReportPayload(
  linkmapText: string,
  demangle: (names: string[]) => Promise<Record<string, string>>,
): Promise<ReportPayload> {
  const treemap = createTreemapData(parseLinkmap(linkmapText));;

  const names = collectSwiftSymbolNames(treemap);
  if (names.length > 0) {
    applyDemangledNames(treemap, await demangle(names));
  }

  return encodeReport(treemap);
}
