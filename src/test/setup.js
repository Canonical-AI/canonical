// Global test setup
import { vi } from 'vitest'

// Mock Firebase
vi.mock('../firebase.js', () => ({
  firebaseApp: {
    name: '[DEFAULT]',
    options: {}
  },
  auth: {},
  db: {},
  analytics: {}
}))

// Mock Firebase Auth
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
  onAuthStateChanged: vi.fn((auth, callback) => {
    callback(null)
    return vi.fn() // Unsubscribe function
  }),
  GoogleAuthProvider: vi.fn(),
  GithubAuthProvider: vi.fn(),
  signInWithPopup: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signInWithEmailAndPassword: vi.fn()
}))

// Mock Firebase Firestore
vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  getDocs: vi.fn()
}))

// Mock Firebase VertexAI
vi.mock('firebase/vertexai', () => ({
  getVertexAI: vi.fn(() => ({})),
  getGenerativeModel: vi.fn(() => ({}))
}))

// Mock Vertex AI service
vi.mock('../services/vertexAiService.js', () => ({
  default: {
    generateText: vi.fn(() => Promise.resolve('Mock generated text')),
    generateContent: vi.fn(() => Promise.resolve({ text: 'Mock content' }))
  }
}))

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
} 