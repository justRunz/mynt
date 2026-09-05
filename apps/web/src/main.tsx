import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { startAuthSync } from '@/app/stores/auth'
import '@/app/i18n'
import './styles/index.css'
import App from '@/app/app'

startAuthSync()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
