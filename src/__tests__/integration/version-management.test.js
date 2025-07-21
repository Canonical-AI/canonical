import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useMainStore } from '../../store/index.js'
import { createRouter, createMemoryHistory } from 'vue-router'

// Mock Firebase operations for commit-based version management
vi.mock('../../services/firebaseDataService', () => ({
  Document: {
    getDocById: vi.fn(),
    updateDocField: vi.fn(),
    createVersion: vi.fn()
  },
  Commit: {
    create: vi.fn(),
    setCommitParams: vi.fn()
  },
  User: {
    getUserAuth: vi.fn(),
    getUserData: vi.fn()
  },
  Project: {
    getById: vi.fn()
  },
  ChatHistory: { getAll: vi.fn() },
  Favorites: { getAll: vi.fn() },
  Task: { getAll: vi.fn() }
}))

describe('Version Management Integration Tests (Commit-Based System)', () => {
  let store
  let router
  let mockDocument
  let mockCommit

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks()

    // Get mock functions
    const { Document, Commit } = await import('../../services/firebaseDataService')
    mockDocument = Document
    mockCommit = Commit

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
        { path: '/document/:id', component: { template: '<div>Document</div>' } }
      ]
    })

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

    // Set project data for testing
    store.project = {
      id: 'test-project-123',
      name: 'Test Project',
      folders: [],
      users: ['test-user-123'],
      createdBy: 'test-user-123'
    }

    // Setup a test document with commits
    store.documentsUpdate({
      id: 'test-doc-123',
      data: {
        name: 'Test Document',
        content: 'Current document content',
        releasedVersion: [],
        draft: true
      },
      commits: [
        {
          id: 'commit-1',
          message: 'Initial commit',
          documentContent: 'Initial content',
          documentName: 'Test Document',
          createDate: { seconds: Date.now() / 1000 - 3600 }, // 1 hour ago
          versionNumber: 'v1.0.0',
          released: true,
          branch: 'main'
        },
        {
          id: 'commit-2',
          message: 'Added more content',
          documentContent: 'Updated content',
          documentName: 'Test Document',
          createDate: { seconds: Date.now() / 1000 - 1800 }, // 30 minutes ago
          versionNumber: '',
          released: false,
          branch: 'main'
        }
      ]
    })

    // Mock updateDocField to always succeed
    mockDocument.updateDocField.mockResolvedValue({
      success: true,
      data: {},
      message: 'Document field updated successfully'
    })
  })

  describe('Commit Management', () => {
    it('should create a new commit successfully', async () => {
      const mockCommitData = {
        id: 'new-commit-123',
        message: 'Test commit message',
        documentContent: 'Current document content',
        documentName: 'Test Document',
        createDate: { seconds: Date.now() / 1000 },
        versionNumber: '',
        released: false,
        branch: 'main'
      }

      mockCommit.create.mockResolvedValue({
        success: true,
        data: mockCommitData,
        message: 'Commit created successfully'
      })

      const result = await store.createCommit('Test commit message')

      expect(mockCommit.create).toHaveBeenCalledWith(
        'test-doc-123',
        store.selected.data,
        'Test commit message',
        'commit-2', // Should use latest commit as parent
        {}
      )

      expect(result).toEqual(mockCommitData)
      expect(store.selected.commits).toHaveLength(3)
      expect(store.selected.commits[2]).toEqual(mockCommitData)
    })

    it('should create commit with version information', async () => {
      const mockCommitData = {
        id: 'version-commit-123',
        message: 'Version commit',
        documentContent: 'Current document content',
        documentName: 'Test Document',
        createDate: { seconds: Date.now() / 1000 },
        versionNumber: 'v2.0.0',
        released: true,
        branch: 'main'
      }

      mockCommit.create.mockResolvedValue({
        success: true,
        data: mockCommitData,
        message: 'Commit created successfully'
      })

      const result = await store.createCommit('Version commit', {
        versionNumber: 'v2.0.0',
        released: true
      })

             expect(mockCommit.create).toHaveBeenCalledWith(
         'test-doc-123',
         expect.objectContaining({
           name: 'Test Document',
           content: 'Current document content'
         }),
         'Version commit',
         'commit-2',
         { versionNumber: 'v2.0.0', released: true }
       )

      expect(result).toEqual(mockCommitData)
      
      // Should update document release status
      expect(mockDocument.updateDocField).toHaveBeenCalledWith(
        'test-doc-123',
        'releasedVersion',
        ['v1.0.0', 'v2.0.0']
      )
    })

    it('should handle commit creation failure', async () => {
      mockCommit.create.mockResolvedValue({
        success: false,
        message: 'Failed to create commit',
        error: new Error('Database error')
      })

      await expect(store.createCommit('Failed commit')).rejects.toThrow('Failed to create commit')
      
      // Should not add commit to local state on failure
      expect(store.selected.commits).toHaveLength(2)
    })
  })

  describe('Version Creation and Management', () => {
    it('should create version from existing commit', async () => {
      mockDocument.createVersion.mockResolvedValue({
        success: true,
        data: {
          id: 'commit-2',
          versionNumber: 'v1.1.0',
          released: false
        },
        message: 'Commit tagged as version'
      })

      const result = await store.createVersion('v1.1.0', {
        fromCommitId: 'commit-2',
        released: false
      })

             expect(mockDocument.createVersion).toHaveBeenCalledWith(
         'test-doc-123',
         expect.objectContaining({
           name: 'Test Document',
           content: 'Current document content'
         }),
         'v1.1.0',
         'commit-2',
         false
       )

      // Should update local commit with version information
      const updatedCommit = store.selected.commits.find(c => c.id === 'commit-2')
      expect(updatedCommit.versionNumber).toBe('v1.1.0')
      expect(updatedCommit.released).toBe(false)
    })

    it('should toggle version release status', async () => {
      mockCommit.setCommitParams.mockResolvedValue({
        success: true,
        data: {},
        message: 'Commit updated successfully'
      })

      const result = await store.toggleCommitVersionRelease({
        commitId: 'commit-1',
        released: false
      })

      expect(mockCommit.setCommitParams).toHaveBeenCalledWith(
        'test-doc-123',
        'commit-1',
        { released: false }
      )

      // Should update local commit
      const updatedCommit = store.selected.commits.find(c => c.id === 'commit-1')
      expect(updatedCommit.released).toBe(false)

      // Should update document release status (no more released versions)
      expect(mockDocument.updateDocField).toHaveBeenCalledWith(
        'test-doc-123',
        'releasedVersion',
        []
      )
    })

    it('should remove version tag from commit', async () => {
      mockCommit.setCommitParams.mockResolvedValue({
        success: true,
        data: {},
        message: 'Commit updated successfully'
      })

      const result = await store.removeCommitVersionTag({
        commitId: 'commit-1',
        versionNumber: 'v1.0.0'
      })

      expect(mockCommit.setCommitParams).toHaveBeenCalledWith(
        'test-doc-123',
        'commit-1',
        { versionNumber: null, released: false }
      )

      // Should update local commit
      const updatedCommit = store.selected.commits.find(c => c.id === 'commit-1')
      expect(updatedCommit.versionNumber).toBeNull()
      expect(updatedCommit.released).toBe(false)

      expect(result).toEqual({
        commitId: 'commit-1',
        versionNumber: 'v1.0.0'
      })
    })

    it('should handle version operation failures gracefully', async () => {
      mockCommit.setCommitParams.mockResolvedValue({
        success: false,
        message: 'Failed to update commit'
      })

      await expect(store.toggleCommitVersionRelease({
        commitId: 'commit-1',
        released: false
      })).rejects.toThrow('Failed to update commit')

      // Should not change local state on failure
      const commit = store.selected.commits.find(c => c.id === 'commit-1')
      expect(commit.released).toBe(true) // Should remain unchanged
    })
  })

  describe('Document Version Status Management', () => {
    it('should check and update document version status', async () => {
      await store.documentsCheckVersionsStatus({ id: 'test-doc-123' })

      // Should update document with released versions from commits
      expect(mockDocument.updateDocField).toHaveBeenCalledWith(
        'test-doc-123',
        'releasedVersion',
        ['v1.0.0']
      )

      expect(mockDocument.updateDocField).toHaveBeenCalledWith(
        'test-doc-123',
        'draft',
        false
      )
    })

         it('should handle document with no released versions', async () => {
       // Update test data to have no released versions
       store.selected.commits[0].released = false
       // Also update local document state to have a different released version status to trigger update
       store.selected.data.releasedVersion = ['v1.0.0']

       await store.documentsCheckVersionsStatus({ id: 'test-doc-123' })

       // Should set document as draft
       expect(mockDocument.updateDocField).toHaveBeenCalledWith(
         'test-doc-123',
         'releasedVersion',
         []
       )

       expect(mockDocument.updateDocField).toHaveBeenCalledWith(
         'test-doc-123',
         'draft',
         true
       )
     })
  })

  describe('Uncommitted Changes Detection', () => {
    it('should detect uncommitted changes when content differs from latest commit', () => {
      // Current content differs from latest commit
      store.selected.data.content = 'Modified content'
      
      expect(store.uncommittedChanges).toBe(true)
    })

    it('should detect uncommitted changes when name differs from latest commit', () => {
      // Current name differs from latest commit
      store.selected.data.name = 'Modified Document Name'
      
      expect(store.uncommittedChanges).toBe(true)
    })

    it('should not detect changes when content matches latest commit', () => {
      // Set content to match latest commit
      store.selected.data.content = 'Updated content'
      store.selected.data.name = 'Test Document'
      
      expect(store.uncommittedChanges).toBe(false)
    })

    it('should handle documents with no commits', () => {
      // Remove all commits
      store.selected.commits = []
      
      // Any content should be considered uncommitted
      store.selected.data.content = 'Some content'
      expect(store.uncommittedChanges).toBe(true)
      
      // Empty content should not be considered uncommitted
      store.selected.data.content = ''
      expect(store.uncommittedChanges).toBe(false)
    })
  })

  describe('Current Commit Getter', () => {
    it('should return the most recent commit', () => {
      const currentCommit = store.currentCommit
      
      expect(currentCommit).toBeDefined()
      expect(currentCommit.id).toBe('commit-2')
      expect(currentCommit.message).toBe('Added more content')
    })

    it('should handle documents with no commits', () => {
      store.selected.commits = []
      
      const currentCommit = store.currentCommit
      expect(currentCommit).toBeNull()
    })

    it('should sort commits by creation date', () => {
      // Add a newer commit
      const newerCommit = {
        id: 'commit-3',
        message: 'Newest commit',
        createDate: { seconds: Date.now() / 1000 }
      }
      
      store.selected.commits.push(newerCommit)
      
      const currentCommit = store.currentCommit
      expect(currentCommit.id).toBe('commit-3')
    })
  })

  describe('Version System Integration', () => {
    it('should handle complete version workflow', async () => {
      // 1. Create a commit
      const commitData = {
        id: 'workflow-commit',
        message: 'Workflow test commit',
        documentContent: 'Workflow content',
        documentName: 'Test Document',
        createDate: { seconds: Date.now() / 1000 },
        versionNumber: '',
        released: false,
        branch: 'main'
      }

      mockCommit.create.mockResolvedValue({
        success: true,
        data: commitData,
        message: 'Commit created successfully'
      })

      await store.createCommit('Workflow test commit')

      // 2. Tag commit as version
      mockDocument.createVersion.mockResolvedValue({
        success: true,
        data: { id: 'workflow-commit', versionNumber: 'v2.0.0', released: false },
        message: 'Commit tagged as version'
      })

      await store.createVersion('v2.0.0', {
        fromCommitId: 'workflow-commit',
        released: false
      })

      // 3. Release the version
      mockCommit.setCommitParams.mockResolvedValue({
        success: true,
        data: {},
        message: 'Commit updated successfully'
      })

      await store.toggleCommitVersionRelease({
        commitId: 'workflow-commit',
        released: true
      })

      // Verify final state
      const workflowCommit = store.selected.commits.find(c => c.id === 'workflow-commit')
      expect(workflowCommit.versionNumber).toBe('v2.0.0')
      expect(workflowCommit.released).toBe(true)

      // Should have updated document release status
      expect(mockDocument.updateDocField).toHaveBeenCalledWith(
        'test-doc-123',
        'releasedVersion',
        ['v1.0.0', 'v2.0.0']
      )
    })
  })
}) 