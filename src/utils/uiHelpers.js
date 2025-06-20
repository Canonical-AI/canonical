import { useMainStore } from "../store/index.js";
const getStore = () => useMainStore();

/**
 * Copy text to clipboard with user feedback
 * @param {string} text - Text to copy
 * @param {Object} store - Vuex store instance
 * @param {string} successMessage - Success message to show
 */
export async function copyToClipboard(text, successMessage = 'Copied to clipboard!') {
  try {
    await navigator.clipboard.writeText(text)
    getStore.uiAlert({ type: 'info', message: successMessage })
  } catch (error) {
    console.error('Failed to copy:', error)
    getStore.uiAlert({ type: 'error', message: 'Failed to copy to clipboard' })
  }
}

/**
 * Focus editor element with proper cursor positioning
 * @param {Object} options - Configuration options
 * @param {boolean} options.isMobile - Whether device is mobile
 * @param {boolean} options.isLoading - Whether editor is loading
 * @param {boolean} options.showEditor - Whether editor is shown
 */
export function activateEditor({ isMobile = false, isLoading = false, showEditor = true }) {
  if (isLoading || !showEditor) return
  
  try {
    setTimeout(() => {
      const editorElement = document.querySelector('.ProseMirror.editor')
      if (editorElement) {
        if (isMobile) {
          if (document.activeElement !== editorElement) {
            editorElement.focus()
          }
        } else {
          // Desktop behavior: clear focus, then set focus with cursor
          document.activeElement?.blur()
          editorElement.focus()
          
          // Only set cursor position if there's no existing selection
          const selection = window.getSelection()
          if (selection.rangeCount === 0) {
            // Find a text node to place cursor in rather than at element position 0
            const textNode = findFirstTextNode(editorElement)
            if (textNode) {
              const range = document.createRange()
              // Place cursor at end of text rather than beginning
              range.setStart(textNode, textNode.textContent.length)
              range.collapse(true)
              selection.removeAllRanges()
              selection.addRange(range)
            }
          }
        }
      }
    }, 50)
  } catch (error) {
    console.error("Error focusing editor:", error)
  }
}

/**
 * Find the first text node in an element
 * @param {Element} element - DOM element to search in
 * @returns {Text|null} First text node or null
 */
function findFirstTextNode(element) {
  // If this is a text node, return it
  if (element.nodeType === Node.TEXT_NODE && element.textContent.trim()) {
    return element
  }

  for (let i = 0; i < element.childNodes.length; i++) {
    const textNode = findFirstTextNode(element.childNodes[i])
    if (textNode) {
      return textNode
    }
  }
  
  return null
}

/**
 * Place cursor at the end of an editable element
 * @param {Element} element - Editable DOM element
 */
export function placeCursorAtEnd(element) {
  try {
    const selection = window.getSelection()
    const range = document.createRange()
    range.selectNodeContents(element)
    range.collapse(false) // false means collapse to end
    selection.removeAllRanges()
    selection.addRange(range)
  } catch (error) {
    console.warn('Could not place cursor at end:', error)
  }
}

/**
 * Debounce function execution
 * @param {Function} func - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(func, delay) {
  let timeout
  return function() {
    clearTimeout(timeout)
    timeout = setTimeout(() => {
      func.apply(this, arguments)
    }, delay)
    return timeout
  }
}

/**
 * Get a random item from an array
 * @param {Array} array - Array to pick from
 * @returns {*} Random item from array
 */
export function getRandomItem(array) {
  const randomIndex = Math.floor(Math.random() * array.length)
  return array[randomIndex]
} 