import Treemap from './Treemap';
import { formatBytes, formatInteger } from '../utils/format';
import type { TreemapData } from '../types/linkmap';

interface TreemapViewProps {
  data: TreemapData;
}

function countedFiles(count: number): string {
  return count === 1 ? 'file' : 'files';
}

/** The summary and treemap, shared by the playground and by generated reports. */
export default function TreemapView({ data }: TreemapViewProps) {
  return (
    <>
      <div className="summary" data-testid="summary">
        <h2>{formatBytes(data.totalSize)}</h2>
        <p>
          {formatInteger(data.objectCount)} input {countedFiles(data.objectCount)}
          {' · '}
          {formatInteger(data.symbolCount)} symbol{data.symbolCount === 1 ? '' : 's'}
        </p>
      </div>

      <div className="chart-panel">
        <section className="center">
          <p>
            This visualization shows how binary size is distributed across object files and
            symbols. Click on a node to expand and focus it, then click a symbol to view details.
          </p>
        </section>
        <main>
          <Treemap data={data} />
        </main>
      </div>
    </>
  );
}
