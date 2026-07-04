import { createContext } from 'react';
import type { SymbolDemangler } from '../types/symbolDemangler';

/** Null in a generated report, where symbol names arrive already demangled. */
export const SymbolDemanglerContext = createContext<SymbolDemangler | null>(null);
