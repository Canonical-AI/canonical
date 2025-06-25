import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useMainStore } from '../../store/index.js'

// Mock Firebase chat operations
vi.mock('../../services/firebaseDataService', () => ({
  ChatHistory: {
    getAll: vi.fn(),
    getDocById: vi.fn(),
    create: vi.fn(),
    updateChat: vi.fn(),
    updateChatField: vi.fn(),
    archiveChat: vi.fn(),
    deleteChat: vi.fn()
  },
  User: {
    getUserAuth: vi.fn(),
    getUserData: vi.fn()
  },
  Project: {
    getById: vi.fn()
  },
  Document: { getAll: vi.fn() },
  Favorites: { getAll: vi.fn() },
  Task: { getAll: vi.fn() }
}))

// Mock router
vi.mock('../../router', () => ({
  default: {
    push: vi.fn()
  }
}))

describe('Chat Management Integration Tests', () => {
  let store
  let mockChatHistory

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks()

    // Get mock functions
    const { ChatHistory } = await import('../../services/firebaseDataService')
    mockChatHistory = ChatHistory

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

    // Set project data directly for testing
    store.project = {
      id: 'test-project-123',
      name: 'Test Project',
      folders: [],
      users: ['test-user-123'],
      createdBy: 'test-user-123'
    }
  })

  describe('Chat Loading and Structure', () => {
    it('should load all chats with proper structure', async () => {
      const mockChats = [
        {
          id: 'chat-1',
          data: {
            name: 'Project Discussion',
            messages: [
              {
                index: 1,
                text: 'Hello world',
                sent: false,
                timestamp: Date.now()
              }
            ],
            updatedDate: { seconds: Date.now() / 1000 }
          }
        },
        {
          id: 'chat-2',
          data: {
            name: 'Another Chat',
            messages: [],
            updatedDate: { seconds: Date.now() / 1000 }
          }
        }
      ]

      mockChatHistory.getAll.mockResolvedValue(mockChats)

      await store.getChats()

      expect(mockChatHistory.getAll).toHaveBeenCalled()
      expect(store.chats).toHaveLength(2)
      expect(store.chats[0].id).toBe('chat-1')
      expect(store.chats[0].data.name).toBe('Project Discussion')
      expect(store.chats[0].data.messages).toHaveLength(1)
    })

    it('should handle chats with missing messages array', async () => {
      const mockChatsWithMissingMessages = [
        {
          id: 'chat-broken',
          data: {
            name: 'Broken Chat',
            // Missing messages array
            updatedDate: { seconds: Date.now() / 1000 }
          }
        }
      ]

      mockChatHistory.getAll.mockResolvedValue(mockChatsWithMissingMessages)

      await store.getChats()

      expect(store.chats).toHaveLength(1)
      expect(store.chats[0].data.messages).toEqual([]) // Should be empty array, not undefined
    })

    it('should load individual chat by ID with proper structure', async () => {
      const mockChat = {
        id: 'specific-chat-123',
        data: {
          name: 'Specific Chat',
          messages: [
            {
              index: 1,
              text: 'First message',
              sent: false,
              timestamp: Date.now()
            },
            {
              index: 2,
              text: 'Second message',
              sent: true,
              timestamp: Date.now()
            }
          ],
          updatedDate: { seconds: Date.now() / 1000 }
        }
      }

      mockChatHistory.getDocById.mockResolvedValue({
        success: true,
        data: mockChat,
        message: 'Chat loaded successfully'
      })

      const result = await store.getChatById('specific-chat-123')

      expect(mockChatHistory.getDocById).toHaveBeenCalledWith('specific-chat-123')
      expect(result.id).toBe('specific-chat-123')
      expect(result.data.name).toBe('Specific Chat')
      expect(result.data.messages).toHaveLength(2)
    })

    it('should handle chat with undefined messages in getChatById', async () => {
      const mockChatWithUndefinedMessages = {
        id: 'chat-undefined-messages',
        data: {
          name: 'Chat with undefined messages',
          // messages is undefined
          updatedDate: { seconds: Date.now() / 1000 }
        }
      }

      mockChatHistory.getDocById.mockResolvedValue({
        success: true,
        data: mockChatWithUndefinedMessages,
        message: 'Chat loaded successfully'
      })

      const result = await store.getChatById('chat-undefined-messages')

      expect(result.data.messages).toEqual([]) // Should be empty array
    })

    it('should handle failed chat loading gracefully', async () => {
      mockChatHistory.getDocById.mockResolvedValue({
        success: false,
        data: null,
        message: 'Chat not found'
      })

      await expect(store.getChatById('non-existent-chat')).rejects.toThrow('Chat not found')
    })
  })

  describe('Chat Management Operations', () => {
    it('should rename chat successfully', async () => {
      const initialChat = {
        id: 'chat-to-rename',
        data: {
          name: 'Old Name',
          messages: [],
          updatedDate: { seconds: Date.now() / 1000 }
        }
      }

      store.chats = [initialChat]

      mockChatHistory.updateChatField.mockResolvedValue({
        success: true,
        data: {
          id: 'chat-to-rename',
          name: 'New Chat Name'
        },
        message: 'Chat field updated successfully'
      })

      const result = await store.renameChat({
        id: 'chat-to-rename',
        newName: 'New Chat Name'
      })

      expect(mockChatHistory.updateChatField).toHaveBeenCalledWith('chat-to-rename', 'name', 'New Chat Name')
      expect(result.success).toBe(true)
      expect(store.chats[0].data.name).toBe('New Chat Name')
    })

    it('should delete chat successfully', async () => {
      const chatsToDelete = [
        { id: 'chat-1', data: { name: 'Chat 1' } },
        { id: 'chat-to-delete', data: { name: 'Chat to Delete' } },
        { id: 'chat-3', data: { name: 'Chat 3' } }
      ]

      store.chats = [...chatsToDelete]

      mockChatHistory.deleteChat.mockResolvedValue({
        success: true,
        data: { id: 'chat-to-delete' },
        message: 'Chat deleted successfully'
      })

      await store.deleteChat('chat-to-delete')

      expect(mockChatHistory.deleteChat).toHaveBeenCalledWith('chat-to-delete')
      expect(store.chats).toHaveLength(2)
      expect(store.chats.find(chat => chat.id === 'chat-to-delete')).toBeUndefined()
    })

    it('should archive chat successfully', async () => {
      const chatsToArchive = [
        { id: 'chat-1', data: { name: 'Chat 1' } },
        { id: 'chat-to-archive', data: { name: 'Chat to Archive' } },
        { id: 'chat-3', data: { name: 'Chat 3' } }
      ]

      store.chats = [...chatsToArchive]

      mockChatHistory.archiveChat.mockResolvedValue({
        success: true,
        data: { id: 'chat-to-archive', archived: true },
        message: 'Chat archived successfully'
      })

      await store.archiveChat('chat-to-archive')

      expect(mockChatHistory.archiveChat).toHaveBeenCalledWith('chat-to-archive')
      expect(store.chats).toHaveLength(2)
      expect(store.chats.find(chat => chat.id === 'chat-to-archive')).toBeUndefined()
    })

    it('should handle chat operation failures gracefully', async () => {
      store.chats = [
        { id: 'failing-chat', data: { name: 'Failing Chat' } }
      ]

      mockChatHistory.deleteChat.mockResolvedValue({
        success: false,
        data: null,
        message: 'Failed to delete chat'
      })

      await expect(store.deleteChat('failing-chat')).rejects.toThrow('Failed to delete chat')
      
      // Chat should still exist in store since operation failed
      expect(store.chats).toHaveLength(1)
      expect(store.chats[0].id).toBe('failing-chat')
    })
  })

  describe('Chat Data Consistency', () => {
    it('should maintain consistent chat structure when loading empty chats', async () => {
      mockChatHistory.getAll.mockResolvedValue([])

      await store.getChats()

      expect(store.chats).toEqual([])
    })

    it('should handle concurrent chat operations', async () => {
      const initialChats = [
        { id: 'chat-1', data: { name: 'Chat 1', messages: [] } },
        { id: 'chat-2', data: { name: 'Chat 2', messages: [] } }
      ]

      store.chats = [...initialChats]

      // Mock concurrent operations
      mockChatHistory.deleteChat.mockResolvedValue({
        success: true,
        data: { id: 'chat-1' },
        message: 'Chat deleted successfully'
      })

      mockChatHistory.updateChatField.mockResolvedValue({
        success: true,
        data: { id: 'chat-2', name: 'Updated Chat 2' },
        message: 'Chat field updated successfully'
      })

      // Execute operations concurrently
      await Promise.all([
        store.deleteChat('chat-1'),
        store.renameChat({ id: 'chat-2', newName: 'Updated Chat 2' })
      ])

      expect(store.chats).toHaveLength(1)
      expect(store.chats[0].id).toBe('chat-2')
      expect(store.chats[0].data.name).toBe('Updated Chat 2')
    })

    it('should ensure all chats have valid message arrays after various operations', async () => {
      const chatsWithVariousStructures = [
        {
          id: 'chat-normal',
          data: {
            name: 'Normal Chat',
            messages: [{ index: 1, text: 'Hello', sent: false }]
          }
        },
        {
          id: 'chat-empty-messages',
          data: {
            name: 'Empty Messages Chat',
            messages: []
          }
        },
        {
          id: 'chat-no-messages',
          data: {
            name: 'No Messages Property'
            // No messages property
          }
        }
      ]

      mockChatHistory.getAll.mockResolvedValue(chatsWithVariousStructures)

      await store.getChats()

      // All chats should have valid messages arrays
      store.chats.forEach(chat => {
        expect(Array.isArray(chat.data.messages)).toBe(true)
      })

      expect(store.chats[0].data.messages).toHaveLength(1)
      expect(store.chats[1].data.messages).toHaveLength(0)
      expect(store.chats[2].data.messages).toHaveLength(0) // Should be initialized as empty array
    })
  })

  describe('Chat Error Handling', () => {
    it('should handle service errors during chat loading', async () => {
      mockChatHistory.getAll.mockRejectedValue(new Error('Network error'))

      // getChats should handle errors gracefully by setting chats to empty array
      await store.getChats()

      expect(store.chats).toEqual([])
      // Should also show a user-friendly error message
      expect(store.globalAlerts).toHaveLength(1)
      expect(store.globalAlerts[0].type).toBe('error')
      expect(store.globalAlerts[0].message).toContain('Failed to load chats')
    })

    it('should handle malformed chat data gracefully', async () => {
      const malformedChats = [
        null,
        { id: 'incomplete-chat' }, // Missing data property
        { data: { name: 'No ID chat' } }, // Missing id property
        {
          id: 'chat-with-corrupted-data',
          data: null
        },
        {
          id: 'valid-chat',
          data: {
            name: 'Valid Chat',
            messages: ['not-an-array'] // Invalid messages format
          }
        },
        {
          id: 'another-valid-chat',
          data: {
            name: 'Another Valid Chat',
            messages: [{ text: 'Hello', sent: false }]
          }
        }
      ]

      mockChatHistory.getAll.mockResolvedValue(malformedChats)

      await store.getChats()

      // Should handle malformed data without crashing and filter out invalid chats
      expect(store.chats).toHaveLength(2) // Only valid chats should remain
      
      // Check that valid chats have proper structure
      store.chats.forEach(chat => {
        expect(chat).toHaveProperty('id')
        expect(chat).toHaveProperty('data')
        expect(chat.data).toHaveProperty('name')
        expect(Array.isArray(chat.data.messages)).toBe(true)
      })
      
      // Check specific valid chats
      expect(store.chats.find(c => c.id === 'valid-chat')).toBeDefined()
      expect(store.chats.find(c => c.id === 'another-valid-chat')).toBeDefined()
      
      // Invalid chats should be filtered out
      expect(store.chats.find(c => c.id === 'incomplete-chat')).toBeUndefined()
      expect(store.chats.find(c => c.id === 'chat-with-corrupted-data')).toBeUndefined()
    })
  })
}) 