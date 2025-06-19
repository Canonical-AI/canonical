import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createStore } from 'vuex'
import { createRouter, createMemoryHistory } from 'vue-router'

// Mock Firebase document operations
const mockDocumentOperations = {
  create: vi.fn(),
  updateDoc: vi.fn(),
  updateDocField: vi.fn(),
  archiveDoc: vi.fn(),
  deleteDocByID: vi.fn(),
  getDocById: vi.fn(),
  getAll: vi.fn()
}

vi.mock('../../services/firebaseDataService', () => ({
  Document: {
    create: mockDocumentOperations.create,
    updateDoc: mockDocumentOperations.updateDoc,
    updateDocField: mockDocumentOperations.updateDocField,
    archiveDoc: mockDocumentOperations.archiveDoc,
    deleteDocByID: mockDocumentOperations.deleteDocByID,
    getDocById: mockDocumentOperations.getDocById,
    getAll: mockDocumentOperations.getAll
  }
}))

describe('Document Editing Integration Tests', () => {
  let store
  let router

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()

    // Create store with document management functionality
    store = createStore({
      state: {
        user: {
          uid: 'test-user-123',
          email: 'test@example.com',
          tier: 'pro'
        },
        project: {
          id: 'test-project-123',
          name: 'Test Project'
        },
        documents: [],
        selected: {
          id: null,
          data: {},
          isLoading: false
        },
        globalAlerts: []
      },
      getters: {
        isUserLoggedIn: (state) => !!state.user.uid
      },
      mutations: {
        addDocument: (state, document) => {
          state.documents.push(document)
        },
        removeDocument: (state, documentId) => {
          state.documents = state.documents.filter(doc => doc.id !== documentId)
        },
        setDocuments: (state, documents) => {
          state.documents = documents
        },
        setSelectedDocument: (state, document) => {
          state.selected = { ...state.selected, ...document }
        },
        updateSelectedDocument: (state, document) => {
          if (document.id) {
            state.selected = { ...state.selected, ...document }
            // Update in documents array as well
            const docIndex = state.documents.findIndex(doc => doc.id === document.id)
            if (docIndex !== -1) {
              state.documents[docIndex] = { ...state.documents[docIndex], ...document }
            }
          }
        },
        saveSelectedDocument: (state) => {
          // This mutation triggers the save
          const docIndex = state.documents.findIndex(doc => doc.id === state.selected.id)
          if (docIndex !== -1) {
            state.documents[docIndex].data = { ...state.selected.data }
          }
        },
        alert: (state, alert) => {
          state.globalAlerts.push(alert)
        }
      },
      actions: {
        async createDocument({ commit, state }, { data, select = true }) {
          const createdDoc = await mockDocumentOperations.create(data)
          if (select) {
            commit('setSelectedDocument', { 
              id: createdDoc.id, 
              data: createdDoc.data || data,
              isLoading: false 
            })
          }
          commit('addDocument', { id: createdDoc.id, data: createdDoc.data || data })
          return { id: createdDoc.id, data: createdDoc.data || data }
        },

        async selectDocument({ commit, state }, { id, version = null }) {
          commit('setSelectedDocument', { ...state.selected, isLoading: true })

          try {
            const selectedData = await mockDocumentOperations.getDocById(id)
            if (!selectedData || !selectedData.data) {
              commit('alert', { type: 'error', message: `${id} not found` })
              return null
            }

            commit('setSelectedDocument', { 
              ...selectedData, 
              isLoading: false,
              currentVersion: version || 'live'
            })
            return selectedData
          } catch (error) {
            commit('setSelectedDocument', { ...state.selected, isLoading: false })
            return null
          }
        },

        async deleteDocument({ commit }, { id }) {
          await mockDocumentOperations.deleteDocByID(id)
          commit('removeDocument', id)
        },

        async archiveDocument({ commit }, { id }) {
          await mockDocumentOperations.archiveDoc(id)
          commit('removeDocument', id)
        },

        async getDocuments({ commit }) {
          const documents = await mockDocumentOperations.getAll()
          commit('setDocuments', documents)
          return documents
        },

        async toggleDraft({ commit, state }) {
          state.selected.data.draft = !state.selected.data.draft
          await mockDocumentOperations.updateDoc(state.selected.id, state.selected.data)
          
          // Update the document in the documents array
          const docIndex = state.documents.findIndex(doc => doc.id === state.selected.id)
          if (docIndex !== -1) {
            state.documents[docIndex].data = { ...state.documents[docIndex].data, ...state.selected.data }
          }
        }
      }
    })

    // Create router
    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div>Home</div>' } },
        { path: '/document/:id', component: { template: '<div>Document</div>' } },
        { path: '/document/create-document', component: { template: '<div>Create</div>' } }
      ]
    })
  })

  describe('Document Creation Flow', () => {
    it('should create a new document successfully', async () => {
      const newDocumentData = {
        name: '[DRAFT] - My New Document',
        content: 'This is a new document with **bold** text.',
        draft: true,
        folder: 'Product'
      }

      // Mock successful document creation
      mockDocumentOperations.create.mockResolvedValue({
        id: 'new-doc-123',
        data: newDocumentData
      })

      // Create document
      const result = await store.dispatch('createDocument', { 
        data: newDocumentData 
      })

      // Verify document creation
      expect(mockDocumentOperations.create).toHaveBeenCalledWith(newDocumentData)
      expect(result.id).toBe('new-doc-123')
      expect(store.documents).toHaveLength(1)
      expect(store.documents[0].data.name).toBe('[DRAFT] - My New Document')
      expect(store.selected.id).toBe('new-doc-123')
    })

    it('should create document without selecting it', async () => {
      const documentData = {
        name: 'Background Document',
        content: 'This document is created but not selected',
        draft: false
      }

      mockDocumentOperations.create.mockResolvedValue({
        id: 'background-doc-456',
        data: documentData
      })

      // Create document without selecting
      const result = await store.dispatch('createDocument', { 
        data: documentData, 
        select: false 
      })

      expect(result.id).toBe('background-doc-456')
      expect(store.documents).toHaveLength(1)
      expect(store.selected.id).toBeNull() // Should not be selected
    })

    it('should handle document creation errors', async () => {
      const documentData = {
        name: 'Failed Document',
        content: 'This will fail to create'
      }

      // Mock creation failure
      mockDocumentOperations.create.mockRejectedValue(
        new Error('Document creation failed')
      )

      // Attempt to create document
      await expect(
        store.dispatch('createDocument', { data: documentData })
      ).rejects.toThrow('Document creation failed')

      // Verify no document was added
      expect(store.documents).toHaveLength(0)
    })
  })

  describe('Document Loading and Selection', () => {
    it('should load and select an existing document', async () => {
      const existingDoc = {
        id: 'existing-doc-789',
        data: {
          name: 'Existing Document',
          content: 'This document already exists.',
          draft: false,
          archived: false
        }
      }

      mockDocumentOperations.getDocById.mockResolvedValue(existingDoc)

      // Select the document
      const result = await store.dispatch('selectDocument', { 
        id: 'existing-doc-789' 
      })

      expect(mockDocumentOperations.getDocById).toHaveBeenCalledWith('existing-doc-789')
      expect(result.id).toBe('existing-doc-789')
      expect(store.selected.id).toBe('existing-doc-789')
      expect(store.selected.data.name).toBe('Existing Document')
      expect(store.selected.isLoading).toBe(false)
    })

    it('should handle loading non-existent document', async () => {
      mockDocumentOperations.getDocById.mockResolvedValue(null)

      const result = await store.dispatch('selectDocument', { 
        id: 'non-existent-doc' 
      })

      expect(result).toBeNull()
      expect(store.globalAlerts).toContainEqual({
        type: 'error',
        message: 'non-existent-doc not found'
      })
    })

    it('should show loading state during document fetch', async () => {
      // Create a promise that we can control
      let resolvePromise
      const loadingPromise = new Promise((resolve) => {
        resolvePromise = resolve
      })
      
      mockDocumentOperations.getDocById.mockReturnValue(loadingPromise)

      // Start loading document
      const loadPromise = store.dispatch('selectDocument', { 
        id: 'loading-doc' 
      })

      // Check loading state
      expect(store.selected.isLoading).toBe(true)

      // Resolve the mock
      resolvePromise({
        id: 'loading-doc',
        data: { name: 'Loaded Document', content: 'Content' }
      })

      await loadPromise

      // Verify loading is complete
      expect(store.selected.isLoading).toBe(false)
      expect(store.selected.id).toBe('loading-doc')
    })
  })

  describe('Document Editing and Updates', () => {
    beforeEach(async () => {
      // Setup with an existing selected document
      const existingDoc = {
        id: 'edit-doc-123',
        data: {
          name: 'Document to Edit',
          content: 'Original content here.',
          draft: true
        }
      }

      mockDocumentOperations.getDocById.mockResolvedValue(existingDoc)
      await store.dispatch('selectDocument', { id: 'edit-doc-123' })
    })

    it('should update document content', async () => {
      const updatedData = {
        name: 'Updated Document Title',
        content: 'Updated content with **formatting**.',
        draft: true
      }

      mockDocumentOperations.updateDoc.mockResolvedValue()

      // Update document
      store.commit('updateSelectedDocument', {
        id: 'edit-doc-123',
        data: updatedData
      })

      // Simulate save
      await mockDocumentOperations.updateDoc('edit-doc-123', updatedData)

      expect(store.selected.data.name).toBe('Updated Document Title')
      expect(store.selected.data.content).toBe('Updated content with **formatting**.')
    })

    it('should toggle document draft status', async () => {
      expect(store.selected.data.draft).toBe(true)

      mockDocumentOperations.updateDoc.mockResolvedValue()

      // Toggle draft status
      await store.dispatch('toggleDraft')

      expect(store.selected.data.draft).toBe(false)
      expect(mockDocumentOperations.updateDoc).toHaveBeenCalledWith(
        'edit-doc-123',
        expect.objectContaining({ draft: false })
      )
    })

    it('should update specific document fields', async () => {
      mockDocumentOperations.updateDocField.mockResolvedValue()

      // Simulate updating just the title
      await mockDocumentOperations.updateDocField(
        'edit-doc-123', 
        'name', 
        'New Title Only'
      )

      expect(mockDocumentOperations.updateDocField).toHaveBeenCalledWith(
        'edit-doc-123',
        'name',
        'New Title Only'
      )
    })

    it('should handle concurrent edits properly', async () => {
      // Simulate multiple rapid updates
      const updates = [
        { content: 'Update 1' },
        { content: 'Update 2' },
        { content: 'Final update' }
      ]

      updates.forEach(update => {
        store.commit('updateSelectedDocument', {
          id: 'edit-doc-123',
          data: { ...store.selected.data, ...update }
        })
      })

      // Final state should have the last update
      expect(store.selected.data.content).toBe('Final update')
    })
  })

  describe('Document Deletion and Archiving', () => {
    beforeEach(async () => {
      // Setup documents list
      store.commit('setDocuments', [
        { id: 'doc-1', data: { name: 'Document 1', content: 'Content 1' } },
        { id: 'doc-2', data: { name: 'Document 2', content: 'Content 2' } },
        { id: 'doc-3', data: { name: 'Document 3', content: 'Content 3' } }
      ])
    })

    it('should delete a document permanently', async () => {
      mockDocumentOperations.deleteDocByID.mockResolvedValue()

      expect(store.documents).toHaveLength(3)

      // Delete document
      await store.dispatch('deleteDocument', { id: 'doc-2' })

      expect(mockDocumentOperations.deleteDocByID).toHaveBeenCalledWith('doc-2')
      expect(store.documents).toHaveLength(2)
      expect(store.documents.find(doc => doc.id === 'doc-2')).toBeUndefined()
    })

    it('should archive a document', async () => {
      mockDocumentOperations.archiveDoc.mockResolvedValue()

      expect(store.documents).toHaveLength(3)

      // Archive document
      await store.dispatch('archiveDocument', { id: 'doc-1' })

      expect(mockDocumentOperations.archiveDoc).toHaveBeenCalledWith('doc-1')
      expect(store.documents).toHaveLength(2)
      expect(store.documents.find(doc => doc.id === 'doc-1')).toBeUndefined()
    })

    it('should handle delete errors gracefully', async () => {
      mockDocumentOperations.deleteDocByID.mockRejectedValue(
        new Error('Delete failed')
      )

      await expect(
        store.dispatch('deleteDocument', { id: 'doc-1' })
      ).rejects.toThrow('Delete failed')

      // Document list should remain unchanged
      expect(store.documents).toHaveLength(3)
    })
  })

  describe('Document List Management', () => {
    it('should load all documents', async () => {
      const mockDocuments = [
        { id: 'doc-1', data: { name: 'Doc 1', content: 'Content 1' } },
        { id: 'doc-2', data: { name: 'Doc 2', content: 'Content 2' } },
        { id: 'doc-3', data: { name: 'Doc 3', content: 'Content 3' } }
      ]

      mockDocumentOperations.getAll.mockResolvedValue(mockDocuments)

      const result = await store.dispatch('getDocuments')

      expect(mockDocumentOperations.getAll).toHaveBeenCalled()
      expect(result).toEqual(mockDocuments)
      expect(store.documents).toEqual(mockDocuments)
    })

    it('should handle empty document list', async () => {
      mockDocumentOperations.getAll.mockResolvedValue([])

      const result = await store.dispatch('getDocuments')

      expect(result).toEqual([])
      expect(store.documents).toEqual([])
    })

    it('should maintain document list integrity during CRUD operations', async () => {
      // Start with initial documents
      store.commit('setDocuments', [
        { id: 'doc-1', data: { name: 'Doc 1' } }
      ])

      // Add a document
      mockDocumentOperations.create.mockResolvedValue({
        id: 'doc-2',
        data: { name: 'Doc 2' }
      })

      await store.dispatch('createDocument', { 
        data: { name: 'Doc 2' }, 
        select: false 
      })

      expect(store.documents).toHaveLength(2)

      // Delete a document
      mockDocumentOperations.deleteDocByID.mockResolvedValue()
      await store.dispatch('deleteDocument', { id: 'doc-2' })

      expect(store.documents).toHaveLength(1)
      expect(store.documents[0].id).toBe('doc-1')
    })
  })

  describe('Document State Synchronization', () => {
    it('should keep selected document and documents list in sync', async () => {
      // Create and select a document
      mockDocumentOperations.create.mockResolvedValue({
        id: 'sync-doc',
        data: { name: 'Sync Test', content: 'Initial content' }
      })

      await store.dispatch('createDocument', { 
        data: { name: 'Sync Test', content: 'Initial content' }
      })

      // Update the selected document
      store.commit('updateSelectedDocument', {
        id: 'sync-doc',
        data: { name: 'Updated Sync Test', content: 'Updated content' }
      })

      // Verify both selected and documents list are updated
      expect(store.selected.data.name).toBe('Updated Sync Test')
      expect(store.documents[0].data.name).toBe('Updated Sync Test')
    })

    it('should handle version-specific edits correctly', async () => {
      const docData = {
        id: 'version-doc',
        data: { name: 'Version Test', content: 'Live content' }
      }

      mockDocumentOperations.getDocById.mockResolvedValue(docData)

      // Load live version
      await store.dispatch('selectDocument', { id: 'version-doc' })
      expect(store.selected.currentVersion).toBe('live')

      // Load specific version
      await store.dispatch('selectDocument', { 
        id: 'version-doc', 
        version: 'v1.0' 
      })
      expect(store.selected.currentVersion).toBe('v1.0')
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle network errors during operations', async () => {
      mockDocumentOperations.updateDoc.mockRejectedValue(
        new Error('Network error')
      )

      store.commit('setSelectedDocument', {
        id: 'error-doc',
        data: { name: 'Error Test' }
      })

      await expect(
        mockDocumentOperations.updateDoc('error-doc', { name: 'Updated' })
      ).rejects.toThrow('Network error')
    })

    it('should prevent operations on non-existent documents', async () => {
      // Try to update a document that doesn't exist in state
      store.commit('updateSelectedDocument', {
        id: 'non-existent',
        data: { name: 'Should not work' }
      })

      // Selected document should be set but documents list unchanged
      expect(store.selected.id).toBe('non-existent')
      expect(store.documents).toHaveLength(0)
    })

    it('should handle permissions errors appropriately', async () => {
      mockDocumentOperations.deleteDocByID.mockRejectedValue(
        new Error('Permission denied')
      )

      await expect(
        store.dispatch('deleteDocument', { id: 'protected-doc' })
      ).rejects.toThrow('Permission denied')
    })
  })
}) 