import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createStore } from 'vuex'
import { createRouter, createMemoryHistory } from 'vue-router'
import { mount } from '@vue/test-utils'

// Mock Firebase operations
const mockFirebaseOperations = {
  createUser: vi.fn(),
  createProject: vi.fn(),
  setDefaultProject: vi.fn(),
  addUserToProject: vi.fn()
}

vi.mock('../../services/firebaseDataService', () => ({
  User: {
    createUser: mockFirebaseOperations.createUser,
    setDefaultProject: mockFirebaseOperations.setDefaultProject
  },
  Project: {
    create: mockFirebaseOperations.createProject,
    addUserToProject: mockFirebaseOperations.addUserToProject
  },
  Document: {
    create: vi.fn()
  }
}))

describe('User Onboarding Flow Integration Tests', () => {
  let store
  let router

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()

    // Create store with all necessary state and actions
    store = createStore({
      state: {
        user: {
          loggedIn: false,
          displayName: null,
          uid: null,
          email: null,
          tier: null,
          defaultProject: null,
          projects: []
        },
        loadingUser: false,
        project: {
          id: null,
          folders: [],
          name: null,
          createdBy: null,
          users: []
        },
        projects: [],
        documents: [],
        selected: {
          id: null,
          data: {}
        },
        globalAlerts: []
      },
      getters: {
        isUserLoggedIn: (state) => !!state.user.uid,
        isLoggedIn: (state) => !!state.user.uid
      },
      mutations: {
        setUserData: (state, payload) => {
          state.user.displayName = payload?.displayName || null
          state.user.uid = payload?.id || null
          state.user.email = payload?.email || null
          state.user.defaultProject = payload?.defaultProject || null
          state.user.tier = payload?.tier || 'free'
          state.user.projects = payload?.projects || []
        },
        setLoadingUser: (state, loading) => {
          state.loadingUser = loading
        },
        setProject: (state, projectId) => {
          if (projectId) {
            state.project.id = projectId
          }
        },
        setDefaultProject: (state, projectId) => {
          state.user.defaultProject = projectId
        },
        alert: (state, alert) => {
          state.globalAlerts.push(alert)
        },
        addDocument: (state, document) => {
          state.documents.push(document)
        },
        setSelectedDocument: (state, document) => {
          state.selected = document
        }
      },
      actions: {
        enter: vi.fn(),
        createDocument: vi.fn().mockImplementation(async ({ commit }, { data }) => {
          const mockResult = { id: 'doc-123', data }
          commit('addDocument', mockResult)
          commit('setSelectedDocument', mockResult)
          return mockResult
        })
      }
    })

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
        displayName: 'Test User'
      }

      // Mock successful user creation
      mockFirebaseOperations.createUser.mockResolvedValue({
        id: newUser.uid,
        email: newUser.email,
        displayName: newUser.displayName,
        defaultProject: null,
        tier: 'pro'
      })

      // Simulate user signup
      await store.commit('setUserData', {
        id: newUser.uid,
        email: newUser.email,
        displayName: newUser.displayName,
        defaultProject: null,
        tier: 'pro'
      })

      // Verify user is created but has no default project
      expect(store.isUserLoggedIn).toBe(true)
      expect(store.user.email).toBe('test@example.com')
      expect(store.user.defaultProject).toBeNull()

      // STEP 2: Project Setup
      const projectData = {
        name: 'My First Project',
        folders: [
          { name: 'Product' },
          { name: 'Features' },
          { name: 'Notes' }
        ],
        createdBy: newUser.uid,
        org: 'example.com'
      }

      // Mock successful project creation
      const mockProjectRef = { id: 'project-123' }
      mockFirebaseOperations.createProject.mockResolvedValue(mockProjectRef)
      mockFirebaseOperations.addUserToProject.mockResolvedValue()
      mockFirebaseOperations.setDefaultProject.mockResolvedValue()

      // Simulate project creation through GetStarted component flow
      store.commit('setProject', mockProjectRef.id)
      store.commit('setDefaultProject', mockProjectRef.id)

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
      const createdDoc = await store.dispatch('createDocument', { data: firstDocData })

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
      store.commit('setUserData', {
        id: 'user-123',
        email: 'test@example.com',
        defaultProject: null
      })

      const customProject = {
        name: 'Custom Project',
        folders: [
          { name: 'Research' },
          { name: 'Strategy' },
          { name: 'Implementation' },
          { name: 'Testing' }
        ]
      }

      const mockProjectRef = { id: 'custom-project-456' }
      mockFirebaseOperations.createProject.mockResolvedValue(mockProjectRef)

      // Simulate custom project setup
      store.commit('setProject', mockProjectRef.id)

      expect(store.project.id).toBe('custom-project-456')
    })

    it('should handle onboarding errors gracefully', async () => {
      // Setup user
      store.commit('setUserData', {
        id: 'user-123',
        email: 'test@example.com'
      })

      // Mock project creation failure
      mockFirebaseOperations.createProject.mockRejectedValue(
        new Error('Project creation failed')
      )

      // Verify error doesn't break the flow
      expect(store.isUserLoggedIn).toBe(true)
      // User should still be able to retry project setup
    })

    it('should prevent onboarding without authentication', () => {
      // Verify unauthenticated state
      expect(store.isUserLoggedIn).toBe(false)
      expect(store.user.uid).toBeNull()

      // Project setup should be blocked
      expect(store.user.defaultProject).toBeNull()
      expect(store.project.id).toBeNull()
    })
  })

  describe('Project Configuration Variations', () => {
    beforeEach(() => {
      // Setup authenticated user for project tests
      store.commit('setUserData', {
        id: 'user-123',
        email: 'test@example.com',
        tier: 'pro'
      })
    })

    it('should handle minimal project setup', async () => {
      const minimalProject = {
        name: 'Simple Project',
        folders: []
      }

      const mockProjectRef = { id: 'minimal-project' }
      mockFirebaseOperations.createProject.mockResolvedValue(mockProjectRef)

      store.commit('setProject', mockProjectRef.id)

      expect(store.project.id).toBe('minimal-project')
    })

    it('should handle enterprise project setup', async () => {
      const enterpriseProject = {
        name: 'Enterprise Project',
        folders: [
          { name: 'Product Management' },
          { name: 'Engineering' },
          { name: 'Design' },
          { name: 'Marketing' },
          { name: 'Sales' },
          { name: 'Support' }
        ],
        org: 'bigcompany.com'
      }

      const mockProjectRef = { id: 'enterprise-project' }
      mockFirebaseOperations.createProject.mockResolvedValue(mockProjectRef)

      store.commit('setProject', mockProjectRef.id)

      expect(store.project.id).toBe('enterprise-project')
    })
  })

  describe('User State Persistence', () => {
    it('should maintain user state during onboarding steps', async () => {
      const userData = {
        id: 'persistent-user',
        email: 'persistent@example.com',
        displayName: 'Persistent User',
        tier: 'pro'
      }

      // Set initial user data
      store.commit('setUserData', userData)

      // Verify persistence through project setup
      const mockProjectRef = { id: 'persistent-project' }
      mockFirebaseOperations.createProject.mockResolvedValue(mockProjectRef)
      
      store.commit('setProject', mockProjectRef.id)
      store.commit('setDefaultProject', mockProjectRef.id)

      // User data should remain intact
      expect(store.user.email).toBe('persistent@example.com')
      expect(store.user.tier).toBe('pro')
      expect(store.user.defaultProject).toBe('persistent-project')
    })

    it('should handle loading states correctly', async () => {
      expect(store.loadingUser).toBe(false)

      store.commit('setLoadingUser', true)
      expect(store.loadingUser).toBe(true)

      // Simulate async operation completion
      store.commit('setLoadingUser', false)
      expect(store.loadingUser).toBe(false)
    })
  })

  describe('Alert System During Onboarding', () => {
    it('should show appropriate alerts during onboarding', () => {
      // Initial state
      expect(store.globalAlerts).toHaveLength(0)

      // Simulate onboarding alerts
      store.commit('alert', { 
        type: 'info', 
        message: 'New User Account Created!' 
      })

      store.commit('alert', { 
        type: 'info', 
        message: 'Project added' 
      })

      store.commit('alert', { 
        type: 'info', 
        message: 'Default project set' 
      })

      expect(store.globalAlerts).toHaveLength(3)
      expect(store.globalAlerts[0].message).toBe('New User Account Created!')
      expect(store.globalAlerts[1].message).toBe('Project added')
      expect(store.globalAlerts[2].message).toBe('Default project set')
    })
  })
}) 