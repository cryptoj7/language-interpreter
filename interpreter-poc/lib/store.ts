import { configureStore, createSlice, PayloadAction } from '@reduxjs/toolkit'

export interface Utterance {
  id: string
  role: 'doctor' | 'patient' | 'system'
  text: string
  originalLang: 'en' | 'es'
  translatedText?: string
  timestamp: string
  audioUrl?: string
}

export interface Conversation {
  id: string
  utterances: Utterance[]
  summary?: string
  actions: string[]
  status: 'active' | 'completed'
  lastDoctorUtterance?: Utterance
}

export interface DetectedAction {
  name: string
  parameters: Record<string, any>
  executed: boolean
}

interface InterpreterState {
  currentConversation: Conversation | null
  isRecording: boolean
  isConnected: boolean
  detectedActions: DetectedAction[]
  error: string | null
}

const initialState: InterpreterState = {
  currentConversation: null,
  isRecording: false,
  isConnected: false,
  detectedActions: [],
  error: null
}

const interpreterSlice = createSlice({
  name: 'interpreter',
  initialState,
  reducers: {
    startConversation: (state, action: PayloadAction<string>) => {
      state.currentConversation = {
        id: action.payload,
        utterances: [],
        actions: [],
        status: 'active'
      }
    },
    addUtterance: (state, action: PayloadAction<Utterance>) => {
      if (state.currentConversation) {
        state.currentConversation.utterances.push(action.payload)
        
        // Store last doctor utterance for repeat functionality
        if (action.payload.role === 'doctor') {
          state.currentConversation.lastDoctorUtterance = action.payload
        }
      }
    },
    setRecording: (state, action: PayloadAction<boolean>) => {
      state.isRecording = action.payload
    },
    setConnected: (state, action: PayloadAction<boolean>) => {
      state.isConnected = action.payload
    },
    addDetectedAction: (state, action: PayloadAction<DetectedAction>) => {
      state.detectedActions.push(action.payload)
    },
    markActionExecuted: (state, action: PayloadAction<string>) => {
      const action_item = state.detectedActions.find(a => a.name === action.payload)
      if (action_item) {
        action_item.executed = true
      }
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload
    },
    endConversation: (state, action: PayloadAction<{ summary: string; actions: string[] }>) => {
      if (state.currentConversation) {
        state.currentConversation.status = 'completed'
        state.currentConversation.summary = action.payload.summary
        state.currentConversation.actions = action.payload.actions
      }
    }
  }
})

export const {
  startConversation,
  addUtterance,
  setRecording,
  setConnected,
  addDetectedAction,
  markActionExecuted,
  setError,
  endConversation
} = interpreterSlice.actions

export const store = configureStore({
  reducer: {
    interpreter: interpreterSlice.reducer
  }
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch 