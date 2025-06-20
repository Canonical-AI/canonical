import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useMainStore } from '../index.js'
import { copyToClipboard, debounce, getRandomItem, placeCursorAtEnd } from '../uiHelpers.js'

// Mock the store module
vi.mock('../../store/index.js', () => ({
  useMainStore: vi.fn()
}))

describe('uiHelpers', () => {
  let mockStore

  beforeEach(() => {
    // Create fresh Pinia instance
    const pinia = createPinia()
    setActivePinia(pinia)
    
    // Create mock store instance
    mockStore = {
      uiAlert: vi.fn()
    }
    
    // Mock the useMainStore to return our mock
    vi.mocked(useMainStore).mockReturnValue(mockStore)
  })

  describe('copyToClipboard', () => {
    beforeEach(() => {
      // Mock navigator.clipboard
      Object.assign(navigator, {
        clipboard: {
          writeText: vi.fn()
        }
      })
    })

    it('should copy text and show success message', async () => {
      navigator.clipboard.writeText.mockResolvedValue()
      
      await copyToClipboard('test text')
      
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('test text')
      expect(mockStore.uiAlert).toHaveBeenCalledWith({
        type: 'info',
        message: 'Copied to clipboard!'
      })
    })

    it('should show error message when clipboard fails', async () => {
      navigator.clipboard.writeText.mockRejectedValue(new Error('Clipboard error'))
      
      await copyToClipboard('test text')
      
      expect(mockStore.uiAlert).toHaveBeenCalledWith({
        type: 'error',
        message: 'Failed to copy to clipboard'
      })
    })

    it('should use custom success message', async () => {
      navigator.clipboard.writeText.mockResolvedValue()
      
      await copyToClipboard('test text', 'Custom success!')
      
      expect(mockStore.uiAlert).toHaveBeenCalledWith({
        type: 'info',
        message: 'Custom success!'
      })
    })
  })

  describe('debounce', () => {
    it('should debounce function calls', async () => {
      const mockFn = vi.fn()
      const debouncedFn = debounce(mockFn, 100)
      
      // Call multiple times quickly
      debouncedFn('call1')
      debouncedFn('call2')
      debouncedFn('call3')
      
      // Should not have been called yet
      expect(mockFn).not.toHaveBeenCalled()
      
      // Wait for debounce delay
      await new Promise(resolve => setTimeout(resolve, 150))
      
      // Should only be called once with the last arguments
      expect(mockFn).toHaveBeenCalledTimes(1)
      expect(mockFn).toHaveBeenCalledWith('call3')
    })
  })

  describe('getRandomItem', () => {
    it('should return an item from the array', () => {
      const array = ['a', 'b', 'c', 'd', 'e']
      const result = getRandomItem(array)
      
      expect(array).toContain(result)
    })

    it('should return undefined for empty array', () => {
      const result = getRandomItem([])
      
      expect(result).toBeUndefined()
    })

    it('should return the only item in single-item array', () => {
      const array = ['only-item']
      const result = getRandomItem(array)
      
      expect(result).toBe('only-item')
    })
  })

  describe('placeCursorAtEnd', () => {
    beforeEach(() => {
      // Mock window.getSelection and document.createRange properly
      const mockSelection = {
        removeAllRanges: vi.fn(),
        addRange: vi.fn()
      }
      
      const mockRange = {
        selectNodeContents: vi.fn(),
        collapse: vi.fn()
      }
      
      global.window.getSelection = vi.fn(() => mockSelection)
      global.document.createRange = vi.fn(() => mockRange)
    })

    it('should place cursor at end of element', () => {
      // Create a simple mock element instead of using document.createElement
      const mockElement = {
        nodeType: 1,
        tagName: 'DIV'
      }
      const mockSelection = window.getSelection()
      const mockRange = document.createRange()
      
      placeCursorAtEnd(mockElement)
      
      expect(mockRange.selectNodeContents).toHaveBeenCalledWith(mockElement)
      expect(mockRange.collapse).toHaveBeenCalledWith(false)
      expect(mockSelection.removeAllRanges).toHaveBeenCalled()
      expect(mockSelection.addRange).toHaveBeenCalledWith(mockRange)
    })
  })
}) 