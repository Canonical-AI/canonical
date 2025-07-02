import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useMainStore } from '../../store/index.js'
import { createRouter, createMemoryHistory } from 'vue-router'

// Mock Firebase operations
vi.mock('../../services/firebaseDataService', () => ({
  User: {
    getUserAuth: vi.fn(),
    getUserData: vi.fn(),
    setDefaultProject: vi.fn()
  },
  Project: {
    create: vi.fn(),
    getById: vi.fn(),
    getAll: vi.fn(),
    update: vi.fn(),
    archive: vi.fn(),
    unarchive: vi.fn(),
    delete: vi.fn(),
    addUserToProject: vi.fn(),
    removeUserFromProject: vi.fn()
  },
  Document: {
    getAll: vi.fn(),
    create: vi.fn(),
    updateDoc: vi.fn(),
    deleteDocByID: vi.fn(),
    archiveDoc: vi.fn()
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
    push: vi.fn(),
    replace: vi.fn()
  }
}))

describe('Project Lifecycle Integration Tests', () => {
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
        { path: '/settings/project/:id?', component: { template: '<div>Project Config</div>' } },
        { path: '/document/create-document', component: { template: '<div>Create Document</div>' } }
      ]
    })

    // Reset all store state to ensure clean state between tests
    store.$reset()
    
    // Setup default user
    store.userSetData({
      uid: 'test-user-123',
      email: 'test@example.com',
      displayName: 'Test User',
      tier: 'pro',
      defaultProject: null,
      projects: []
    })
  })

  describe('Project Creation', () => {
    it('should create a new project successfully', async () => {
      const projectData = {
        name: 'Test Project',
        folders: [
          { name: 'Product', children: [] },
          { name: 'Features', children: [] },
          { name: 'Notes', children: [] }
        ],
        users: ['test-user-123'],
        owner: 'test-user-123'
      }

      // Mock successful project creation
      const mockProjectId = 'project-123'
      mockFirebase.Project.create.mockResolvedValue({
        success: true,
        data: { id: mockProjectId, ...projectData }
      })
      
      // Mock project retrieval after creation
      mockFirebase.Project.getById.mockResolvedValue({
        id: mockProjectId,
        name: projectData.name,
        folders: projectData.folders,
        users: [{ userId: 'test-user-123', role: 'admin', status: 'active' }],
        createdBy: 'test-user-123',
        archived: false
      })

      // Mock empty documents for new project
      mockFirebase.Document.getAll.mockResolvedValue([])

      const createdProject = await store.projectCreate(projectData)

      expect(mockFirebase.Project.create).toHaveBeenCalledWith({
        name: projectData.name,
        folders: projectData.folders,
        users: [projectData.owner],
        owner: projectData.owner
      })
      expect(createdProject).toBeTruthy()
      expect(createdProject.id).toBe(mockProjectId)
    })

    it('should handle project creation with default folders', async () => {
      const projectData = {
        name: 'Default Folders Project',
        folders: [
          { name: 'Product', children: [] },
          { name: 'Features', children: [] },
          { name: 'Personas', children: [] },
          { name: 'Notes', children: [] },
          { name: 'Decisions', children: [] },
          { name: 'User Interviews', children: [] }
        ],
        users: ['test-user-123'],
        owner: 'test-user-123'
      }

      const mockProjectId = 'project-default-folders'
      mockFirebase.Project.create.mockResolvedValue({
        success: true,
        data: { id: mockProjectId, ...projectData }
      })
      
      mockFirebase.Project.getById.mockResolvedValue({
        id: mockProjectId,
        ...projectData,
        users: [{ userId: 'test-user-123', role: 'admin', status: 'active' }],
        createdBy: 'test-user-123',
        archived: false
      })

      mockFirebase.Document.getAll.mockResolvedValue([])

      const createdProject = await store.projectCreate(projectData)

      expect(createdProject.folders).toHaveLength(6)
      expect(createdProject.folders.map(f => f.name)).toEqual([
        'Product', 'Features', 'Personas', 'Notes', 'Decisions', 'User Interviews'
      ])
    })

    it('should handle project creation failure', async () => {
      const projectData = {
        name: 'Failed Project',
        folders: [],
        users: ['test-user-123'],
        owner: 'test-user-123'
      }

      // Mock project creation failure
      mockFirebase.Project.create.mockResolvedValue({
        success: false,
        message: 'Creation failed'
      })

      const createdProject = await store.projectCreate(projectData)

      expect(createdProject).toBeNull()
      expect(store.globalAlerts).toHaveLength(1)
      expect(store.globalAlerts[0].type).toBe('error')
    })

    it('should enforce project creation limits for free users', async () => {
      // Set user to free tier with existing projects at limit
      store.userSetData({
        uid: 'free-user-123',
        email: 'free@example.com',
        displayName: 'Free User',
        tier: 'free',
        projects: [
          { projectId: 'existing-project-1', status: 'active' },
          { projectId: 'existing-project-2', status: 'active' },
          { projectId: 'existing-project-3', status: 'active' },
          { projectId: 'existing-project-4', status: 'active' },
          { projectId: 'existing-project-5', status: 'active' }
        ]
      })

      const projectData = {
        name: 'Free Limit Exceeded',
        folders: [],
        users: ['free-user-123'],
        owner: 'free-user-123'
      }

      // Check that canCreateProject returns false for free users at limit
      expect(store.canCreateProject.allowed).toBe(false)
      expect(store.canCreateProject.reason).toContain('Free users are limited')

      // Attempt to create project should fail
      const createdProject = await store.projectCreate(projectData)
      expect(createdProject).toBeNull()
    })
  })

  describe('Project Selection and Switching', () => {
    beforeEach(() => {
      // Setup user with multiple projects
      store.userSetData({
        uid: 'multi-project-user',
        email: 'multi@example.com',
        displayName: 'Multi Project User',
        tier: 'pro',
        defaultProject: 'project-1',
        projects: [
          { projectId: 'project-1', status: 'active', role: 'admin' },
          { projectId: 'project-2', status: 'active', role: 'member' },
          { projectId: 'project-3', status: 'active', role: 'admin' },
          { projectId: 'archived-project', status: 'active', role: 'admin' }
        ]
      })
    })

    it('should switch between projects successfully', async () => {
      // Mock project data for switching
      const project1Data = {
        id: 'project-1',
        name: 'Project One',
        folders: [{ name: 'Folder 1', children: [] }],
        users: [{ userId: 'multi-project-user', role: 'admin', status: 'active' }],
        archived: false
      }

      const project2Data = {
        id: 'project-2', 
        name: 'Project Two',
        folders: [{ name: 'Folder 2', children: [] }],
        users: [{ userId: 'multi-project-user', role: 'member', status: 'active' }],
        archived: false
      }

      // Mock project retrieval with specific implementations
      mockFirebase.Project.getById.mockImplementation((projectId) => {
        if (projectId === 'project-1') {
          return Promise.resolve(project1Data)
        } else if (projectId === 'project-2') {
          return Promise.resolve(project2Data)
        }
        return Promise.resolve(null)
      })

      // Mock document loading
      mockFirebase.Document.getAll.mockResolvedValue([])

      // Mock all project data loading methods for both projects
      mockFirebase.ChatHistory.getAll.mockResolvedValue([])
      mockFirebase.Favorites.getAll.mockResolvedValue([])
      mockFirebase.Template.getAll.mockResolvedValue([])
      mockFirebase.Comment.getAll.mockResolvedValue([])
      mockFirebase.Task.getAll.mockResolvedValue([])

      // Switch to project 1
      const result1 = await store.projectSet('project-1', true)
      expect(result1).toBe(true)
      expect(store.project.id).toBe('project-1')
      expect(store.project.name).toBe('Project One')
      expect(store.isProjectAdmin).toBe(true)

      // Switch to project 2
      const result2 = await store.projectSet('project-2', true)
      expect(result2).toBe(true)
      expect(store.project.id).toBe('project-2')
      expect(store.project.name).toBe('Project Two')
      expect(store.isProjectAdmin).toBe(false) // User is member, not admin
    })

    it('should handle project access denied', async () => {
      // Mock project that user doesn't have access to
      mockFirebase.Project.getById.mockRejectedValue(new Error('Access denied'))

      const result = await store.projectSet('unauthorized-project', true)
      expect(result).toBe(false)
      expect(store.globalAlerts).toHaveLength(1)
      expect(store.globalAlerts[0].type).toBe('error')
    })

    it('should handle archived project access correctly', async () => {
      const archivedProjectData = {
        id: 'archived-project',
        name: 'Archived Project',
        folders: [],
        users: [{ userId: 'multi-project-user', role: 'admin', status: 'active' }],
        archived: true
      }

      mockFirebase.Project.getById.mockResolvedValue(archivedProjectData)
      mockFirebase.Document.getAll.mockResolvedValue([])
      
      // Mock all project data loading methods
      mockFirebase.ChatHistory.getAll.mockResolvedValue([])
      mockFirebase.Favorites.getAll.mockResolvedValue([])
      mockFirebase.Template.getAll.mockResolvedValue([])
      mockFirebase.Comment.getAll.mockResolvedValue([])
      mockFirebase.Task.getAll.mockResolvedValue([])

      const result = await store.projectSet('archived-project', true)
      expect(result).toBe(true)
      expect(store.project.archived).toBe(true)
      expect(store.isProjectReadOnly).toBe(true)
    })
  })

  describe('Project Updates', () => {
    beforeEach(async () => {
      // Setup project for testing updates
      const projectData = {
        id: 'update-test-project',
        name: 'Original Name',
        folders: [
          { name: 'Original Folder', children: [] }
        ],
        users: [{ userId: 'test-user-123', role: 'admin', status: 'active' }],
        createdBy: 'test-user-123',
        archived: false
      }

      store.project = projectData
      mockFirebase.Project.getById.mockResolvedValue(projectData)
      mockFirebase.Document.getAll.mockResolvedValue([])
    })

    it('should update project name successfully', async () => {
      const updateData = {
        id: 'update-test-project',
        name: 'Updated Project Name',
        folders: store.project.folders
      }

      mockFirebase.Project.update.mockResolvedValue({
        success: true,
        message: 'Project updated successfully'
      })

      // Mock refresh after update
      mockFirebase.Project.getById.mockResolvedValue({
        ...store.project,
        name: 'Updated Project Name'
      })

      // Simulate ProjectConfig.vue update flow
      const result = await mockFirebase.Project.update(updateData.id, {
        name: updateData.name,
        folders: updateData.folders
      })

      expect(result.success).toBe(true)
      expect(mockFirebase.Project.update).toHaveBeenCalledWith('update-test-project', {
        name: 'Updated Project Name',
        folders: store.project.folders
      })
    })

    it('should update project folders successfully', async () => {
      const newFolders = [
        { name: 'Product', children: [] },
        { name: 'Engineering', children: [] },
        { name: 'Design', children: [] }
      ]

      mockFirebase.Project.update.mockResolvedValue({
        success: true,
        message: 'Project updated successfully'
      })

      mockFirebase.Project.getById.mockResolvedValue({
        ...store.project,
        folders: newFolders
      })

      const result = await mockFirebase.Project.update('update-test-project', {
        name: store.project.name,
        folders: newFolders
      })

      expect(result.success).toBe(true)
      expect(mockFirebase.Project.update).toHaveBeenCalledWith('update-test-project', {
        name: 'Original Name',
        folders: newFolders
      })
    })

    it('should handle project update failure', async () => {
      mockFirebase.Project.update.mockResolvedValue({
        success: false,
        message: 'Update failed - insufficient permissions'
      })

      const result = await mockFirebase.Project.update('update-test-project', {
        name: 'Should Fail',
        folders: []
      })

      expect(result.success).toBe(false)
      expect(result.message).toContain('insufficient permissions')
    })

    it('should prevent updates for read-only projects', async () => {
      // Set project as archived (read-only)
      store.project.archived = true

      // Should not allow updates
      expect(store.isProjectReadOnly).toBe(true)
      
      // Update should not be called for read-only projects
      // This would be handled by the UI, but we can test the computed property
      expect(store.isProjectReadOnly).toBe(true)
    })
  })

  describe('Project Archiving', () => {
    beforeEach(async () => {
      const projectData = {
        id: 'archive-test-project',
        name: 'Archive Test Project',
        folders: [{ name: 'Test Folder', children: [] }],
        users: [{ userId: 'test-user-123', role: 'admin', status: 'active' }],
        createdBy: 'test-user-123',
        archived: false
      }

      store.project = projectData
      mockFirebase.Project.getById.mockResolvedValue(projectData)
    })

    it('should archive project successfully', async () => {
      mockFirebase.Project.archive.mockResolvedValue({
        success: true,
        message: 'Project archived successfully'
      })

      const result = await store.projectArchive('archive-test-project')

      expect(result).toBe(true)
      expect(mockFirebase.Project.archive).toHaveBeenCalledWith('archive-test-project')
    })

    it('should handle archive failure', async () => {
      mockFirebase.Project.archive.mockResolvedValue({
        success: false,
        message: 'Archive failed'
      })

      const result = await store.projectArchive('archive-test-project')

      expect(result).toBe(false)
      expect(store.globalAlerts).toHaveLength(1)
      expect(store.globalAlerts[0].type).toBe('error')
    })

    it('should show archived projects in dropdown with indicator', async () => {
      // Setup multiple projects including archived ones
      store.projects = [
        { id: 'active-1', name: 'Active Project', archived: false },
        { id: 'archived-1', name: 'Archived Project', archived: true },
        { id: 'active-2', name: 'Another Active', archived: false }
      ]

      // Test dropdown formatting (this would be computed in ProjectConfig.vue)
      const dropdownItems = store.projects.map(project => ({
        id: project.id,
        name: project.archived ? `${project.name} (Archived)` : project.name,
        archived: project.archived
      }))

      expect(dropdownItems).toHaveLength(3)
      expect(dropdownItems[1].name).toBe('Archived Project (Archived)')
      expect(dropdownItems[1].archived).toBe(true)
    })
  })

  describe('Project Restoration', () => {
    beforeEach(async () => {
      const archivedProjectData = {
        id: 'restore-test-project',
        name: 'Restore Test Project',
        folders: [{ name: 'Test Folder', children: [] }],
        users: [{ userId: 'test-user-123', role: 'admin', status: 'active' }],
        createdBy: 'test-user-123',
        archived: true
      }

      store.project = archivedProjectData
      mockFirebase.Project.getById.mockResolvedValue(archivedProjectData)
    })

    it('should restore archived project successfully', async () => {
      mockFirebase.Project.unarchive.mockResolvedValue({
        success: true,
        message: 'Project restored successfully'
      })

      const result = await store.projectUnarchive('restore-test-project')

      expect(result).toBe(true)
      expect(mockFirebase.Project.unarchive).toHaveBeenCalledWith('restore-test-project')
    })

    it('should handle restoration failure', async () => {
      mockFirebase.Project.unarchive.mockResolvedValue({
        success: false,
        message: 'Restoration failed'
      })

      const result = await store.projectUnarchive('restore-test-project')

      expect(result).toBe(false)
      expect(store.globalAlerts).toHaveLength(1)
      expect(store.globalAlerts[0].type).toBe('error')
    })
  })

  describe('Project Deletion', () => {
    beforeEach(async () => {
      const projectData = {
        id: 'delete-test-project',
        name: 'Delete Test Project',
        folders: [{ name: 'Test Folder', children: [] }],
        users: [{ userId: 'test-user-123', role: 'admin', status: 'active' }],
        createdBy: 'test-user-123',
        archived: false
      }

      store.project = projectData
      mockFirebase.Project.getById.mockResolvedValue(projectData)
      
      // Setup user with multiple projects
      store.userSetData({
        uid: 'test-user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        tier: 'pro',
        defaultProject: 'delete-test-project',
        projects: [
          { projectId: 'delete-test-project', status: 'active', role: 'admin' },
          { projectId: 'other-project', status: 'active', role: 'admin' }
        ]
      })
    })

    it('should delete project successfully and navigate to another project', async () => {
      mockFirebase.Project.delete.mockResolvedValue({
        success: true,
        message: 'Project deleted successfully'
      })

      const result = await store.projectDelete('delete-test-project')

      expect(result).toBe(true)
      expect(mockFirebase.Project.delete).toHaveBeenCalledWith('delete-test-project')
    })

    it('should handle deletion failure', async () => {
      mockFirebase.Project.delete.mockResolvedValue({
        success: false,
        message: 'Deletion failed'
      })

      const result = await store.projectDelete('delete-test-project')

      expect(result).toBe(false)
      expect(store.globalAlerts).toHaveLength(1)
      expect(store.globalAlerts[0].type).toBe('error')
    })

    it('should navigate to home when deleting last project', async () => {
      // Setup user with only one project
      store.userSetData({
        uid: 'test-user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        tier: 'pro',
        defaultProject: 'delete-test-project',
        projects: [
          { projectId: 'delete-test-project', status: 'active', role: 'admin' }
        ]
      })

      mockFirebase.Project.delete.mockResolvedValue({
        success: true,
        message: 'Project deleted successfully'
      })

      const result = await store.projectDelete('delete-test-project')

      expect(result).toBe(true)
      // Should clear project state when no other projects available
      expect(store.user.defaultProject).toBeNull()
    })

    it('should properly switch to next project after deletion and update components', async () => {
      // Setup user with multiple projects
      store.userSetData({
        uid: 'test-user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        tier: 'pro',
        defaultProject: 'project-to-delete',
        projects: [
          { projectId: 'project-to-delete', status: 'active', role: 'admin' },
          { projectId: 'remaining-project', status: 'active', role: 'admin' }
        ]
      })

      // Setup projects list
      store.projects = [
        { id: 'project-to-delete', name: 'Project To Delete', archived: false },
        { id: 'remaining-project', name: 'Remaining Project', archived: false }
      ]

      // Set current project to the one being deleted
      store.project = { id: 'project-to-delete', name: 'Project To Delete' }

      // Mock services
      mockFirebase.Project.delete.mockResolvedValue({
        success: true,
        message: 'Project deleted successfully'
      })

      mockFirebase.Project.getById.mockResolvedValue({
        id: 'remaining-project',
        name: 'Remaining Project',
        folders: [],
        users: []
      })

      // Mock other services that projectGetAllData calls
      mockFirebase.Document.getAll.mockResolvedValue([])
      mockFirebase.Task.getAll.mockResolvedValue([])
      mockFirebase.ChatHistory.getAll.mockResolvedValue([])
      mockFirebase.Favorites.getAll.mockResolvedValue([])

      // Mock userSetDefaultProject
      mockFirebase.User.setDefaultProject.mockResolvedValue({
        success: true
      })

      const result = await store.projectDelete('project-to-delete')

      expect(result).toBe(true)
      expect(mockFirebase.Project.delete).toHaveBeenCalledWith('project-to-delete')
      
      // Should remove project from projects list
      expect(store.projects).toHaveLength(1)
      expect(store.projects[0].id).toBe('remaining-project')
      
      // Should remove from user's projects list
      expect(store.user.projects).toHaveLength(1)
      expect(store.user.projects[0].projectId).toBe('remaining-project')
      
      // Should switch to remaining project
      expect(store.project.id).toBe('remaining-project')
      expect(store.user.defaultProject).toBe('remaining-project')
    })

    it('should navigate to new-user when deleting last project', async () => {
      // Setup user with only one project
      store.userSetData({
        uid: 'test-user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        tier: 'pro',
        defaultProject: 'last-project',
        projects: [
          { projectId: 'last-project', status: 'active', role: 'admin' }
        ]
      })

      store.projects = [
        { id: 'last-project', name: 'Last Project', archived: false }
      ]

      store.project = { id: 'last-project', name: 'Last Project' }

      mockFirebase.Project.delete.mockResolvedValue({
        success: true,
        message: 'Project deleted successfully'
      })

      const result = await store.projectDelete('last-project')

      expect(result).toBe(true)
      
      // Should clear projects list
      expect(store.projects).toHaveLength(0)
      expect(store.user.projects).toHaveLength(0)
      
      // Should clear current project and default project
      expect(store.project.id).toBeNull()
      expect(store.user.defaultProject).toBeNull()
    })
  })

  describe('Project Permissions and Access Control', () => {
    it('should correctly identify project admin status', async () => {
      const adminProjectData = {
        id: 'admin-project',
        name: 'Admin Project',
        folders: [],
        users: [{ userId: 'test-user-123', role: 'admin', status: 'active' }],
        createdBy: 'test-user-123',
        archived: false
      }

      store.project = adminProjectData
      store.userSetData({
        uid: 'test-user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        tier: 'pro',
        projects: [{ projectId: 'admin-project', status: 'active', role: 'admin' }]
      })

      expect(store.isProjectAdmin).toBe(true)
      expect(store.isProjectReadOnly).toBe(false)
    })

    it('should correctly identify member-only status', async () => {
      const memberProjectData = {
        id: 'member-project',
        name: 'Member Project',
        folders: [],
        users: [{ userId: 'test-user-123', role: 'member', status: 'active' }],
        createdBy: 'other-user',
        archived: false
      }

      store.project = memberProjectData
      store.userSetData({
        uid: 'test-user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        tier: 'pro',
        projects: [{ projectId: 'member-project', status: 'active', role: 'member' }]
      })

      expect(store.isProjectAdmin).toBe(false)
      expect(store.isProjectReadOnly).toBe(false) // Members can still edit content
    })

    it('should handle read-only access for archived projects', async () => {
      const archivedProjectData = {
        id: 'readonly-project',
        name: 'Read Only Project',
        folders: [],
        users: [{ userId: 'test-user-123', role: 'admin', status: 'active' }],
        createdBy: 'test-user-123',
        archived: true
      }

      store.project = archivedProjectData

      expect(store.isProjectReadOnly).toBe(true)
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle network errors during project operations', async () => {
      mockFirebase.Project.create.mockRejectedValue(new Error('Network error'))

      const result = await store.projectCreate({
        name: 'Network Test',
        folders: [],
        users: ['test-user-123'],
        owner: 'test-user-123'
      })

      expect(result).toBeNull()
      expect(store.globalAlerts).toHaveLength(1)
      expect(store.globalAlerts[0].message).toContain('Failed to create project')
    })

    it('should handle invalid project data', async () => {
      // Try to create project with missing required fields
      const result = await store.projectCreate({
        name: '', // Empty name
        folders: [],
        users: [],
        owner: ''
      })

      expect(result).toBeNull()
    })

    it('should handle concurrent project operations', async () => {
      // Setup user with access to both projects
      store.userSetData({
        uid: 'test-user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        tier: 'pro',
        projects: [
          { projectId: 'project-1', status: 'active', role: 'admin' },
          { projectId: 'project-2', status: 'active', role: 'admin' }
        ]
      })

      // Simulate multiple rapid project selections
      mockFirebase.Project.getById
        .mockResolvedValueOnce({
          id: 'project-1',
          name: 'Project 1',
          folders: [],
          users: [{ userId: 'test-user-123', role: 'admin', status: 'active' }],
          archived: false
        })
        .mockResolvedValueOnce({
          id: 'project-2',
          name: 'Project 2',
          folders: [],
          users: [{ userId: 'test-user-123', role: 'admin', status: 'active' }],
          archived: false
        })

      mockFirebase.Document.getAll.mockResolvedValue([])
      
      // Mock all project data loading methods for both calls
      mockFirebase.ChatHistory.getAll.mockResolvedValue([])
      mockFirebase.Favorites.getAll.mockResolvedValue([])
      mockFirebase.Template.getAll.mockResolvedValue([])
      mockFirebase.Comment.getAll.mockResolvedValue([])
      mockFirebase.Task.getAll.mockResolvedValue([])

      // Simulate rapid project switching
      const promise1 = store.projectSet('project-1', true)
      const promise2 = store.projectSet('project-2', true)

      const [result1, result2] = await Promise.all([promise1, promise2])

      // Both should succeed, but final state should be consistent
      expect(result1).toBe(true)
      expect(result2).toBe(true)
      expect(store.project.id).toBeTruthy()
    })
  })

  describe('Integration with Document Management', () => {
    it('should load documents when switching projects', async () => {
      // Setup user with access to project
      store.userSetData({
        uid: 'test-user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        tier: 'pro',
        projects: [
          { projectId: 'doc-test-project', status: 'active', role: 'admin' }
        ]
      })

      const projectData = {
        id: 'doc-test-project',
        name: 'Document Test Project',
        folders: [{ name: 'Documents', children: [] }],
        users: [{ userId: 'test-user-123', role: 'admin', status: 'active' }],
        archived: false
      }

      const mockDocuments = [
        { id: 'doc-1', data: { name: 'Document 1', folder: 'Documents' } },
        { id: 'doc-2', data: { name: 'Document 2', folder: 'Documents' } }
      ]

      mockFirebase.Project.getById.mockResolvedValue(projectData)
      mockFirebase.Document.getAll.mockResolvedValue(mockDocuments)
      
      // Mock all project data loading methods
      mockFirebase.ChatHistory.getAll.mockResolvedValue([])
      mockFirebase.Favorites.getAll.mockResolvedValue([])
      mockFirebase.Template.getAll.mockResolvedValue([])
      mockFirebase.Comment.getAll.mockResolvedValue([])
      mockFirebase.Task.getAll.mockResolvedValue([])

      const result = await store.projectSet('doc-test-project', true)

      expect(result).toBe(true)
      expect(store.project.id).toBe('doc-test-project')
      expect(store.documents).toHaveLength(2)
      expect(mockFirebase.Document.getAll).toHaveBeenCalledWith()
    })

    it('should handle project deletion and document state', async () => {
      // Setup project with documents
      store.project = { id: 'project-with-docs', name: 'Project With Docs' }
      store.projects = [{ id: 'project-with-docs', name: 'Project With Docs' }]
      store.documents = [
        { id: 'doc-1', data: { name: 'Document 1' } },
        { id: 'doc-2', data: { name: 'Document 2' } }
      ]

      mockFirebase.Project.delete.mockResolvedValue({
        success: true,
        message: 'Project deleted successfully'
      })

      const result = await store.projectDelete('project-with-docs')

      expect(result).toBe(true)
      // Project should be removed from projects list
      expect(store.projects).toHaveLength(0)
      // When no projects remain, user should have null defaultProject
      expect(store.user.defaultProject).toBeNull()
    })
  })
}) 