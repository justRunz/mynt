import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { BrowserRouter } from 'react-router-dom'

import { AuthProvider } from '../auth/AuthProvider'
import { AppRoutes } from './routes'
import { StatusBar } from './StatusBar'
import { UpdatePrompt } from './UpdatePrompt'
import { persister, queryClient } from './queryClient'

export default function App() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: 7 * 24 * 60 * 60 * 1000 }}
      // Anything queued while offline is replayed once the restored cache is in
      // place, in the order it was made.
      onSuccess={() => queryClient.resumePausedMutations()}
    >
      <AuthProvider>
        {/* Mounted here rather than inside the app shell: UpdatePrompt is what
            registers the service worker, and the shell only exists once signed
            in -- so a first visit sitting on the sign-in screen would never
            cache anything. Being offline matters there too. */}
        <UpdatePrompt />
        <StatusBar />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </PersistQueryClientProvider>
  )
}
