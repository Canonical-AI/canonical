# Store Usage Examples

## 🎯 Global Access - No Imports Required!

In any Vue component, you can now access the store without imports:

### Options API
```vue
<template>
  <div>
    <p v-if="store.loading.user">Loading...</p>
    <p v-else>Welcome {{ store.user.displayName }}!</p>
    <button @click="addNewComment">Add Comment</button>
  </div>
</template>

<script>
export default {
  methods: {
    async addNewComment() {
      // Direct access - no imports needed!
      await this.store.comments.add({
        content: 'New comment',
        author: this.store.user.uid
      })
    },
    
    async loginUser() {
      await this.store.user.enter()
    }
  }
}
</script>
```

### Composition API
```vue
<script setup>
import { inject } from 'vue'

// Get store via inject
const store = inject('store')

const loginUser = async () => {
  await store.user.enter()
}

const createDocument = async () => {
  await store.documents.create({
    data: { name: 'New Document', content: '' }
  })
}
</script>
```

## 🏗️ Organized Actions by Category

### User Management
```js
// Login/Authentication
await store.user.enter()
await store.user.logout()
await store.user.getData()
store.user.setData(userData)
await store.user.setDefaultProject(projectId)
```

### Document Management
```js
// CRUD Operations
await store.documents.create({ data: docData, select: true })
await store.documents.getAll()
await store.documents.select({ id: 'doc123', version: 'v1.0' })
await store.documents.save()
await store.documents.delete({ id: 'doc123' })
await store.documents.archive({ id: 'doc123' })
store.documents.update(docData)

// Check document versions
await store.documents.checkVersionsStatus({ id: 'doc123' })
```

### Comment Management
```js
// Comments & Replies
await store.comments.add({
  content: 'Great document!',
  author: store.user.uid
})

await store.comments.addReply({
  parentId: 'comment123',
  comment: { content: 'Thanks!', author: store.user.uid }
})

await store.comments.update({
  id: 'comment123',
  updatedComment: { content: 'Updated content' }
})

await store.comments.delete('comment123')

await store.comments.updateData({
  id: 'comment123',
  data: { resolved: true }
})

store.comments.set(commentArray)
```

### Version Management
```js
// Document Versions
await store.versions.create({
  versionNumber: '1.1',
  content: documentContent
})

await store.versions.delete('1.0')

await store.versions.toggleReleased({
  versionNumber: '1.1',
  released: true
})

await store.versions.updateMarkedUpContent({
  versionContent: markedUpContent,
  versionNumber: '1.1'
})

await store.versions.toggleDraft()
```

### Project Management
```js
// Projects
await store.project.set('project123')
store.project.setTemp(tempProjectData)
await store.project.getAllData()
```

### Chat Management
```js
// Chats
await store.chats.getAll()
await store.chats.archive('chat123')
await store.chats.delete('chat123')
await store.chats.rename({ id: 'chat123', newName: 'New Chat Name' })
store.chats.set(chatsArray)
```

### Task Management
```js
// Tasks
await store.tasks.update({
  docID: 'doc123',
  identity: 'task456',
  task: updatedTaskData
})
```

### Template Management
```js
// Templates
await store.templates.getAll()
store.templates.set(templatesArray)
```

### Favorites Management
```js
// Favorites
store.favorites.toggle('doc123') // Add or remove from favorites
```

### Folder Management
```js
// Folders
store.folders.add('New Folder')
store.folders.remove('Old Folder')
store.folders.rename({
  fromFolderName: 'Old Name',
  toFolderName: 'New Name'
})

store.folders.update({
  docId: 'doc123',
  target: 'Folder Name',
  action: 'add' // or 'remove'
})

store.folders.toggleOpen({
  FolderName: 'My Folder',
  isOpen: true
})
```

### UI State Management
```js
// UI Actions
store.ui.alert({
  type: 'success',
  message: 'Document saved!',
  autoClear: true
})

store.ui.filter('search term')
store.ui.resetFilter()
store.ui.closeDetail()
store.ui.increment()
```

## 🔥 Key Benefits

### ✅ No More Async Issues
- All async operations properly handled in actions
- No more `await commit()` antipatterns
- Clean error handling

### ✅ Organized Structure  
- Logical grouping: `store.comments.add()` instead of `store.commentsAdd()`
- Easy to discover related functions
- Clear separation of concerns

### ✅ Global Access
- Use `this.store` in any component
- No imports required
- Works with both Options and Composition API

### ✅ Type Safety Ready
- Easy to add TypeScript later
- Clear action signatures
- Predictable return values

## 🔄 Migration from Old Store

### Before (Vuex)
```js
// Component
import { useStore } from 'vuex'

export default {
  setup() {
    const store = useStore()
    
    const addComment = async () => {
      await store.dispatch('addComment', commentData)
    }
    
    return { addComment }
  }
}
```

### After (Pinia + Global)
```js
// Component - NO IMPORTS!
export default {
  methods: {
    async addComment() {
      await this.store.comments.add(commentData)
    }
  }
}
```

The new store is **cleaner**, **more organized**, and **easier to use**! 🚀 