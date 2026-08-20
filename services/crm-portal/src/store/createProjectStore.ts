import { create } from 'zustand'
import type {
  ChatMessage,
  CreateProjectPayload,
  ProjectType,
  UploadedDoc,
} from '../types/project'
import { flattenPartial, getByPath, setByPath } from '../lib/paths'
import { labelForPath } from '../lib/fieldLabels'
import { checkNameUnique } from '../lib/slug'
import { requestAssistant } from '../lib/aiAssistant'

export const STEP_LABELS = [
  'Type',
  'Basics',
  'Configuration',
  'Enterprise Features',
  'Deployment',
  'Review & Create',
] as const

export type NameUniqueStatus = 'idle' | 'checking' | 'unique' | 'duplicate'

function defaultConfigFor(type: ProjectType): Record<string, unknown> {
  if (type === 'web_app') {
    return { framework: 'React', authRequired: false, dataLayer: 'none', template: 'Blank' }
  }
  if (type === 'website') {
    return { siteType: 'landing', pages: ['Home', 'About', 'Contact'], seo: {} }
  }
  return { audience: 'customer', accessControl: 'invite', modules: [] }
}

function initialFormState(): CreateProjectPayload {
  return {
    type: null,
    name: '',
    description: '',
    ownerId: 'me',
    visibility: 'private',
    config: {},
    enterpriseFeatures: {
      identityAccess: { sso: false, rbac: false, mfa: false, multiTenant: false },
      dataReliability: {
        caching: false,
        backgroundJobs: false,
        backupsAndDR: false,
        rateLimiting: false,
      },
      observabilityCompliance: {
        auditLogging: false,
        monitoring: false,
        centralizedLogging: false,
        complianceFlags: [],
      },
      integrationComms: {
        apiExposure: 'none',
        webhooks: false,
        emailNotifications: false,
        pushNotifications: false,
        thirdPartyIntegrations: [],
      },
      i18n: { multiLanguage: false, multiCurrency: false },
    },
    deployment: { targets: [] },
    eventing: {
      enabled: true,
      framework: 'aisena-eventing',
      frameworkVersion: '1.0.0',
      canonicalFormat: 'JSON',
      categories: ['TECHNICAL', 'BUSINESS'],
      definitionRegistry: 'project/eventing/definitions',
      piiHandling: 'EXCLUDE',
      delivery: {
        transport: 'KAFKA',
        technicalTopic: 'technical-events-development',
        businessTopic: 'business-events-development',
      },
    },
  }
}

interface AppliedBatchEntry {
  path: string
  prevValue: unknown
}

interface CreateProjectState {
  step: number
  formState: CreateProjectPayload
  touchedFields: Set<string>
  nameUniqueStatus: NameUniqueStatus
  nameSuggestion?: string
  uploadedDocs: UploadedDoc[]
  chatMessages: ChatMessage[]
  chatOpen: boolean
  assistantLoading: boolean
  assistantError: string | null
  lastAppliedBatch: { messageId: string; entries: AppliedBatchEntry[] } | null
  dirty: boolean

  setStep: (n: number) => void
  next: () => void
  back: () => void
  setType: (type: ProjectType) => void
  updateField: (path: string, value: unknown) => void
  toggleArrayValue: (path: string, value: string) => void
  checkNameUniqueness: (name: string) => Promise<void>
  addUploadedDoc: (doc: UploadedDoc) => void
  updateUploadedDoc: (id: string, patch: Partial<UploadedDoc>) => void
  removeUploadedDoc: (id: string) => void
  setChatOpen: (open: boolean) => void
  sendChatMessage: (text: string) => Promise<void>
  resolveConflict: (messageId: string, path: string, accept: boolean) => void
  undoLastBatch: () => void
  reset: () => void
}

let idCounter = 0
function nextId(prefix: string): string {
  idCounter += 1
  return `${prefix}-${Date.now()}-${idCounter}`
}

export const useCreateProjectStore = create<CreateProjectState>((set, get) => ({
  step: 0,
  formState: initialFormState(),
  touchedFields: new Set(),
  nameUniqueStatus: 'idle',
  nameSuggestion: undefined,
  uploadedDocs: [],
  chatMessages: [
    {
      id: nextId('msg'),
      role: 'assistant',
      content:
        "Hi! Describe what you want to build in plain language and I'll pre-fill this form for you — you can always edit anything I set.",
    },
  ],
  chatOpen: false,
  assistantLoading: false,
  assistantError: null,
  lastAppliedBatch: null,
  dirty: false,

  setStep: (n) => set({ step: Math.max(0, Math.min(5, n)) }),
  next: () => set((s) => ({ step: Math.min(5, s.step + 1) })),
  back: () => set((s) => ({ step: Math.max(0, s.step - 1) })),

  setType: (type) =>
    set((s) => {
      const touched = new Set(s.touchedFields)
      touched.add('type')
      const sameType = s.formState.type === type
      return {
        formState: {
          ...s.formState,
          type,
          config: sameType ? s.formState.config : defaultConfigFor(type),
        },
        touchedFields: touched,
        dirty: true,
      }
    }),

  updateField: (path, value) =>
    set((s) => {
      const touched = new Set(s.touchedFields)
      touched.add(path)
      return { formState: setByPath(s.formState, path, value), touchedFields: touched, dirty: true }
    }),

  toggleArrayValue: (path, value) =>
    set((s) => {
      const current = (getByPath(s.formState, path) as string[] | undefined) ?? []
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value]
      const touched = new Set(s.touchedFields)
      touched.add(path)
      return { formState: setByPath(s.formState, path, next), touchedFields: touched, dirty: true }
    }),

  checkNameUniqueness: async (name) => {
    set({ nameUniqueStatus: 'checking' })
    const result = await checkNameUnique(name)
    // Ignore stale responses if the name changed while the check was in flight.
    if (get().formState.name !== name) return
    set({
      nameUniqueStatus: result.unique ? 'unique' : 'duplicate',
      nameSuggestion: result.suggestion,
    })
  },

  addUploadedDoc: (doc) => set((s) => ({ uploadedDocs: [...s.uploadedDocs, doc], dirty: true })),
  updateUploadedDoc: (id, patch) =>
    set((s) => ({
      uploadedDocs: s.uploadedDocs.map((d) => (d.id === id ? { ...d, ...patch } : d)),
    })),
  removeUploadedDoc: (id) =>
    set((s) => ({ uploadedDocs: s.uploadedDocs.filter((d) => d.id !== id) })),

  setChatOpen: (open) => set({ chatOpen: open }),

  sendChatMessage: async (text) => {
    const userMsg: ChatMessage = { id: nextId('msg'), role: 'user', content: text }
    set((s) => ({
      chatMessages: [...s.chatMessages, userMsg],
      assistantLoading: true,
      assistantError: null,
    }))

    try {
      const state = get()
      const response = await requestAssistant(text, {
        currentFormState: state.formState,
        uploadedDocs: state.uploadedDocs,
        chatHistory: state.chatMessages.map((m) => ({ role: m.role, content: m.content })),
      })

      const leaves = response.suggestedFieldUpdates ? flattenPartial(response.suggestedFieldUpdates) : []
      const appliedUpdates: { path: string; label: string; value: unknown }[] = []
      const pendingConflicts: {
        path: string
        label: string
        oldValue: unknown
        newValue: unknown
      }[] = []
      const batchEntries: AppliedBatchEntry[] = []

      let nextFormState = get().formState
      const touched = get().touchedFields
      for (const leaf of leaves) {
        const oldValue = getByPath(nextFormState, leaf.path)
        const isConflict =
          touched.has(leaf.path) && oldValue !== undefined && JSON.stringify(oldValue) !== JSON.stringify(leaf.value)
        if (isConflict) {
          pendingConflicts.push({ path: leaf.path, label: labelForPath(leaf.path), oldValue, newValue: leaf.value })
        } else {
          batchEntries.push({ path: leaf.path, prevValue: oldValue })
          nextFormState = setByPath(nextFormState, leaf.path, leaf.value)
          appliedUpdates.push({ path: leaf.path, label: labelForPath(leaf.path), value: leaf.value })
        }
      }

      const assistantMsg: ChatMessage = {
        id: nextId('msg'),
        role: 'assistant',
        content: response.message,
        appliedUpdates: appliedUpdates.length ? appliedUpdates : undefined,
        pendingConflicts: pendingConflicts.length ? pendingConflicts : undefined,
        followUpQuestions: response.followUpQuestions,
      }

      set((s) => ({
        formState: nextFormState,
        chatMessages: [...s.chatMessages, assistantMsg],
        assistantLoading: false,
        lastAppliedBatch: batchEntries.length ? { messageId: assistantMsg.id, entries: batchEntries } : s.lastAppliedBatch,
        dirty: true,
      }))
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: nextId('msg'),
        role: 'assistant',
        content: "Sorry, the assistant is unavailable right now. You can keep filling out the form manually.",
        isError: true,
      }
      set((s) => ({
        chatMessages: [...s.chatMessages, errorMsg],
        assistantLoading: false,
        assistantError: err instanceof Error ? err.message : 'Assistant request failed',
      }))
    }
  },

  resolveConflict: (messageId, path, accept) =>
    set((s) => {
      let formState = s.formState
      const chatMessages = s.chatMessages.map((m) => {
        if (m.id !== messageId || !m.pendingConflicts) return m
        return {
          ...m,
          pendingConflicts: m.pendingConflicts.map((c) => {
            if (c.path !== path) return c
            if (accept) formState = setByPath(formState, path, c.newValue)
            return { ...c, resolved: (accept ? 'accepted' : 'dismissed') as 'accepted' | 'dismissed' }
          }),
        }
      })
      return { formState, chatMessages }
    }),

  undoLastBatch: () =>
    set((s) => {
      if (!s.lastAppliedBatch) return s
      let formState = s.formState
      for (const entry of s.lastAppliedBatch.entries) {
        formState = setByPath(formState, entry.path, entry.prevValue)
      }
      const chatMessages = s.chatMessages.map((m) =>
        m.id === s.lastAppliedBatch!.messageId ? { ...m, reverted: true } : m,
      )
      return { formState, chatMessages, lastAppliedBatch: null }
    }),

  reset: () =>
    set({
      step: 0,
      formState: initialFormState(),
      touchedFields: new Set(),
      nameUniqueStatus: 'idle',
      nameSuggestion: undefined,
      uploadedDocs: [],
      dirty: false,
      lastAppliedBatch: null,
    }),
}))
