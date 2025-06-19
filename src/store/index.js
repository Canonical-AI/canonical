import { defineStore } from 'pinia'
import router from '../router'
import {User, Document, Template, ChatHistory, Favorites, Project, Comment, Task} from '../services/firebaseDataService'

function filterHelper(list, filter) {
  return [...list].filter(function(item) {
    var justTheData = [];
    Object.keys(item.data).forEach(k => {
      justTheData.push(item.data[k])
    });
    Object.keys(item).forEach(k => {
      if(k != "data") {justTheData.push(item[k])}
    });
    let regex = new RegExp('(' + filter+ ')', 'i');
    return JSON.stringify({justTheData}).match(regex);
  })
}

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop().split(';').shift();
  }
  return null;
}

export const useMainStore = defineStore('main', {
  state: () => ({
    user: {
      loggedIn: false,
      displayName: null,
      uid: null,
      email: null,
      tier: null,
      defaultProject: null,
      projects: []
    },
    loadingUser: true,
    project: {
      id: null,
      folders: [],
      name: null,
      createdBy: null,
      users: []
    },
    projects: [],
    documents: [],
    chats: [],
    loading: {
      personas: {
        loaded: false,
        fetching: false
      }
    },
    selected: {
      id: null,
      version: null,
      comments: [],
      versions: [],
      isVersion: false,
      currentVersion: 'live'
    },
    detailClose: 1,
    globalAlerts: [],
    filter: "",
    templates: [],
    favorites: [],
    tasks: [],
  }),

  getters: {
    isUserLoggedIn: (state) => state.user.uid !== null,
    
    canAccessAi: (state) => state.user.tier === 'pro' || state.user.tier === 'trial',
    
    filteredDocuments: (state) => filterHelper(Array.isArray(state.documents) ? state.documents : [], state.filter),
    
    isFavorite: (state) => (id) => state.favorites.includes(id),
    
    projectFolderTree: (state) => {
      // Ensure documents is an array before trying to map
      if (!Array.isArray(state.documents)) {
        return [];
      }
      
      const documentMap = new Map(state.documents.map(doc => [doc.id, doc]));
      
      // Ensure project.folders is an array
      if (!Array.isArray(state.project.folders)) {
        return state.documents.sort((a, b) => a.data?.name?.localeCompare(b.data?.name) || 0);
      }
      
      const updatedFolders = state.project.folders.map(folder => {
        const updatedChildren = folder.children.map(childId => documentMap
          .get(childId))
          .filter(Boolean)
          .sort((a, b) => a.data?.name?.localeCompare(b.data?.name) || 0);
        return {
          id: folder.name,
          isOpen: folder.isOpen ?? true,
          children: updatedChildren,
          data: {
            name: folder.name,
            folder: true,
          }
        };
      });

      updatedFolders.sort((a, b) => a.id.localeCompare(b.id));
      const documentsInFolders = new Set(state.project.folders.flatMap(folder => folder.children || []));
      const ungroupedDocuments = state.documents.filter(doc => !documentsInFolders.has(doc.id)).sort((a, b) => a.data?.name?.localeCompare(b.data?.name) || 0);
      return [...updatedFolders, ...ungroupedDocuments];
    },
    
    documentComments: (state) => {
      return state.selected.comments
        .sort((a, b) => a.date?.createDate - b.date?.createDate);
    },
    
    filteredCommentsByVersion: (state) => {
      if (!state.selected.comments) return [];
      
      const currentVersion = state.selected.currentVersion;
      
      if (!currentVersion || currentVersion === 'live') {
        return state.selected.comments
          .sort((a, b) => a.createDate?.seconds - b.createDate?.seconds);
      }
      
      return state.selected.comments
        .filter(comment => comment.documentVersion === currentVersion)
        .sort((a, b) => a.createDate?.seconds - b.createDate?.seconds);
    },
    
    threadedCommentsByVersion() {
      const filteredComments = this.filteredCommentsByVersion;
      const threaded = [];
      const commentMap = new Map();
      
      filteredComments.forEach(comment => {
        commentMap.set(comment.id, { 
          ...comment, 
          children: [] 
        });
      });
      
      filteredComments.forEach(comment => {
        if (comment.parentId && commentMap.has(comment.parentId)) {
          commentMap.get(comment.parentId).children.push(commentMap.get(comment.id));
        } else if (!comment.parentId) {
          threaded.push(commentMap.get(comment.id));
        }
      });
      
      return threaded.sort((a, b) => a.createDate?.seconds - b.createDate?.seconds);
    },
  },

  actions: {
    // User Management
    async userEnter() {
      this.loadingUser = true;
      try {
        console.log('Starting user authentication...');
        const user = await User.getUserAuth();
        
        if (user) {
          console.log('User authenticated:', user.email);
          // WAIT for user data to be set before continuing
          this.userSetData(user);
          console.log('User data set in store, user.uid:', this.user.uid);
          
          // WAIT for project to be set before continuing
          if (user.defaultProject) {
            console.log('Setting default project:', user.defaultProject);
            await this.projectSet(user.defaultProject);
            console.log('Project set complete');
          }
        } else {
          console.log('No user authenticated');
        }
      } catch (error) {
        console.error('Error in userEnter:', error);
        this.uiAlert({ type: 'error', message: 'Authentication failed', autoClear: true });
      } finally {
        this.loadingUser = false;
        console.log('User authentication flow complete');
      }
    },

    userSetData(payload) {
      this.user = {
        loggedIn: true,
        displayName: payload.displayName,
        uid: payload.uid,
        email: payload.email,
        tier: payload.tier,
        defaultProject: payload.defaultProject,
        projects: payload.projects
      };
    },

    userLogout() {
      this.user = {
        loggedIn: false,
        displayName: null,
        uid: null,
        email: null,
        tier: null,
        defaultProject: null,
        projects: []
      };
      this.documents = [];
      this.selected = {
        id: null,
        version: null,
        comments: [],
        versions: [],
        isVersion: false,
        currentVersion: 'live'
      };
      this.project = {
        id: null,
        folders: [],
        name: null,
        createdBy: null,
        users: []
      };
      this.projects = [];
      this.chats = [];
      this.tasks = [];
      this.favorites = [];
      this.templates = [];
    },

    async userGetData() {
      this.loadingUser = true;
      this.user = await User.getById(this.user.uid);
      this.loadingUser = false;
    },

    async userSetDefaultProject(payload) {
      await User.setDefaultProject(payload);
      this.user.defaultProject = payload;
    },

    // Project Management
    async projectSet(projectId) {
      if (!projectId) return;
      
      this.project = await Project.getById(projectId);
      
      if (this.isUserLoggedIn) {
        await this.projectGetAllData();
      }
    },

    projectSetTemp(payload) {
      this.project = payload;
    },

    async projectGetAllData() {
      console.log('Starting projectGetAllData, user.uid:', this.user.uid);
      
      // Double check user is logged in before proceeding
      if (!this.isUserLoggedIn || !this.user.uid) {
        console.warn('User not logged in, skipping project data load');
        return;
      }

      console.log('Loading project data...');
      
      // Load projects
      this.projects = await Promise.all(
        this.user.projects.map(projectId => Project.getById(projectId))
      );
      console.log('Projects loaded:', this.projects.length);
      
      // Load documents  
      this.documents = await Document.getAll();
      console.log('Documents loaded:', this.documents.length);

      // Load user-specific data only if confirmed logged in
      if (this.isUserLoggedIn && this.user.uid) {
        console.log('Loading user-specific data...');
        this.tasks = await Task.getAll();
        console.log('Tasks loaded:', this.tasks.length);
        
        this.chats = await ChatHistory.getAll();
        console.log('Chats loaded:', this.chats.length);
        
        this.favorites = await Favorites.getAll();
        console.log('Favorites loaded:', this.favorites.length);
      }
      
      console.log('Project data loading complete');
    },

    // Document Management
    async documentsCreate({ data, select = true }) {
      const createdDoc = await Document.create(data);
      if (select) {
        this.selected = { ...this.selected, ...createdDoc };
      }
      this.documents.push({ id: createdDoc.id, data: createdDoc.data });
      return { id: createdDoc.id, data: createdDoc.data };
    },

    async documentsGetAll() {
      const documents = await Document.getAll(); 
      this.documents = documents;
      return documents;
    },

    async documentsSelect({ id, version = null }) {
      this.selected = { ...this.selected, isLoading: true };

      try {
        let selectedData;
        if (version) {
          let selectedBase = await Document.getDocById(id);
          let selectedVersion = await Document.getDocVersion(id, version);

          selectedBase.data = selectedVersion.content;
          if (selectedVersion.markedUpContent) {
            selectedBase.data.content = selectedVersion.markedUpContent;
            selectedBase.viewingMarkup = true;
          }
          selectedBase.viewingVersion = version;
          selectedData = selectedBase;
        } else {
          selectedData = await Document.getDocById(id);
        }

        selectedData.isLoading = false;
        this.selected = selectedData;
      } catch (error) {
        this.selected.isLoading = false;
        throw error;
      }
    },

    async documentsCheckVersionsStatus({ id }) {
      try {
        const versions = await Document.getDocVersions(id);
        const hasReleasedVersions = versions.some(version => version.released);
        const docIndex = this.documents.findIndex(doc => doc.id === id);
        
        if (docIndex !== -1) {
          this.documents[docIndex].data.hasReleasedVersions = hasReleasedVersions;
        }
        
        if (this.selected.id === id) {
          this.selected.data.hasReleasedVersions = hasReleasedVersions;
        }
      } catch (error) {
        console.error('Error checking document versions status:', error);
      }
    },

    async documentsDelete({ id }) {
      await Document.deleteDocByID(id);
      this.documents = this.documents.filter(doc => doc.id !== id);
    },

    async documentsArchive({ id }) {
      await Document.archiveDoc(id);
      this.documents = this.documents.filter(doc => doc.id !== id);
    },

    async documentsSave() {
      const updatedDoc = await Document.updateDoc(this.selected.id, this.selected.data);
      
      const docIndex = this.documents.findIndex(doc => doc.id === this.selected.id);
      if (docIndex !== -1) {
        this.documents[docIndex] = { id: this.selected.id, data: updatedDoc.data };
      }
      
      this.selected = { ...this.selected, ...updatedDoc };
      
      return updatedDoc;
    },

    documentsUpdate(document) {
      this.selected = { ...this.selected, ...document };
    },

    // Comments Management
    async commentsAdd(comment) {
      const newComment = await Document.createComment(this.selected.id, comment);
      newComment.createDate = { seconds: Math.floor(Date.now() / 1000) };
      this.selected.comments.push(newComment);
      return newComment;
    },

    async commentsAddReply({ parentId, comment }) {
      const replyData = {
        ...comment,
        parentId: parentId
      };
      const newReply = await Document.createComment(this.selected.id, replyData);
      newReply.createDate = { seconds: Math.floor(Date.now() / 1000) };
      this.selected.comments.push(newReply);
      return newReply;
    },

    async commentsUpdate({ id, updatedComment }) {
      const updatedCommentData = await Document.updateComment(this.selected.id, id, updatedComment);
      const commentIndex = this.selected.comments.findIndex(comment => comment.id === id);
      if (commentIndex !== -1) {
        this.selected.comments[commentIndex] = { ...this.selected.comments[commentIndex], ...updatedCommentData };
      }
      return updatedCommentData;
    },

    async commentsDelete(id) {
      await Document.deleteComment(this.selected.id, id);
      this.selected.comments = this.selected.comments.filter(comment => comment.id !== id);
      return id;
    },

    async commentsUpdateData({ id, data }) {
      const updatedCommentData = await Document.updateCommentData(this.selected.id, id, data);
      const commentIndex = this.selected.comments.findIndex(comment => comment.id === id);
      if (commentIndex !== -1) {
        this.selected.comments[commentIndex] = { ...this.selected.comments[commentIndex], ...data };
      }
      return updatedCommentData;
    },

    commentsSet(comments) {
      this.selected.comments = comments;
    },

    // UI Management
    uiAlert(payload) {
      this.globalAlerts.push({
        type: payload.type,
        message: payload.message,
        autoClear: payload.autoClear,
        timestamp: Date.now()
      });
    },

    uiFilter(payload) {
      this.filter = payload;
    },

    uiResetFilter() {
      this.filter = "";
    },

    uiCloseDetail() {
      this.detailClose = this.detailClose + 1;
    },

    uiIncrement() {
      this.detailClose++;
    },

    // Folder Management
    foldersUpdate({docId, target, action}) {
      const sourceFolder = this.project.folders.find(folder => 
        folder.children.includes(docId)
      );
      
      if (action === 'remove' && sourceFolder) {
        sourceFolder.children = sourceFolder.children.filter(id => id !== docId);
      } else if (action === 'add') {
        const targetFolder = this.project.folders.find(folder => folder.name === target);
        if (targetFolder) {
          targetFolder.children.push(docId);
        }
      }
    },

    foldersAdd(folderName) {
      this.project.folders.push({
        name: folderName,
        children: [],
        isOpen: true
      });
    },

    foldersRemove(folderName) {
      this.project.folders = this.project.folders.filter(folder => folder.name !== folderName);
    },

    foldersRename({toFolderName, fromFolderName}) {
      const folder = this.project.folders.find(folder => folder.name === fromFolderName);
      if (folder) {
        folder.name = toFolderName;
      }
    },

    foldersToggleOpen({FolderName, isOpen}) {
      const folder = this.project.folders.find(folder => folder.name === FolderName);
      if (folder) {
        folder.isOpen = isOpen;
      }
    }
  }
})

