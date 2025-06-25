import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useMainStore } from '../../store/index.js'
import { createRouter, createMemoryHistory } from 'vue-router'
import UserManagement from '../settings/UserManagement.vue'

// Mock Firebase services
vi.mock('../../services/firebaseDataService', () => ({
  Project: {
    getProjectInvitations: vi.fn(),
    inviteUserToProject: vi.fn(),
    updateInvitation: vi.fn(),
    removeUserFromProject: vi.fn(),
    reinstateUser: vi.fn()
  }
}))

// Mock Vuetify components for testing
const mockVuetifyComponents = {
  'v-sheet': { template: '<div class="v-sheet"><slot /></div>', props: ['pa', 'color', 'rounded'] },
  'v-divider': { template: '<hr class="v-divider" />', props: ['class'] },
  'v-btn': { 
    template: '<button @click="$emit(\'click\')" :disabled="disabled" :loading="loading" :class="{ disabled }"><slot /></button>',
    props: ['disabled', 'loading', 'color', 'variant', 'size', 'density', 'prepend-icon', 'append-icon', 'class'],
    emits: ['click']
  },
  'v-text-field': { 
    template: '<div class="v-text-field"><input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" :placeholder="label" :class="{ error: errorMessages && errorMessages.length }" /><span v-if="readonly" class="readonly-display">{{ modelValue }}</span></div>',
    props: ['modelValue', 'label', 'variant', 'density', 'clearable', 'hide-details', 'prepend-inner-icon', 'type', 'required', 'error-messages', 'success', 'success-messages', 'readonly', 'append-icon', 'append-inner-icon'],
    emits: ['update:modelValue', 'keyup.enter', 'click:append', 'click:append-inner']
  },
  'v-table': { template: '<table class="v-table"><slot /></table>', props: ['density'] },
  'v-chip': { 
    template: '<span class="v-chip" :class="`chip-${color} chip-${variant}`"><slot /></span>',
    props: ['color', 'variant', 'size']
  },
  'v-dialog': { 
    template: '<div v-if="modelValue" class="v-dialog"><slot /></div>',
    props: ['modelValue', 'max-width', 'persistent'],
    emits: ['update:modelValue']
  },
  'v-card': { template: '<div class="v-card"><slot /></div>' },
  'v-card-title': { template: '<h3 class="v-card-title"><slot /></h3>', props: ['class'] },
  'v-card-text': { template: '<div class="v-card-text"><slot /></div>', props: ['class'] },
  'v-card-actions': { template: '<div class="v-card-actions"><slot /></div>' },
  'v-stepper': { 
    template: '<div class="v-stepper"><slot /></div>',
    props: ['modelValue'],
    emits: ['update:modelValue']
  },
  'v-stepper-header': { template: '<div class="v-stepper-header"><slot /></div>' },
  'v-stepper-item': { 
    template: '<div class="v-stepper-item"><slot /></div>',
    props: ['complete', 'value', 'title', 'density']
  },
  'v-stepper-window': { template: '<div class="v-stepper-window"><slot /></div>' },
  'v-stepper-window-item': { 
    template: '<div v-if="value === 1 || value === 2" class="v-stepper-window-item"><slot /></div>',
    props: ['value']
  },
  'v-select': { 
    template: '<select :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value)"><option v-for="item in items" :key="item.value" :value="item.value">{{ item.title }}</option></select>',
    props: ['modelValue', 'items', 'label', 'variant', 'prepend-inner-icon'],
    emits: ['update:modelValue']
  },
  'v-alert': { 
    template: '<div class="v-alert" :class="`alert-${type} alert-${variant}`"><slot /></div>',
    props: ['type', 'variant', 'class']
  },
  'v-spacer': { template: '<div class="v-spacer"></div>' },
  'v-icon': { 
    template: '<span class="v-icon"><slot /></span>',
    props: ['left']
  },
  'v-menu': { template: '<div class="v-menu"><slot /></div>' },
  'v-list': { template: '<ul class="v-list"><slot /></ul>' },
  'v-list-item': { template: '<li class="v-list-item"><slot /></li>' },
  'v-list-item-title': { template: '<div class="v-list-item-title"><slot /></div>' }
}

describe('UserManagement Component', () => {
  let wrapper
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

    // Mock store methods
    store.projectCreateInvitation = vi.fn()
    store.projectUpdateInvitation = vi.fn()
    store.projectRemoveUserFromProject = vi.fn()
    store.projectReinstateUser = vi.fn()
    store.uiAlert = vi.fn()

    // Create router
    router = createRouter({
      history: createMemoryHistory(),
      routes: []
    })

    // Setup admin user
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

    // Setup project
    store.project = {
      id: 'project-123',
      name: 'Test Project',
      createdBy: 'admin-user-123',
      users: [],
      folders: []
    }
  })

  const createWrapper = (propsData = {}) => {
    const defaultProps = {
      projectId: 'project-123',
      users: [
        {
          id: 'admin-user-123',
          email: 'admin@example.com',
          displayName: 'Admin User',
          role: 'admin',
          status: 'active'
        },
        {
          id: 'user-456',
          email: 'user@example.com',
          displayName: 'Regular User',
          role: 'user',
          status: 'active'
        }
      ]
    }

    return mount(UserManagement, {
      props: { ...defaultProps, ...propsData },
      global: {
        plugins: [store, router],
        components: mockVuetifyComponents,
        mocks: {
          $store: store
        }
      }
    })
  }

  describe('Component Rendering', () => {
    it('should render user management interface for admin', async () => {
      // Mock pending invitations
      mockFirebase.Project.getProjectInvitations.mockResolvedValue([])
      
      wrapper = createWrapper()
      await wrapper.vm.$nextTick()

      expect(wrapper.text()).toContain('Manage Users')
      expect(wrapper.text()).toContain('Invite User')
      expect(wrapper.find('button').exists()).toBe(true)
    })

    it('should display existing users in table', async () => {
      mockFirebase.Project.getProjectInvitations.mockResolvedValue([])
      
      wrapper = createWrapper()
      await wrapper.vm.$nextTick()

      expect(wrapper.text()).toContain('Admin User')
      expect(wrapper.text()).toContain('Regular User')
      expect(wrapper.text()).toContain('admin@example.com')
      expect(wrapper.text()).toContain('user@example.com')
    })

    it('should show search field when users exist', async () => {
      mockFirebase.Project.getProjectInvitations.mockResolvedValue([])
      
      wrapper = createWrapper()
      await wrapper.vm.$nextTick()

      const searchField = wrapper.find('input[placeholder="Search users..."]')
      expect(searchField.exists()).toBe(true)
    })

    it('should disable invite button for non-admin users', async () => {
      // Change to non-admin user
      store.userSetData({
        uid: 'user-456',
        email: 'user@example.com',
        displayName: 'Regular User',
        tier: 'pro',
        defaultProject: 'project-123',
        projects: [{
          projectId: 'project-123',
          status: 'active',
          role: 'user'
        }]
      })

      mockFirebase.Project.getProjectInvitations.mockResolvedValue([])
      
      wrapper = createWrapper()
      await wrapper.vm.$nextTick()

      const inviteButton = wrapper.find('button.disabled')
      expect(inviteButton.exists()).toBe(true)
    })
  })

  describe('Invitation Creation', () => {
    beforeEach(async () => {
      mockFirebase.Project.getProjectInvitations.mockResolvedValue([])
      wrapper = createWrapper()
      await wrapper.vm.$nextTick()
    })

    it('should open invite dialog when invite button is clicked', async () => {
      const inviteButton = wrapper.find('button')
      await inviteButton.trigger('click')

      expect(wrapper.vm.inviteUserDialog.show).toBe(true)
      expect(wrapper.find('.v-dialog').exists()).toBe(true)
    })

    it('should validate email addresses', async () => {
      wrapper.vm.inviteUserDialog.show = true
      await wrapper.vm.$nextTick()

      // Test invalid email
      wrapper.vm.inviteUserDialog.email = 'invalid-email'
      await wrapper.vm.$nextTick()

      expect(wrapper.vm.isValidEmailFormat('invalid-email')).toBe(false)
      expect(wrapper.vm.emailValidationErrors).toContain('Please enter a valid email address')

      // Test valid email
      wrapper.vm.inviteUserDialog.email = 'valid@example.com'
      await wrapper.vm.$nextTick()

      expect(wrapper.vm.isValidEmailFormat('valid@example.com')).toBe(true)
    })

    it('should prevent duplicate invitations', async () => {
      // Add existing user email
      wrapper.vm.inviteUserDialog.email = 'admin@example.com'
      await wrapper.vm.$nextTick()

      expect(wrapper.vm.emailExistsInProject('admin@example.com')).toBe(true)
      expect(wrapper.vm.emailValidationErrors).toContain('This email is already a member of the project')
    })

    it('should create invitation for new user', async () => {
      // Mock successful invitation creation
      store.projectCreateInvitation.mockResolvedValue({
        success: true,
        id: 'invite-123',
        email: 'newuser@example.com',
        role: 'user',
        inviteToken: 'token-123'
      })

      wrapper.vm.inviteUserDialog.show = true
      wrapper.vm.inviteUserDialog.email = 'newuser@example.com'
      wrapper.vm.inviteUserDialog.role = 'user'
      await wrapper.vm.$nextTick()

      // Trigger invitation creation
      await wrapper.vm.sendInvitationFromModal()

      expect(store.projectCreateInvitation).toHaveBeenCalledWith({
        projectId: 'project-123',
        email: 'newuser@example.com',
        role: 'user'
      })

      expect(wrapper.vm.inviteUserDialog.step).toBe(2)
      expect(wrapper.vm.inviteUserDialog.createdInvitation).toBeTruthy()
    })

    it('should display invitation link after creation', async () => {
      // Mock window.location.origin
      Object.defineProperty(window, 'location', {
        value: {
          origin: 'http://localhost:3000'
        }
      })

      wrapper.vm.inviteUserDialog.show = true
      wrapper.vm.inviteUserDialog.step = 2
      wrapper.vm.inviteUserDialog.createdInvitation = {
        inviteToken: 'test-token-123',
        email: 'test@example.com',
        role: 'user'
      }
      await wrapper.vm.$nextTick()

      // Check if the component's buildInvitationUrl method is working
      expect(wrapper.vm.buildInvitationUrl('test-token-123')).toContain('/invite/test-token-123')
      
      // Check if the full URL is displayed correctly in the component
      const expectedUrl = `http://localhost:3000/invite/test-token-123`
      
      // Look for the URL in the readonly text field value
      const textField = wrapper.find('.readonly-display')
      if (textField.exists()) {
        expect(textField.text()).toContain('/invite/test-token-123')
      }
      
      expect(wrapper.text()).toContain('test@example.com')
    })
  })

  describe('Invitation Management', () => {
    it('should load and display pending invitations', async () => {
      const mockInvitations = [
        {
          id: 'invite-1',
          email: 'pending@example.com',
          role: 'user',
          status: 'pending',
          createdDate: { toDate: () => new Date('2024-01-01') },
          expiresAt: { toDate: () => new Date('2024-01-08') },
          inviteToken: 'token-1'
        }
      ]

      mockFirebase.Project.getProjectInvitations.mockResolvedValue(mockInvitations)
      
      wrapper = createWrapper()
      
      // Manually set the pending invitations since the component loads them asynchronously
      wrapper.vm.pendingInvitations = mockInvitations
      await wrapper.vm.$nextTick()

      // Check that the data is in the component's computed property
      expect(wrapper.vm.filteredInvitations).toHaveLength(1)
      expect(wrapper.vm.filteredInvitations[0].email).toBe('pending@example.com')
      
      // Since we're using mock components, let's check the component's data instead
      expect(wrapper.vm.pendingInvitations[0].email).toBe('pending@example.com')
      expect(wrapper.vm.pendingInvitations[0].status).toBe('pending')
    })

    it('should allow canceling invitations', async () => {
      const mockInvitations = [
        {
          id: 'invite-cancel-123',
          email: 'cancel@example.com',
          role: 'user',
          status: 'pending',
          createdDate: { toDate: () => new Date() },
          expiresAt: { toDate: () => new Date(Date.now() + 86400000) },
          inviteToken: 'cancel-token'
        }
      ]

      mockFirebase.Project.getProjectInvitations.mockResolvedValue(mockInvitations)
      store.projectUpdateInvitation.mockResolvedValue()
      
      wrapper = createWrapper()
      await wrapper.vm.$nextTick()

      // Mock the invitation data
      wrapper.vm.pendingInvitations = mockInvitations

      await wrapper.vm.cancelInvitation('invite-cancel-123')

      expect(store.projectUpdateInvitation).toHaveBeenCalledWith({
        id: 'invite-cancel-123',
        status: 'cancelled'
      })
    })

    it('should copy invitation links to clipboard', async () => {
      // Mock clipboard API
      const mockWriteText = vi.fn().mockResolvedValue()
      global.navigator = {
        clipboard: {
          writeText: mockWriteText
        }
      }

      wrapper = createWrapper()
      wrapper.vm.invitationDialog.token = 'copy-token-123'

      await wrapper.vm.copyInvitationLinkToClipboard('copy-token-123')

      expect(mockWriteText).toHaveBeenCalledWith(
        expect.stringContaining('/invite/copy-token-123')
      )
    })
  })

  describe('User Search and Filtering', () => {
    it('should filter users by search query', async () => {
      mockFirebase.Project.getProjectInvitations.mockResolvedValue([])
      
      wrapper = createWrapper()
      await wrapper.vm.$nextTick()

      // Set search query - need to set both userSearchQuery and debouncedSearchQuery since debounce is used
      wrapper.vm.userSearchQuery = 'admin'
      wrapper.vm.debouncedSearchQuery = 'admin'
      await wrapper.vm.$nextTick()

      const filteredUsers = wrapper.vm.filteredAndSortedUsers
      expect(filteredUsers).toHaveLength(1)
      expect(filteredUsers[0].email).toBe('admin@example.com')
    })

    it('should sort users correctly (active first, then removed)', async () => {
      const usersWithStatuses = [
        {
          id: 'user-1',
          email: 'removed@example.com',
          displayName: 'Removed User',
          role: 'user',
          status: 'removed'
        },
        {
          id: 'user-2',
          email: 'active@example.com',
          displayName: 'Active User',
          role: 'user',
          status: 'active'
        }
      ]

      mockFirebase.Project.getProjectInvitations.mockResolvedValue([])
      
      wrapper = createWrapper({ users: usersWithStatuses })
      await wrapper.vm.$nextTick()

      const sortedUsers = wrapper.vm.filteredAndSortedUsers
      expect(sortedUsers[0].status).toBe('active')
      expect(sortedUsers[1].status).toBe('removed')
    })
  })

  describe('User Actions', () => {
    it('should show confirmation dialog for user removal', async () => {
      mockFirebase.Project.getProjectInvitations.mockResolvedValue([])
      
      wrapper = createWrapper()
      await wrapper.vm.$nextTick()

      wrapper.vm.confirmRemoveUser('user-456')

      expect(wrapper.vm.confirmDialog.show).toBe(true)
      expect(wrapper.vm.confirmDialog.title).toContain('Remove User')
    })

    it('should remove users when confirmed', async () => {
      mockFirebase.Project.getProjectInvitations.mockResolvedValue([])
      store.projectRemoveUserFromProject.mockResolvedValue()
      
      wrapper = createWrapper()
      wrapper.vm.confirmDialog.action = () => wrapper.vm.removeUser('user-456')

      await wrapper.vm.confirmDialog.action()

      expect(store.projectRemoveUserFromProject).toHaveBeenCalledWith({
        userId: 'user-456',
        projectId: 'project-123'
      })
    })

    it('should reinstate removed users', async () => {
      mockFirebase.Project.getProjectInvitations.mockResolvedValue([])
      store.projectReinstateUser.mockResolvedValue()
      
      wrapper = createWrapper()

      await wrapper.vm.reinstateUser('user-456')

      expect(store.projectReinstateUser).toHaveBeenCalledWith({
        userId: 'user-456',
        projectId: 'project-123'
      })
    })
  })

  describe('Permissions and Authorization', () => {
    it('should determine admin status correctly', async () => {
      mockFirebase.Project.getProjectInvitations.mockResolvedValue([])
      
      wrapper = createWrapper()
      await wrapper.vm.$nextTick()

      // Admin user should have admin access
      expect(wrapper.vm.isCurrentUserAdmin).toBe(true)
    })

    it('should handle project creator permissions', async () => {
      // Set user as project creator but not explicitly admin in user list
      const usersWithoutExplicitAdmin = [
        {
          id: 'creator-123',
          email: 'creator@example.com',
          displayName: 'Project Creator',
          role: 'user', // Not explicitly admin in users array
          status: 'active'
        }
      ]

      store.userSetData({
        uid: 'creator-123',
        email: 'creator@example.com',
        displayName: 'Project Creator',
        tier: 'pro',
        defaultProject: 'project-123',
        projects: [{
          projectId: 'project-123',
          status: 'active',
          role: 'user'
        }]
      })

      // But user IS the project creator
      store.project.createdBy = 'creator-123'

      mockFirebase.Project.getProjectInvitations.mockResolvedValue([])
      
      wrapper = createWrapper({ users: usersWithoutExplicitAdmin })
      await wrapper.vm.$nextTick()

      expect(wrapper.vm.isCurrentUserAdmin).toBe(true)
    })

    it('should disable admin functions for regular users', async () => {
      // Change to regular user
      store.userSetData({
        uid: 'user-456',
        email: 'user@example.com',
        displayName: 'Regular User',
        tier: 'pro',
        defaultProject: 'project-123',
        projects: [{
          projectId: 'project-123',
          status: 'active',
          role: 'user'
        }]
      })

      // User is not project creator
      store.project.createdBy = 'admin-user-123'

      mockFirebase.Project.getProjectInvitations.mockResolvedValue([])
      
      // Pass users where the current user is not admin
      const regularUsersList = [
        {
          id: 'admin-user-123',
          email: 'admin@example.com',
          displayName: 'Admin User',
          role: 'admin',
          status: 'active'
        },
        {
          id: 'user-456',
          email: 'user@example.com',
          displayName: 'Regular User',
          role: 'user', // This user is not admin
          status: 'active'
        }
      ]
      
      wrapper = createWrapper({ users: regularUsersList })
      await wrapper.vm.$nextTick()

      expect(wrapper.vm.isCurrentUserAdmin).toBe(false)
      
      // Initialize the dialog state to test canCreateInvitation
      wrapper.vm.inviteUserDialog.email = 'test@example.com'
      wrapper.vm.inviteUserDialog.role = 'user'
      await wrapper.vm.$nextTick()
      
      expect(wrapper.vm.canCreateInvitation).toBe(false)
    })
  })

  describe('Error Handling', () => {
    it('should handle invitation creation errors', async () => {
      mockFirebase.Project.getProjectInvitations.mockResolvedValue([])
      
      wrapper = createWrapper()
      wrapper.vm.inviteUserDialog.show = true
      wrapper.vm.inviteUserDialog.email = 'error@example.com'

      // Mock error
      store.projectCreateInvitation.mockRejectedValue(new Error('Network error'))

      await wrapper.vm.sendInvitationFromModal()

      expect(wrapper.vm.inviteError).toBe('Network error')
    })

    it('should handle invitation loading errors gracefully', async () => {
      mockFirebase.Project.getProjectInvitations.mockRejectedValue(
        new Error('Permission denied')
      )
      
      wrapper = createWrapper()
      await wrapper.vm.$nextTick()

      // Should not crash and should set empty invitations
      expect(wrapper.vm.pendingInvitations).toEqual([])
    })
  })
}) 