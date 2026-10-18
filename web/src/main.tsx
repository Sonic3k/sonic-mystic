import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/base.css';
import './styles/hall.css';
import './styles/tuvi.css';
import './styles/ns.css';
import './styles/astro.css';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
