import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useMainStore } from '../../store/index.js'

// Mock only the needed part of firebaseDataService **inside** the factory to avoid hoisting issues
vi.mock('../../services/firebaseDataService', () => {
  const createComment = vi.fn()
  return {
    Document: {
      createComment,
    },
  }
})

// Import the mocked module so we can access the spy later
import { Document } from '../../services/firebaseDataService'

let store

beforeEach(() => {
  const pinia = createPinia()
  setActivePinia(pinia)
  store = useMainStore()

  // Select a document so comments can be added
  store.documentsUpdate({ id: 'doc-1', data: { name: 'Test Doc' } })

  // Reset mock implementation & calls before each test
  Document.createComment.mockReset()
  Document.createComment.mockImplementation((docId, comment) => {
    return Promise.resolve({ success: true, data: { id: 'comment-1', ...comment } })
  })
})

describe('Comment Management', () => {
  it('commentsAdd should inject documentId when missing', async () => {
    const payload = {
      comment: 'Test comment',
      selectedText: 'some text',
      resolved: false,
    }

    const newComment = await store.commentsAdd(payload)

    expect(Document.createComment).toHaveBeenCalledWith('doc-1', expect.objectContaining({ documentId: 'doc-1' }))
    expect(newComment.documentId).toBe('doc-1')
    expect(store.selected.comments[0].documentId).toBe('doc-1')
  })

  it('commentsAddReply should inject documentId when missing', async () => {
    const replyPayload = {
      comment: 'A reply',
      selectedText: 'reply text',
      resolved: false,
    }

    const newReply = await store.commentsAddReply({ parentId: 'comment-1', comment: replyPayload })

    expect(Document.createComment).toHaveBeenCalledWith('doc-1', expect.objectContaining({ documentId: 'doc-1' }))
    expect(newReply.documentId).toBe('doc-1')
    expect(store.selected.comments.some((c) => c.documentId === 'doc-1')).toBe(true)
  })
}) 