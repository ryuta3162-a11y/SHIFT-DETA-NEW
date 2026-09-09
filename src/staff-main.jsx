import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import PwaRoot from './PwaRoot.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PwaRoot />
  </StrictMode>,
);
