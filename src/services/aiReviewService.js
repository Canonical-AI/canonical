import { Feedback, DocumentReview } from './vertexAiService'

/**
 * AI Review Service for document review functionality
 * Vue 2 compatible service for managing AI reviews
 */
class AiReviewService {
  constructor() {
    this.undoStack = []
    this.isReviewLoading = false
    this.reviewResults = null
    this.generativeFeedback = null
  }

  /**
   * Generate AI feedback for a document
   * @param {Object} document - The document object
   * @param {Function} showAlert - Alert function
   */
  async generateFeedback(document, showAlert) {
    if (!document?.data) return null

    const prompt = `
      title ${document.data.name}
      type of doc ${document.data.type}
      ${document.data.content}
    `
    
    try {
      const result = await Feedback.generateFeedback({ prompt })
      this.generativeFeedback = ""
      
      for await (const chunk of result.stream) {
        const chunkText = chunk.text()
        this.generativeFeedback += chunkText
      }
      
      return this.generativeFeedback
    } catch (error) {
      console.error('Error generating feedback:', error)
      showAlert('error', 'Failed to generate feedback. Please try again.')
      return null
    }
  }

  /**
   * Start AI review process with inline comments
   * @param {Object} document - The document object
   * @param {Object} editorRef - Editor reference
   * @param {Function} showAlert - Alert function
   * @param {Function} refreshEditor - Editor refresh function
   */
  async startAiReview(document, editorRef, showAlert, refreshEditor) {
    if (!document?.data?.content || !editorRef) {
      showAlert('warning', 'No content to review or editor not ready')
      return { success: false }
    }

    this.isReviewLoading = true
    this.reviewResults = null

    try {
      const documentContent = document.data.content
      const maxRetries = 2
      let results = null
      
      // Retry loop for better reliability
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          results = await DocumentReview.createInlineComments(documentContent, editorRef)
          
          if (results.success && (results.commentsCreated > 0 || documentContent.trim().length < 100)) {
            break
          }
          
          if (results.success && results.commentsCreated === 0 && attempt < maxRetries) {
            console.log(`AI review attempt ${attempt} generated no comments, retrying...`)
            continue
          }
          break
          
        } catch (attemptError) {
          if (attempt === maxRetries) throw attemptError
          console.log(`AI review attempt ${attempt} failed, retrying...`, attemptError)
        }
      }

      if (!results || !results.success) {
        throw new Error(results?.error || 'AI review failed to generate results')
      }

      this.reviewResults = results
      refreshEditor()

      // Show appropriate success message
      if (results.commentsCreated > 0) {
        let message = `AI review completed! ${results.commentsCreated} inline comments added.`
        if (results.failedComments > 0) {
          message += ` (${results.failedComments} comments could not be positioned)`
        }
        showAlert('success', message)
      } else {
        const message = documentContent.trim().length < 100 
          ? 'Document is too short for meaningful review.' 
          : 'Great! No issues found in your document.'
        showAlert('info', message)
      }

      return { success: true, needsEditorRefresh: true }

    } catch (error) {
      console.error('AI review failed:', error)
      this.reviewResults = { success: false, error: error.message || 'An unexpected error occurred' }
      showAlert('error', `AI review failed: ${error.message || 'Please try again'}`)
      return { success: false }
    } finally {
      this.isReviewLoading = false
    }
  }

  /**
   * Clear all AI-generated comments
   * @param {Object} store - Vuex store
   * @param {Function} showAlert - Alert function
   * @param {Function} refreshEditor - Editor refresh function
   */
  async clearAiComments(store, showAlert, refreshEditor) {
    try {
      const allComments = store.state.selected?.comments || []
      const aiComments = allComments.filter(comment => comment.aiGenerated === true)
      
      if (aiComments.length === 0) {
        showAlert('info', 'No AI comments found to clear')
        return { success: true }
      }

      await Promise.all(aiComments.map(comment => 
        store.dispatch('deleteComment', comment.id)
      ))

      refreshEditor()
      showAlert('success', `${aiComments.length} AI comment${aiComments.length > 1 ? 's' : ''} cleared`)
      
      return { success: true }

    } catch (error) {
      console.error('Error clearing AI comments:', error)
      showAlert('error', 'Failed to clear AI comments. Please try again.')
      return { success: false }
    }
  }

  /**
   * Handle accepting an AI suggestion
   * @param {Object} suggestionData - Suggestion data
   * @param {Object} document - Document object
   * @param {Object} store - Vuex store
   * @param {Function} showAlert - Alert function
   * @param {Function} refreshEditor - Editor refresh function
   * @param {Object} router - Vue router instance
   * @param {Object} route - Current route object
   */
  async handleAcceptSuggestion(suggestionData, document, store, showAlert, refreshEditor, router, route) {
    try {
      const { commentId, suggestion, editorPosition } = suggestionData
      const selectedText = editorPosition.selectedText
      
      if (!selectedText || !suggestion) {
        throw new Error('Missing text or suggestion data')
      }

      // Check if we're viewing a version (not live)
      const isViewingVersion = route.query.v && route.query.v !== 'live'
      
      if (isViewingVersion) {
        // We're viewing a version, need to apply to live version
        return await this.applySuggestionToLiveVersion(
          suggestionData, 
          document, 
          store, 
          showAlert, 
          router
        )
      }

      // We're on live version, proceed normally
      return await this.applySuggestionToCurrentDocument(
        suggestionData,
        document,
        store,
        showAlert,
        refreshEditor
      )

    } catch (error) {
      console.error('Error accepting suggestion:', error)
      showAlert('error', 'Failed to apply suggestion. Please try again.')
      return { success: false }
    }
  }

  /**
   * Apply suggestion to the current document (live version)
   * @private
   */
  async applySuggestionToCurrentDocument(suggestionData, document, store, showAlert, refreshEditor) {
    const { commentId, suggestion, editorPosition } = suggestionData
    const selectedText = editorPosition.selectedText

    // Save current state for undo
    this.saveUndoState({
      content: document.data.content,
      commentId: commentId,
      action: 'accept-suggestion',
      originalText: selectedText,
      newText: suggestion
    })

    // Try to replace text in document with improved logic
    const currentContent = document.data.content
    let updatedContent = this.performTextReplacement(currentContent, selectedText, suggestion)
    
    if (currentContent === updatedContent) {
      // If exact match failed, try fuzzy matching for slight variations
      updatedContent = this.performFuzzyTextReplacement(currentContent, selectedText, suggestion)
      
      if (currentContent === updatedContent) {
        showAlert('warning', 
          'The text to be replaced could not be found. It may have been modified by a previous suggestion. ' +
          'Please check the document and apply the suggestion manually if needed.'
        )
        
        // Still resolve the comment since we attempted to apply it
        await store.dispatch('updateCommentData', {
          id: commentId,
          data: { resolved: true }
        })
        
        return { success: false, needsEditorRefresh: true }
      }
    }

    // Update document
    document.data.content = updatedContent
    store.commit("updateSelectedDocument", {
      id: document.id,
      data: document.data
    })

    // Resolve the comment
    await store.dispatch('updateCommentData', {
      id: commentId,
      data: { resolved: true }
    })

    refreshEditor()
    showAlert('success', 'AI suggestion accepted and applied')

    return { success: true, needsEditorRefresh: true, shouldRefreshSuggestions: true }
  }

  /**
   * Perform text replacement with exact matching
   * @private
   */
  performTextReplacement(content, originalText, newText) {
    return content.replace(originalText, newText)
  }

  /**
   * Perform fuzzy text replacement for cases where text might have slight variations
   * @private
   */
  performFuzzyTextReplacement(content, originalText, newText) {
    // Try to find the text with normalized whitespace
    const normalizedOriginal = originalText.replace(/\s+/g, ' ').trim()
    const normalizedContent = content.replace(/\s+/g, ' ')
    
    if (normalizedContent.includes(normalizedOriginal)) {
      return content.replace(new RegExp(originalText.replace(/\s+/g, '\\s+'), 'g'), newText)
    }

    // Try to find a substring match (at least 80% of the original text)
    const minMatchLength = Math.floor(originalText.length * 0.8)
    if (originalText.length > minMatchLength) {
      const substring = originalText.substring(0, minMatchLength)
      if (content.includes(substring)) {
        // Find the full context around the substring
        const startIndex = content.indexOf(substring)
        const endIndex = startIndex + originalText.length
        const contextText = content.substring(startIndex, Math.min(endIndex, content.length))
        
        // Replace the context with the suggestion
        return content.replace(contextText, newText)
      }
    }

    // Try word-by-word matching for cases where punctuation might have changed
    const originalWords = originalText.split(/\s+/)
    const contentWords = content.split(/\s+/)
    
    if (originalWords.length >= 3) {
      // Look for sequences of at least 3 consecutive words
      for (let i = 0; i <= contentWords.length - originalWords.length; i++) {
        const slice = contentWords.slice(i, i + originalWords.length)
        const matchingWords = slice.filter((word, index) => 
          word.toLowerCase().includes(originalWords[index].toLowerCase()) ||
          originalWords[index].toLowerCase().includes(word.toLowerCase())
        )
        
        if (matchingWords.length >= originalWords.length * 0.8) {
          // Found a potential match, replace this section
          const beforeWords = contentWords.slice(0, i)
          const afterWords = contentWords.slice(i + originalWords.length)
          const newContentWords = [...beforeWords, newText, ...afterWords]
          return newContentWords.join(' ')
        }
      }
    }

    return content // No replacement if no match found
  }

  /**
   * Apply suggestion to live version when viewing a historical version
   * @private
   */
  async applySuggestionToLiveVersion(suggestionData, versionDocument, store, showAlert, router) {
    const { commentId, suggestion, editorPosition } = suggestionData
    const selectedText = editorPosition.selectedText

    try {
      // Fetch the live version of the document
      const liveDocResult = await store.dispatch("selectDocument", { 
        id: versionDocument.id, 
        version: null 
      })
      
      if (!liveDocResult || !liveDocResult.data) {
        throw new Error('Could not fetch live version of document')
      }

      const liveDocument = store.state.selected
      const liveContent = liveDocument.data.content

      // Save current state for undo (using live document content)
      this.saveUndoState({
        content: liveContent,
        commentId: commentId,
        action: 'accept-suggestion',
        originalText: selectedText,
        newText: suggestion
      })

      // Try to apply suggestion to live version with improved logic
      let updatedContent = this.performTextReplacement(liveContent, selectedText, suggestion)
      
      if (liveContent === updatedContent) {
        // If exact match failed, try fuzzy matching
        updatedContent = this.performFuzzyTextReplacement(liveContent, selectedText, suggestion)
        
        if (liveContent === updatedContent) {
          showAlert('warning', 
            'The text to be replaced was not found in the live version. ' +
            'The document may have been modified since this version. ' +
            'Please review the live document and apply the suggestion manually.'
          )
          
          // Navigate to live version for manual application
          await router.push({ 
            path: `/document/${versionDocument.id}`,
            query: {} // Remove version query to go to live
          })
          
          return { 
            success: false, 
            navigatedToLive: true,
            needsEditorRefresh: true 
          }
        }
      }
      
      // Update live document
      liveDocument.data.content = updatedContent
      store.commit("updateSelectedDocument", {
        id: liveDocument.id,
        data: liveDocument.data
      })

      // Resolve the comment in the live version
      await store.dispatch('updateCommentData', {
        id: commentId,
        data: { resolved: true }
      })

      // Navigate to live version to show the applied change
      await router.push({ 
        path: `/document/${versionDocument.id}`,
        query: {} // Remove version query to go to live
      })

      showAlert('success', 
        'AI suggestion applied to live document. You have been redirected to the updated live version.'
      )

      return { 
        success: true, 
        navigatedToLive: true,
        needsEditorRefresh: true 
      }

    } catch (error) {
      console.error('Error applying suggestion to live version:', error)
      
      // If there's an error, still try to navigate to live version
      try {
        await router.push({ 
          path: `/document/${versionDocument.id}`,
          query: {} 
        })
        showAlert('error', 
          'Could not automatically apply suggestion. Please apply it manually in the live document.'
        )
      } catch (navError) {
        console.error('Navigation error:', navError)
      }
      
      return { success: false, navigatedToLive: true }
    }
  }

  /**
   * Undo the last AI change
   * @param {Object} document - Document object
   * @param {Object} store - Vuex store
   * @param {Function} showAlert - Alert function
   * @param {Function} refreshEditor - Editor refresh function
   * @param {Object} router - Vue router instance
   * @param {Object} route - Current route object
   */
  async undoLastChange(document, store, showAlert, refreshEditor, router, route) {
    if (this.undoStack.length === 0) {
      showAlert('info', 'Nothing to undo')
      return { success: true }
    }

    const lastChange = this.undoStack.pop()
    if (!lastChange) return { success: true }

    try {
      // Check if we're viewing a version (not live)
      const isViewingVersion = route.query.v && route.query.v !== 'live'
      
      if (isViewingVersion) {
        // Navigate to live version first
        await router.push({ 
          path: `/document/${document.id}`,
          query: {} // Remove version query to go to live
        })
        
        // Wait for navigation and document loading
        await new Promise(resolve => setTimeout(resolve, 500))
        
        // Get the live document from store
        const liveDocument = store.state.selected
        if (!liveDocument) {
          throw new Error('Could not access live document')
        }
        
        // Apply undo to live document
        liveDocument.data.content = lastChange.content
        store.commit("updateSelectedDocument", {
          id: liveDocument.id,
          data: liveDocument.data
        })
        
        showAlert('success', 'Last change undone in live document')
        return { success: true, navigatedToLive: true, needsEditorRefresh: true }
      }

      // We're on live version, proceed normally
      document.data.content = lastChange.content
      store.commit("updateSelectedDocument", {
        id: document.id,
        data: document.data
      })

      // Unresolve comment if it was an accepted suggestion
      if (lastChange.action === 'accept-suggestion' && lastChange.commentId) {
        await store.dispatch('updateCommentData', {
          id: lastChange.commentId,
          data: { resolved: false }
        })
      }

      refreshEditor()
      showAlert('success', 'Last change undone')
      return { success: true, needsEditorRefresh: true }

    } catch (error) {
      console.error('Error undoing change:', error)
      showAlert('error', 'Failed to undo change. Please try again.')
      return { success: false }
    }
  }

  /**
   * Save current state for undo functionality
   * @param {Object} undoData - Data to save for undo
   */
  saveUndoState(undoData) {
    // Limit undo stack to last 10 operations to prevent memory issues
    if (this.undoStack.length >= 10) {
      this.undoStack.shift() // Remove oldest entry
    }
    
    this.undoStack.push({
      ...undoData,
      timestamp: Date.now()
    })
  }

  /**
   * Check if there are AI-generated comments
   * @param {Object} store - Vuex store
   * @returns {boolean} Whether there are AI comments
   */
  hasAiComments(store) {
    const comments = store.state.selected?.comments || []
    return comments.some(comment => comment.aiGenerated === true)
  }

  /**
   * Remove outdated AI suggestions that reference text no longer in the document
   * @param {Object} store - Vuex store
   * @param {string} currentContent - Current document content
   * @param {Function} showAlert - Alert function
   */
  async cleanupOutdatedSuggestions(store, currentContent, showAlert) {
    try {
      const allComments = store.state.selected?.comments || []
      const aiComments = allComments.filter(comment => 
        comment.aiGenerated === true && 
        comment.data?.suggestion && 
        comment.data?.editorPosition?.selectedText
      )
      
      let removedCount = 0
      
      for (const comment of aiComments) {
        const selectedText = comment.data.editorPosition.selectedText
        
        // Check if the text still exists in the document
        if (!currentContent.includes(selectedText)) {
          // Try fuzzy matching before removing
          const fuzzyMatch = this.performFuzzyTextReplacement(
            currentContent, 
            selectedText, 
            selectedText // Just checking if we can find it
          )
          
          if (fuzzyMatch === currentContent) {
            // Text not found even with fuzzy matching, remove the comment
            await store.dispatch('deleteComment', comment.id)
            removedCount++
          }
        }
      }
      
      if (removedCount > 0) {
        showAlert('info', `Removed ${removedCount} outdated AI suggestion${removedCount > 1 ? 's' : ''} that no longer apply`)
      }
      
      return removedCount
    } catch (error) {
      console.error('Error cleaning up outdated suggestions:', error)
      return 0
    }
  }

  /**
   * Check if undo is available
   * @returns {boolean} Whether undo is available
   */
  canUndo() {
    return this.undoStack.length > 0
  }

  /**
   * Reset service state
   */
  resetState() {
    this.isReviewLoading = false
    this.reviewResults = null
    this.generativeFeedback = null
    this.undoStack = []
  }

  /**
   * Get current state
   * @returns {Object} Current service state
   */
  getState() {
    return {
      isReviewLoading: this.isReviewLoading,
      reviewResults: this.reviewResults,
      generativeFeedback: this.generativeFeedback,
      undoStack: [...this.undoStack]
    }
  }
}

// Export singleton instance
export default new AiReviewService() 