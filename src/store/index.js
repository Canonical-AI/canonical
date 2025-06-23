import { defineStore } from 'pinia'
import router from '../router'
import {User, Document, ChatHistory, Favorites, Project, Comment, Task} from '../services/firebaseDataService'

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
      projects: [],
    },
    loadingUser: true,
    project: {
      id: null,
      folders: [],
      name: null,
      createdBy: null,
      users: [],
      invitation: [],
      projectRole: null,
    },
    loading: {
      user: true,
      project: false,
      documents: false,
      chats: false,
      favorites: false,
      tasks: false,
      templates: false,
      pendingInvitations: false,
    },
    projects: [],
    documents: [],
    chats: [],
    pendingInvitations: [],
    pendingInvitationsDismissed: false,
    loading: {
      personas: {
        loaded: false,
        fetching: false
      }
    },
    selected: {
      id: null,
      data: {},
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
    
    isProjectAdmin: (state) => state.user.projects.find(project => project.projectId === state.project.id)?.role === 'admin',
    
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
        const user = await User.getUserAuth();
        
        if (user) {

          // WAIT for user data to be set before continuing
          this.userSetData(user);

          // Load pending invitations for the user
          await this.userGetPendingInvitations();

          // WAIT for project to be set before continuing
          if (user.defaultProject) {
            await this.projectSet(user.defaultProject);
          }
        } else {
          console.log('No user authenticated');
        }
      } catch (error) {
        this.uiAlert({ type: 'error', message: 'Authentication failed', autoClear: true });
      } finally {
        this.loading.user = false;
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
        projects: payload.projects,
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
        projects: [],
      };
      this.project = {
        id: null,
        folders: [],
        name: null,
        createdBy: null,
        users: [],
        invitation: [],
        projectRole: null,
      };
      this.projects = [];
      this.documents = [];
      this.chats = [];
      this.pendingInvitations = [];
      this.pendingInvitationsDismissed = false;
      this.selected = {
        id: null,
        data: {},
        version: null,
        comments: [],
        versions: [],
        isVersion: false,
        currentVersion: 'live'
      };
      this.favorites = [];
      this.tasks = [];
    },

    async userGetPendingInvitations() {
      if (!this.isUserLoggedIn) {
        this.pendingInvitations = [];
        return [];
      }

      try {
        const invites = await User.getPendingInvitations();
        
        // Load project names for each invitation
        this.pendingInvitations = await Promise.all(
          invites.map(async (invite) => {
            try {
              const project = await Project.getById(invite.projectId);
              return {
                ...invite,
                projectName: project.name
              };
            } catch (error) {
              console.error('Error loading project for invitation:', error);
              return invite;
            }
          })
        );
        
        return this.pendingInvitations;
      } catch (error) {
        console.error('Error loading invitations:', error);
        this.pendingInvitations = [];
        return [];
      }
    },

    async userAcceptInvitation(inviteToken) {
      if (!this.isUserLoggedIn) return;
      
      try {
        const projectId = await User.acceptInvitation(inviteToken);
        
        // Remove from local pending invitations list
        this.pendingInvitations = this.pendingInvitations.filter(inv => inv.inviteToken !== inviteToken);
        
        // Set this project as the user's default project if they don't have one
        if (!this.user.defaultProject) {
          await this.userSetDefaultProject(projectId);
        }
        
        // Set the project and load its data
        await this.projectSet(projectId, true);
        
        // Refresh user data to get updated project list
        await this.userEnter();
        
        return projectId;
      } catch (error) {
        this.uiAlert({ 
          type: 'error', 
          message: error.message,
          autoClear: true 
        });
        throw error;
      }
    },

    async userDeclineInvitation(inviteId) {
      if (!this.isUserLoggedIn) return;
      
      try {
        await User.declineInvitation(inviteId);
        
        // Remove from local pending invitations list
        this.pendingInvitations = this.pendingInvitations.filter(inv => inv.id !== inviteId);
      } catch (error) {
        this.uiAlert({ 
          type: 'error', 
          message: error.message,
          autoClear: true 
        });
        throw error;
      }
    },

    userDismissPendingInvitations() {
      this.pendingInvitationsDismissed = true;
    },

    userShowPendingInvitations() {
      this.pendingInvitationsDismissed = false;
    },

    async userLogoutAction() {
      await User.logout();
    },

    async userGetInvitationByToken(token) {
      try {
        const invitation = await User.getInvitationByToken(token);
        
        // Load project and inviter details
        const project = await Project.getById(invitation.projectId);
        const inviter = await User.getUserData(invitation.invitedBy);
        
        return {
          ...invitation,
          projectName: project.name,
          inviterName: inviter.displayName || inviter.email
        };
      } catch (error) {
        console.error('Error loading invitation:', error);
        throw error;
      }
    },


    async userSetDefaultProject(payload) {
      await User.setDefaultProject(payload);
      this.user.defaultProject = payload;
    },

    // Project Management
    async projectSet(projectId, details = false) {
      //if (this.loading.project) return;
      this.loading.project = true;
      console.log('projectSet', projectId)
      if (!projectId) return;
      
      this.project = await Project.getById(projectId, true);
      
      if (this.isUserLoggedIn) {
        await this.projectGetAllData();
      }
      this.loading.project = false;
    },

    async projectRefresh(details = false) {
      this.project = await Project.getById(this.project.id, details);
    },


    async projectGetAllData() {
      
      // Double check user is logged in before proceeding
      if (!this.isUserLoggedIn || !this.user.uid) {
        console.warn('User not logged in, skipping project data load');
        return;
      }

      // Check if project is set before proceeding
      if (!this.project || !this.project.id) {
        console.warn('No project set, skipping project data load');
        return;
      }

      try {
        // Load projects (with safety check for user.projects)
        if (this.user.projects && this.user.projects.length > 0) {
          this.projects = await Promise.all(
            this.user.projects.map(project => Project.getById(project.projectId))
          );
        }
        
        // Load documents (already has safety checks in Document.getAll)
        this.documents = await Document.getAll();
        console.log('Documents loaded:', this.documents.length);

        // Load user-specific data only if confirmed logged in
        if (this.isUserLoggedIn && this.user.uid) {
          
          // These methods already have their own safety checks
          this.tasks = await Task.getAll();         
          this.chats = await ChatHistory.getAll();
          this.favorites = await Favorites.getAll();
        }

      } catch (error) {
        console.error('Error loading project data:', error);
        this.uiAlert({
          type: 'error',
          message: 'Failed to load project data. Please try refreshing the page.',
          autoClear: true
        });
      }

      return true;
    },
    

    async projectGetInvitation() {
      this.project.invitation = await Project.getInvitation(this.project.id);
    },
    
    async projectCreateInvitation({projectId, email, role}) { 
      const result = await Project.inviteUserToProject({projectId, email, role});
      return  result
    },

    async projectUpdateInvitation(payload) {
      const { id, ...updateData } = payload;
      await Project.updateInvitation(id, updateData);
    },

    async projectRemoveUserFromProject({userId, projectId}) {
      await Project.removeUserFromProject({userId, projectId});
      
      // Update local project users state to mark user as removed
      if (this.project.users) {
        const userIndex = this.project.users.findIndex(user => user.userId === userId );
        if (userIndex !== -1) {
          this.project.users[userIndex] = {
            ...this.project.users[userIndex],
            status: 'removed'
          };
        }
      }
    },

    async projectReinstateUser({userId, projectId}) {
      await Project.reinstateUser({userId, projectId});
      
      // Update local project users state to mark user as active
      if (this.project.users) {
        const userIndex = this.project.users.findIndex(user => user.userId === userId );
        if (userIndex !== -1) {
          this.project.users[userIndex] = {
            ...this.project.users[userIndex],
            status: 'active'
          };
        }
      }
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
      // Initialize selected with safe defaults
      this.selected = { 
        id: null,
        data: {},
        comments: [],
        versions: [],
        isVersion: false,
        currentVersion: 'live',
        isLoading: true 
      };

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

        // Ensure selectedData has the required structure
        if (!selectedData || !selectedData.id) {
          throw new Error(`Failed to load document with ID: ${id}`);
        }

        // Ensure data property exists
        if (!selectedData.data) {
          selectedData.data = {};
        }

        // Ensure comments array exists
        if (!selectedData.comments) {
          selectedData.comments = [];
        }

        selectedData.isLoading = false;
        this.selected = {
          ...selectedData,
          currentVersion: version || 'live',
          isVersion: !!version
        };
        
        // Check document versions status after selecting
        await this.documentsCheckVersionsStatus({ id: this.selected.id });
        
        return this.selected;
      } catch (error) {
        this.selected = {
          id: null,
          data: {},
          comments: [],
          versions: [],
          isVersion: false,
          currentVersion: 'live',
          isLoading: false
        };
        console.error('Error selecting document:', error);
        throw error;
      }
    },

    async documentsCheckVersionsStatus({ id }) {
      try {
        const releasedVersions = this.selected.versions.filter(version => version?.released === true).map(version => version.versionNumber);
        const currentReleasedVersions = this.selected.data.releasedVersion || [];

        // Compare arrays by value using JSON.stringify (with sorting for consistent comparison)
        const releasedVersionsSorted = [...releasedVersions].sort();
        const currentReleasedVersionsSorted = [...currentReleasedVersions].sort();
        const arraysAreEqual = JSON.stringify(releasedVersionsSorted) === JSON.stringify(currentReleasedVersionsSorted);
        
        if (!arraysAreEqual || (this.selected.data.draft === true && this.selected.data.releasedVersion && this.selected.data.releasedVersion.length > 0)) {
          await Document.updateDocField(id, 'releasedVersion', releasedVersions);
          await Document.updateDocField(id, 'draft', false);
          
          // Update the local state immediately
          this.selected.data = {
            ...this.selected.data,
            releasedVersion: releasedVersions,
            draft: false
          };
          
          // Update the document in the documents array to reflect changes
          const docIndex = this.documents.findIndex(doc => doc.id === id);
          if (docIndex !== -1) {
            this.documents[docIndex].data = {
              ...this.documents[docIndex].data,
              releasedVersion: releasedVersions,
              draft: false
            };
          }
        } else if (this.selected.data.draft === false && (!this.selected.data.releasedVersion || this.selected.data.releasedVersion.length === 0)) {
          // This is something to protect backwards compatibility, before version releases were implemented
          console.log('setting draft to true');
          await Document.updateDocField(id, 'releasedVersion', []);
          await Document.updateDocField(id, 'draft', true);
          
          this.selected.data = {
            ...this.selected.data,
            releasedVersion: [],
            draft: true
          };
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
      // Safety checks to prevent undefined errors
      if (!this.selected || !this.selected.id || !this.selected.data) {
        console.error('Cannot save document: selected document is invalid', this.selected);
        throw new Error('Cannot save document: selected document is invalid');
      }

      const updatedDoc = await Document.updateDoc(this.selected.id, this.selected.data);
      
      const docIndex = this.documents.findIndex(doc => doc.id === this.selected.id);
      if (docIndex !== -1) {
        this.documents[docIndex] = { id: this.selected.id, data: this.selected.data };
      }
      
      this.selected = { ...this.selected, data: this.selected.data };
      
      return { id: this.selected.id, data: this.selected.data };
    },

    documentsUpdate(document) {
      this.selected = { ...this.selected, ...document };
    },

    // Comments Management
    async commentsAdd(comment) {
      if (!this.selected || !this.selected.id) {
        throw new Error('No document selected');
      }
      if (!this.selected.comments) {
        this.selected.comments = [];
      }
      
      const newComment = await Document.createComment(this.selected.id, comment);
      newComment.createDate = { seconds: Math.floor(Date.now() / 1000) };
      this.selected.comments.push(newComment);
      return newComment;
    },

    async commentsAddReply({ parentId, comment }) {
      if (!this.selected || !this.selected.id) {
        throw new Error('No document selected');
      }
      if (!this.selected.comments) {
        this.selected.comments = [];
      }
      
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
      const alert = {
        type: payload.type,
        message: payload.message,
        autoClear: payload.autoClear,
        timestamp: Date.now(),
        time: Date.now(),
        show: true
      };
      
      this.globalAlerts.push(alert);
      
      // Auto-clear alerts if autoClear is true
      if (payload.autoClear) {
        setTimeout(() => {
          const index = this.globalAlerts.indexOf(alert);
          if (index > -1) {
            alert.show = false;
            // Remove after fade out
            setTimeout(() => {
              this.globalAlerts.splice(index, 1);
            }, 1000);
          }
        }, 5000);
      }
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
    async foldersUpdate({docId, target, action}) {
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
      await Project.updatefield(this.project.id, 'folders', this.project.folders);
    },

    async foldersAdd(folderName) {
      this.project.folders.push({
        name: folderName,
        children: [],
        isOpen: true
      });
      await Project.updatefield(this.project.id, 'folders', this.project.folders);
      this.uiAlert({type: 'success', message: 'Folder updated', autoClear: true});
    },

    async foldersRemove(folderName) {
      this.project.folders = this.project.folders.filter(folder => folder.name !== folderName);
      await Project.updatefield(this.project.id, 'folders', this.project.folders);
    },

    async foldersRename({toFolderName, fromFolderName}) {
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

      const folderStatus = {
        projectId: this.project.id,
        folders: this.project.folders.map(folder => ({
          name: folder.name,
          isOpen: folder.isOpen
        }))
      };

      document.cookie = `folderStatus=${encodeURIComponent(JSON.stringify(folderStatus))}; path=/;`;  
    },

    async createVersion(newVersion) {
      await Document.createVersion(this.selected.id, this.selected.data, newVersion);
      
      // Update the versions array in the selected document
      if (!this.selected.versions) {
        this.selected.versions = [];
      }
      this.selected.versions.push(newVersion);
      
      return newVersion;
    },

    async deleteVersion(selectedVersion) {
      await Document.deleteVersion(this.selected.id, selectedVersion);
      
      // Update the versions array in the selected document
      if (this.selected.versions) {
        this.selected.versions = this.selected.versions.filter(version => version !== selectedVersion);
      }
      
      return selectedVersion;
    },

    async toggleVersionReleased({ versionNumber, released }) {
      await Document.toggleVersionReleased(this.selected.id, versionNumber, released);
      
      // Update the versions array in the selected document
      if (this.selected.versions) {
        this.selected.versions = this.selected.versions.map(version => 
          version.versionNumber === versionNumber ? { 
            ...version, released: released
          } : version
        );
      }
      
      // Check document versions status after toggle
      await this.documentsCheckVersionsStatus({ id: this.selected.id });
      
      return { versionNumber, released };
    },

    async renameChat(payload) {
      // Chat renaming implementation
      const result = await ChatHistory.updateChatField(payload.id, 'name', payload.newName);
      const chatIndex = this.chats.findIndex(chat => chat.id === payload.id);
      if (chatIndex !== -1) {
        this.chats[chatIndex].data.name = payload.newName;
      }
      return result;
    },

    async updateTask(payload) {
      const result = await Task.updateTask(payload.docID, payload.identity, payload.task);
      
      // Find the document containing the task
      const docIndex = this.tasks.findIndex(doc => doc.docID === payload.docID);
      if (docIndex !== -1) {
        // Update the specific task within the document's tasks array
        const updatedTasks = this.tasks[docIndex].tasks.map(t => 
          t.identity === payload.identity 
            ? payload.task 
            : t
        );
        this.tasks[docIndex] = { ...this.tasks[docIndex], tasks: updatedTasks };
      }
      return result;
    },

    async updateMarkedUpContent({ docID, versionContent, versionNumber }) {
      if (this.selected.id === null || this.selected.currentVersion === 'live') { 
        return; 
      }
      
      await Document.updateMarkedUpContent(docID, versionContent, versionNumber);
      
      // Update the content in the selected document if we're viewing this document
      if (this.selected.id === docID) {
        this.selected.data = { 
          ...this.selected.data, 
          content: versionContent 
        };
      }
    },



    async toggleFavorite(docId) {
      const index = this.favorites.indexOf(docId);
      let newFavorites;
      if (index > -1) {
        this.favorites.splice(index, 1);
        newFavorites = [...this.favorites];
      } else {
        this.favorites.push(docId);
        newFavorites = [...this.favorites];
      }
      await Favorites.updateFavorites(newFavorites);
    },

    async getChats() {
      this.chats = await ChatHistory.getAll()
    },

    async deleteChat(id) {
      this.chats = this.chats.filter(chat => chat.id !== id);
      await ChatHistory.deleteChat(id);
    },

    async archiveChat(id) {
      this.chats = this.chats.filter(chat => chat.id !== id);
      await ChatHistory.archiveChat(id);
    }
  }
})

