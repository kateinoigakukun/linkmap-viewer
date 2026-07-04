import { useEffect, useState } from 'react';
import TreemapView from '../../src/components/TreemapView';
import { readEmbeddedTreemap } from './embedded';
import type { TreemapData } from '../../src/types/linkmap';

// A generated report renders one treemap, the one the CLI baked into it. There is no linkmap
// parser and no file loading here -- the CLI did that work already.
export default function ReportApp() {
  const [data, setData] = useState<TreemapData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        setData(await readEmbeddedTreemap());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to read the embedded linkmap');
      }
    })();
  }, []);

  if (error) {
    return (
      <div className="start-panel">
        <section className="center">
          <h1>Linkmap Viewer</h1>
          <p className="error" data-testid="error-message">{error}</p>
        </section>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="start-panel">
        <section className="center">
          <h1>Linkmap Viewer</h1>
          <p>
            This report has no linkmap embedded in it. Generate one with{' '}
            <code>npx linkmap-viewer &lt;linkmap&gt;</code>.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="results-panel visible">
      <TreemapView data={data} />
    </div>
  );
}
