import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import './i18n';
import ErrorBoundary from './components/ErrorBoundary';
import { MotionConfig } from 'framer-motion';

// Clear seeded mock default business details if they match the defaults
const savedDetails = localStorage.getItem('businessDetails');
if (savedDetails) {
  try {
    const parsed = JSON.parse(savedDetails);
    if (parsed.name === "مؤسسة ناجل عسير" || parsed.name === "مؤسسة ناجل عمير" || parsed.address === "Saudi Arabia") {
      localStorage.removeItem('businessDetails');
    }
  } catch (e) {}
}

createRoot(document.getElementById('root')!).render(
 <StrictMode>
 <ErrorBoundary>
 <MotionConfig reducedMotion="always">
 <App />
 </MotionConfig>
 </ErrorBoundary>
 </StrictMode>,
)

