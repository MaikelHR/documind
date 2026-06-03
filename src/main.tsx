import { createRoot } from 'react-dom/client';
import './index.css';
import './i18n/config';
import App from './App';

const root = document.getElementById('root');
if (root) createRoot(root).render(<App />);
