import { defineStore } from 'pinia'
import router from '../router'
import {User, Document, ChatHistory, Favorites, Project, Comment, Task} from '../services/firebaseDataService'
import { eventStore } from './eventStore'

// Static flag to prevent multiple simultaneous userEnter calls
let isUserEnterInProgress = false;
let userEnterPromise = null;

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

    isUserInProject: (state) => !!state.user.projects?.find(project => project.projectId === state.project.id && project.status !== 'removed'),
    
    isProjectAdmin: (state) => state.user.projects?.find(project => project.projectId === state.project.id && project.status !== 'removed')?.role === 'admin',
    
    isProjectArchived: (state) => state.project?.archived === true,
    
    isProjectReadOnly: (state) => state.project?.archived === true,
    
    canCreateProject: (state) => {
      const userTier = state.user.tier;
      
      // Pro users have unlimited projects
      if (userTier === 'pro' || userTier === 'trial') {
        return { allowed: true, reason: null, projectCount: 0, limit: null };
      }
      
      // Get user's current project count (only active projects)
      const userProjects = state.user.projects || [];
      const activeProjects = userProjects.filter(p => p.status === 'active');
      const projectCount = activeProjects.length;
      const freeLimit = 5;
      
      if (projectCount >= freeLimit) {
        return { 
          allowed: false, 
          reason: `Free users are limited to ${freeLimit} projects. Upgrade to Pro for unlimited projects.`,
          projectCount,
          limit: freeLimit
        };
      }
      
      return { 
        allowed: true, 
        reason: null, 
        projectCount,
        limit: freeLimit
      };
    },
    
    filteredDocuments: (state) => filterHelper(Array.isArray(state.documents) ? state.documents : [], state.filter),
    
    isFavorite: (state) => (id) => state.favorites.includes(id),
    
    projectFolderTree: (state) => {
      // Ensure documents is an array before trying to map
      if (!Array.isArray(state.documents) || !state.project?.folders) {
        return [];
      }
      
      const documentMap = new Map(state.documents.map(doc => [doc.id, doc]));
      
      // Ensure project.folders is an array
      if (!Array.isArray(state.project.folders)) {
        return state.documents.sort((a, b) => a.data?.name?.localeCompare(b.data?.name) || 0);
      }
      
      const updatedFolders = state.project?.folders
        ?.filter(folder => folder && folder.name) // Filter out null/invalid folders
        ?.map(folder => {
          const children = folder.children || []; // Default to empty array if children is missing
          const updatedChildren = children.map(childId => documentMap
            .get(childId))
            .filter(Boolean)
            .sort((a, b) => a.data?.name?.localeCompare(b.data?.name) || 0);
          return {
            id: folder.name,
            name: folder.name,
            isOpen: folder.isOpen ?? true,
            folder: true,
            children: updatedChildren,
            data: {
              name: folder.name,
              folder: true,
            }
          };
        });

      if (updatedFolders) {
        updatedFolders.sort((a, b) => a.id.localeCompare(b.id));
      }
      
      // Safe access to folders for documentsInFolders calculation
      const validFolders = state.project.folders.filter(folder => folder && Array.isArray(folder.children));
      const documentsInFolders = new Set(validFolders.flatMap(folder => folder.children || []));
      const ungroupedDocuments = state.documents.filter(doc => !documentsInFolders.has(doc.id)).sort((a, b) => a.data?.name?.localeCompare(b.data?.name) || 0);
      return [...(updatedFolders || []), ...ungroupedDocuments];
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
      if (isUserEnterInProgress) {
        console.log('userEnter already in progress, waiting for existing promise');
        return userEnterPromise;
      }

      isUserEnterInProgress = true;
      userEnterPromise = this._userEnterInternal();
      
      try {
        return await userEnterPromise;
      } finally {
        // Reset flag and promise
        isUserEnterInProgress = false;
        userEnterPromise = null;
      }
    },

    async _userEnterInternal() {
      this.loading.user = true;
      eventStore.emitEvent('loading-modal', { show: true, message: 'Authenticating and setting up your workspace' });
      
      try {
        const user = await User.getUserAuth();
        
        if (user) {
          // WAIT for user data to be set before continuing
          this.userSetData(user);

          // Load pending invitations for the user
          await this.userGetPendingInvitations();

          // WAIT for project to be set before continuing
          eventStore.emitEvent('loading-modal', { show: false, message: '' });
          if (user.defaultProject) {
            await this.projectSet(user.defaultProject);
          }

          return true;
        } else {
          console.log('No user authenticated');
          return false;
        }
      } catch (error) {
        console.error('Error in userEnter:', error);
        this.uiAlert({ type: 'error', message: 'Authentication failed', autoClear: true });
        return false;
      } finally {
        this.loading.user = false;
        eventStore.emitEvent('loading-modal', { show: false, message: '' });
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
      // TODO: get this shit out of here and into the user.acceptInvitation function
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
        
        if (invites.length === 0) {
          this.pendingInvitations = [];
          return [];
        }
        
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
      if (!inviteToken) return;
      
      try {
        // adds user to project 
        const result = await User.acceptInvitation(inviteToken);

        if (result.success) {
          const projectId = result.data.projectId;
          
          // Remove from local pending invitations list
          console.log('this.pendingInvitations', this.pendingInvitations);
          this.pendingInvitations = (this.pendingInvitations || []).filter(inv => inv.inviteToken !== inviteToken);
        
          
          return projectId;
        } else {
          this.uiAlert({ 
            type: 'error', 
            message: result.message,
            autoClear: true 
          });
          throw new Error(result.message);
        }
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
        const result = await User.declineInvitation(inviteId);
        
        if (result.success) {
          // Remove from local pending invitations list
          this.pendingInvitations = (this.pendingInvitations || []).filter(inv => inv.id !== inviteId);
        } else {
          this.uiAlert({ 
            type: 'error', 
            message: result.message,
            autoClear: true 
          });
          throw new Error(result.message);
        }
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
      try {
        const result = await User.logout();
        if (result.success) {
          this.uiAlert({ type: 'info', message: result.message, autoClear: true });
        } else {
          this.uiAlert({ type: 'error', message: result.message, autoClear: true });
        }
        return result.success;
      } catch (error) {
        this.uiAlert({ type: 'error', message: 'Unexpected error during logout', autoClear: true });
        console.error('Logout error:', error);
        return false;
      }
    },

    async userGetInvitationByToken(token) {
      try {
        const invitation = await User.getInvitationByToken(token);
        
        // Load project and inviter details (skip auth check for invitation loading)
        const project = await Project.getById(invitation.projectId, false, true);
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
      try {
        const result = await User.setDefaultProject(payload);
        if (result.success) {
          this.user.defaultProject = payload;
          this.uiAlert({ type: 'success', message: result.message, autoClear: true });
          return true;
        } else {
          this.uiAlert({ type: 'error', message: result.message, autoClear: true });
          return false;
        }
      } catch (error) {
        this.uiAlert({ type: 'error', message: 'Failed to set default project', autoClear: true });
        console.error('Set default project error:', error);
        return false;
      }
    },

    // Project Management
    async projectCreate(payload) {
      this.loading.project = true;
      
      try {
        const result = await Project.create(payload);
        if (result.success) {
          this.project = result.data;
          this.projects.push(result.data);
          
          // Update user's projects list to include the new project
          if (!this.user.projects) {
            this.user.projects = [];
          }
          
          this.user.projects.push({
            projectId: result.data.id,
            role: 'admin',
            status: 'active',
            isCreator: true
          });
          
          this.uiAlert({ type: 'success', message: result.message, autoClear: true });
          return result.data;
        } else {
          this.uiAlert({ type: 'error', message: result.message, autoClear: true });
          return null;
        }
      } catch (error) {
        this.uiAlert({ type: 'error', message: 'Failed to create project', autoClear: true });
        console.error('Project creation error:', error);
        return null;
      } finally {
        this.loading.project = false;
      }
    },
    
    async projectSet(projectId, details = false) {

      // if user is not in project dont let them set it and fetch (unless its demo)
      // TODO: if the user has no project then we should set the default project to null and have them go through the project create
      
      // Fix: Check if user is in the SPECIFIC PROJECT being set, not the current project
      const userInSpecificProject = this.user.projects?.find(project => 
        project.projectId === projectId && project.status !== 'removed'
      );
      
      // Also check if this is a project that was just created (exists in this.projects but not in user.projects yet)
      const projectJustCreated = this.projects.find(p => p.id === projectId && p.createdBy === this.user.uid);
      
      if (!userInSpecificProject && !projectJustCreated && projectId !== import.meta.env.VITE_DEFAULT_PROJECT_ID) {
        this.uiAlert({
          type: 'error',
          message: 'You are not a member of this project',
          autoClear: true
        });
        return false;
      }

      if (!projectId ) return false;
      console.log('projectId', projectId);
   
      try {
        this.project.id = projectId;
        this.project = await Project.getById(projectId, true, true);

        
        if (this.isUserLoggedIn) {
          await this.projectGetAllData();
        }

        return true;
      } catch (error) {
        console.error('Error setting project:', error);
        this.uiAlert({
          type: 'error',
          message: error.message || 'Failed to load project',
          autoClear: true
        });
        return false;
      }
    },

    async projectRefresh(details = false) {
      if (!this.project.id) return;
      this.project = await Project.getById(this.project.id, details, true);
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
          const projectPromises = this.user.projects.map(async (project) => {
            const projectData = await Project.getById(project.projectId, false, true);
            if (projectData) {
              // Add user's role to project data for easier access
              projectData.userRole = project.role;
              projectData.userStatus = project.status;
            }
            return projectData;
          });
          
          const allProjects = await Promise.all(projectPromises);
          this.projects = allProjects.filter(Boolean); // Remove any null projects
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
      if (result.success) {
        return result.data;
      } else {
        throw new Error(result.message || 'Failed to create invitation');
      }
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

    async projectArchive(projectId) {
      try {
        const result = await Project.archive(projectId);
        
        if (result.success) {
          // Update local projects list to mark as archived
          const projectIndex = this.projects.findIndex(p => p.id === projectId);
          if (projectIndex !== -1) {
            this.projects[projectIndex] = {
              ...this.projects[projectIndex],
              archived: true
            };
          }
          
          this.uiAlert({ 
            type: 'success', 
            message: result.message || 'Project archived successfully',
            autoClear: true 
          });
          
          return true;
        } else {
          this.uiAlert({ 
            type: 'error', 
            message: result.message || 'Failed to archive project',
            autoClear: true 
          });
          return false;
        }
      } catch (error) {
        this.uiAlert({ 
          type: 'error', 
          message: 'Failed to archive project',
          autoClear: true 
        });
        console.error('Project archive error:', error);
        return false;
      }
    },

    async projectDelete(projectId) {
      try {
        const result = await Project.delete(projectId);
        
        if (result.success) {
          // Remove from local projects list
          this.projects = this.projects.filter(p => p.id !== projectId);
          
          // If this was the current project, switch to another project or trigger new user flow
          if (this.project.id === projectId) {
            await this.handleCurrentProjectDeleted();
          }
          
          this.uiAlert({ 
            type: 'success', 
            message: result.message || 'Project deleted successfully',
            autoClear: true 
          });
          
          return true;
        } else {
          this.uiAlert({ 
            type: 'error', 
            message: result.message || 'Failed to delete project',
            autoClear: true 
          });
          return false;
        }
      } catch (error) {
        this.uiAlert({ 
          type: 'error', 
          message: 'Failed to delete project',
          autoClear: true 
        });
        console.error('Project delete error:', error);
        return false;
      }
    },

    async projectUnarchive(projectId) {
      try {
        const result = await Project.unarchive(projectId);
        
        if (result.success) {
          // Update local projects list to mark as unarchived
          const projectIndex = this.projects.findIndex(p => p.id === projectId);
          if (projectIndex !== -1) {
            this.projects[projectIndex] = {
              ...this.projects[projectIndex],
              archived: false
            };
          }
          
          this.uiAlert({ 
            type: 'success', 
            message: result.message || 'Project restored successfully',
            autoClear: true 
          });
          
          return true;
        } else {
          this.uiAlert({ 
            type: 'error', 
            message: result.message || 'Failed to restore project',
            autoClear: true 
          });
          return false;
        }
      } catch (error) {
        this.uiAlert({ 
          type: 'error', 
          message: 'Failed to restore project',
          autoClear: true 
        });
        console.error('Project unarchive error:', error);
        return false;
      }
    },

    async handleCurrentProjectDeleted() {
      // Find the next available non-archived project
      const availableProjects = this.projects.filter(p => !p.archived);
      
      if (availableProjects.length > 0) {
        // Set the first available project as default
        const nextProject = availableProjects[0];
        await this.userSetDefaultProject(nextProject.id);
        await this.projectSet(nextProject.id, true);
        
        this.uiAlert({
          type: 'info',
          message: `Switched to project: ${nextProject.name}`,
          autoClear: true
        });
      } else {
        // No projects available, trigger new user flow
        this.user.defaultProject = null;
        router.push('/new-user');
        
        this.uiAlert({
          type: 'info',
          message: 'No projects available. Let\'s create a new one!',
          autoClear: true
        });
      }
    },

    // Document Management
    async documentsCreate({ data, select = true }) {
      const result = await Document.create(data);
      // TODO: need a way to add the document to the correct folder if user wants to
      
      if (result.success) {
        const createdDoc = result.data;
        if (select) {
          this.selected = { ...this.selected, ...createdDoc };
        }
        this.documents.push({ id: createdDoc.id, data: createdDoc.data });
        return { id: createdDoc.id, data: createdDoc.data };
      } else {
        this.uiAlert({ 
          type: 'error', 
          message: result.message || 'Failed to create document',
          autoClear: true 
        });
        throw new Error(result.message || 'Failed to create document');
      }
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
          const result1 = await Document.updateDocField(id, 'releasedVersion', releasedVersions);
          const result2 = await Document.updateDocField(id, 'draft', false);
          
          if (result1.success && result2.success) {
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
          } else {
            console.error('Failed to update document version status:', result1.error || result2.error);
          }
        } else if (this.selected.data.draft === false && (!this.selected.data.releasedVersion || this.selected.data.releasedVersion.length === 0)) {
          // This is something to protect backwards compatibility, before version releases were implemented
          console.log('setting draft to true');
          const result1 = await Document.updateDocField(id, 'releasedVersion', []);
          const result2 = await Document.updateDocField(id, 'draft', true);
          
          if (result1.success && result2.success) {
            this.selected.data = {
              ...this.selected.data,
              releasedVersion: [],
              draft: true
            };
          } else {
            console.error('Failed to update document draft status:', result1.error || result2.error);
          }
        }
      } catch (error) {
        console.error('Error checking document versions status:', error);
      }
    },

    async documentsDelete({ id }) {
      const result = await Document.deleteDocByID(id);
      
      if (result.success) {
        this.documents = this.documents.filter(doc => doc.id !== id);
      } else {
        this.uiAlert({ 
          type: 'error', 
          message: result.message || 'Failed to delete document',
          autoClear: true 
        });
        throw new Error(result.message || 'Failed to delete document');
      }
    },

    async documentsArchive({ id }) {
      const result = await Document.archiveDoc(id);
      
      if (result.success) {
        this.documents = this.documents.filter(doc => doc.id !== id);
      } else {
        this.uiAlert({ 
          type: 'error', 
          message: result.message || 'Failed to archive document',
          autoClear: true 
        });
        throw new Error(result.message || 'Failed to archive document');
      }
    },

    async documentsSave() {
      // Safety checks to prevent undefined errors
      if (!this.selected || !this.selected.id || !this.selected.data) {
        console.error('Cannot save document: selected document is invalid', this.selected);
        throw new Error('Cannot save document: selected document is invalid');
      }

      const result = await Document.updateDoc(this.selected.id, this.selected.data);
      
      if (result.success) {
        const docIndex = this.documents.findIndex(doc => doc.id === this.selected.id);
        if (docIndex !== -1) {
          this.documents[docIndex] = { id: this.selected.id, data: this.selected.data };
        }
        
        this.selected = { ...this.selected, data: this.selected.data };
        
        // Emit document saved event for components that need to know about successful saves
        eventStore.emitEvent('documentSaved', {
          documentId: this.selected.id,
          documentData: this.selected.data
        });
        
        return { id: this.selected.id, data: this.selected.data };
      } else {
        this.uiAlert({ 
          type: 'error', 
          message: result.message || 'Failed to save document',
          autoClear: true 
        });
        throw new Error(result.message || 'Failed to save document');
      }
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
      
      const result = await Document.createComment(this.selected.id, comment);
      
      if (result.success) {
        const newComment = result.data;
        newComment.createDate = { seconds: Math.floor(Date.now() / 1000) };
        this.selected.comments.push(newComment);
        return newComment;
      } else {
        this.uiAlert({ 
          type: 'error', 
          message: result.message || 'Failed to create comment',
          autoClear: true 
        });
        throw new Error(result.message || 'Failed to create comment');
      }
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
      const result = await Document.createComment(this.selected.id, replyData);
      
      if (result.success) {
        const newReply = result.data;
        newReply.createDate = { seconds: Math.floor(Date.now() / 1000) };
        this.selected.comments.push(newReply);
        return newReply;
      } else {
        this.uiAlert({ 
          type: 'error', 
          message: result.message || 'Failed to create reply',
          autoClear: true 
        });
        throw new Error(result.message || 'Failed to create reply');
      }
    },

    async commentsUpdate({ id, updatedComment }) {
      const result = await Document.updateComment(this.selected.id, id, updatedComment);
      
      if (result.success) {
        const updatedCommentData = result.data;
        const commentIndex = this.selected.comments.findIndex(comment => comment.id === id);
        if (commentIndex !== -1) {
          this.selected.comments[commentIndex] = { ...this.selected.comments[commentIndex], ...updatedCommentData };
        }
        return updatedCommentData;
      } else {
        this.uiAlert({ 
          type: 'error', 
          message: result.message || 'Failed to update comment',
          autoClear: true 
        });
        throw new Error(result.message || 'Failed to update comment');
      }
    },

    async commentsDelete(id) {
      const result = await Document.deleteComment(this.selected.id, id);
      
      if (result.success) {
        this.selected.comments = this.selected.comments.filter(comment => comment.id !== id);
        return id;
      } else {
        this.uiAlert({ 
          type: 'error', 
          message: result.message || 'Failed to delete comment',
          autoClear: true 
        });
        throw new Error(result.message || 'Failed to delete comment');
      }
    },

    async commentsUpdateData({ id, data }) {
      const result = await Document.updateCommentData(this.selected.id, id, data);
      
      if (result.success) {
        const updatedCommentData = result.data;
        const commentIndex = this.selected.comments.findIndex(comment => comment.id === id);
        if (commentIndex !== -1) {
          this.selected.comments[commentIndex] = { ...this.selected.comments[commentIndex], ...data };
        }
        return updatedCommentData;
      } else {
        this.uiAlert({ 
          type: 'error', 
          message: result.message || 'Failed to update comment data',
          autoClear: true 
        });
        throw new Error(result.message || 'Failed to update comment data');
      }
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
    async foldersUpdate(payload) {
      // Store original state for rollback
      const originalFolders = JSON.parse(JSON.stringify(this.project.folders));

      try {
        const result = await Project.updateField(this.project.id, 'folders', payload);
        this.project.folders = payload;
      } catch (error) {
        this.project.folders = originalFolders;
        throw error;
      }
    },

    async foldersMove(docId, targetFolderName = null) {
      // Store original state for rollback
      const originalFolders = JSON.parse(JSON.stringify(this.project.folders));
      
      // Step 1: Remove document from its current folder (if any)
      const sourceFolder = this.project.folders.find(folder => folder.children.includes(docId));
      if (sourceFolder) {
        sourceFolder.children = sourceFolder.children.filter(id => id !== docId);
      }

      // Step 2: Add document to target folder (if specified)
      if (targetFolderName) {
        const targetFolder = this.project.folders.find(folder => folder.name === targetFolderName);
        if (targetFolder) {
          targetFolder.children.push(docId);
        } else {
          // Restore original state if target folder doesn't exist
          this.project.folders = originalFolders;
          this.uiAlert({ 
            type: 'error', 
            message: `Target folder "${targetFolderName}" not found`,
            autoClear: true 
          });
          throw new Error(`Target folder "${targetFolderName}" not found`);
        }
      }
      // If targetFolderName is null/undefined, document moves to root level (no folder)

      try {
        const result = await Project.updateField(this.project.id, 'folders', this.project.folders);
        
        if (!result.success) {
          // Restore original state on failure
          this.project.folders = originalFolders;
          this.uiAlert({ 
            type: 'error', 
            message: result.message || 'Failed to move document',
            autoClear: true 
          });
          throw new Error('Failed to move document');
        }

        // Success feedback
        const moveDescription = targetFolderName 
          ? `moved to "${targetFolderName}" folder` 
          : 'moved to root level';
        this.uiAlert({ 
          type: 'success', 
          message: `Document ${moveDescription}`,
          autoClear: true 
        });

      } catch (error) {
        // Restore original state on any error
        this.project.folders = originalFolders;
        throw error;
      }
    },



    async foldersAdd(folderName) {
      // Store original state for rollback
      const originalFolders = [...this.project.folders];

      // check if the folder name already exists
      if (this.project.folders.find(folder => folder.name === folderName)) {
        this.uiAlert({type: 'error', message: 'New Folder already exists rename it before adding more folders', autoClear: true});
        return false;
      }
      
      this.project.folders.push({
        name: folderName,
        children: [],
        isOpen: true
      });
      
      try {
        const result = await Project.updateField(this.project.id, 'folders', this.project.folders);
        
        if (result.success) {
          this.uiAlert({type: 'success', message: 'Folder updated', autoClear: true});
          return true;
        } else {
          // Restore original state on failure
          this.project.folders = originalFolders;
          this.uiAlert({ 
            type: 'error', 
            message: result.message || 'Failed to add folder',
            autoClear: true 
          });
          throw new Error('Failed to add folder');
        }
      } catch (error) {
        // Restore original state on any error
        this.project.folders = originalFolders;
        if (error.message === 'Failed to add folder') {
          throw error;
        }
        throw new Error('Failed to add folder');

      }
    },

    async foldersRemove(folderName) {
      // Store original state for rollback
      const originalFolders = [...this.project.folders];
      
      this.project.folders = this.project.folders.filter(folder => folder.name !== folderName);
      
      try {
        const result = await Project.updateField(this.project.id, 'folders', this.project.folders);
        if (result.success) {
          this.uiAlert({type: 'success', message: 'Folder updated', autoClear: true});
        } else {
          this.project.folders = originalFolders;
          this.uiAlert({type: 'error', message: 'Failed to remove folder', autoClear: true});
          throw new Error('Failed to remove folder');
        }
      } catch (error) {
        // Restore original state on any error
        this.project.folders = originalFolders;
        if (error.message === 'Failed to remove folder') {
          throw error;
        }
        throw new Error('Failed to remove folder');
      }
    },

    async foldersRename({toFolderName, fromFolderName}) {
      const originalFolders = [...this.project.folders];

      const folder = this.project.folders.find(folder => folder.name === fromFolderName);
      if (folder) {
        folder.name = toFolderName;
      }

      try {
        const result = await Project.updateField(this.project.id, 'folders', this.project.folders);
        if (result.success) {
          this.uiAlert({type: 'success', message: 'Folder updated', autoClear: true});
        }

      } catch (error) {
        this.project.folders = originalFolders;
        throw error;
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
      const result = await Document.createVersion(this.selected.id, this.selected.data, newVersion);
      
      if (result.success) {
        // Update the versions array in the selected document
        if (!this.selected.versions) {
          this.selected.versions = [];
        }
        this.selected.versions.push(newVersion);
        
        return newVersion;
      } else {
        this.uiAlert({ 
          type: 'error', 
          message: result.message || 'Failed to create version',
          autoClear: true 
        });
        throw new Error(result.message || 'Failed to create version');
      }
    },

    async deleteVersion(selectedVersion) {
      const result = await Document.deleteVersion(this.selected.id, selectedVersion);
      
      if (result.success) {
        // Update the versions array in the selected document
        if (this.selected.versions) {
          this.selected.versions = this.selected.versions.filter(version => version !== selectedVersion);
        }
        
        return selectedVersion;
      } else {
        this.uiAlert({ 
          type: 'error', 
          message: result.message || 'Failed to delete version',
          autoClear: true 
        });
        throw new Error(result.message || 'Failed to delete version');
      }
    },

    async toggleVersionReleased({ versionNumber, released }) {
      const result = await Document.toggleVersionReleased(this.selected.id, versionNumber, released);
      
      if (result.success) {
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
      } else {
        this.uiAlert({ 
          type: 'error', 
          message: result.message || 'Failed to toggle version release status',
          autoClear: true 
        });
        throw new Error(result.message || 'Failed to toggle version release status');
      }
    },

    async renameChat(payload) {
      // Chat renaming implementation
      const result = await ChatHistory.updateChatField(payload.id, 'name', payload.newName);
      
      if (result.success) {
        const chatIndex = this.chats.findIndex(chat => chat.id === payload.id);
        if (chatIndex !== -1) {
          this.chats[chatIndex].data.name = payload.newName;
        }
        return result;
      } else {
        this.uiAlert({ 
          type: 'error', 
          message: result.message || 'Failed to rename chat',
          autoClear: true 
        });
        throw new Error(result.message || 'Failed to rename chat');
      }
    },

    async updateTask(payload) {
      const result = await Task.updateTask(payload.docID, payload.identity, payload.task);
      
      if (result.success) {
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
      } else {
        this.uiAlert({ 
          type: 'error', 
          message: result.message || 'Failed to update task',
          autoClear: true 
        });
        throw new Error(result.message || 'Failed to update task');
      }
    },

    async updateMarkedUpContent({ docID, versionContent, versionNumber }) {
      if (this.selected.id === null || this.selected.currentVersion === 'live') { 
        return; 
      }
      
      const result = await Document.updateMarkedUpContent(docID, versionContent, versionNumber);
      
      if (result.success) {
        // Update the content in the selected document if we're viewing this document
        if (this.selected.id === docID) {
          this.selected.data = { 
            ...this.selected.data, 
            content: versionContent 
          };
        }
      } else {
        this.uiAlert({ 
          type: 'error', 
          message: result.message || 'Failed to update marked up content',
          autoClear: true 
        });
        throw new Error(result.message || 'Failed to update marked up content');
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
      
      const result = await Favorites.updateFavorites(newFavorites);
      
      if (!result.success) {
        // Revert the change if the update failed
        if (index > -1) {
          this.favorites.push(docId);
        } else {
          this.favorites.splice(this.favorites.indexOf(docId), 1);
        }
        
        this.uiAlert({ 
          type: 'error', 
          message: result.message || 'Failed to update favorites',
          autoClear: true 
        });
        throw new Error(result.message || 'Failed to update favorites');
      }
    },

    async getChatById(id) {
      const result = await ChatHistory.getDocById(id);
      
      if (result.success) {
        // Ensure the chat has proper structure with messages array
        const chat = {
          ...result.data,
          data: {
            ...result.data.data,
            messages: result.data.data.messages || []
          }
        };
        return chat;
      } else {
        this.uiAlert({ 
          type: 'error', 
          message: result.message || 'Failed to load chat',
          autoClear: true 
        });
        throw new Error(result.message || 'Failed to load chat');
      }
    },

    async getChats() {
      try {
        const rawChats = await ChatHistory.getAll();
        
        // Ensure each chat has proper structure with messages array
        // Filter out malformed chat data
        this.chats = rawChats
          .filter(chat => chat && chat.id && chat.data && typeof chat.data === 'object')
          .map(chat => ({
            ...chat,
            data: {
              ...chat.data,
              messages: Array.isArray(chat.data.messages) ? chat.data.messages : []
            }
          }));
      } catch (error) {
        console.error('Error loading chats:', error);
        this.chats = []; // Set to empty array on error
        
        // Optionally show user-friendly error message
        this.uiAlert({ 
          type: 'error', 
          message: 'Failed to load chats. Please try again.',
          autoClear: true 
        });
      }
    },

    async deleteChat(id) {
      const result = await ChatHistory.deleteChat(id);
      
      if (result.success) {
        this.chats = this.chats.filter(chat => chat.id !== id);
      } else {
        this.uiAlert({ 
          type: 'error', 
          message: result.message || 'Failed to delete chat',
          autoClear: true 
        });
        throw new Error(result.message || 'Failed to delete chat');
      }
    },

    async archiveChat(id) {
      const result = await ChatHistory.archiveChat(id);
      
      if (result.success) {
        this.chats = this.chats.filter(chat => chat.id !== id);
      } else {
        this.uiAlert({ 
          type: 'error', 
          message: result.message || 'Failed to archive chat',
          autoClear: true 
        });
        throw new Error(result.message || 'Failed to archive chat');
      }
    }
  }
})

