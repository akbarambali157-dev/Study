import { createHashRouter } from 'react-router-dom'
import { App } from './App'
import { DashboardPage } from './features/dashboard/DashboardPage'
import { NotFoundPage } from './features/NotFoundPage'

/**
 * Hash routing on purpose: the same build works on GitHub Pages, Netlify and
 * Vercel with no rewrite rules, and a share link can carry a whole deck in the
 * fragment without any server.
 *
 * Every route below the shell is loaded on demand. pdf.js alone is over a
 * megabyte, and there is no reason for a student to download the PDF reader
 * just to look at today's due count.
 */
export const router = createHashRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <DashboardPage /> },
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
