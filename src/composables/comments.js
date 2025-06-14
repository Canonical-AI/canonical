export const useComments = (store, eventStore) => {
  const handleAcceptSuggestion = async (payload, context) => {
    const { commentId, selectedText, suggestion } = payload;
    
    // Extract required methods and data from the context
    const {
      editorContent,
    } = context;
    
    try {
      console.log('Processing accept suggestion:', { commentId, selectedText, suggestion });
      
      // Validate required data
      if (!commentId || !selectedText || !suggestion) {
        console.error('Missing required data for accept suggestion:', { commentId, selectedText, suggestion });
        store.commit('alert', {
          type: 'error',
          message: 'Invalid suggestion data',
          autoClear: true
        });
        return;
      }
      
      // 1. Check if the selected text is still the same in the comment
      // This would require checking the current comment state
      // For now, we'll proceed with the assumption it's valid

      // Check if the editor content includes the selected text
      if (!editorContent.includes(selectedText)) {
        console.error('Selected text not found in editor content:', selectedText);
        store.commit('alert', {
          type: 'error',
          message: 'Selected text not found in editor content',
          autoClear: true
        });
        return;
      }
      
      
      // 2. Store the current editor content into the undo store
      const currentEditorContent = editorContent;
      store.commit('addUndo', {
        commentId: commentId,
        selectedText: selectedText,
        suggestion: suggestion,
        currentEditorContent: currentEditorContent,
        timestamp: Date.now()
      });
      
      const contentFrom = ` :comment[${selectedText}]{#${commentId} resolved="false"}` // we'll get rid of the marks as well
      const contentTo = ` :comment[${suggestion}]{#${commentId} resolved="true"}`


      if (!editorContent.includes(contentFrom)) {
        console.error('Selected text not found in editor content:', selectedText);
        store.commit('alert', {
          type: 'warning',
          message: 'selected text not found, resolving',
          autoClear: true
        });

        store.dispatch('updateCommentData', {id: commentId, data: {resolved: true}});
        return;
      }

      store.commit('addUndo', {
        commentId: commentId,
        selectedText: selectedText,
        suggestion: suggestion,
        currentEditorContent: editorContent,
        timestamp: Date.now()
      });
      // 4. Update the document content
      eventStore.emitEvent('replace-document-content', {contentfrom: selectedText, contentto: contentTo});
      
      // 4. Resolve the comment
      store.dispatch('updateCommentData', {id: commentId, data: {resolved: true}});
      
      
      // 5. Show a success message
      store.commit('alert', {
        type: 'success',
        message: 'Suggestion applied successfully',
        autoClear: true
      });
      
      // 6. Clear the event from the event store
      // Remove the processed event from the event store
      const eventIndex = eventStore.events.findIndex(event => 
        event.name === 'accept-suggestion' && 
        event.payload.commentId === commentId
      );
      if (eventIndex !== -1) {
        eventStore.events.splice(eventIndex, 1);
      }
      
      
    } catch (error) {
      console.error('Error processing accept suggestion:', error);
      store.commit('alert', {
        type: 'error',
        message: 'Failed to apply suggestion',
        autoClear: true
      });
    }
  };

  const handleUndo = async (payload, context) => {
    const { commentId } = payload;

    const undo = store.state.undoStore.find(undo => undo.commentId === commentId);

    const contentFrom = ` :comment[${undo.suggestion}]{#${undo.commentId} resolved="true"}`
    const contentTo = ` :comment[${undo.selectedText}]{#${undo.commentId} resolved="false"}`
    eventStore.emitEvent('replace-document-content', {contentfrom: contentFrom, contentto: contentTo});
    store.dispatch('updateCommentData', {id: commentId, data: {resolved: false}});

  }

  const handleUndoAll = async (payload, context) => {
    const { commentId, selectedText, suggestion, currentEditorContent } = payload;


    
    
    // Extract required methods and data from the context
    const {
      editorContent,

    } = context;
  }

  return {
    handleAcceptSuggestion
  };
};
