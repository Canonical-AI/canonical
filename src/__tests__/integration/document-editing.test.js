import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useMainStore } from '../../store/index.js'
import { createRouter, createMemoryHistory } from 'vue-router'

// Mock Firebase document operations
vi.mock('../../services/firebaseDataService', () => ({
  Document: {
    create: vi.fn(),
    updateDoc: vi.fn(),
    updateDocField: vi.fn(),
    archiveDoc: vi.fn(),
    deleteDocByID: vi.fn(),
    getDocById: vi.fn(),
    getDocVersion: vi.fn(),
    getAll: vi.fn()
  },
  User: {
    getUserAuth: vi.fn(),
    getUserData: vi.fn()
  },
  Project: {
    getById: vi.fn()
  },
  Favorites: {
    updateFavorites: vi.fn()
  },
  ChatHistory: { getAll: vi.fn() },
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

describe('Document Editing Integration Tests', () => {
  let store
  let router
  let mockDocument
  let mockFavorites

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks()

    // Get mock functions
    const { Document, Favorites } = await import('../../services/firebaseDataService')
    mockDocument = Document
    mockFavorites = Favorites

    // Create fresh Pinia instance
    const pinia = createPinia()
    setActivePinia(pinia)
    
    // Get the store instance
    store = useMainStore()

    // Set initial test state
    store.userSetData({
      uid: 'test-user-123',
      email: 'test@example.com',
      displayName: 'Test User',
      tier: 'pro',
      defaultProject: 'test-project-123',
      projects: ['test-project-123']
    })

    // Set project data directly for testing
    store.project = {
      id: 'test-project-123',
      name: 'Test Project',
      folders: [],
      users: ['test-user-123'],
      createdBy: 'test-user-123'
    }

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
      mockDocument.create.mockResolvedValue({
        success: true,
        data: {
          id: 'new-doc-123',
          data: newDocumentData
        },
        message: 'Document created successfully'
      })

      // Create document
      const result = await store.documentsCreate({ 
        data: newDocumentData 
      })

      // Verify document creation
      expect(mockDocument.create).toHaveBeenCalledWith(newDocumentData)
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

      mockDocument.create.mockResolvedValue({
        success: true,
        data: {
          id: 'bg-doc-123',
          data: documentData
        },
        message: 'Document created successfully'
      })

      // Create document without selecting
      const result = await store.documentsCreate({ 
        data: documentData, 
        select: false 
      })

      expect(result.id).toBe('bg-doc-123')
      expect(store.documents).toHaveLength(1)
      expect(store.selected.id).toBeNull() // Should not be selected
    })
  })

  describe('Document Selection Flow', () => {
    it('should select existing document successfully', async () => {
      const existingDoc = {
        id: 'existing-doc-123',
        data: {
          name: 'Existing Document',
          content: 'This document already exists'
        },
        comments: [],
        versions: []
      }

      // Mock successful document fetch
      mockDocument.getDocById.mockResolvedValue(existingDoc)

      // Select document
      const result = await store.documentsSelect({ id: 'existing-doc-123' })

      expect(mockDocument.getDocById).toHaveBeenCalledWith('existing-doc-123')
      
      // The store adds additional fields, so check the core fields match
      expect(result.id).toBe('existing-doc-123')
      expect(result.data.name).toBe('Existing Document')
      expect(store.selected.id).toBe('existing-doc-123')
      expect(store.selected.data.name).toBe('Existing Document')
    })

    it('should handle document not found', async () => {
      // Mock document not found
      mockDocument.getDocById.mockResolvedValue(null)

      // Try to select non-existent document and expect it to throw
      await expect(store.documentsSelect({ id: 'non-existent-doc' }))
        .rejects.toThrow('Failed to load document with ID: non-existent-doc')
    })

    it('should select document with specific version', async () => {
      const existingDoc = {
        id: 'versioned-doc-123',
        data: {
          name: 'Versioned Document',
          content: 'This document has versions'
        },
        comments: [],
        versions: [
          { number: '1.0', content: 'Version 1.0 content' },
          { number: '2.0', content: 'Version 2.0 content' }
        ]
      }

      const versionData = {
        content: 'Version 1.0 content'
      }

      mockDocument.getDocById.mockResolvedValue(existingDoc)
      mockDocument.getDocVersion.mockResolvedValue(versionData)

      // Select document with version
      await store.documentsSelect({ id: 'versioned-doc-123', version: '1.0' })

      expect(store.selected.id).toBe('versioned-doc-123')
      expect(store.selected.currentVersion).toBe('1.0')
    })
  })

  describe('Document Management Operations', () => {
    it('should delete document successfully', async () => {
      // Set up initial document
      store.documents = [
        { id: 'doc-to-delete', data: { name: 'Document to Delete' } }
      ]

      mockDocument.deleteDocByID.mockResolvedValue({
        success: true,
        data: { id: 'doc-to-delete' },
        message: 'Document deleted successfully'
      })

      // Delete document
      await store.documentsDelete({ id: 'doc-to-delete' })

      expect(mockDocument.deleteDocByID).toHaveBeenCalledWith('doc-to-delete')
      expect(store.documents).toHaveLength(0)
    })

    it('should archive document successfully', async () => {
      // Set up initial document  
      store.documents = [
        { id: 'doc-to-archive', data: { name: 'Document to Archive' } }
      ]

      mockDocument.archiveDoc.mockResolvedValue({
        success: true,
        data: { id: 'doc-to-archive', archived: true },
        message: 'Document archived successfully'
      })

      // Archive document
      await store.documentsArchive({ id: 'doc-to-archive' })

      expect(mockDocument.archiveDoc).toHaveBeenCalledWith('doc-to-archive')
      expect(store.documents).toHaveLength(0)
    })

    it('should update document successfully', async () => {
      const originalDoc = { 
        id: 'doc-to-update', 
        data: { 
          name: 'Original Name',
          content: 'Original content'
        } 
      }

      store.documents = [originalDoc]
      store.documentsUpdate(originalDoc)

      // Update selected document data
      store.documentsUpdate({ 
        id: 'doc-to-update',
        data: { 
          name: 'Updated Name', 
          content: 'Updated content' 
        } 
      })

      expect(store.selected.data.name).toBe('Updated Name')
      expect(store.selected.data.content).toBe('Updated content')
      
      // Note: documentsUpdate only updates the selected document, not the documents array
      // This behavior is correct as documents array should be updated via documentsGetAll or specific save operations
    })
  })

  describe('Document State Management', () => {
    it('should handle loading states correctly', async () => {
      mockDocument.getDocById.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          id: 'slow-doc',
          data: { name: 'Slow Loading Doc' },
          comments: [],
          versions: []
        }), 100))
      )

      // Start loading
      const selectPromise = store.documentsSelect({ id: 'slow-doc' })
      
      // Should show loading state initially
      expect(store.selected.isLoading).toBe(true)

      // Wait for completion
      await selectPromise

      // Should no longer be loading
      expect(store.selected.isLoading).toBe(false)
      expect(store.selected.id).toBe('slow-doc')
    })

    it('should maintain consistent state during rapid operations', async () => {
      const doc1 = { id: 'doc-1', data: { name: 'Doc 1' }, comments: [], versions: [] }
      const doc2 = { id: 'doc-2', data: { name: 'Doc 2' }, comments: [], versions: [] }

      mockDocument.getDocById
        .mockResolvedValueOnce(doc1)
        .mockResolvedValueOnce(doc2)

      // Rapidly select different documents
      const select1 = store.documentsSelect({ id: 'doc-1' })
      const select2 = store.documentsSelect({ id: 'doc-2' })

      await Promise.all([select1, select2])

      // Should end up with doc-2 selected (last operation)
      expect(store.selected.id).toBe('doc-2')
      expect(store.selected.data.name).toBe('Doc 2')
    })
  })

  describe('Favorites Integration', () => {
    it('should toggle document favorites correctly', async () => {
      const docId = 'favorite-doc-123'
      
      // Mock the Favorites.updateFavorites method
      mockFavorites.updateFavorites.mockResolvedValue({
        success: true,
        data: { favorites: [] },
        message: 'Favorites updated successfully'
      })
      
      // Initially not favorited
      expect(store.isFavorite(docId)).toBe(false)

      // Toggle to favorite
      await store.toggleFavorite(docId)
      expect(store.favorites).toContain(docId)
      expect(store.isFavorite(docId)).toBe(true)

      // Toggle back to not favorite
      await store.toggleFavorite(docId)
      expect(store.favorites).not.toContain(docId)
      expect(store.isFavorite(docId)).toBe(false)
    })
  })
}) 