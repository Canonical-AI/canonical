import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useMainStore } from '../../store/index.js'
import { createRouter, createMemoryHistory } from 'vue-router'

// Mock Firebase operations
vi.mock('../../services/firebaseDataService', () => ({
  User: {
    createUser: vi.fn(),
    setDefaultProject: vi.fn(),
    getUserAuth: vi.fn(),
    getUserData: vi.fn()
  },
  Project: {
    create: vi.fn(),
    addUserToProject: vi.fn(),
    getById: vi.fn()
  },
  Document: {
    create: vi.fn(),
    getAll: vi.fn()
  },
  ChatHistory: { getAll: vi.fn() },
  Favorites: { getAll: vi.fn() },
  Template: { getAll: vi.fn() },
  Comment: { getAll: vi.fn() },
  Task: { getAll: vi.fn() }
}))

// Mock router
vi.mock('../../router', () => ({
  default: {
    push: vi.fn()
  }
}))

describe('User Onboarding Flow Integration Tests', () => {
  let store
  let router
  let mockFirebase

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks()

    // Get mock functions
    mockFirebase = await import('../../services/firebaseDataService')

    // Create fresh Pinia instance
    const pinia = createPinia()
    setActivePinia(pinia)
    
    // Get the store instance
    store = useMainStore()

    // Create router
    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div>Home</div>' } },
        { path: '/new-user', component: { template: '<div>New User Setup</div>' } },
        { path: '/document/:id', component: { template: '<div>Document</div>' } }
      ]
    })
  })

  describe('Complete User Onboarding Journey', () => {
    it('should handle full onboarding flow: signup → project setup → first document', async () => {
      // STEP 1: User Signs Up
      const newUser = {
        uid: 'new-user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        tier: 'pro',
        defaultProject: null,
        projects: []
      }

      // Mock successful user creation
      mockFirebase.User.createUser.mockResolvedValue({
        id: newUser.uid,
        email: newUser.email,
        displayName: newUser.displayName,
        defaultProject: null,
        tier: 'pro',
        projects: []
      })

      // Simulate user signup
      store.userSetData(newUser)

      // Verify user is created but has no default project
      expect(store.isUserLoggedIn).toBe(true)
      expect(store.user.email).toBe('test@example.com')
      expect(store.user.defaultProject).toBeNull()

      // STEP 2: Project Setup
      const projectData = {
        name: 'My First Project',
        folders: [
          { name: 'Product', children: [], isOpen: true },
          { name: 'Features', children: [], isOpen: true },
          { name: 'Notes', children: [], isOpen: true }
        ],
        createdBy: newUser.uid,
        users: [newUser.uid]
      }

      // Mock successful project creation and retrieval
      const mockProjectRef = { id: 'project-123' }
      mockFirebase.Project.create.mockResolvedValue(mockProjectRef)
      mockFirebase.Project.addUserToProject.mockResolvedValue()
      mockFirebase.User.setDefaultProject.mockResolvedValue()
      
      // Mock project retrieval (this is what projectSet calls)
      mockFirebase.Project.getById.mockResolvedValue({
        id: 'project-123',
        ...projectData
      })

      // Mock document loading (called by projectGetAllData)
      mockFirebase.Document.getAll.mockResolvedValue([])

      // Simulate project creation through GetStarted component flow
      await store.projectSet('project-123')
      await store.userSetDefaultProject('project-123')

      // Verify project setup completed
      expect(store.project.id).toBe('project-123')
      expect(store.user.defaultProject).toBe('project-123')

      // STEP 3: First Document Creation
      const firstDocData = {
        name: "My first product doc",
        content: "Welcome to *Canonical!* we've created this document to help you get started.",
        draft: true
      }

      // Mock document creation
      mockFirebase.Document.create.mockResolvedValue({
        id: 'doc-123',
        data: firstDocData
      })

      const createdDoc = await store.documentsCreate({ data: firstDocData })

      // Verify complete onboarding flow
      expect(store.isUserLoggedIn).toBe(true)
      expect(store.user.defaultProject).toBe('project-123')
      expect(store.project.id).toBe('project-123')
      expect(createdDoc.id).toBe('doc-123')
      expect(store.documents).toHaveLength(1)
      expect(store.selected.id).toBe('doc-123')
    })

    it('should handle project setup with custom folders', async () => {
      // Setup authenticated user
      store.userSetData({
        uid: 'user-123',
        email: 'user@example.com',
        displayName: 'Test User',
        tier: 'pro',
        defaultProject: null,
        projects: []
      })

      const customProjectData = {
        name: 'Custom Project',
        folders: [
          { name: 'Engineering', children: [], isOpen: true },
          { name: 'Design', children: [], isOpen: true },
          { name: 'Marketing', children: [], isOpen: true },
          { name: 'Research', children: [], isOpen: true }
        ],
        createdBy: 'user-123',
        users: ['user-123']
      }

      mockFirebase.Project.create.mockResolvedValue({ id: 'custom-project-456' })
      mockFirebase.Project.getById.mockResolvedValue({
        id: 'custom-project-456',
        ...customProjectData
      })

      // Mock document loading
      mockFirebase.Document.getAll.mockResolvedValue([])

      await store.projectSet('custom-project-456')

      expect(store.project.id).toBe('custom-project-456')
      expect(store.project.name).toBe('Custom Project')
      expect(store.project.folders).toEqual(customProjectData.folders)
    })

    it('should handle user entering with existing project', async () => {
      const existingUser = {
        uid: 'existing-user-789',
        email: 'existing@example.com',
        displayName: 'Existing User',
        tier: 'pro',
        defaultProject: 'existing-project-789',
        projects: ['existing-project-789']
      }

      const existingProject = {
        id: 'existing-project-789',
        name: 'Existing Project',
        folders: [
          { name: 'Docs', children: ['doc-1', 'doc-2'], isOpen: true }
        ],
        users: ['existing-user-789'],
        createdBy: 'existing-user-789'
      }

      // Mock user authentication with existing data
      mockFirebase.User.getUserAuth.mockResolvedValue(existingUser)
      mockFirebase.Project.getById.mockResolvedValue(existingProject)

      // Mock document loading
      mockFirebase.Document.getAll.mockResolvedValue([])

      // Simulate user entering app
      await store.userEnter()

      expect(store.isUserLoggedIn).toBe(true)
      expect(store.user.uid).toBe('existing-user-789')
      expect(store.user.defaultProject).toBe('existing-project-789')
      expect(store.project.id).toBe('existing-project-789')
      expect(store.project.name).toBe('Existing Project')
    })
  })

  describe('Onboarding Error Handling', () => {
    it('should handle authentication failure gracefully', async () => {
      mockFirebase.User.getUserAuth.mockRejectedValue(new Error('Auth failed'))

      await store.userEnter()

      expect(store.isUserLoggedIn).toBe(false)
      expect(store.loadingUser).toBe(false)
      expect(store.globalAlerts).toHaveLength(1)
      expect(store.globalAlerts[0].type).toBe('error')
      expect(store.globalAlerts[0].message).toContain('Authentication failed')
    })

    it('should handle project creation failure', async () => {
      store.userSetData({
        uid: 'user-123',
        email: 'user@example.com',
        displayName: 'Test User',
        tier: 'pro',
        defaultProject: null,
        projects: []
      })

      mockFirebase.Project.getById.mockRejectedValue(new Error('Project not found'))

      // The projectSet method will throw an error when Project.getById fails
      await expect(store.projectSet('failing-project'))
        .rejects.toThrow('Project not found')
    })
  })

  describe('State Consistency During Onboarding', () => {
    it('should maintain loading states correctly during onboarding', async () => {
      mockFirebase.User.getUserAuth.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({
          uid: 'slow-user',
          email: 'slow@example.com',
          displayName: 'Slow User',
          tier: 'pro',
          defaultProject: 'slow-project',
          projects: ['slow-project']
        }), 100))
      )

      mockFirebase.Project.getById.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({
          id: 'slow-project',
          name: 'Slow Project', 
          folders: []
        }), 50))
      )

      // Mock document loading
      mockFirebase.Document.getAll.mockResolvedValue([])

      // Start user enter process
      const enterPromise = store.userEnter()
      
      // Should be loading initially
      expect(store.loadingUser).toBe(true)

      // Wait for completion
      await enterPromise

      // Should no longer be loading
      expect(store.loadingUser).toBe(false)
      expect(store.isUserLoggedIn).toBe(true)
      expect(store.project.id).toBe('slow-project')
    })

    it('should handle concurrent user operations correctly', async () => {
      const userData = {
        uid: 'concurrent-user',
        email: 'concurrent@example.com',
        displayName: 'Concurrent User',
        tier: 'pro',
        defaultProject: 'concurrent-project',
        projects: ['concurrent-project']
      }

      mockFirebase.User.getUserAuth.mockResolvedValue(userData)
      mockFirebase.Project.getById.mockResolvedValue({
        id: 'concurrent-project',
        name: 'Concurrent Project', 
        folders: []
      })

      // Mock document loading
      mockFirebase.Document.getAll.mockResolvedValue([])

      // Start multiple concurrent operations
      const enter1 = store.userEnter()
      const enter2 = store.userEnter()
      
      await Promise.all([enter1, enter2])

      // Should have consistent final state
      expect(store.isUserLoggedIn).toBe(true)
      expect(store.user.uid).toBe('concurrent-user')
      expect(store.project.id).toBe('concurrent-project')
      expect(store.loadingUser).toBe(false)
    })
  })
}) 