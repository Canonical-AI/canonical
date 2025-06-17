import { describe, it, expect, vi, beforeEach } from 'vitest'
import { showAlert, copyToClipboard, debounce, getRandomItem, placeCursorAtEnd } from '../uiHelpers.js'

describe('uiHelpers', () => {
  describe('showAlert', () => {
    it('should commit alert to store with correct parameters', () => {
      const mockStore = {
        commit: vi.fn()
      }
      
      showAlert(mockStore, 'success', 'Test message')
      
      expect(mockStore.commit).toHaveBeenCalledWith('alert', {
        type: 'success',
        message: 'Test message',
        autoClear: true
      })
    })

    it('should respect autoClear parameter', () => {
      const mockStore = {
        commit: vi.fn()
      }
      
      showAlert(mockStore, 'error', 'Test message', false)
      
      expect(mockStore.commit).toHaveBeenCalledWith('alert', {
        type: 'error',
        message: 'Test message',
        autoClear: false
      })
    })
  })

  describe('copyToClipboard', () => {
    let mockStore

    beforeEach(() => {
      mockStore = {
        commit: vi.fn()
      }
      // Mock navigator.clipboard
      Object.assign(navigator, {
        clipboard: {
          writeText: vi.fn()
        }
      })
    })

    it('should copy text and show success message', async () => {
      navigator.clipboard.writeText.mockResolvedValue()
      
      await copyToClipboard('test text', mockStore)
      
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('test text')
      expect(mockStore.commit).toHaveBeenCalledWith('alert', {
        type: 'info',
        message: 'Copied to clipboard!',
        autoClear: true
      })
    })

    it('should show error message when clipboard fails', async () => {
      navigator.clipboard.writeText.mockRejectedValue(new Error('Clipboard error'))
      
      await copyToClipboard('test text', mockStore)
      
      expect(mockStore.commit).toHaveBeenCalledWith('alert', {
        type: 'error',
        message: 'Failed to copy to clipboard',
        autoClear: true
      })
    })

    it('should use custom success message', async () => {
      navigator.clipboard.writeText.mockResolvedValue()
      
      await copyToClipboard('test text', mockStore, 'Custom success!')
      
      expect(mockStore.commit).toHaveBeenCalledWith('alert', {
        type: 'info',
        message: 'Custom success!',
        autoClear: true
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