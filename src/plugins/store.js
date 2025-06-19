import { useMainStore } from '../store/index.js'

export default {
  install(app) {
    // Initialize store
    const store = useMainStore()
    
    // Create nested structure for convenient access
    store.user = {
      enter: () => store.userEnter(),
      setData: (payload) => store.userSetData(payload),
      logout: () => store.userLogout(),
      getData: () => store.userGetData(),
      setDefaultProject: (payload) => store.userSetDefaultProject(payload)
    }

    store.project = {
      set: (projectId) => store.projectSet(projectId),
      setTemp: (payload) => store.projectSetTemp(payload),
      getAllData: () => store.projectGetAllData()
    }

    store.documents = {
      create: (payload) => store.documentsCreate(payload),
      getAll: () => store.documentsGetAll(),
      select: (payload) => store.documentsSelect(payload),
      checkVersionsStatus: (payload) => store.documentsCheckVersionsStatus(payload),
      delete: (payload) => store.documentsDelete(payload),
      archive: (payload) => store.documentsArchive(payload),
      save: () => store.documentsSave(),
      update: (document) => store.documentsUpdate(document)
    }

    store.comments = {
      add: (comment) => store.commentsAdd(comment),
      addReply: (payload) => store.commentsAddReply(payload),
      update: (payload) => store.commentsUpdate(payload),
      delete: (id) => store.commentsDelete(id),
      updateData: (payload) => store.commentsUpdateData(payload),
      set: (comments) => store.commentsSet(comments)
    }

    store.ui = {
      alert: (payload) => store.uiAlert(payload),
      filter: (payload) => store.uiFilter(payload),
      resetFilter: () => store.uiResetFilter(),
      closeDetail: () => store.uiCloseDetail(),
      increment: () => store.uiIncrement()
    }

    store.folders = {
      update: (payload) => store.foldersUpdate(payload),
      add: (folderName) => store.foldersAdd(folderName),
      remove: (folderName) => store.foldersRemove(folderName),
      rename: (payload) => store.foldersRename(payload),
      toggleOpen: (payload) => store.foldersToggleOpen(payload)
    }
    
    // Make store globally available
    app.config.globalProperties.$store = store
    
    // Also provide it for composition API
    app.provide('store', store)
    
    // Add global property to access store in any component without import
    app.mixin({
      computed: {
        store() {
          return store
        }
      }
    })
  }
} 