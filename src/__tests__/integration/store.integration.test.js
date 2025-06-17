import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createStore } from 'vuex'

describe('Store Integration Tests', () => {
  let store

  beforeEach(() => {
    store = createStore({
      state: {
        user: null,
        isUserLoggedIn: false,
        currentDocument: null,
        documents: [],
        alerts: [],
        isOnline: true
      },
      getters: {
        isLoggedIn: (state) => !!state.user,
        isUserLoggedIn: (state) => state.isUserLoggedIn,
        currentDocument: (state) => state.currentDocument,
        documents: (state) => state.documents,
        alertsCount: (state) => state.alerts.length
      },
      mutations: {
        setUser: (state, user) => { 
          state.user = user 
        },
        setUserLoggedIn: (state, status) => { 
          state.isUserLoggedIn = status 
        },
        alert: (state, alert) => { 
          state.alerts.push(alert) 
        },
        clearAlerts: (state) => {
          state.alerts = []
        },
        setCurrentDocument: (state, document) => {
          state.currentDocument = document
        },
        addDocument: (state, document) => {
          state.documents.push(document)
        }
      },
      actions: {
        enter: ({ commit }, user) => {
          commit('setUser', user)
          commit('setUserLoggedIn', true)
        },
        logout: ({ commit }) => {
          commit('setUser', null)
          commit('setUserLoggedIn', false)
          commit('setCurrentDocument', null)
        },
        showAlert: ({ commit }, { type, message }) => {
          commit('alert', { type, message, timestamp: Date.now() })
        }
      }
    })
  })

  describe('User Authentication Flow', () => {
    it('should handle user login correctly', async () => {
      // Initially not logged in
      expect(store.getters.isUserLoggedIn).toBe(false)
      expect(store.getters.isLoggedIn).toBe(false)

      // Login user
      const testUser = { uid: 'test-123', email: 'test@example.com' }
      await store.dispatch('enter', testUser)

      // Should be logged in
      expect(store.getters.isUserLoggedIn).toBe(true)
      expect(store.getters.isLoggedIn).toBe(true)
      expect(store.state.user).toEqual(testUser)
    })

    it('should handle user logout correctly', async () => {
      // First login
      const testUser = { uid: 'test-123', email: 'test@example.com' }
      await store.dispatch('enter', testUser)
      
      // Set some document state
      store.commit('setCurrentDocument', { id: 'doc-1', title: 'Test Doc' })

      // Logout
      await store.dispatch('logout')

      // Should be logged out and state cleared
      expect(store.getters.isUserLoggedIn).toBe(false)
      expect(store.getters.isLoggedIn).toBe(false)
      expect(store.state.user).toBeNull()
      expect(store.state.currentDocument).toBeNull()
    })
  })

  describe('Alert System', () => {
    it('should manage alerts correctly', async () => {
      // Initially no alerts
      expect(store.getters.alertsCount).toBe(0)

      // Add an alert
      await store.dispatch('showAlert', { type: 'success', message: 'Test alert' })

      // Should have one alert
      expect(store.getters.alertsCount).toBe(1)
      expect(store.state.alerts[0]).toMatchObject({
        type: 'success',
        message: 'Test alert'
      })

      // Clear alerts
      store.commit('clearAlerts')

      // Should have no alerts
      expect(store.getters.alertsCount).toBe(0)
    })

    it('should handle multiple alerts', async () => {
      await store.dispatch('showAlert', { type: 'success', message: 'Alert 1' })
      await store.dispatch('showAlert', { type: 'error', message: 'Alert 2' })
      await store.dispatch('showAlert', { type: 'info', message: 'Alert 3' })

      expect(store.getters.alertsCount).toBe(3)
      expect(store.state.alerts.map(a => a.message)).toEqual(['Alert 1', 'Alert 2', 'Alert 3'])
    })
  })

  describe('Document Management', () => {
    it('should manage current document state', () => {
      const testDoc = { id: 'doc-1', title: 'Test Document', content: 'Test content' }

      // Set current document
      store.commit('setCurrentDocument', testDoc)

      expect(store.getters.currentDocument).toEqual(testDoc)
    })

    it('should manage documents list', () => {
      const doc1 = { id: 'doc-1', title: 'Doc 1' }
      const doc2 = { id: 'doc-2', title: 'Doc 2' }

      // Add documents
      store.commit('addDocument', doc1)
      store.commit('addDocument', doc2)

      expect(store.getters.documents).toHaveLength(2)
      expect(store.getters.documents[0]).toEqual(doc1)
      expect(store.getters.documents[1]).toEqual(doc2)
    })
  })

  describe('State Consistency', () => {
    it('should maintain consistent state during complex operations', async () => {
      // Login user
      const user = { uid: 'test-123', email: 'test@example.com' }
      await store.dispatch('enter', user)

      // Set document
      const document = { id: 'doc-1', title: 'Test Doc' }
      store.commit('setCurrentDocument', document)

      // Add alert
      await store.dispatch('showAlert', { type: 'info', message: 'Document loaded' })

      // Verify all state is consistent
      expect(store.getters.isUserLoggedIn).toBe(true)
      expect(store.state.user).toEqual(user)
      expect(store.getters.currentDocument).toEqual(document)
      expect(store.getters.alertsCount).toBe(1)

      // Logout should clear user state but preserve alerts
      await store.dispatch('logout')

      expect(store.getters.isUserLoggedIn).toBe(false)
      expect(store.state.user).toBeNull()
      expect(store.state.currentDocument).toBeNull()
      expect(store.getters.alertsCount).toBe(1) // Alerts should persist
    })
  })
}) 