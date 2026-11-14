import { createHashRouter } from 'react-router-dom'
import { App } from './App'
import { NotFoundPage } from './features/NotFoundPage'

/**
 * Hash routing keeps this static build portable across Vercel and GitHub Pages.
 * Feature routes are split so authentication, community, document and game
 * code is downloaded only when a student opens that part of the app.
 */
export const router = createHashRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, lazy: async () => ({ Component: (await import('./features/dashboard/DashboardPage')).DashboardPage }) },
      { path: 'auth', lazy: async () => ({ Component: (await import('./features/auth/AuthPage')).AuthPage }) },
      { path: 'admin', lazy: async () => ({ Component: (await import('./features/admin/AdminPage')).AdminPage }) },
      { path: 'discover', lazy: async () => ({ Component: (await import('./features/discover/DiscoverPage')).DiscoverPage }) },
      { path: 'students', lazy: async () => ({ Component: (await import('./features/discover/StudentsPage')).StudentsPage }) },
      { path: 'groups', lazy: async () => ({ Component: (await import('./features/groups/GroupsPage')).GroupsPage }) },
      { path: 'groups/:id', lazy: async () => ({ Component: (await import('./features/groups/GroupsPage')).GroupsPage }) },
      { path: 'discover/:id/quiz', lazy: async () => ({ Component: (await import('./features/discover/PublicMaterialQuizPage')).PublicMaterialQuizPage }) },
      { path: 'profile-setup', lazy: async () => ({ Component: (await import('./features/auth/ProfileSetupPage')).ProfileSetupPage }) },
      { path: 'planner', lazy: async () => ({ Component: (await import('./features/planner/PlannerPage')).PlannerPage }) },
      { path: 'install', lazy: async () => ({ Component: (await import('./features/install/InstallPage')).InstallPage }) },
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
      { path: 'messages', lazy: async () => ({ Component: (await import('./features/messages/MessagesPage')).MessagesPage }) },
      { path: 'messages/:id', lazy: async () => ({ Component: (await import('./features/messages/MessagesPage')).MessagesPage }) },
      { path: 'notifications', lazy: async () => ({ Component: (await import('./features/notifications/NotificationsPage')).NotificationsPage }) },
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
