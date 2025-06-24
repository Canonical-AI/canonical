import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useMainStore } from '../../store/index.js'

// Mock Firebase services
vi.mock('../../services/firebaseDataService', () => ({
  User: {
    getUserAuth: vi.fn(),
    getUserData: vi.fn(),
    setDefaultProject: vi.fn()
  },
  Document: {
    getAll: vi.fn(),
    create: vi.fn(),
    updateDoc: vi.fn(),
    deleteDocByID: vi.fn(),
    archiveDoc: vi.fn()
  },
  Project: {
    getById: vi.fn(),
    getAll: vi.fn()
  },
  ChatHistory: {
    getAll: vi.fn()
  },
  Favorites: {
    getAll: vi.fn()
  },
  Template: {
    getAll: vi.fn()
  },
  Comment: {
    getAll: vi.fn()
  },
  Task: {
    getAll: vi.fn()
  }
}))

// Mock router
vi.mock('../../router', () => ({
  default: {
    push: vi.fn()
  }
}))

describe('Store Integration Tests', () => {
  let store

  beforeEach(() => {
    // Create fresh Pinia instance
    const pinia = createPinia()
    setActivePinia(pinia)
    
    // Get the store instance
    store = useMainStore()
  })

  describe('User Authentication Flow', () => {
    it('should handle user login correctly', async () => {
      // Initially not logged in
      expect(store.isUserLoggedIn).toBe(false)
      expect(store.user.loggedIn).toBe(false)

      // Login user
      const testUser = { 
        uid: 'test-123', 
        email: 'test@example.com',
        displayName: 'Test User',
        tier: 'pro',
        defaultProject: null,
        projects: []
      }
      
      store.userSetData(testUser)

      // Should be logged in
      expect(store.isUserLoggedIn).toBe(true)
      expect(store.user.loggedIn).toBe(true)
      expect(store.user.uid).toBe('test-123')
      expect(store.user.email).toBe('test@example.com')
    })

    it('should handle user logout correctly', async () => {
      // First login
      const testUser = { 
        uid: 'test-123', 
        email: 'test@example.com',
        displayName: 'Test User',
        tier: 'pro',
        defaultProject: 'project-1',
        projects: ['project-1']
      }
      
      store.userSetData(testUser)
      
      // Set some document state
      store.documentsUpdate({ id: 'doc-1', data: { name: 'Test Doc' } })

      // Logout
      store.userLogout()

      // Should be logged out and state cleared
      expect(store.isUserLoggedIn).toBe(false)
      expect(store.user.loggedIn).toBe(false)
      expect(store.user.uid).toBeNull()
      expect(store.selected.id).toBeNull()
    })
  })

  describe('Alert System', () => {
    it('should manage alerts correctly', () => {
      // Initially no alerts
      expect(store.globalAlerts).toHaveLength(0)

      // Add an alert
      store.uiAlert({ type: 'success', message: 'Test alert' })

      // Should have one alert
      expect(store.globalAlerts).toHaveLength(1)
      expect(store.globalAlerts[0]).toMatchObject({
        type: 'success',
        message: 'Test alert'
      })
    })

    it('should handle multiple alerts', () => {
      store.uiAlert({ type: 'success', message: 'Alert 1' })
      store.uiAlert({ type: 'error', message: 'Alert 2' })
      store.uiAlert({ type: 'info', message: 'Alert 3' })

      expect(store.globalAlerts).toHaveLength(3)
      expect(store.globalAlerts.map(a => a.message)).toEqual(['Alert 1', 'Alert 2', 'Alert 3'])
    })
  })

  describe('Document Management', () => {
    it('should manage selected document state', () => {
      const testDoc = { id: 'doc-1', data: { name: 'Test Document', content: 'Test content' } }

      // Set selected document
      store.documentsUpdate(testDoc)

      expect(store.selected.id).toBe('doc-1')
      expect(store.selected.data.name).toBe('Test Document')
    })

    it('should manage documents list', () => {
      const doc1 = { id: 'doc-1', data: { name: 'Doc 1' } }
      const doc2 = { id: 'doc-2', data: { name: 'Doc 2' } }

      // Set documents
      store.documents = [doc1, doc2]

      expect(store.documents).toHaveLength(2)
      expect(store.documents[0]).toEqual(doc1)
      expect(store.documents[1]).toEqual(doc2)
    })

    it('should filter documents correctly', () => {
      const doc1 = { id: 'doc-1', data: { name: 'Important Document' } }
      const doc2 = { id: 'doc-2', data: { name: 'Regular Document' } }
      const doc3 = { id: 'doc-3', data: { name: 'Another Important One' } }

      store.documents = [doc1, doc2, doc3]
      store.filter = 'Important'

      const filtered = store.filteredDocuments
      expect(filtered).toHaveLength(2)
      expect(filtered.map(d => d.id)).toEqual(['doc-1', 'doc-3'])
    })
  })

  describe('Project Management', () => {
    it('should set project data correctly', () => {
      const projectData = {
        id: 'project-123',
        name: 'Test Project',
        folders: [],
        users: ['user-1'],
        createdBy: 'user-1'
      }

      // Set project data directly for testing
      store.project = projectData

      expect(store.project.id).toBe('project-123')
      expect(store.project.name).toBe('Test Project')
    })
  })

  describe('State Consistency', () => {
    it('should maintain consistent state during complex operations', async () => {
      // Login user
      const user = { 
        uid: 'test-123', 
        email: 'test@example.com',
        displayName: 'Test User',
        tier: 'pro',
        defaultProject: 'project-1',
        projects: ['project-1']
      }
      
      store.userSetData(user)

      // Set document
      const document = { id: 'doc-1', data: { name: 'Test Doc' } }
      store.documentsUpdate(document)

      // Add alert
      store.uiAlert({ type: 'info', message: 'Document loaded' })

      // Verify all state is consistent
      expect(store.isUserLoggedIn).toBe(true)
      expect(store.user.uid).toBe('test-123')
      expect(store.selected.id).toBe('doc-1')
      expect(store.globalAlerts).toHaveLength(1)

      // Logout should clear user state but preserve alerts
      store.userLogout()

      expect(store.isUserLoggedIn).toBe(false)
      expect(store.user.uid).toBeNull()
      expect(store.selected.id).toBeNull()
      expect(store.globalAlerts).toHaveLength(1) // Alerts should persist
    })
  })
}) 