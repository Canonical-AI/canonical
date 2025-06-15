export const useComments = (store, eventStore) => {
  const handleAcceptSuggestion = async (payload, context) => {
    const { commentId, selectedText, suggestion } = payload;
    
    // Extract required methods and data from the context
    const {
      editorContent,
    } = context;
    

    if (!commentId || !selectedText || !suggestion) {
      console.error('Missing required data for accept suggestion:', { commentId, selectedText, suggestion });
      return;
    }
    
    const contentFrom = `:comment[${selectedText}]{#${commentId} resolved="false"}` // we'll get rid of the marks as well
    const contentTo = `:comment[${suggestion}]{#${commentId} resolved="true"}`

    if (!editorContent.includes(contentFrom)) {
      console.error('Selected text not found in editor content:', selectedText);
      store.commit('alert', {
        type: 'warning',
        message: 'selected text not found, resolving',
        autoClear: true
      });

      eventStore.emitEvent('resolve-comment', {commentId: commentId});
      return;
    }

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
  };

  const handleUndo = async (payload, context) => {
    const { editorContent } = context;
    const { id, suggestion, selectedText } = payload;

    const contentFrom = `:comment[${suggestion}]{#${id} resolved="true"}`
    const contentTo = `:comment[${selectedText}]{#${id} resolved="false"}`
    
    if (!editorContent.includes(contentFrom)) {
      console.warn('Selected text not found in editor content:', selectedText);
      return;
    }
    
    const newContent = editorContent.replace(contentFrom, contentTo);
    
    // Update through the computed property setter
    context.editorContent = newContent; // This will trigger the setter
    context.isEditorModified = true;
    context.refreshEditor(newContent);
    
    // Update the comment data
    store.dispatch('updateCommentData', {id: id, data: {resolved: false}});
    
    store.commit('alert', {
      type: 'success',
      message: 'Undo completed successfully',
      autoClear: true
    });
  }


  return {
    handleAcceptSuggestion,
    handleUndo
  };
};
