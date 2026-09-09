import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { NuqsAdapter } from 'nuqs/adapters/react-router/v7'
import { BrowserRouter } from 'react-router-dom'

import { AppRoutes } from './routes'
import { StatusBar } from '@/app/components/status-bar'
import { UpdatePrompt } from '@/app/components/update-prompt'
import { persister, queryClient } from '@/app/lib/query-client'

/** The shape of what is cached, not the version of the app. */
const CACHE_SHAPE = 'own-api-1'

export default function App() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        // Bump this whenever the shape of anything cached changes.
        //
        // A persisted cache outlives the code that wrote it. The catalog is
        // held with staleTime: Infinity precisely so it is never refetched, so
        // a browser that used the app before the move off PostgREST kept
        // country rows shaped { code, euro_since } forever -- and the
        // completeness page went white on countryCode being undefined, with no
        // request in flight that could ever have fixed it.
        //
        // Not the build hash or the version: those change on every deploy, and
        // emptying the collector's offline copy every time something ships
        // would defeat the reason any of this is persisted.
        buster: CACHE_SHAPE,
        // Reads are persisted so the collection can be consulted without a
        // signal. Writes are not, and saying so here keeps it from being
        // rediscovered as a surprise: nothing survives a reload but data.
        dehydrateOptions: { shouldDehydrateMutation: () => false },
      }}
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
