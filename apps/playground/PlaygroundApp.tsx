import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import TreemapView from '../../src/components/TreemapView';
import { SymbolDemanglerContext } from '../../src/components/SymbolDemanglerContext';
import { createTreemapData, parseLinkmap } from '../../src/utils/linkmapParser';
import { fetchSampleLinkmap, readLinkmapFile } from '../../src/utils/loadLinkmap';
import { createSwiftDemangler } from '../../src/utils/swiftDemangle';
import type { TreemapData } from '../../src/types/linkmap';

export default function PlaygroundApp() {
  const [data, setData] = useState<TreemapData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Symbols are demangled as they come into view, so the wasm demangler is not loaded at all
  // unless a Swift symbol is actually shown.
  const demangler = useMemo(() => createSwiftDemangler(), []);

  const loadText = useCallback(async (text: string) => {
    setError(null);
    try {
      setData(createTreemapData(parseLinkmap(text)));
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : 'Failed to parse linkmap');
    }
  }, []);

  const loadFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      setError(null);
      setLoading(true);
      try {
        await loadText(await readLinkmapFile(file));
      } catch (err) {
        setData(null);
        setError(err instanceof Error ? err.message : 'Failed to read linkmap file');
      } finally {
        setLoading(false);
      }
    },
    [loadText],
  );

  const loadSample = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      await loadText(await fetchSampleLinkmap(import.meta.env.BASE_URL));
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : 'Failed to load sample linkmap');
    } finally {
      setLoading(false);
    }
  }, [loadText]);

  useEffect(() => {
    const onDragOver = (event: DragEvent) => event.preventDefault();

    const hasFiles = (event: DragEvent): boolean =>
      !!event.dataTransfer?.types && Array.from(event.dataTransfer.types).includes('Files');

    const onDragEnter = (event: DragEvent) => {
      event.preventDefault();
      if (!hasFiles(event)) return;
      setDragging((count) => count + 1);
    };

    const onDragLeave = (event: DragEvent) => {
      event.preventDefault();
      if (!hasFiles(event)) return;
      setDragging((count) => Math.max(0, count - 1));
    };

    const onDrop = (event: DragEvent) => {
      event.preventDefault();
      setDragging(0);
      const file = event.dataTransfer?.files?.[0];
      void loadFile(file);
    };

    const onPaste = (event: ClipboardEvent) => {
      const text = event.clipboardData?.getData('text/plain');
      if (!text) return;
      event.preventDefault();
      void loadText(text);
    };

    document.addEventListener('dragover', onDragOver);
    document.addEventListener('dragenter', onDragEnter);
    document.addEventListener('dragleave', onDragLeave);
    document.addEventListener('drop', onDrop);
    document.body.addEventListener('paste', onPaste);

    return () => {
      document.removeEventListener('dragover', onDragOver);
      document.removeEventListener('dragenter', onDragEnter);
      document.removeEventListener('dragleave', onDragLeave);
      document.removeEventListener('drop', onDrop);
      document.body.removeEventListener('paste', onPaste);
    };
  }, [loadFile, loadText]);

  return (
    <>
      <div className={`drag-target${dragging > 0 ? ' visible' : ''}`}>Drop linkmap file here</div>

      <div className="start-panel" style={{ display: data ? 'none' : 'block' }}>
        <section className="center">
          <h1>Linkmap Viewer</h1>
          <p>
            This page provides a way to visualize where the bytes in your binary came from.
            Import a linker map below and it is shown as a treemap grouped by object file and
            symbol. Gzip-compressed <code>.map.gz</code> files are supported.
          </p>
          <p className="formats">
            <strong>wasm-ld and other LLD flavours</strong> — pass{' '}
            <code>-Wl,-Map=output.map</code> to your linker.
            <br />
            <strong>Apple ld (ld64, ld-prime)</strong> — pass{' '}
            <code>-Wl,-map,output.map</code>, or in Xcode set{' '}
            <code>LD_GENERATE_MAP_FILE=YES</code> and <code>LD_MAP_FILE_PATH</code>.
            <br />
            The format is detected from the file; there is nothing to choose.
          </p>
          <p>
            <button
              type="button"
              className="import-button"
              data-testid="import-button"
              disabled={loading}
              onClick={() => inputRef.current?.click()}
            >
              {loading ? 'Loading linkmap...' : 'Import your linkmap...'}
            </button>
          </p>
          <p>
            Or{' '}
            <button
              type="button"
              className="text-button"
              data-testid="sample-link"
              disabled={loading}
              onClick={() => void loadSample()}
            >
              load the JavaScriptKit Basic example
            </button>
            .
          </p>
          {error && <p className="error" data-testid="error-message">{error}</p>}
        </section>
      </div>

      <div className={`results-panel${data ? ' visible' : ''}`}>
        {data && (
          <SymbolDemanglerContext.Provider value={demangler}>
            <TreemapView data={data} />
          </SymbolDemanglerContext.Provider>
        )}
      </div>

      <input
        ref={inputRef}
        data-testid="file-input"
        type="file"
        accept=".map,.map.gz,.txt,.gz,text/plain,application/gzip,application/x-gzip"
        hidden
        onChange={(event) => void loadFile(event.target.files?.[0])}
      />
    </>
  );
}
