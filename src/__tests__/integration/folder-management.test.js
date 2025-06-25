import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useMainStore } from '../../store/index.js'

// Mock Firebase operations
vi.mock('../../services/firebaseDataService', () => ({
  Project: {
    getById: vi.fn(),
    update: vi.fn(),
    updateField: vi.fn()
  },
  Document: {
    getAll: vi.fn(),
    updateDocField: vi.fn()
  },
  User: {
    getUserAuth: vi.fn(),
    getUserData: vi.fn()
  },
  ChatHistory: { getAll: vi.fn() },
  Favorites: { getAll: vi.fn() },
  Task: { getAll: vi.fn() }
}))

// Mock router
vi.mock('../../router', () => ({
  default: {
    push: vi.fn()
  }
}))

describe('Folder Management Integration Tests', () => {
  let store
  let mockProject
  let mockDocument

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks()

    // Get mock functions
    const { Project, Document } = await import('../../services/firebaseDataService')
    mockProject = Project
    mockDocument = Document

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
      projects: [{
        projectId: 'test-project-123',
        status: 'active',
        role: 'admin'
      }]
    })

    // Set project data with actual folder structure (children contain document IDs)
    store.project = {
      id: 'test-project-123',
      name: 'Test Project',
      folders: [
        {
          name: 'Getting Started',
          children: ['doc-1', 'doc-2'], // Document IDs, not names
          isOpen: true
        },
        {
          name: 'Product',
          children: ['doc-3'],
          isOpen: false
        },
        {
          name: 'Advanced',
          children: [],
          isOpen: true
        }
      ],
      users: ['test-user-123'],
      createdBy: 'test-user-123'
    }

    // Mock documents
    store.documents = [
      { id: 'doc-1', data: { name: 'Welcome Guide', content: 'Welcome...' } },
      { id: 'doc-2', data: { name: 'Quick Start', content: 'Quick start...' } },
      { id: 'doc-3', data: { name: 'Feature Overview', content: 'Features...' } },
      { id: 'doc-4', data: { name: 'Unorganized Doc', content: 'Unorganized...' } }
    ]
  })

  describe('Folder Structure and Hierarchy', () => {
    it('should generate projectFolderTree correctly', () => {
      const folderTree = store.projectFolderTree

      // Should contain folders and ungrouped documents
      expect(folderTree.length).toBeGreaterThan(0)
      
      // Check that folders are properly structured
      const gettingStartedFolder = folderTree.find(item => item.name === 'Getting Started' && item.folder === true)
      expect(gettingStartedFolder).toBeDefined()
      expect(gettingStartedFolder.isOpen).toBe(true)
      expect(gettingStartedFolder.id).toBe('Getting Started')

      const productFolder = folderTree.find(item => item.name === 'Product' && item.folder === true)
      expect(productFolder).toBeDefined()
      expect(productFolder.isOpen).toBe(false)

      // Check that ungrouped documents are included
      const ungroupedDoc = folderTree.find(item => item.id === 'doc-4')
      expect(ungroupedDoc).toBeDefined()
      expect(ungroupedDoc.folder).toBeUndefined() // Not a folder
    })

    it('should handle empty folder structure', () => {
      store.project.folders = []
      
      const folderTree = store.projectFolderTree
      
      // Should only contain documents (no folders)
      expect(folderTree).toHaveLength(4) // All documents are ungrouped
      expect(folderTree.every(item => item.folder !== true)).toBe(true)
    })

    it('should handle malformed project data gracefully', () => {
      store.project = null
      
      expect(() => {
        const folderTree = store.projectFolderTree
      }).not.toThrow()
      
      store.project = { folders: null }
      
      expect(() => {
        const folderTree = store.projectFolderTree
      }).not.toThrow()
    })
  })

  describe('Folder Operations', () => {
    it('should add new folder successfully', async () => {
      mockProject.updateField.mockResolvedValue({
        success: true,
        data: { id: 'test-project-123', folders: [] },
        message: 'Project updated successfully'
      })

      const initialFolderCount = store.project.folders.length

      await store.foldersAdd('New Test Folder')

      expect(store.project.folders).toHaveLength(initialFolderCount + 1)
      
      const newFolder = store.project.folders.find(f => f.name === 'New Test Folder')
      expect(newFolder).toBeDefined()
      expect(newFolder.children).toEqual([])
      expect(newFolder.isOpen).toBe(true)

      expect(mockProject.updateField).toHaveBeenCalledWith(
        'test-project-123',
        'folders',
        store.project.folders
      )
    })

    it('should remove folder successfully', async () => {
      mockProject.updateField.mockResolvedValue({
        success: true,
        data: { id: 'test-project-123', folders: [] },
        message: 'Project updated successfully'
      })

      const initialFolderCount = store.project.folders.length

      await store.foldersRemove('Advanced')

      expect(store.project.folders).toHaveLength(initialFolderCount - 1)
      expect(store.project.folders.find(f => f.name === 'Advanced')).toBeUndefined()

      expect(mockProject.updateField).toHaveBeenCalledWith(
        'test-project-123',
        'folders',
        store.project.folders
      )
    })

    it('should rename folder successfully', async () => {
      const renameResult = await store.foldersRename({
        fromFolderName: 'Getting Started',
        toFolderName: 'Getting Started Renamed'
      })

      const renamedFolder = store.project.folders.find(f => f.name === 'Getting Started Renamed')
      expect(renamedFolder).toBeDefined()
      expect(renamedFolder.children).toEqual(['doc-1', 'doc-2']) // Children should be preserved

      const oldFolder = store.project.folders.find(f => f.name === 'Getting Started')
      expect(oldFolder).toBeUndefined()
    })

    it('should toggle folder open/closed state', () => {
      const initialOpenState = store.project.folders[0].isOpen
      expect(initialOpenState).toBe(true)

      store.foldersToggleOpen({
        FolderName: 'Getting Started',
        isOpen: false
      })

      expect(store.project.folders[0].isOpen).toBe(false)
    })

    it('should move documents between folders', async () => {
      mockProject.updateField.mockResolvedValue({
        success: true,
        data: { id: 'test-project-123', folders: [] },
        message: 'Project updated successfully'
      })

      // Move doc-1 from 'Getting Started' to 'Product'
      await store.foldersUpdate({
        docId: 'doc-1',
        target: 'Product',
        action: 'add'
      })

      const gettingStartedFolder = store.project.folders.find(f => f.name === 'Getting Started')
      const productFolder = store.project.folders.find(f => f.name === 'Product')

      expect(gettingStartedFolder.children).not.toContain('doc-1')
      expect(productFolder.children).toContain('doc-1')

      expect(mockProject.updateField).toHaveBeenCalledWith(
        'test-project-123',
        'folders',
        store.project.folders
      )
    })

    it('should remove documents from folders', async () => {
      mockProject.updateField.mockResolvedValue({
        success: true,
        data: { id: 'test-project-123', folders: [] },
        message: 'Project updated successfully'
      })

      // Remove doc-1 from its current folder
      await store.foldersUpdate({
        docId: 'doc-1',
        target: null,
        action: 'remove'
      })

      const gettingStartedFolder = store.project.folders.find(f => f.name === 'Getting Started')
      expect(gettingStartedFolder.children).not.toContain('doc-1')

      expect(mockProject.updateField).toHaveBeenCalledWith(
        'test-project-123',
        'folders',
        store.project.folders
      )
    })
  })

  describe('Folder Error Handling', () => {
    it('should handle folder addition failure gracefully', async () => {
      mockProject.updateField.mockResolvedValue({
        success: false,
        message: 'Failed to update project'
      })

      await expect(store.foldersAdd('Failing Folder')).rejects.toThrow('Failed to add folder')

      // Folder should not be added to local state on failure
      const failingFolder = store.project.folders.find(f => f.name === 'Failing Folder')
      expect(failingFolder).toBeUndefined()
    })

    it('should handle folder removal failure gracefully', async () => {
      mockProject.updateField.mockResolvedValue({
        success: false,
        message: 'Failed to update project'
      })

      const initialFolders = [...store.project.folders]

      await expect(store.foldersRemove('Getting Started')).rejects.toThrow('Failed to remove folder')

      // Folders should be restored on failure
      expect(store.project.folders).toEqual(initialFolders)
    })

    it('should handle folder update failure gracefully', async () => {
      mockProject.updateField.mockResolvedValue({
        success: false,
        message: 'Failed to update folders'
      })

      const initialFolders = JSON.parse(JSON.stringify(store.project.folders))

      await expect(store.foldersUpdate({
        docId: 'doc-1',
        target: 'Product',
        action: 'add'
      })).rejects.toThrow('Failed to update folders')

      // Folder structure should be restored on failure
      expect(store.project.folders).toEqual(initialFolders)
    })

    it('should handle operations on non-existent folders gracefully', async () => {
      // Try to rename non-existent folder
      const result = await store.foldersRename({
        fromFolderName: 'Non-existent',
        toFolderName: 'New Name'
      })

      // Should not throw, but also should not change anything
      expect(store.project.folders.find(f => f.name === 'New Name')).toBeUndefined()
    })

    it('should handle toggle operations on non-existent folders gracefully', () => {
      expect(() => {
        store.foldersToggleOpen({
          FolderName: 'Non-existent',
          isOpen: true
        })
      }).not.toThrow()
    })
  })

  describe('Folder Data Consistency', () => {
    it('should maintain folder structure integrity during operations', async () => {
      mockProject.updateField.mockResolvedValue({
        success: true,
        data: { id: 'test-project-123', folders: [] },
        message: 'Project updated successfully'
      })

      const originalStructure = JSON.parse(JSON.stringify(store.project.folders))

      // Perform multiple operations
      await store.foldersAdd('Temp Folder')
      await store.foldersRemove('Temp Folder')

      // Structure should be back to original (except for object references)
      expect(store.project.folders.length).toBe(originalStructure.length)
      expect(store.project.folders.map(f => f.name)).toEqual(originalStructure.map(f => f.name))
    })

    it('should handle concurrent folder operations', async () => {
      mockProject.updateField.mockResolvedValue({
        success: true,
        data: { id: 'test-project-123', folders: [] },
        message: 'Project updated successfully'
      })

      const operations = [
        store.foldersAdd('Concurrent Folder 1'),
        store.foldersAdd('Concurrent Folder 2'),
        store.foldersToggleOpen({ FolderName: 'Getting Started', isOpen: false }),
        store.foldersToggleOpen({ FolderName: 'Product', isOpen: true })
      ]

      await Promise.all(operations)

      // All operations should complete without errors
      expect(mockProject.updateField).toHaveBeenCalledTimes(2) // Only add operations call updateField
      expect(store.project.folders.find(f => f.name === 'Concurrent Folder 1')).toBeDefined()
      expect(store.project.folders.find(f => f.name === 'Concurrent Folder 2')).toBeDefined()
    })

    it('should handle projectFolderTree computation with various data states', () => {
      // Test with empty documents
      store.documents = []
      expect(() => store.projectFolderTree).not.toThrow()

      // Test with documents but no folders
      store.documents = [{ id: 'doc-1', data: { name: 'Test Doc' } }]
      store.project.folders = []
      expect(() => store.projectFolderTree).not.toThrow()

      // Test with malformed folder data
      store.project.folders = [
        { name: 'Valid Folder', children: ['doc-1'], isOpen: true },
        null, // Invalid folder
        { name: 'Missing children' }, // Missing children array
        { children: ['doc-2'] } // Missing name
      ]
      expect(() => store.projectFolderTree).not.toThrow()
    })
  })
}) 