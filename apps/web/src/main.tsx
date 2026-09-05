import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { startAuthSync } from './auth/authStore'
import './i18n'
import './styles/index.css'
import App from './app/App'

startAuthSync()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
