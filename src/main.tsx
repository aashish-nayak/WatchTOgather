import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { signalingService } from '@/lib/signaling';

// Start signaling early (auto connect)
// signalingService.start(true);

createRoot(document.getElementById('root')!).render(<App />);
