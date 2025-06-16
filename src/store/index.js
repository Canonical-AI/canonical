import { createStore } from 'vuex'
import router from '../router'
//import {product, persona} from '../services/firebaseDataService'
import {User, Document, Template, ChatHistory, Favorites, Project, Comment, Task} from '../services/firebaseDataService'

function filterHelper(list,filter){
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

const store = createStore({
  state () {
    return {
      user:{
        loggedIn: false,
        displayName: null,
        uid:null,
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
      chats:[],
      loading:{
        personas:{
          loaded:false,
          fetching:false
        }
      },
      selected:{
        id: null,
        version: null,
        comments: [],
        versions: [],
        isVersion: false,
        currentVersion: 'live'
      },
      detailClose: 1,
      globalAlerts:[],
      filter: "",
      templates:[],
      favorites: [],
      tasks: [],
    }
  },
  getters: {
    isUserLoggedIn (state) {
      return state.user.uid !== null
    },
    canAccessAi (state) {
      return state.user.tier === 'pro' || state.user.tier === 'trial'
    },
    filteredDocuments (state){
      return filterHelper(state.documents,state.filter)
    },
    isFavorite: (state) => (id) => {
      return state.favorites.includes(id);
    },
    projectFolderTree(state){
      const documentMap = new Map(state.documents.map(doc => [doc.id, doc]));
      const updatedFolders = state.project.folders.map(folder => {
          const updatedChildren = folder.children.map(childId => documentMap
              .get(childId))
              .filter(Boolean)
              .sort((a, b) => a.data.name.localeCompare(b.data.name)); // Sort by name
          return {
                      id: folder.name,
                      isOpen: folder.isOpen ?? true,
                      children: updatedChildren, // Update children to include full document objects
                      data: {
                          name: folder.name,
                          folder: true,
                      }
                  };
              });

      updatedFolders.sort((a, b) => a.id.localeCompare(b.id));
      const documentsInFolders = new Set(state.project.folders.flatMap(folder => folder.children));
      const ungroupedDocuments = state.documents.filter(doc => !documentsInFolders.has(doc.id)).sort((a, b) => a.data?.name.localeCompare(b.data?.name));
      return [...updatedFolders, ...ungroupedDocuments]; // Append ungrouped documents
    },
    documentComments: (state) => {
      return state.selected.comments
        .sort((a, b) => a.date.createDate - b.date.createDate);
    },
    // Filter comments by version - shows all comments for 'live' version, or only version-specific comments
    filteredCommentsByVersion: (state) => {
      if (!state.selected.comments) return [];
      
      const currentVersion = state.selected.currentVersion;
      
      // If viewing 'live' version or no version specified, show ALL comments (from all versions)
      if (!currentVersion || currentVersion === 'live') {
        return state.selected.comments
          .sort((a, b) => a.createDate?.seconds - b.createDate?.seconds);
      }
      
      // If viewing a specific version, show only comments for that version
      return state.selected.comments
        .filter(comment => comment.documentVersion === currentVersion)
        .sort((a, b) => a.createDate?.seconds - b.createDate?.seconds);
    },
    // Get threaded comments organized as parent-child structure
    threadedCommentsByVersion: (state, getters) => {
      const filteredComments = getters.filteredCommentsByVersion;
      const threaded = [];
      const commentMap = new Map();
      
      // First pass: create map of all comments
      filteredComments.forEach(comment => {
        commentMap.set(comment.id, { 
          ...comment, 
          children: [] 
        });
      });
      
      // Second pass: organize into parent-child structure
      filteredComments.forEach(comment => {
        if (comment.parentId && commentMap.has(comment.parentId)) {
          // This is a child comment
          commentMap.get(comment.parentId).children.push(commentMap.get(comment.id));
        } else if (!comment.parentId) {
          // This is a top-level comment
          threaded.push(commentMap.get(comment.id));
        }
      });
      
      return threaded.sort((a, b) => a.createDate?.seconds - b.createDate?.seconds);
    },
    
  },
  actions: {
    async enter({ commit , state}) {
      await commit('setLoadingUser', true);
      const user = await User.getUserAuth();
      if (user) {
        await commit('setUserData', user);
        await commit('setProject', user.defaultProject)
      } 
      await commit('setLoadingUser', false);
    },

    async createDocument({ commit, state }, { data , select = true}) {
      const createdDoc = await Document.create(data);
      if (select) {commit('setSelectedDocument', { ...state.selected, ...createdDoc })}
      commit('addDocument', { id: createdDoc.id, data: createdDoc.data })
      return { id: createdDoc.id, data: createdDoc.data };
    },

    async getDocuments ({ commit }) {
      
      const documents = await Document.getAll(); 
      commit('setDocuments', documents);
      return documents;
    },

    async selectDocument({ commit, state }, { id, version = null }) {
      commit('setSelectedDocument', { ...state.selected, isLoading: true });

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

        if (typeof selectedData.data === "undefined") {
          commit("alert", { type: "error", message: `${id} not found` });
          commit('setSelectedDocument', { ...state.selected, isLoading: false });
          return;
        }

        // Set version information in the selected document
        selectedData.isVersion = !!version;
        selectedData.currentVersion = version || 'live';

        commit('setSelectedDocument', { ...selectedData, isLoading: false });
        return selectedData; // Return the selected data
      } catch (error) {
        console.error("Error selecting document:", error);
        commit('setSelectedDocument', { ...state.selected, isLoading: false });
        if (error.message.includes('Permission denied')) {
          router.push('/');
        }
        return null;
      }
    },

    async deleteDocument({ commit }, { id }) {
      await Document.deleteDocByID(id)
      commit('removeDocument', id)
    },

    async archiveDocument({ commit }, { id }) {
      await Document.archiveDoc(id)
      commit('removeDocument', id)
    },

    async getTemplates({ commit }) {
      const templates = await Template.getAll();
      commit('setTemplates', templates);
    },

    async createVersion({ commit, state }, newVersion) {
      await Document.createVersion(state.selected.id, state.selected.data, newVersion);
      commit('setSelectedDocument', { ...state.selected, versions: state.selected.versions.push(newVersion) });
    },

    async deleteVersion({ commit, state }, selectedVersion) {
      await Document.deleteVersion(state.selected.id, selectedVersion);
      commit('setSelectedDocument', { ...state.selected, versions: state.selected.versions.filter(version => version !== selectedVersion) });
    },

    async updateMarkedUpContent({ commit, state }, { versionContent, versionNumber }) {
      if (state.selected.id === null || state.selected.currentVersion === 'live') { return };
      await Document.updateMarkedUpContent(state.selected.id, versionContent, versionNumber);
      commit('setSelectedDocument', { ...state.selected, data: { ...state.selected.data, content: versionContent } });
    },

    async toggleDraft({ commit, state }) {
        state.selected.data.draft = !state.selected.data.draft;
        await Document.updateDoc(state.selected.id, state.selected.data);
        
        // Update the document in the documents array to reflect changes
        const docIndex = state.documents.findIndex(doc => doc.id === state.selected.id);
        if (docIndex !== -1) {
          state.documents[docIndex].data = { ...state.documents[docIndex].data, ...state.selected.data };
        }
    },

    async addComment({state, commit}, comment) {
      const newComment = await Document.createComment(state.selected.id, comment)
      newComment.createDate = { seconds: Math.floor(Date.now() / 1000) }; // Convert to seconds for Firestore timestamp format
      commit('addCommentToState', newComment);
      return newComment;
    },

    async addReply({state, commit}, { parentId, comment }) {
      const replyData = {
        ...comment,
        parentId: parentId
      };
      const newReply = await Document.createComment(state.selected.id, replyData);
      newReply.createDate = { seconds: Math.floor(Date.now() / 1000) };
      commit('addReplyToState', newReply);
      return newReply;
    },

    async updateComment({state, commit}, { id, updatedComment }) {
      const updatedCommentData = await Document.updateComment(state.selected.id, id, updatedComment)
      commit('updateCommentInState', {id, updatedComment: updatedCommentData});
      return updatedCommentData;
    },

    async deleteComment({state, commit}, id) {
      await Document.deleteComment(state.selected.id, id)
      commit('deleteCommentInState', id);
      return id;
    },

    async renameChat({state, commit}, {id, newName}){
      try {
        await ChatHistory.updateChatField(id, 'name', newName);
        const updatedChats = state.chats.map(chat => 
          chat.id === id ? { ...chat, data: { ...chat.data, name: newName } } : chat
        );
        commit('setChats', updatedChats);
      } catch (error) {
        console.error("Failed to rename chat:", error);
      }
    },

    // Action for updating comment data (replaces the async mutation)
    async updateCommentData({ state, commit }, { id, data }) {
      const updatedCommentData = await Document.updateCommentData(state.selected.id, id, data);
      commit('updateCommentInState', {id, values: data});
      return updatedCommentData;
    },



  },

  mutations: {

    ///--------------------------------------------------------------
    /// User mutations

    setUserData(state,payload){
      if (!payload) {
        console.warn("no user record exists")
      } 

      state.user.displayName = payload?.displayName || null;
      state.user.uid = payload?.id || null;
      state.user.email = payload?.email || null;
      state.user.defaultProject = payload?.project || null;
      state.user.tier = payload?.tier || 'free';
      state.user.projects = payload?.projects || []
      return
    },

    logout(state){
      state.user.displayName = null;
      state.user.uid = null;
      state.user.email = null;
      state.user.projects = []
      router.push('/')

      store.commit('setProject', state.user.defaultProject)
      return
    },

    async setLoadingUser(state, payload){
      state.loadingUser = payload
    },

    async getUserData(state){
      state.loadingUser = true
      state.user = await User.getById(state.user.uid)
      await commit('setUserData', state.user);
      state.loadingUser = false
      return
    },

    async setProject(state, projectId){

      if (!projectId || (Array.isArray(projectId) && projectId.length === 0)) {
        console.warn("Project ID is null or empty, aborting setProject.");
        return;
      }

      state.project = await Project.getById(projectId, { userDetails: true })

      const folderStatusCookie = getCookie('folderStatus');
      if (folderStatusCookie) {
        const folderStatus = JSON.parse(decodeURIComponent(folderStatusCookie));

        if (folderStatus.projectId === projectId) {
          folderStatus.folders.forEach(statusFolder => {
            const projectFolder = state.project.folders.find(folder => folder.name === statusFolder.name);
            if (projectFolder) {
              projectFolder.isOpen = statusFolder.isOpen;
            }
          });
        }
      }

      await store.commit('getAllData')
      return
    },

    setTempProject(state, payload){
      state.tempProject = payload
    },

    async setDefaultProject(state,payload){
      await User.setDefaultProject( payload)
      state.user.defaultProject = payload
      return
    },

    async getAllData(state){
      state.projects = await Promise.all(
        state.user.projects.map(projectId => Project.getById(projectId))
      );
      state.documents = await Document.getAll()

      if (store.getters.isUserLoggedIn) {
        state.tasks = await Task.getAll()
        state.chats = await ChatHistory.getAll();
        state.favorites = await Favorites.getAll();
      }
      return
    },

    ///--------------------------------------------------------------
    /// Global Events

    alert(state,payload){
      //   $store.commit('alert',{type:'info',message:'HI!',autoClear:true})
      const alert = {
        time: Date.now(),
        show: true,
        type: payload.type,
        message: payload.message,
      }
      //setTimeout((...state) => {
      const index = state.globalAlerts.length
      if(payload.autoClear === true ){setTimeout(() => {state.globalAlerts[index].show = false;}, 5000)}
      state.globalAlerts.push(alert)
    },

    filter(state,payload){
      state.filter = payload
    },

    resetFilter(state){
      state.filter = null
    },

    closeDetail(state){
      state.detailClose = state.detailClose + 1;
    },
    


    ///--------------------------------------------------------------
    /// Chats

    async getChats (state) {
      state.chats = await ChatHistory.getAll()
      return
    },


    async archiveChat(state,id){
      await ChatHistory.archiveChat(id)
      state.chats = await ChatHistory.getAll()
    },

    async deleteChat(state,id){
      await ChatHistory.deleteChat(id)
      state.chats = await ChatHistory.getAll()
    },
  

    setTemplates(state, templates) {
      state.templates = templates;
    },

    ///--------------------------------------------------------------
    /// Documents

    setDocuments (state, documents) {
      state.documents = documents
      return
    },

    addDocument (state, document) {
      state.documents.push(document)
      return
    },

    removeDocument (state, document) {
      state.documents = state.documents.filter(doc => doc.id !== document.id)
      return
    },

    setSelectedDocument(state, document) {
      state.selected = document;
    },



    updateSelectedDocument(state, document) {
      if (state.selected.isLoading) {return}
      state.selected = {...state.selected, ...document}
    },

    async saveSelectedDocument(state) {
      if (state.selected.id === null) return;
      await Document.updateDoc(state.selected.id, state.selected.data);
      const newTasks = await Task.updateTasks(state.selected.id, state.selected.data);
      state.tasks = state.tasks.filter(task => task.docID !== state.selected.id).concat(newTasks);
      
      // Update the document in the documents array to reflect changes
      const docIndex = state.documents.findIndex(doc => doc.id === state.selected.id);
      if (docIndex !== -1) {
        state.documents[docIndex].data = { ...state.documents[docIndex].data, ...state.selected.data };
      }
    },

    increment (state) {
      state.count++
    },

    ///--------------------------------------------------------------
    /// Tasks

    async updateTask(state, {docID, identity, task}){
      const doc = state.tasks.find(d => d.docID === docID);
      if (!doc) return;

      const updatedTasks = doc.tasks.map(t => 
        t.identity === identity 
          ? task 
          : t
      );

      state.tasks = state.tasks.map(t => 
        t.docID === docID 
          ? { ...t, tasks: updatedTasks } 
          : t
      );
      await Task.updateTask(docID, identity, task);
    },

    ///--------------------------------------------------------------
    /// Favorites

    toggleFavorite(state, id) {
      const index = state.favorites.indexOf(id);
      if (index === -1) {
        state.favorites.push(id);
      } else {
        state.favorites.splice(index, 1);
      }
      Favorites.updateFavorites(state.favorites); // Update the database
    },

    ///--------------------------------------------------------------
    /// Folders

    updateFolder(state, {docId, target, action}){ // this updates the project.folder and adds removes
      if (action === 'add') {
        // Add docId to the 'to' folder
        const toFolder = state.project.folders.find(folder => folder.name === target);
        if (toFolder) {
          toFolder.children.push(docId);
        }
      } else if (action === 'remove') {
        // Remove docId from the 'from' folder
        const fromFolder = state.project.folders.find(folder => folder.name === target);
        if (fromFolder) {
          fromFolder.children = fromFolder.children.filter(id => id !== docId);
        }
      }
      Project.updatefield(state.project.id, 'folders', state.project.folders);
    },

    addFolder(state,folderName){
      const existingFolder = state.project.folders.find(folder => folder.name === folderName);
      if (!existingFolder) {
        state.project.folders.push({ name: folderName, children: [] , isOpen: true});
      }
      Project.updatefield(state.project.id, 'folders', state.project.folders);
    },

    removeFolder(state,folderName){
      state.project.folders = state.project.folders.filter(folder => folder.name !== folderName);
      Project.updatefield(state.project.id, 'folders', state.project.folders);
    },

    renameFolder(state, {toFolderName, fromFolderName}) {
      const folder = state.project.folders.find(folder => folder.name === fromFolderName);
      if (folder) {
        folder.name = toFolderName; // Rename the folder
      }
      Project.updatefield(state.project.id, 'folders', state.project.folders);
    },

    toggleFolderOpen(state,{FolderName,isOpen}){
      const folder = state.project.folders.find(folder => folder.name === FolderName);
      if (folder) {
        folder.isOpen = isOpen; // Rename the folder
      }

      // Store the object as a JSON string in a single cookie
      const folderStatus = {
        projectId: state.project.id,
        folders: state.project.folders.map(folder => ({
          name: folder.name,
          isOpen: folder.isOpen
        }))
      };
    
      // Store the object as a JSON string in a single cookie
      document.cookie = `folderStatus=${encodeURIComponent(JSON.stringify(folderStatus))}; path=/;`;
    
    },

    ///--------------------------------------------------------------
    /// COMMENTS
 
    setComments(state, comments) {
      state.selected.comments = comments;
    },

    setChats(state, chats) {
      state.chats = chats;
    },

    addCommentToState(state, comment) {
      state.selected.comments.push(comment);
    },

    addReplyToState(state, reply) {
      state.selected.comments.push(reply);
    },

    deleteCommentInState(state, id) {
      state.selected.comments = state.selected.comments.filter(comment => comment.id !== id);
    },

    updateCommentInState(state, {id, values}) {
      const index = state.selected.comments.findIndex(comment => comment.id === id);
      if (index === -1) return;
      state.selected.comments[index] = {
        ...state.selected.comments[index],
        ...values
      }
    },

  }
});

export default store;
