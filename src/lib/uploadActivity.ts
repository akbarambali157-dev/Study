import { create } from 'zustand'

export type UploadActivity = {
  id: string
  title: string
  detail: string
  progress: number
  phase: 'reading' | 'processing'
  startedAt: number
  phaseStartedAt: number
}

type UploadActivityInput = Omit<UploadActivity, 'startedAt' | 'phaseStartedAt'>

type UploadActivityState = {
  items: Record<string, UploadActivity>
  setActivity: (id: string, activity: UploadActivityInput | null) => void
}

export const useUploadActivities = create<UploadActivityState>((set) => ({
  items: {},
  setActivity: (id, activity) => set((state) => {
    const items = { ...state.items }
    if (activity) {
      const previous = state.items[id]
      const now = Date.now()
      items[id] = {
        ...activity,
        startedAt: previous?.startedAt ?? now,
        phaseStartedAt: previous?.phase === activity.phase ? previous.phaseStartedAt : now,
      }
    } else delete items[id]
    return { items }
  }),
}))

export function setUploadActivity(id: string, activity: UploadActivityInput | null) {
  useUploadActivities.getState().setActivity(id, activity)
}
