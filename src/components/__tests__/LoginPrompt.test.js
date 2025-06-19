import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { createRouter, createMemoryHistory } from 'vue-router'
import LoginPrompt from '../LoginPrompt.vue'

// Mock Firebase
vi.mock('../../firebase', () => ({
  firebaseApp: {}
}))

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
  GoogleAuthProvider: vi.fn(),
  GithubAuthProvider: vi.fn(),
  signInWithPopup: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signInWithEmailAndPassword: vi.fn()
}))

// Mock Vuetify components for simpler testing
const mockVuetifyComponents = {
  'v-dialog': { template: '<div><slot /></div>' },
  'v-card': { template: '<div><slot /></div>' },
  'v-card-title': { template: '<div><slot /></div>' },
  'v-card-text': { template: '<div><slot /></div>' },
  'v-card-actions': { template: '<div><slot /></div>' },
  'v-btn': { 
    template: '<button @click="$emit(\'click\')"><slot /></button>',
    emits: ['click']
  },
  'v-icon': { template: '<span><slot /></span>' },
  'v-expand-transition': { template: '<div><slot /></div>' },
  'v-divider': { template: '<hr />' },
  'v-form': { 
    template: '<form @submit="$emit(\'submit\', $event)"><slot /></form>',
    emits: ['submit']
  },
  'v-text-field': { 
    template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
    props: ['modelValue', 'label', 'type'],
    emits: ['update:modelValue']
  },
  'v-spacer': { template: '<div></div>' }
}

describe('LoginPrompt', () => {
  let store
  let router
  let wrapper

  beforeEach(() => {
    // Create mock store
    store = createStore({
      getters: {
        isLoggedIn: () => false,
        isUserLoggedIn: () => false
      },
      actions: {
        enter: vi.fn()
      }
    })

    // Create mock router
    router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: { template: '<div>Home</div>' } }]
    })

    // Mock localStorage
    global.localStorage = {
      getItem: vi.fn(),
      setItem: vi.fn()
    }
  })

  const createWrapper = (props = {}) => {
    return mount(LoginPrompt, {
      global: {
        plugins: [store, router],
        components: mockVuetifyComponents
      },
      props
    })
  }

  describe('Component Rendering', () => {
    it('should render login dialog', () => {
      wrapper = createWrapper()
      
      // Just check that the component renders with the expected text
      expect(wrapper.text()).toContain('Sign in to Canonical')
    })

    it('should show social login buttons', () => {
      wrapper = createWrapper()
      
      expect(wrapper.text()).toContain('Sign In with Google')
      expect(wrapper.text()).toContain('Sign In with GitHub')
      expect(wrapper.text()).toContain('Sign In with Email')
    })

    it('should show remind me later button', () => {
      wrapper = createWrapper()
      
      expect(wrapper.text()).toContain('Remind me later')
    })
  })

  describe('User Interactions', () => {
    it('should toggle email form when email button is clicked', async () => {
      wrapper = createWrapper()
      
      // Check initial state - email form is collapsed
      expect(wrapper.text()).not.toContain('Need an account? Sign Up')
      
      // Click the email sign-in button
      const emailButton = wrapper.findAll('button').find(btn => 
        btn.text().includes('Sign In with Email')
      )
      await emailButton.trigger('click')
      
      // Email form should now be visible (the toggle button appears)
      expect(wrapper.text()).toContain('Need an account? Sign Up')
    })

    it('should toggle between sign up and sign in modes', async () => {
      wrapper = createWrapper()
      
      // First show the email form
      const emailButton = wrapper.findAll('button').find(btn => 
        btn.text().includes('Sign In with Email')
      )
      await emailButton.trigger('click')
      
      // Should initially show "Sign In"
      expect(wrapper.text()).toContain('Sign In')
      expect(wrapper.text()).toContain('Need an account? Sign Up')
      
      // Click toggle button
      const toggleButton = wrapper.findAll('button').find(btn => 
        btn.text().includes('Need an account? Sign Up')
      )
      await toggleButton.trigger('click')
      
      // Should now show "Sign Up"
      expect(wrapper.text()).toContain('Sign Up')
      expect(wrapper.text()).toContain('Already have an account? Sign In')
    })

    it('should call dismiss when remind me later is clicked', async () => {
      // Mock localStorage directly on the wrapper instance
      const mockLocalStorage = {
        setItem: vi.fn(),
        getItem: vi.fn()
      }
      
      // Override the global localStorage for this test
      Object.defineProperty(global, 'localStorage', {
        value: mockLocalStorage,
        writable: true
      })
      
      wrapper = createWrapper()
      
      const remindButton = wrapper.findAll('button').find(btn => 
        btn.text().includes('Remind me later')
      )
      await remindButton.trigger('click')
      
      // Should set localStorage to dismiss prompt
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'loginPromptDismissed', 
        expect.any(String)
      )
    })
  })

  describe('Form Validation', () => {
    it('should have required email and password fields', async () => {
      wrapper = createWrapper()
      
      // Show email form
      const emailButton = wrapper.findAll('button').find(btn => 
        btn.text().includes('Sign In with Email')
      )
      await emailButton.trigger('click')
      
      // Check that email and password inputs exist
      const inputs = wrapper.findAll('input')
      expect(inputs.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('Store Integration', () => {
    it('should check login status from store', () => {
      const mockStore = createStore({
        getters: {
          isLoggedIn: () => true,
          isUserLoggedIn: () => true
        }
      })

      wrapper = mount(LoginPrompt, {
        global: {
          plugins: [mockStore, router],
          components: mockVuetifyComponents
        }
      })

      // Component should have access to store getters
      // Check the store directly
      expect(mockstore.isLoggedIn).toBe(true)
      expect(mockstore.isUserLoggedIn).toBe(true)
    })
  })
}) 