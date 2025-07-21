/**
 * Main Pinia Store
 * 
 * Code Quality Improvements Applied:
 * - Consolidated all constants and utility functions in utils/index.js for better maintainability
 * - Moved business logic functions directly into store for better encapsulation
 * - Improved error handling consistency with centralized user-friendly messages
 * - Used immutable array updates to prevent reactivity issues
 * - Added clear documentation for duplicate getters and their semantic differences
 * - Kept canCreateProject as getter for backward compatibility while adding action for better practices
 * - Centralized project access checking with inline utility functions
 * - Improved state mutations to use safe array operations
 */

import { defineStore } from 'pinia'
import router from '../router'
import {User, Document, ChatHistory, Favorites, Project, Comment, Task, Commit} from '../services/firebaseDataService'
import { eventStore } from './eventStore'
import { MigrationSystem } from './migrations'
import { 
  MESSAGES, 
  ROUTES, 
  ALERT_AUTO_CLEAR_TIMEOUT, 
  ALERT_FADE_OUT_TIMEOUT,
  PROJECT_STATUS,
  USER_ROLES,
  USER_TIERS,
  PROJECT_LIMITS,
  filterHelper,
  updateArrayItem
} from '../utils/index.js'

// Static flag to prevent multiple simultaneous userEnter calls
let isUserEnterInProgress = false;
let userEnterPromise = null;

/**
 * Determines if a user can create a new project based on their tier and current project count
 * @param {Object} user - User object with tier and projects
 * @returns {Object} Object with allowed boolean, reason string, projectCount, and limit
 */
function canUserCreateProject(user) {
  const userTier = user?.tier;
  
  // Pro users have unlimited projects
  if (userTier === USER_TIERS.PRO || userTier === USER_TIERS.TRIAL) {
    return { 
      allowed: true, 
      reason: null, 
      projectCount: 0, 
      limit: null 
    };
  }
  
  // Get user's current project count (only active projects)
  const userProjects = user?.projects || [];
  const activeProjects = userProjects.filter(p => p.status === PROJECT_STATUS.ACTIVE);
  const projectCount = activeProjects.length;
  const freeLimit = PROJECT_LIMITS.FREE_TIER_LIMIT;
  
  if (projectCount >= freeLimit) {
    return { 
      allowed: false, 
      reason: MESSAGES.PROJECT_LIMIT_EXCEEDED(freeLimit),
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
}

/**
 * Checks if user has access to a specific project
 * @param {Object} user - User object
 * @param {string} projectId - Project ID to check
 * @param {Array} projects - Array of projects (for newly created projects)
 * @returns {boolean} Whether user has access to the project
 */
function hasProjectAccess(user, projectId, projects = []) {
  // Check if user is in the specific project
  const userInProject = user?.projects?.find(project => 
    project.projectId === projectId && project.status !== PROJECT_STATUS.REMOVED
  );
  
  // Check if this is a project that was just created
  const projectJustCreated = projects.find(p => 
    p.id === projectId && p.createdBy === user?.uid
  );
  
  // Allow access to demo project
  const isDemoProject = projectId === import.meta.env.VITE_DEFAULT_PROJECT_ID;
  
  return !!(userInProject || projectJustCreated || isDemoProject);
}

/**
 * Safely updates user projects list
 * @param {Array} userProjects - Current user projects array
 * @param {Object} newProject - New project to add
 * @returns {Array} Updated projects array
 */
function addUserProject(userProjects = [], newProject) {
  return [...userProjects, newProject];
}

/**
 * Removes a project from user's projects list
 * @param {Array} userProjects - Current user projects array  
 * @param {string} projectId - Project ID to remove
 * @returns {Array} Updated projects array
 */
function removeUserProject(userProjects = [], projectId) {
  return userProjects.filter(p => p.projectId !== projectId);
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
    selected: { // selected document
      id: null,
      data: {},
      version: null,
      comments: [],
      versions: [],
      commits: [],
      isVersion: false,
      currentVersion: 'live',
      currentBranch:'main',
      currentCommit:null
    },
    pendingInvitations: [],
    pendingInvitationsDismissed: false,
    detailClose: 1,
    globalAlerts: [],
    filter: "",
    templates: [],
    favorites: [],
    tasks: [],
  }),

  getters: {
    isUserLoggedIn: (state) => state.user.uid !== null,
    
    canAccessAi: (state) => state.user.tier === USER_TIERS.PRO || state.user.tier === USER_TIERS.TRIAL,

    isUserInProject: (state) => !!state.user.projects?.find(project => project.projectId === state.project.id && project.status !== PROJECT_STATUS.REMOVED),
    
    isProjectAdmin: (state) => state.user.projects?.find(project => project.projectId === state.project.id && project.status !== PROJECT_STATUS.REMOVED)?.role === USER_ROLES.ADMIN,
    
    // Semantic getter for checking if project is archived (used for display logic)
    isProjectArchived: (state) => state.project?.archived === true,
    
    // Semantic getter for checking if project is read-only (used for edit permissions)
    // Note: Currently same as archived, but separated for future extensibility
    isProjectReadOnly: (state) => state.project?.archived === true,
    
    // Project creation permission checking (kept as getter for backward compatibility)
    canCreateProject: (state) => canUserCreateProject(state.user),
    
    filteredDocuments: (state) => filterHelper(Array.isArray(state.documents) ? state.documents : [], state.filter),
    
    // selected document getters
    isFavorite: (state) => (id) => state.favorites.includes(id),

    documentComments: (state) => {
      return state.selected.comments
        .sort((a, b) => a.date?.createDate - b.date?.createDate);
    },

    currentCommit: (state) => {
      if (!state.selected.commits || state.selected.commits.length === 0) return null;

      // Sort commits by creation date and return the most recent one
      const sortedCommits = [...state.selected.commits].sort((a, b) => {
        const aTime = a.createDate?.seconds || 0;
        const bTime = b.createDate?.seconds || 0;
        return bTime - aTime; // Most recent first
      });

      return sortedCommits[0] || null;
    },

    uncommittedChanges: (state) => {
      // If there's no current commit, any content means there are uncommitted changes
      if (!state.currentCommit) {
        return !!(state.selected.data?.content && state.selected.data.content.trim() !== '');
      }
      
      return state.currentCommit.documentContent !== state.selected.data.content || 
             state.currentCommit.documentName !== state.selected.data.name;
    },
    
    filteredCommentsByVersion: (state) => {
      if (!state.selected.comments) return [];
      
      const currentVersion = state.selected.currentVersion;
      const currentCommitId = state.selected.currentCommitId;
      const isViewingCommit = state.selected.isCommit;
      
      if (!currentVersion || currentVersion === 'live') {
        return state.selected.comments
          .sort((a, b) => a.createDate?.seconds - b.createDate?.seconds);
      }
      
      // Enhanced filtering for commit-based version system
      if (isViewingCommit && currentCommitId) {
        // When viewing a specific commit, show comments that:
        // 1. Match the current version number (if commit is version-tagged)
        // 2. OR have documentVersion 'commit' and were created on this commit
        // 3. OR match the commit ID directly (future enhancement)
        return state.selected.comments
          .filter(comment => {
            // Match version number (covers version-tagged commits)
            if (comment.documentVersion === currentVersion) return true;
            
            // Match 'commit' when viewing untagged commits or commits that were tagged after comment creation
            if (comment.documentVersion === 'commit' && currentVersion !== 'commit') {
              // This handles the edge case where comment was created before version tagging
              return true;
            }
            
            return false;
          })
          .sort((a, b) => a.createDate?.seconds - b.createDate?.seconds);
      }
      
      // Standard version filtering (for legacy version system)
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
    
  




  },

  actions: {
    // Project permission checking (moved from getter to action for better practice)
    checkCanCreateProject() {
      return canUserCreateProject(this.user);
    },

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
        currentVersion: 'live',
        currentbranch:'main',
        currentCommit:null
      };
      this.favorites = [];
      this.tasks = [];
    },

    async userMigrate() {
      // Migration function to handle data structure changes between versions
      // This runs after user data loads and checks for migration needs
      const migrationSystem = new MigrationSystem(this);
      await migrationSystem.runMigrations();
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
        this.uiAlert({ type: 'error', message: MESSAGES.DEFAULT_PROJECT_SET_FAILED, autoClear: true });
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
          this.projects = [...this.projects, result.data]; // Ensure immutable update
          
          // Update user's projects list to include the new project safely
          if (!this.user.projects) {
            this.user.projects = [];
          }
          
          this.user.projects = addUserProject(this.user.projects, {
            projectId: result.data.id,
            role: USER_ROLES.ADMIN,
            status: PROJECT_STATUS.ACTIVE,
            isCreator: true
          });
          
          this.uiAlert({ type: 'success', message: result.message, autoClear: true });
          return result.data;
        } else {
          this.uiAlert({ type: 'error', message: result.message || MESSAGES.PROJECT_CREATE_FAILED, autoClear: true });
          return null;
        }
      } catch (error) {
        this.uiAlert({ type: 'error', message: MESSAGES.PROJECT_CREATE_FAILED, autoClear: true });
        console.error('Project creation error:', error);
        return null;
      } finally {
        this.loading.project = false;
      }
    },
    
    async projectSet(projectId, details = false) {
      if (!projectId) return false;

      // Check if user has access to this project using utility function
      if (!hasProjectAccess(this.user, projectId, this.projects)) {
        this.uiAlert({
          type: 'error',
          message: MESSAGES.PROJECT_ACCESS_DENIED,
          autoClear: true
        });
        return false;
      }

      console.log('projectId', projectId);
   
      try {
        this.project.id = projectId;
        const projectData = await Project.getById(projectId, true, true);
        
        if (!projectData) {
          throw new Error(`Project with ID ${projectId} not found`);
        }
        
        this.project = projectData;
        
        if (this.isUserLoggedIn) {
          await this.projectGetAllData();
          
          // Run migration after all project data is loaded
          await this.userMigrate();
        }

        return true;
      } catch (error) {
        console.error('Error setting project:', error);
        this.uiAlert({
          type: 'error',
          message: error.message || MESSAGES.PROJECT_DATA_LOAD_FAILED,
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
          message: MESSAGES.PROJECT_DATA_LOAD_FAILED,
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
      
      // Update local project users state to mark user as removed using immutable update
      if (this.project.users) {
        this.project.users = updateArrayItem(
          this.project.users, 
          user => user.userId === userId, 
          { status: PROJECT_STATUS.REMOVED }
        );
      }
    },

    async projectReinstateUser({userId, projectId}) {
      await Project.reinstateUser({userId, projectId});
      
      // Update local project users state to mark user as active using immutable update
      if (this.project.users) {
        this.project.users = updateArrayItem(
          this.project.users, 
          user => user.userId === userId, 
          { status: PROJECT_STATUS.ACTIVE }
        );
      }
    },

    async projectArchive(projectId) {
      try {
        const result = await Project.archive(projectId);
        
        if (result.success) {
          // Update local projects list to mark as archived using immutable update
          this.projects = updateArrayItem(this.projects, p => p.id === projectId, { archived: true });
          
          this.uiAlert({ 
            type: 'success', 
            message: result.message || MESSAGES.PROJECT_ARCHIVED_SUCCESS,
            autoClear: true 
          });
          
          return true;
        } else {
          this.uiAlert({ 
            type: 'error', 
            message: result.message || MESSAGES.PROJECT_ARCHIVE_FAILED,
            autoClear: true 
          });
          return false;
        }
      } catch (error) {
        this.uiAlert({ 
          type: 'error', 
          message: MESSAGES.PROJECT_ARCHIVE_FAILED,
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
          
          // Remove from user's projects list
          this.user.projects = removeUserProject(this.user.projects, projectId);
          
          // If this was the current project, switch to another project or trigger new user flow
          if (this.project.id === projectId) {
            await this.handleCurrentProjectDeleted();
          }
          
          this.uiAlert({ 
            type: 'success', 
            message: result.message || MESSAGES.PROJECT_DELETED_SUCCESS,
            autoClear: true 
          });
          
          return true;
        } else {
          this.uiAlert({ 
            type: 'error', 
            message: result.message || MESSAGES.PROJECT_DELETE_FAILED,
            autoClear: true 
          });
          return false;
        }
      } catch (error) {
        this.uiAlert({ 
          type: 'error', 
          message: MESSAGES.PROJECT_DELETE_FAILED,
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
          // Update local projects list to mark as unarchived using immutable update
          this.projects = updateArrayItem(this.projects, p => p.id === projectId, { archived: false });
          
          this.uiAlert({ 
            type: 'success', 
            message: result.message || MESSAGES.PROJECT_RESTORED_SUCCESS,
            autoClear: true 
          });
          
          return true;
        } else {
          this.uiAlert({ 
            type: 'error', 
            message: result.message || MESSAGES.PROJECT_RESTORE_FAILED,
            autoClear: true 
          });
          return false;
        }
      } catch (error) {
        this.uiAlert({ 
          type: 'error', 
          message: MESSAGES.PROJECT_RESTORE_FAILED,
          autoClear: true 
        });
        console.error('Project unarchive error:', error);
        return false;
      }
    },

    async handleCurrentProjectDeleted() {
      // Remove from user's projects list first  
      this.user.projects = removeUserProject(this.user.projects, this.project.id);
      
      // Find the next available non-archived project
      const availableProjects = this.projects.filter(p => !p.archived);
      
      if (availableProjects.length > 0) {
        // Set the first available project as default
        const nextProject = availableProjects[0];
        console.log('Switching to next project:', nextProject.name);
        
        try {
          // Update default project in database
          await this.userSetDefaultProject(nextProject.id);
          
          // Set the project and force a full refresh
          const result = await this.projectSet(nextProject.id, true);
          
          if (result) {
            // Force refresh of all project data to ensure components update
            await this.projectGetAllData();
            
            // Force reactive update for any components watching project state
            this.$patch({
              project: { ...this.project }
            });
            
            this.uiAlert({
              type: 'info', 
              message: MESSAGES.PROJECT_SWITCHED(nextProject.name),
              autoClear: true
            });
          } else {
            throw new Error('Failed to set new project');
          }
        } catch (error) {
          console.error('Error switching to next project:', error);
          // If we can't switch to another project, fall back to new user flow
          this.user.defaultProject = null;
          this.$patch({
            project: {
              id: null,
              folders: [],
              name: null,
              createdBy: null,
              users: [],
              invitation: [],
              projectRole: null,
            }
          });
          // Don't navigate here - let App.vue watcher handle it to avoid double navigation
        }
      } else {
        // No projects available, clear state and let App.vue handle navigation
        console.log('No projects available, clearing project state');
        this.user.defaultProject = null;
        this.$patch({
          project: {
            id: null,
            folders: [],
            name: null,
            createdBy: null,
            users: [],
            invitation: [],
            projectRole: null,
          }
        });
        
        this.uiAlert({
          type: 'info',
          message: MESSAGES.PROJECT_CREATE_PROMPT,
          autoClear: true
        });
        
        // Don't call router.push here - let App.vue watcher handle navigation
        // to avoid double navigation calls
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
          message: result.message || MESSAGES.DOCUMENT_CREATE_FAILED,
          autoClear: true 
        });
        throw new Error(result.message || MESSAGES.DOCUMENT_CREATE_FAILED);
      }
    },

    async documentsGetAll() {
      const documents = await Document.getAll(); 
      this.documents = documents;
      return documents;
    },

    async documentsSelect({ id, version = null, commitId = null }) {
      // Initialize selected with safe defaults
      this.selected = { 
        id: null,
        data: {},
        comments: [],
        versions: [],
        commits: [],
        isVersion: false,
        isCommit: false,
        currentVersion: 'live',
        currentCommitId: null,
        isLoading: true 
      };

      try {
        let selectedData;
        
        // Handle commit ID selection (new primary method)
        if (commitId) {
          selectedData = await Document.getDocById(id);
          
          // Find the specific commit
          const commit = selectedData.commits?.find(c => c.id === commitId);
          if (!commit) {
            throw new Error(`Commit with ID ${commitId} not found`);
          }
          
          // Use commit data to populate document
          selectedData.data = {
            name: commit.documentName || selectedData.data.name,
            content: commit.documentContent || commit.content || '',
            type: selectedData.data.type
          };
          
          selectedData.viewingCommit = commitId;
          selectedData.isCommit = true;
          selectedData.currentCommitId = commitId;
          selectedData.currentVersion = commit.versionNumber || 'commit';
        }
        // Handle version selection (backwards compatibility)
        else if (version) {
          let selectedBase = await Document.getDocById(id);
          
          // Use new getVersionContent method that handles both content-based and tag-based versions
          let selectedVersion;
          try {
            selectedVersion = await Document.getVersionContent(id, version);
          } catch (error) {
            // Fallback to old method for backwards compatibility
            console.warn('Falling back to legacy version loading for version:', version);
            selectedVersion = await Document.getDocVersion(id, version);
          }

          selectedBase.data = selectedVersion.content;
          if (selectedVersion.markedUpContent) {
            selectedBase.data.content = selectedVersion.markedUpContent;
            selectedBase.viewingMarkup = true;
          }
          selectedBase.viewingVersion = version;
          selectedData = selectedBase;
        } 
        // Handle live document (default)
        else {
          selectedData = await Document.getDocById(id);
          
          // Check and migrate document versions if needed (when document is opened)
          if (this.isUserLoggedIn ) {
            try {
              const migrationSystem = new MigrationSystem(this);
              await migrationSystem.checkDocumentMigrationOnOpen(selectedData);
            } catch (migrationError) {
              console.error('Document migration check failed:', migrationError);
              // Don't block document opening if migration fails
            }
          }
          
          // Auto-redirect demo users to latest commit
          if (!this.isUserLoggedIn && selectedData.commits && selectedData.commits.length > 0) {
            // Find the most recently created commit
            const sortedCommits = selectedData.commits
              .filter(c => c.createDate) // Only commits with createDate
              .sort((a, b) => {
                const aTime = a.createDate?.seconds || 0;
                const bTime = b.createDate?.seconds || 0;
                return bTime - aTime; // Most recent first
              });
            
            if (sortedCommits.length > 0) {
              const latestCommit = sortedCommits[0];
              // Redirect to the latest commit
              return { 
                redirectToCommit: latestCommit.id,
                documentId: id 
              };
            }
          }
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

        // Ensure commits array exists
        if (!selectedData.commits) {
          selectedData.commits = [];
        }

        
        this.selected = {
          ...selectedData,
          currentVersion: commitId ? (selectedData.currentVersion || 'commit') : (version || 'live'),
          currentCommitId: commitId || null,
          isVersion: !!version,
          isCommit: !!commitId
        };

        // Quick check if document might need migration (avoid unnecessary reads)
        if (this.isUserLoggedIn) {
          try {
            const migrationSystem = new MigrationSystem(this);
            await migrationSystem.checkSelectedDocumentMigration();
          } catch (migrationError) {
            console.error('Document migration check failed:', migrationError);
            // Don't block document opening if migration fails
          }
        }

        // Set loading to false after all operations complete
        this.selected.isLoading = false;
        
        // Check document versions status after selecting
        await this.documentsCheckVersionsStatus({ id: this.selected.id });
        
        return this.selected;
      } catch (error) {
        this.selected = {
          id: null,
          data: {},
          comments: [],
          versions: [],
          commits: [],
          isVersion: false,
          isCommit: false,
          currentVersion: 'live',
          currentCommitId: null,
          isLoading: false
        };
        console.error('Error selecting document:', error);
        throw error;
      }
    },

    async documentsCheckVersionsStatus({ id }) {
      try {
        // Get released versions from commits (commit-based versioning system)
        const releasedVersions = this.selected.commits
          ?.filter(commit => commit.versionNumber && commit.versionNumber.trim() !== '' && commit.released)
          ?.map(commit => commit.versionNumber) || [];

        const currentReleasedVersions = this.selected.data.releasedVersion || [];

        // Compare arrays by value using JSON.stringify (with sorting for consistent comparison)
        const releasedVersionsSorted = [...releasedVersions].sort();
        const currentReleasedVersionsSorted = [...currentReleasedVersions].sort();
        const arraysAreEqual = JSON.stringify(releasedVersionsSorted) === JSON.stringify(currentReleasedVersionsSorted);
        
        if (!arraysAreEqual || (this.selected.data.draft === true && currentReleasedVersions.length > 0)) {
          await this.updateDocumentReleasedVersions(id, releasedVersions);
        } else if (releasedVersions.length === 0 && (currentReleasedVersions.length > 0 || this.selected.data.draft === false)) {
          // Set draft status when no released versions exist
          await this.updateDocumentReleasedVersions(id, []);
        }
      } catch (error) {
        console.error('Error checking document versions status:', error);
      }
    },

    /**
     * Helper method to update document's releasedVersion and draft fields both in database and local state
     * This ensures consistency across the application when version data changes
     */
    async updateDocumentReleasedVersions(docId, releasedVersions) {
      try {
        const isDraft = releasedVersions.length === 0;
        
        // Update database fields
        const result1 = await Document.updateDocField(docId, 'releasedVersion', releasedVersions);
        const result2 = await Document.updateDocField(docId, 'draft', isDraft);
        
        if (result1.success && result2.success) {
          // Update the local selected document state immediately using immutable approach
          this.selected.data = {
            ...this.selected.data,
            releasedVersion: releasedVersions,
            draft: isDraft
          };
          
          // Update the document in the documents array to reflect changes using immutable approach
          const docIndex = this.documents.findIndex(doc => doc.id === docId);
          if (docIndex !== -1) {
            this.documents = this.documents.map((doc, index) => 
              index === docIndex 
                ? {
                    ...doc,
                    data: {
                      ...doc.data,
                      releasedVersion: releasedVersions,
                      draft: isDraft
                    }
                  }
                : doc
            );
          }
          
          console.log(`Updated document ${docId} releasedVersions:`, releasedVersions, `draft: ${isDraft}`);
        } else {
          console.error('Failed to update document version status:', result1.error || result2.error);
        }
      } catch (error) {
        console.error('Error updating document released versions:', error);
      }
    },

    async documentsDelete({ id }) {
      const result = await Document.deleteDocByID(id);
      
      if (result.success) {
        this.documents = this.documents.filter(doc => doc.id !== id);
      } else {
        this.uiAlert({ 
          type: 'error', 
          message: result.message || MESSAGES.DOCUMENT_DELETE_FAILED,
          autoClear: true 
        });
        throw new Error(result.message || MESSAGES.DOCUMENT_DELETE_FAILED);
      }
    },

    async documentsArchive({ id }) {
      const result = await Document.archiveDoc(id);
      
      if (result.success) {
        this.documents = this.documents.filter(doc => doc.id !== id);
      } else {
        this.uiAlert({ 
          type: 'error', 
          message: result.message || MESSAGES.DOCUMENT_ARCHIVE_FAILED,
          autoClear: true 
        });
        throw new Error(result.message || MESSAGES.DOCUMENT_ARCHIVE_FAILED);
      }
    },

    async documentsSave() {
      // Safety checks to prevent undefined errors
      if (!this.selected || !this.selected.id || !this.selected.data) {
        console.error('Cannot save document: selected document is invalid', this.selected);
        throw new Error(MESSAGES.INVALID_DOCUMENT);
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
          message: result.message || MESSAGES.DOCUMENT_SAVE_FAILED,
          autoClear: true 
        });
        throw new Error(result.message || MESSAGES.DOCUMENT_SAVE_FAILED);
      }
    },

    documentsUpdate(document) {
      this.selected = { ...this.selected, ...document };
    },

    // Comments Management
    async commentsAdd(comment) {
      if (!this.selected || !this.selected.id) {
        throw new Error(MESSAGES.NO_DOCUMENT_SELECTED);
      }
      if (!this.selected.comments) {
        this.selected.comments = [];
      }

      // Ensure comment is always associated with current document for proper filtering/sync
      if (!comment.documentId) {
        comment.documentId = this.selected.id;
      }
      
      // Note: documentVersion gets set based on currentVersion:
      // - 'live' -> null (shows on all versions)
      // - version number -> that specific version 
      // - 'commit' -> shows on untagged commits (may need special handling if commit gets tagged later)
      
      const result = await Document.createComment(this.selected.id, comment);
      
      if (result.success) {
        const newComment = result.data;
        newComment.createDate = { seconds: Math.floor(Date.now() / 1000) };
        this.selected.comments.push(newComment);
        return newComment;
      } else {
        this.uiAlert({ 
          type: 'error', 
          message: result.message || MESSAGES.COMMENT_CREATE_FAILED,
          autoClear: true 
        });
        throw new Error(result.message || MESSAGES.COMMENT_CREATE_FAILED);
      }
    },

    async commentsAddReply({ parentId, comment }) {
      if (!this.selected || !this.selected.id) {
        throw new Error(MESSAGES.NO_DOCUMENT_SELECTED);
      }
      if (!this.selected.comments) {
        this.selected.comments = [];
      }

      // Ensure comment is always associated with current document for proper filtering/sync
      if (!comment.documentId) {
        comment.documentId = this.selected.id;
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
            }, ALERT_FADE_OUT_TIMEOUT);
          }
        }, ALERT_AUTO_CLEAR_TIMEOUT);
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
        this.uiAlert({type: 'error', message: MESSAGES.FOLDER_EXISTS_ERROR, autoClear: true});
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
          this.uiAlert({type: 'success', message: MESSAGES.FOLDER_UPDATE_SUCCESS, autoClear: true});
          return true;
        } else {
          // Restore original state on failure
          this.project.folders = originalFolders;
          this.uiAlert({ 
            type: 'error', 
            message: result.message || MESSAGES.FOLDER_ADD_FAILED,
            autoClear: true 
          });
          throw new Error(MESSAGES.FOLDER_ADD_FAILED);
        }
      } catch (error) {
        // Restore original state on any error
        this.project.folders = originalFolders;
        if (error.message === MESSAGES.FOLDER_ADD_FAILED) {
          throw error;
        }
        throw new Error(MESSAGES.FOLDER_ADD_FAILED);

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
          this.uiAlert({type: 'error', message: MESSAGES.FOLDER_REMOVE_FAILED, autoClear: true});
          throw new Error(MESSAGES.FOLDER_REMOVE_FAILED);
        }
      } catch (error) {
        // Restore original state on any error
        this.project.folders = originalFolders;
        if (error.message === MESSAGES.FOLDER_REMOVE_FAILED) {
          throw error;
        }
        throw new Error(MESSAGES.FOLDER_REMOVE_FAILED);
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

    async createVersion(newVersion, options = {}) {
      // Use provided content or current selected document data
      const versionData = options.content ? { 
        name: this.selected.data.name,
        content: options.content,
        type: this.selected.data.type
      } : this.selected.data;
      
      const result = await Document.createVersion(
        this.selected.id, 
        versionData, 
        newVersion, 
        options.fromCommitId, 
        options.released === true
      );
      
      if (result.success) {
        // If this was created from a commit, update the local commits array
        if (options.fromCommitId && this.selected.commits) {
          const commitIndex = this.selected.commits.findIndex(c => c.id === options.fromCommitId);
          if (commitIndex !== -1) {
            // Create new array with updated commit object to ensure reactivity
            this.selected.commits = this.selected.commits.map((commit, index) => 
              index === commitIndex 
                ? { ...commit, versionNumber: newVersion, released: options.released === true }
                : commit
            );
          }
        }
        
        // Always recalculate releasedVersions based on all commits after version creation/update
        const releasedVersions = this.selected.commits
          ?.filter(commit => commit.versionNumber && commit.versionNumber.trim() !== '' && commit.released)
          ?.map(commit => commit.versionNumber) || [];
        
        // Update document releasedVersion field directly
        await this.updateDocumentReleasedVersions(this.selected.id, releasedVersions);
        
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




    async toggleCommitVersionRelease({ commitId, released }) {
      try {
        // Update the commit's released status
        const result = await Commit.setCommitParams(this.selected.id, commitId, {
          released: released
        });
        
        if (!result.success) {
          throw new Error(result.message || 'Failed to update commit');
        }
        
        // Update local commits array using immutable approach for proper reactivity
        if (this.selected.commits) {
          const commitIndex = this.selected.commits.findIndex(c => c.id === commitId);
          if (commitIndex !== -1) {
            // Create new array with updated commit object to ensure reactivity
            this.selected.commits = this.selected.commits.map((commit, index) => 
              index === commitIndex 
                ? { ...commit, released: released }
                : commit
            );
          }
        }
        
        // Calculate new releasedVersions based on all released version commits
        const releasedVersions = this.selected.commits
          ?.filter(commit => commit.versionNumber && commit.versionNumber.trim() !== '' && commit.released)
          ?.map(commit => commit.versionNumber) || [];
        
        // Update document releasedVersion field directly
        await this.updateDocumentReleasedVersions(this.selected.id, releasedVersions);
        
        const commit = this.selected.commits?.find(c => c.id === commitId);
        const versionNumber = commit?.versionNumber;
        
        this.uiAlert({ 
          type: 'success', 
          message: `Version ${versionNumber} ${released ? 'released' : 'unreleased'}`,
          autoClear: true 
        });
        
        return { commitId, versionNumber, released };
      } catch (error) {
        this.uiAlert({ 
          type: 'error', 
          message: error.message || 'Failed to update version release status',
          autoClear: true 
        });
        throw error;
      }
    },

    async removeCommitVersionTag({ commitId, versionNumber }) {
      try {
        // Remove version tagging from commit
        const result = await Commit.setCommitParams(this.selected.id, commitId, {
          versionNumber: null,
          released: false
        });
        
        if (!result.success) {
          throw new Error(result.message || 'Failed to update commit');
        }
        
        // Update local commits array using immutable approach for proper reactivity
        if (this.selected.commits) {
          const commitIndex = this.selected.commits.findIndex(c => c.id === commitId);
          if (commitIndex !== -1) {
            // Create new array with updated commit object to ensure reactivity
            this.selected.commits = this.selected.commits.map((commit, index) => 
              index === commitIndex 
                ? { ...commit, versionNumber: null, released: false }
                : commit
            );
          }
        }
        
        // Calculate new releasedVersions based on remaining released version commits
        const releasedVersions = this.selected.commits
          ?.filter(commit => commit.versionNumber && commit.versionNumber.trim() !== '' && commit.released)
          ?.map(commit => commit.versionNumber) || [];
        
        // Update document releasedVersion field directly
        await this.updateDocumentReleasedVersions(this.selected.id, releasedVersions);
        
        this.uiAlert({ 
          type: 'success', 
          message: `Version ${versionNumber} removed`,
          autoClear: true 
        });
        
        return { commitId, versionNumber };
      } catch (error) {
        this.uiAlert({ 
          type: 'error', 
          message: error.message || 'Failed to remove version tag',
          autoClear: true 
        });
        throw error;
      }
    },

    // Commit Management
    async createCommit(commitMessage, params = {}) {
      // get last commit
      const currentCommit = this.currentCommit;
      const result = await Commit.create(this.selected.id, this.selected.data, commitMessage, currentCommit?.id, params);
      
      if (result.success) {
        // Update the commits array in the selected document
        if (!this.selected.commits) {
          this.selected.commits = [];
        }
        this.selected.commits.push(result.data);
        
        // If this commit was created with version information, update document status immediately
        if (params.versionNumber) {
          // Calculate new releasedVersions based on all released version commits
          const releasedVersions = this.selected.commits
            ?.filter(commit => commit.versionNumber && commit.versionNumber.trim() !== '' && commit.released)
            ?.map(commit => commit.versionNumber) || [];
          
          // Update document releasedVersion field directly
          await this.updateDocumentReleasedVersions(this.selected.id, releasedVersions);
        }
        
        const successMessage = params.versionNumber 
          ? `Version ${params.versionNumber} created with commit ${result.data.commitId}`
          : `Commit ${result.data.commitId} created successfully`;
          
        this.uiAlert({ 
          type: 'success', 
          message: successMessage,
          autoClear: true 
        });
        
        return result.data;
      } else {
        this.uiAlert({ 
          type: 'error', 
          message: result.message || 'Failed to create commit',
          autoClear: true 
        });
        throw new Error(result.message || 'Failed to create commit');
      }
    },

    hasUncommittedChanges() {
      // Check if there are changes since the last commit
      if (!this.selected || !this.selected.id) {
        return false;
      }

      const currentCommit = this.currentCommit;
      
      if (!currentCommit) {
        // No commits exist, so any content means there are uncommitted changes
        return !!(this.selected.data?.content && this.selected.data.content.trim() !== '');
      }

      // Compare current content with most recent commit content
      const mostRecentContent = currentCommit.documentContent || '';
      const currentContent = this.selected.data?.content || '';
      const mostRecentName = currentCommit.documentName || '';
      const currentName = this.selected.data?.name || '';

      return mostRecentContent !== currentContent || mostRecentName !== currentName;
    },

    getMostRecentCommit() {
      if (!this.selected) return null;
      return this.currentCommit;
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
          message: result.message || MESSAGES.CHAT_LOAD_FAILED,
          autoClear: true 
        });
        throw new Error(result.message || MESSAGES.CHAT_LOAD_FAILED);
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
          message: MESSAGES.CHATS_LOAD_FAILED,
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

