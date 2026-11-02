import './globals.js';
import './utils/apiConfig.js';
import './firebase.js';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(<App />);
