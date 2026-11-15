import { create } from 'zustand'

export type UploadActivity = {
  id: string
  title: string
  detail: string
  progress: number
  phase: 'reading' | 'processing'
}

type UploadActivityState = {
  items: Record<string, UploadActivity>
  setActivity: (id: string, activity: UploadActivity | null) => void
}

export const useUploadActivities = create<UploadActivityState>((set) => ({
  items: {},
  setActivity: (id, activity) => set((state) => {
    const items = { ...state.items }
    if (activity) items[id] = activity
    else delete items[id]
    return { items }
  }),
}))

export function setUploadActivity(id: string, activity: UploadActivity | null) {
  useUploadActivities.getState().setActivity(id, activity)
}
