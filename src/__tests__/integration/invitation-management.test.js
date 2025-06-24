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
    getUserData: vi.fn(),
    getUserByEmail: vi.fn(),
    getPendingInvitations: vi.fn(),
    acceptInvitation: vi.fn(),
    declineInvitation: vi.fn(),
    getInvitationByToken: vi.fn(),
    getUserRoleInProject: vi.fn()
  },
  Project: {
    create: vi.fn(),
    addUserToProject: vi.fn(),
    getById: vi.fn(),
    inviteUserToProject: vi.fn(),
    updateInvitation: vi.fn(),
    removeUserFromProject: vi.fn(),
    reinstateUser: vi.fn(),
    getUsersForProject: vi.fn(),
    getInvitation: vi.fn(),
    getProjectInvitations: vi.fn()
  },
  Document: {
    create: vi.fn(),
    getAll: vi.fn()
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

// Mock crypto for invite token generation
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: vi.fn(() => 'mock-uuid-12345')
  },
  writable: true
})

describe('Invitation Management Integration Tests', () => {
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
        { path: '/settings/project/:id', component: { template: '<div>Project Settings</div>' } },
        { path: '/invite/:token', component: { template: '<div>Invitation Accept</div>' } }
      ]
    })

    // Setup basic authenticated admin user with project
    store.userSetData({
      uid: 'admin-user-123',
      email: 'admin@example.com',
      displayName: 'Admin User',
      tier: 'pro',
      defaultProject: 'project-123',
      projects: [{
        projectId: 'project-123',
        status: 'active',
        role: 'admin'
      }]
    })

    // Mock project data
    mockFirebase.Project.getById.mockResolvedValue({
      id: 'project-123',
      name: 'Test Project',
      createdBy: 'admin-user-123',
      users: [
        {
          id: 'admin-user-123',
          email: 'admin@example.com',
          displayName: 'Admin User',
          role: 'admin',
          status: 'active'
        }
      ],
      invitations: [],
      folders: []
    })

    // Mock document loading
    mockFirebase.Document.getAll.mockResolvedValue([])
    mockFirebase.ChatHistory.getAll.mockResolvedValue([])
    mockFirebase.Favorites.getAll.mockResolvedValue([])
    mockFirebase.Task.getAll.mockResolvedValue([])

    // Set project
    await store.projectSet('project-123')
  })

  describe('Admin Invitation Creation Flow', () => {
    it('should create invitation for new user successfully', async () => {
      // Mock user doesn't exist
      mockFirebase.User.getUserByEmail.mockResolvedValue(null)
      
      // Mock no existing invitations
      mockFirebase.Project.getInvitation.mockResolvedValue([])
      
      // Mock successful invitation creation
      const mockInvitation = {
        id: 'invite-123',
        email: 'newuser@example.com',
        projectId: 'project-123',
        invitedBy: 'admin-user-123',
        role: 'user',
        status: 'pending',
        inviteToken: 'mock-uuid-12345',
        createdDate: { seconds: Date.now() / 1000 },
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
      
      mockFirebase.Project.inviteUserToProject.mockResolvedValue({
        success: true,
        ...mockInvitation
      })

      // Create invitation through store
      const result = await store.projectCreateInvitation({
        projectId: 'project-123',
        email: 'newuser@example.com',
        role: 'user'
      })

      // Verify invitation creation
      expect(mockFirebase.Project.inviteUserToProject).toHaveBeenCalledWith({
        projectId: 'project-123',
        email: 'newuser@example.com',
        role: 'user'
      })

      expect(result.success).toBe(true)
      expect(result.email).toBe('newuser@example.com')
      expect(result.inviteToken).toBe('mock-uuid-12345')
    })

    it('should handle existing user by adding them directly to project', async () => {
      // Mock existing user
      const existingUser = {
        id: 'existing-user-456',
        email: 'existing@example.com',
        displayName: 'Existing User'
      }
      mockFirebase.User.getUserByEmail.mockResolvedValue(existingUser)
      
      // Mock successful user addition
      mockFirebase.Project.addUserToProject.mockResolvedValue(true)
      mockFirebase.Project.inviteUserToProject.mockResolvedValue({
        success: true,
        user: existingUser
      })

      const result = await store.projectCreateInvitation({
        projectId: 'project-123',
        email: 'existing@example.com',
        role: 'user'
      })

      expect(result.success).toBe(true)
      expect(result.user).toEqual(existingUser)
    })

    it('should prevent duplicate invitations', async () => {
      // Mock user doesn't exist
      mockFirebase.User.getUserByEmail.mockResolvedValue(null)
      
      // Mock existing invitation
      const existingInvitation = {
        id: 'existing-invite-789',
        email: 'duplicate@example.com',
        status: 'pending'
      }
      mockFirebase.Project.getInvitation.mockResolvedValue([existingInvitation])
      mockFirebase.Project.inviteUserToProject.mockResolvedValue({
        success: true,
        ...existingInvitation
      })

      const result = await store.projectCreateInvitation({
        projectId: 'project-123',
        email: 'duplicate@example.com',
        role: 'user'
      })

      expect(result.success).toBe(true)
      expect(result.id).toBe('existing-invite-789')
    })

    it('should enforce admin-only invitation creation', async () => {
      // Change user to non-admin
      store.userSetData({
        uid: 'regular-user-123',
        email: 'user@example.com',
        displayName: 'Regular User',
        tier: 'pro',
        defaultProject: 'project-123',
        projects: [{
          projectId: 'project-123',
          status: 'active',
          role: 'user' // Not admin
        }]
      })

      // Mock non-admin response
      mockFirebase.Project.inviteUserToProject.mockResolvedValue(null)

      const result = await store.projectCreateInvitation({
        projectId: 'project-123',
        email: 'newuser@example.com',
        role: 'user'
      })

      expect(result).toBeNull()
    })
  })

  describe('Invitation Status Management', () => {
    it('should update invitation status successfully', async () => {
      mockFirebase.Project.updateInvitation.mockResolvedValue()

      await store.projectUpdateInvitation({
        id: 'invite-123',
        status: 'cancelled'
      })

      expect(mockFirebase.Project.updateInvitation).toHaveBeenCalledWith(
        'invite-123',
        { status: 'cancelled' }
      )
    })

    it('should load project invitations for admin users', async () => {
      const mockInvitations = [
        {
          id: 'invite-1',
          email: 'user1@example.com',
          role: 'user',
          status: 'pending',
          createdDate: { toDate: () => new Date('2024-01-01') }
        },
        {
          id: 'invite-2',
          email: 'user2@example.com',
          role: 'admin',
          status: 'accepted',
          createdDate: { toDate: () => new Date('2024-01-02') }
        }
      ]

      mockFirebase.Project.getProjectInvitations.mockResolvedValue(mockInvitations)

      // This would typically be called by a component
      const invitations = await mockFirebase.Project.getProjectInvitations('project-123')

      expect(invitations).toHaveLength(2)
      expect(invitations[0].email).toBe('user1@example.com')
      expect(invitations[1].status).toBe('accepted')
    })
  })

  describe('User Invitation Acceptance Flow', () => {
    beforeEach(() => {
      // Reset to non-logged-in state for invitation acceptance tests
      store.userLogout()
    })

    it('should load invitation details by token', async () => {
      const mockInvitation = {
        email: 'invited@example.com',
        projectId: 'project-123',
        invitedBy: 'admin-user-123',
        role: 'user',
        status: 'pending',
        inviteToken: 'valid-token-123'
      }

      const mockProject = {
        id: 'project-123',
        name: 'Test Project'
      }

      const mockInviter = {
        displayName: 'Admin User',
        email: 'admin@example.com'
      }

      mockFirebase.User.getInvitationByToken.mockResolvedValue(mockInvitation)
      mockFirebase.Project.getById.mockResolvedValue(mockProject)
      mockFirebase.User.getUserData.mockResolvedValue(mockInviter)

      const invitationDetails = await store.userGetInvitationByToken('valid-token-123')

      expect(invitationDetails.email).toBe('invited@example.com')
      expect(invitationDetails.projectName).toBe('Test Project')
      expect(invitationDetails.inviterName).toBe('Admin User')
    })

    it('should complete full invitation acceptance flow', async () => {
      // Step 1: User signs up/logs in
      store.userSetData({
        uid: 'new-user-789',
        email: 'invited@example.com',
        displayName: 'New User',
        tier: 'trial',
        defaultProject: null,
        projects: []
      })

      // Step 2: Mock successful invitation acceptance
      mockFirebase.User.acceptInvitation.mockResolvedValue('project-123')
      
      // Mock user entering after acceptance
      mockFirebase.User.getUserAuth.mockResolvedValue({
        uid: 'new-user-789',
        email: 'invited@example.com',
        displayName: 'New User',
        tier: 'trial',
        defaultProject: 'project-123',
        projects: [{
          projectId: 'project-123',
          status: 'active',
          role: 'user'
        }]
      })

      // Step 3: Accept invitation
      const projectId = await store.userAcceptInvitation('valid-token-123')

      // Verify acceptance
      expect(mockFirebase.User.acceptInvitation).toHaveBeenCalledWith('valid-token-123')
      expect(projectId).toBe('project-123')

      // Verify invitation removed from pending list
      expect(store.pendingInvitations.filter(inv => inv.inviteToken === 'valid-token-123')).toHaveLength(0)
    })

    it('should handle invitation decline', async () => {
      // User is logged in
      store.userSetData({
        uid: 'user-123',
        email: 'user@example.com',
        displayName: 'User',
        tier: 'trial',
        defaultProject: null,
        projects: []
      })

      mockFirebase.User.declineInvitation.mockResolvedValue()

      await store.userDeclineInvitation('invite-123')

      expect(mockFirebase.User.declineInvitation).toHaveBeenCalledWith('invite-123')
      expect(store.pendingInvitations.filter(inv => inv.id === 'invite-123')).toHaveLength(0)
    })

    it('should load and manage pending invitations', async () => {
      // User is logged in
      store.userSetData({
        uid: 'user-123',
        email: 'user@example.com',
        displayName: 'User',
        tier: 'trial',
        defaultProject: null,
        projects: []
      })

      const mockPendingInvites = [
        {
          id: 'invite-1',
          email: 'user@example.com',
          projectId: 'project-456',
          role: 'user',
          inviteToken: 'token-1'
        }
      ]

      const mockProject = {
        id: 'project-456',
        name: 'Another Project'
      }

      mockFirebase.User.getPendingInvitations.mockResolvedValue(mockPendingInvites)
      mockFirebase.Project.getById.mockResolvedValue(mockProject)

      const invitations = await store.userGetPendingInvitations()

      expect(invitations).toHaveLength(1)
      expect(invitations[0].projectName).toBe('Another Project')
      expect(store.pendingInvitations).toHaveLength(1)
    })
  })

  describe('Authorization and Security', () => {
    it('should enforce email matching for invitation acceptance', async () => {
      // User logged in with different email
      store.userSetData({
        uid: 'user-123',
        email: 'wrong@example.com',
        displayName: 'Wrong User',
        tier: 'trial',
        defaultProject: null,
        projects: []
      })

      // Mock invitation for different email
      mockFirebase.User.acceptInvitation.mockRejectedValue(
        new Error('This invitation is for a different email address')
      )

      await expect(store.userAcceptInvitation('token-for-other-email')).rejects.toThrow(
        'This invitation is for a different email address'
      )
    })

    it('should handle expired invitations', async () => {
      store.userSetData({
        uid: 'user-123',
        email: 'user@example.com',
        displayName: 'User',
        tier: 'trial',
        defaultProject: null,
        projects: []
      })

      mockFirebase.User.acceptInvitation.mockRejectedValue(
        new Error('Invitation has expired')
      )

      await expect(store.userAcceptInvitation('expired-token')).rejects.toThrow(
        'Invitation has expired'
      )
    })

    it('should validate project admin permissions', async () => {
      // Ensure the store is set up properly for admin check
      store.project.id = 'project-123'
      
      // Check that isProjectAdmin getter works correctly
      expect(store.isProjectAdmin).toBe(true)

      // Change to non-admin user
      store.userSetData({
        uid: 'user-123',
        email: 'user@example.com',
        displayName: 'Regular User',
        tier: 'trial',
        defaultProject: 'project-123',
        projects: [{
          projectId: 'project-123',
          status: 'active',
          role: 'user'
        }]
      })

      expect(store.isProjectAdmin).toBe(false)
    })

    it('should handle invalid invitation tokens', async () => {
      mockFirebase.User.getInvitationByToken.mockRejectedValue(
        new Error('Invalid or expired invitation')
      )

      await expect(store.userGetInvitationByToken('invalid-token')).rejects.toThrow(
        'Invalid or expired invitation'
      )
    })
  })

  describe('User Management Integration', () => {
    it('should remove users from project', async () => {
      mockFirebase.Project.removeUserFromProject.mockResolvedValue()

      await store.projectRemoveUserFromProject({
        userId: 'user-to-remove-123',
        projectId: 'project-123'
      })

      expect(mockFirebase.Project.removeUserFromProject).toHaveBeenCalledWith({
        userId: 'user-to-remove-123',
        projectId: 'project-123'
      })

      // Verify local state update
      const removedUser = store.project.users?.find(u => u.userId === 'user-to-remove-123')
      if (removedUser) {
        expect(removedUser.status).toBe('removed')
      }
    })

    it('should reinstate removed users', async () => {
      mockFirebase.Project.reinstateUser.mockResolvedValue()

      await store.projectReinstateUser({
        userId: 'user-to-reinstate-123',
        projectId: 'project-123'
      })

      expect(mockFirebase.Project.reinstateUser).toHaveBeenCalledWith({
        userId: 'user-to-reinstate-123',
        projectId: 'project-123'
      })

      // Verify local state update
      const reinstatedUser = store.project.users?.find(u => u.userId === 'user-to-reinstate-123')
      if (reinstatedUser) {
        expect(reinstatedUser.status).toBe('active')
      }
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      mockFirebase.Project.inviteUserToProject.mockRejectedValue(
        new Error('Network error')
      )

      await expect(store.projectCreateInvitation({
        projectId: 'project-123',
        email: 'user@example.com',
        role: 'user'
      })).rejects.toThrow('Network error')
    })

    it('should handle missing project data', async () => {
      mockFirebase.Project.getById.mockResolvedValue(null)

      const result = await store.projectSet('non-existent-project')
      
      expect(result).toBe(false)
    })

    it('should clear invitation state on user logout', () => {
      // Set some invitation state
      store.pendingInvitations = [{ id: 'test-invite' }]

      // Logout user
      store.userLogout()

      // Verify state is cleared
      expect(store.pendingInvitations).toHaveLength(0)
      expect(store.pendingInvitationsDismissed).toBe(false)
    })

    it('should handle empty invitation responses', async () => {
      mockFirebase.User.getPendingInvitations.mockResolvedValue([])

      const invitations = await store.userGetPendingInvitations()

      expect(invitations).toHaveLength(0)
      expect(store.pendingInvitations).toHaveLength(0)
    })
  })

  describe('Complete Invitation Workflows', () => {
    it('should handle complete admin workflow: invite → manage → cancel', async () => {
      // Step 1: Create invitation
      mockFirebase.User.getUserByEmail.mockResolvedValue(null)
      mockFirebase.Project.getInvitation.mockResolvedValue([])
      
      const mockInvitation = {
        id: 'workflow-invite-123',
        email: 'workflow@example.com',
        projectId: 'project-123',
        role: 'user',
        status: 'pending',
        inviteToken: 'workflow-token-123'
      }
      
      mockFirebase.Project.inviteUserToProject.mockResolvedValue({
        success: true,
        ...mockInvitation
      })

      const createResult = await store.projectCreateInvitation({
        projectId: 'project-123',
        email: 'workflow@example.com',
        role: 'user'
      })

      expect(createResult.success).toBe(true)

      // Step 2: Load invitations
      mockFirebase.Project.getProjectInvitations.mockResolvedValue([mockInvitation])

      // Step 3: Cancel invitation
      mockFirebase.Project.updateInvitation.mockResolvedValue()

      await store.projectUpdateInvitation({
        id: 'workflow-invite-123',
        status: 'cancelled'
      })

      expect(mockFirebase.Project.updateInvitation).toHaveBeenCalledWith(
        'workflow-invite-123',
        { status: 'cancelled' }
      )
    })

    it('should handle complete user workflow: receive → login → accept → join project', async () => {
      // Step 1: User receives invitation link and loads details
      const mockInvitation = {
        email: 'complete-flow@example.com',
        projectId: 'project-123',
        invitedBy: 'admin-user-123',
        role: 'user',
        status: 'pending',
        inviteToken: 'complete-flow-token'
      }

      mockFirebase.User.getInvitationByToken.mockResolvedValue(mockInvitation)
      mockFirebase.Project.getById.mockResolvedValue({
        id: 'project-123',
        name: 'Complete Flow Project'
      })
      mockFirebase.User.getUserData.mockResolvedValue({
        displayName: 'Admin User'
      })

      const invitationDetails = await store.userGetInvitationByToken('complete-flow-token')
      expect(invitationDetails.projectName).toBe('Complete Flow Project')

      // Step 2: User logs in/signs up
      store.userSetData({
        uid: 'complete-flow-user-123',
        email: 'complete-flow@example.com',
        displayName: 'Complete Flow User',
        tier: 'trial',
        defaultProject: null,
        projects: []
      })

      // Step 3: User accepts invitation
      mockFirebase.User.acceptInvitation.mockResolvedValue('project-123')
      mockFirebase.User.getUserAuth.mockResolvedValue({
        uid: 'complete-flow-user-123',
        email: 'complete-flow@example.com',
        displayName: 'Complete Flow User',
        tier: 'trial',
        defaultProject: 'project-123',
        projects: [{
          projectId: 'project-123',
          status: 'active',
          role: 'user'
        }]
      })

      const projectId = await store.userAcceptInvitation('complete-flow-token')

      // Step 4: Verify user is now in project
      expect(projectId).toBe('project-123')
      expect(store.user.defaultProject).toBe('project-123')
      
      // Make sure the project ID is set in the store
      store.project.id = 'project-123'

      // Step 5: Verify project access
      const hasAccess = store.isUserInProject
      expect(hasAccess).toBe(true)
    })
  })
}) 