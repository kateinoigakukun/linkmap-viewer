import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import ReportApp from './ReportApp';
import '../../src/index.css';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

createRoot(root).render(
  <StrictMode>
    <ReportApp />
  </StrictMode>,
);
