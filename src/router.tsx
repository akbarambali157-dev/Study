import { createHashRouter } from 'react-router-dom'
import { App } from './App'
import { DashboardPage } from './features/dashboard/DashboardPage'
import { NotFoundPage } from './features/NotFoundPage'
import { AuthPage } from './features/auth/AuthPage'
import { ProfileSetupPage } from './features/auth/ProfileSetupPage'

/**
 * Hash routing keeps this static build portable across Vercel and GitHub Pages.
 * Heavy document and game routes are loaded only when a student opens them.
 */
export const router = createHashRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'auth', element: <AuthPage /> },
      { path: 'profile-setup', element: <ProfileSetupPage /> },
      {
        path: 'community',
        lazy: async () => ({
          Component: (await import('./features/community/FeedPage')).FeedPage,
        }),
      },
      {
        path: 'library',
        lazy: async () => ({
          Component: (await import('./features/library/LibraryPage')).LibraryPage,
        }),
      },
      {
        path: 'upload',
        lazy: async () => ({
          Component: (await import('./features/upload/UploadPage')).UploadPage,
        }),
      },
      {
        path: 'doc/:id',
        lazy: async () => ({
          Component: (await import('./features/doc/DocPage')).DocPage,
        }),
      },
      {
        path: 'deck/:id/study',
        lazy: async () => ({
          Component: (await import('./features/flashcards/DeckStudyPage')).DeckStudyPage,
        }),
      },
      {
        path: 'deck/:id/rush',
        lazy: async () => ({
          Component: (await import('./features/game/CardRushPage')).CardRushPage,
        }),
      },
      {
        path: 'deck/:id/test',
        lazy: async () => ({
          Component: (await import('./features/tests/TestPage')).TestPage,
        }),
      },
      {
        path: 'trail',
        lazy: async () => ({
          Component: (await import('./features/trail/TrailPage')).TrailPage,
        }),
      },
      {
        path: 'settings',
        lazy: async () => ({
          Component: (await import('./features/settings/SettingsPage')).SettingsPage,
        }),
      },
      {
        path: 'shared/:encoded',
        lazy: async () => ({
          Component: (await import('./features/shared/SharedPage')).SharedPage,
        }),
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
