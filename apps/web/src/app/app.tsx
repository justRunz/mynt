import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { NuqsAdapter } from 'nuqs/adapters/react-router/v7'
import { BrowserRouter } from 'react-router-dom'

import { AppRoutes } from './routes'
import { StatusBar } from '@/app/components/status-bar'
import { UpdatePrompt } from '@/app/components/update-prompt'
import { persister, queryClient } from '@/app/lib/query-client'

export default function App() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: 7 * 24 * 60 * 60 * 1000 }}
      // Anything queued while offline is replayed once the restored cache is in
      // place, in the order it was made.
      onSuccess={() => queryClient.resumePausedMutations()}
    >
      {/* Mounted here rather than inside the app shell: UpdatePrompt is what
          registers the service worker, and the shell only exists once signed
          in -- so a first visit sitting on the sign-in screen would never
          cache anything. Being offline matters there too. */}
      <UpdatePrompt />
      <StatusBar />
      <BrowserRouter>
        {/* Screen state -- which binder page, which filters -- lives in the
            query string rather than in component state, so a reload, a
            bookmark or a shared link all land where the user left off.
            Inside the router, since that is what nuqs writes through. */}
        <NuqsAdapter>
          <AppRoutes />
        </NuqsAdapter>
      </BrowserRouter>
    </PersistQueryClientProvider>
  )
}
