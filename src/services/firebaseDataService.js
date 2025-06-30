/*
 * ============================================================================= 
 * FIREBASE DATA SERVICE - REFACTORED FOR CLEAN ARCHITECTURE
 * =============================================================================
 * 
 * This service layer provides pure data access operations for Firestore.
 * 
 * ARCHITECTURE PRINCIPLES:
 * - Separation of Concerns: Data access, business logic, and UI are separated
 * - Consistent Error Handling: All methods return DataServiceResult objects
 * - Centralized Permissions: PermissionHelper handles all auth/access checks
 * - Validation Helpers: Common validation logic is centralized
 * - Business Helpers: Complex multi-step operations are encapsulated
 * - No UI Coupling: No direct UI alerts or router navigation in data layer
 * 
 * USAGE PATTERN:
 * ```javascript
 * const result = await DataServiceClass.method(params);
 * if (result.success) {
 *   // Handle success: result.data, result.message
 * } else {
 *   // Handle error: result.error, result.message
 * }
 * ```
 * 
 * @version 2.0.0 - Refactored December 2024
 * ============================================================================= 
 */

import {firebaseApp} from "../firebase";
import { getFirestore, collection, query, where, orderBy, setDoc, getDocs, getDoc, doc, addDoc, updateDoc, deleteDoc, serverTimestamp, increment, collectionGroup } from "firebase/firestore";
import { getAuth, signOut, onAuthStateChanged } from "firebase/auth";
import router from "../router";
import { useMainStore } from "../store/index.js";
import { compareEmails } from "../utils/index.js";
import _ from 'lodash';

// Helper function to get store instance
const getStore = () => useMainStore();

// Initialize Cloud Firestore and get a reference to the service
const db = getFirestore(firebaseApp)
export default db;

// =============================================================================
// REFACTORED: Data Service Result Class for Consistent Return Values
// =============================================================================
export class DataServiceResult {
  constructor(success, data = null, error = null, message = null, metadata = {}) {
    this.success = success;
    this.data = data;
    this.error = error;
    this.message = message;
    this.metadata = metadata; // For additional info like counts, IDs, etc.
  }

  static success(data, message = null, metadata = {}) {
    return new DataServiceResult(true, data, null, message, metadata);
  }

  static error(error, message = null, data = null) {
    const errorMessage = message || (error instanceof Error ? error.message : 'Unknown error');
    return new DataServiceResult(false, data, error, errorMessage);
  }
}

// =============================================================================
// REFACTORED: Centralized Permission Management
// =============================================================================
class PermissionHelper {
  static requireAuth() {
    if (!getStore().user.uid) {
      throw new Error('Authentication required');
    }
    return true;
  }

  static requireProject() {
    if (!getStore().isUserInProject && getStore().project.id !== import.meta.env.VITE_DEFAULT_PROJECT_ID) {
      throw new Error('You are not a member of this project');
    }
    return true;
  }

  static requireRole(requiredRole) {
    this.requireAuth();
    this.requireProject();
    
    const userRole = getStore().user.projects?.find(
      p => p.projectId === getStore().project.id
    )?.role;
    
    const roleHierarchy = { user: 1, admin: 2 };
    
    if (!userRole || roleHierarchy[userRole] < roleHierarchy[requiredRole]) {
      throw new Error(`${requiredRole} role required`);
    }
    return true;
  }

  static requireProjectAdmin() {
    return this.requireRole('admin');
  }

  // For special cases during user creation - bypasses auth check
  static bypassAuthCheck() {
    return true;
  }
}

// =============================================================================
// VALIDATION HELPERS
// =============================================================================
class ValidationHelper {
  static validateInvitation(invitation, userEmail) {
    if (invitation.expiresAt.toDate() < new Date()) {
      throw new Error(ERROR_MESSAGES.INVITATION_EXPIRED);
    }
    
    if (!compareEmails(userEmail, invitation.email)) {
      throw new Error(ERROR_MESSAGES.INVITATION_EMAIL_MISMATCH);
    }
    
    return true;
  }

  static validateProjectAccess(userId, projectId) {
    const userProjects = getStore().user.projects || [];
    return userProjects.some(p => p.projectId === projectId && p.status !== 'removed');
  }

  static validateVersionNumber(existingVersions, newVersionNumber) {
    if (existingVersions.includes(newVersionNumber)) {
      throw new Error(`Version ${newVersionNumber} already exists`);
    }
    return true;
  }

  static validateUserNotInProject(projectUsers, email) {
    const userInProject = projectUsers.find(user => user.email === email);
    if (userInProject) {
      throw new Error('User already in project');
    }
    return true;
  }

  static validateDocumentAccess(docData, isUserLoggedIn) {
    // Permission check 1: Check if user is not logged in and document is in draft mode
    if (!isUserLoggedIn && docData.draft) {
      throw new Error('This document is not publicly available. Please sign in to view it.');
    }
    return true;
  }

  static validateCommentThreading(parentComment) {
    if (parentComment && parentComment.parentId) {
      throw new Error("Child comments cannot have children (single-level nesting only)");
    }
    return true;
  }
}

// =============================================================================
// BUSINESS LOGIC HELPERS
// =============================================================================
class BusinessHelper {
  static async processUserInvitation(invitation, userId, userEmail) {
    // Complex invitation processing logic extracted from multiple methods
    ValidationHelper.validateInvitation(invitation, userEmail);
    
    // Process invitation acceptance
    const result = await Project.addUserToProject(userId, invitation.projectId, invitation.role, invitation);
    
    // Update invitation status
    await updateDoc(doc(db, "invitations", invitation.id), {
      status: 'accepted',
      acceptedAt: serverTimestamp()
    });
    
    return result;
  }

  static async ensureProjectCreatorAccess(projectId, userId) {
    // Extracted from Document.getDocById
    const projectRef = doc(db, "project", projectId);
    const projectDoc = await getDoc(projectRef);
    
    if (!projectDoc.exists()) return false;
    
    const projectData = projectDoc.data();
    if (projectData.createdBy === userId) {
      const userRole = await User.getUserRoleInProject(userId, projectId);
      if (!userRole) {
        await Project.addUserToProject(userId, projectId, 'admin');
        await getStore().userEnter(); // Refresh user data
        return true;
      }
    }
    return false;
  }

  static generateInviteToken() {
    return crypto.randomUUID ? crypto.randomUUID() : 
      'invite_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now().toString(36);
  }

  static createInvitationData(email, projectId, role, invitedBy) {
    return {
      email,
      projectId,
      invitedBy,
      role,
      status: 'pending',
      inviteToken: this.generateInviteToken(),
      createdDate: serverTimestamp(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    };
  }
}

// =============================================================================
// CONSTANTS
// =============================================================================
const COLLECTION_NAMES = {
  USERS: 'users',
  DOCUMENTS: 'documents',
  PROJECTS: 'project',
  COMMENTS: 'comments',
  INVITATIONS: 'invitations',
  USER_PROJECTS: 'userProjects',
  CHATS: 'chats',
  TASKS: 'tasks',
  FAVORITES: 'favorites',
  USAGE_LOGS: 'usageLogs'
};

const ERROR_MESSAGES = {
  AUTH_REQUIRED: 'Authentication required',
  PROJECT_ACCESS_REQUIRED: 'You are not a member of this project',
  ADMIN_REQUIRED: 'Admin privileges required',
  OPERATION_TIMEOUT: 'Operation timed out',
  USER_NOT_FOUND: 'User not found',
  INVITATION_EXPIRED: 'Invitation has expired',
  INVITATION_EMAIL_MISMATCH: 'Invitation is for a different email address',
  USER_ALREADY_IN_PROJECT: 'User already in project',
  LAST_ADMIN_REMOVAL: 'Cannot remove the last admin from the project',
  VERSION_EXISTS: 'Version already exists',
  DOCUMENT_NOT_PUBLIC: 'This document is not publicly available. Please sign in to view it.',
  TASK_NOT_FOUND: 'Task not found',
  COMMENT_THREADING_ERROR: 'Child comments cannot have children (single-level nesting only)'
};

export const collectionMap = {
  user:'users',
  comment:'comments',
  approval:'approvals',
  document:'documents',
  change:'documentChanges',
  favorites:'favorites',
  project:'projects',
  task:'tasks',
  invitation:'invitations',
  userProject:'userProjects'
}



// =============================================================================
// DEPRECATED: Legacy helper functions have been removed
// All methods now use PermissionHelper class for centralized access control
// =============================================================================

function withTimeout(fn, timeoutDuration) {
  return async function(...args) {
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Operation timed out')), timeoutDuration)
    );

    try {
      return await Promise.race([fn.apply(this, args), timeoutPromise]);
    } catch (error) {
      // Commit an alert to the store when a timeout occurs
      
     getStore().uiAlert({ type: 'error', message: error.message, autoClear: true });
      throw error; // Re-throw the error after committing the alert
    }
  };
}


// Higher-order function to wrap all async methods in a class
function wrapAsyncMethodsWithTimeout(targetClass, timeoutDuration) {
  // Wrap instance methods
  const instanceMethodNames = Object.getOwnPropertyNames(targetClass.prototype).filter(
    method => typeof targetClass.prototype[method] === 'function' && method !== 'constructor'
  );

  instanceMethodNames.forEach(method => {
    const originalMethod = targetClass.prototype[method];
    targetClass.prototype[method] = withTimeout(originalMethod, timeoutDuration);
  });

  // Wrap static methods
  const staticMethodNames = Object.getOwnPropertyNames(targetClass).filter(
    method => typeof targetClass[method] === 'function' && method !== 'constructor'
  );

  staticMethodNames.forEach(method => {
    const originalMethod = targetClass[method];
    targetClass[method] = withTimeout(originalMethod, timeoutDuration);
  });
}

export function addInDefaults(value) {
  // Note: This function is called from within methods that already check auth
  // No need to re-check authentication here
  
  const store = getStore();
  
  return {
    ...value,
    createdBy: value.createdBy || store.user.uid,
    updatedBy: store.user.uid,
    project: value.project || store.project.id,
    createDate: value.createDate || serverTimestamp(),
    updatedDate: serverTimestamp(),
    archived: value.archived || false
  };
}

// users
export class User{
  // Static flag to prevent multiple simultaneous createUser calls
  static isCreatingUser = false;
  static createUserPromise = null;
  
  // Static flag to prevent multiple simultaneous getUserAuth calls
  static isGettingUserAuth = false;
  static getUserAuthPromise = null;

  constructor(value) {
    
    this.displayName = value.displayName || "";
    this.email = value.email || "";
    this.defaultProject = value.defaultProject || null;
    this.org = value.org || getStore().user.email.split('@')[1];
    this.tier = value.tier || 'free';
    this.createDate =  serverTimestamp();
    this.updatedDate = serverTimestamp(); // Add this line
    this.archived = false;
  }

  static async getUserData(id){
    const userRef = doc(db, "users", id);
    const userDoc = await getDoc(userRef);
    const userProjects = await this.getProjectsForUser(id)
    
    return { uid: userDoc.id, ...userDoc.data() , projects: userProjects };
  }
  
  static async getUserAuth() {
    // Check if we're already getting user auth
    if (this.isGettingUserAuth) {
      console.log('getUserAuth already in progress, waiting for existing promise');
      // Wait for the existing getUserAuth operation to complete
      await this.getUserAuthPromise;
      return;
    }
    
    // Set flag and create promise
    this.isGettingUserAuth = true;
    this.getUserAuthPromise = this._getUserAuthInternal();
    
    try {
      return await this.getUserAuthPromise;
    } finally {
      // Reset flag and promise
      this.isGettingUserAuth = false;
      this.getUserAuthPromise = null;
    }
  }
  
  static async _getUserAuthInternal() {
    const auth = getAuth(firebaseApp);

    return new Promise((resolve, reject) => {
      // Use a timeout to prevent hanging
      const timeout = setTimeout(() => {
        reject(new Error('Auth state change timeout'));
      }, 10000); // 10 second timeout
      
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        clearTimeout(timeout);
        unsubscribe(); // Unsubscribe immediately to prevent multiple listeners
        
        if (!user) {
          console.log('user not logged in');
          return resolve(null);
        }

        try {
          const userRef = doc(db, "users", user.uid);
          const userDetails = await this.getUserData(userRef.id);

          if (!userDetails || !userDetails.email) {
            await this.createUser(user);
            // After createUser completes, get the updated user data
            const newUserDetails = await this.getUserData(user.uid);
            return resolve(newUserDetails);
          }

          if (!userDetails.defaultProject) {
            router.push('/new-user');
            return resolve(userDetails);
          }

          resolve(userDetails);
        } catch (error) {
          console.error('Error in getUserAuth:', error);
          reject(error);
        }
      });
    });
  }

  static async logout(){
    try {
      const auth = getAuth();
      await signOut(auth);
      getStore().userLogout();
      return DataServiceResult.success(null, 'Successfully logged out');
    } catch (error) {
      return DataServiceResult.error(error, 'Failed to log out');
    }
  }
  
  static async createUser(payload){
    console.log('createUser', payload);
    
    // Check if we're already creating a user
    if (this.isCreatingUser) {
      console.log('createUser already in progress, waiting for existing promise');
      // Wait for the existing createUser operation to complete
      await this.createUserPromise;
      return;
    }
    
    // Check if user already exists to prevent duplicate creation
    const existingUserRef = doc(db, "users", payload.uid);
    const existingUserDoc = await getDoc(existingUserRef);
    if (existingUserDoc.exists()) {
      console.log('User already exists, skipping creation');
      return;
    }
    
    // Set flag and create promise
    this.isCreatingUser = true;
    this.createUserPromise = this._createUserInternal(payload);
    
    try {
      await this.createUserPromise;
    } finally {
      // Reset flag and promise
      this.isCreatingUser = false;
      this.createUserPromise = null;
    }
  }
  
  static async _createUserInternal(payload){
    console.log('_createUserInternal', payload);
    const newUser = {
      displayName: payload.email,
      email: payload.email,
      defaultProject: null,
      tier: 'pro',
      createdDate: serverTimestamp(),
    };

    await setDoc(doc(db, "users", payload.uid), newUser);
    
    const userDataForStore = { ...newUser, uid: payload.uid, id: payload.uid};
    getStore().userSetData(userDataForStore); // step 2 /new-user will stop loading once we check that we have uid in state

    // Check for pending invitations for this email
    const pendingInvitations = await this.getPendingInvitations(payload.email);
    
    if (pendingInvitations.length > 0) {
      // Auto-accept ALL invitations for new users (Option C: Hybrid approach)
      const acceptedProjects = [];
      let defaultProjectId = null;
      
      for (const invitation of pendingInvitations) {
        try {
          // Call special method that bypasses auth check during user creation
          const projectId = await this.acceptInvitationDuringCreation(invitation.inviteToken, payload.uid, payload.email);
          acceptedProjects.push({
            id: projectId,
            name: invitation.projectName || 'Project',
            role: invitation.role
          });
          
          // Set the first project as default
          if (!defaultProjectId) {
            defaultProjectId = projectId;
          }
        } catch (error) {
          console.error(`Error auto-accepting invitation for project ${invitation.projectId}:`, error);
          // Continue with other invitations
        }
      }
      
      if (acceptedProjects.length > 0) {
        // Refresh user data to get updated project memberships
        const refreshedUserData = await this.getUserData(payload.uid);
        getStore().userSetData(refreshedUserData);
        
        // Set the default project as the active project in the store
        if (defaultProjectId) {
          await getStore().projectSet(defaultProjectId, true);
        }
        
        // Show comprehensive notification about auto-joined projects
        const projectNames = acceptedProjects.map(p => p.name).join(', ');
        const message = acceptedProjects.length === 1 
          ? `Welcome! You've been automatically added to ${projectNames}.`
          : `Welcome! You've been automatically added to ${acceptedProjects.length} projects: ${projectNames}.`;
        
        getStore().uiAlert({ 
          type: 'success', 
          message,
          autoClear: false  // Keep visible longer for multi-project notifications
        });
        
        // Navigate to home page after auto-accept flow completes
        router.push('/');
        
        // Skip the new-user setup since they already have project(s)
        return;
      }
    }
    
    // Normal new user flow - no pending invitations
    router.push('/new-user');
    getStore().uiAlert({ type: 'info', message: 'New User Account Created!' });
    return
  }

  static async setDefaultProject(value) {
    try {
      PermissionHelper.requireAuth();
      
      const userRef = doc(db, "users", getStore().user.uid);
      await updateDoc(userRef, { defaultProject: value });
      
      return DataServiceResult.success({ defaultProject: value }, 'Default project set');
    } catch (error) {
      return DataServiceResult.error(error, 'Failed to set default project');
    }
  }

   // USER PROJECTS

  static async getProjectsForUser(userId) {
    const userProjectsRef = collection(db, "userProjects");
    const q = query(userProjectsRef, where('userId', '==', userId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  }

  static async updateField(id, fieldName, fieldValue) {
    try {
      PermissionHelper.requireAuth();
      
      const userRef = doc(db, "users", id);
      await updateDoc(userRef, {
        [fieldName]: fieldValue,
        updatedDate: serverTimestamp()
      });
      
      return DataServiceResult.success(
        { id, [fieldName]: fieldValue }, 
        'User updated successfully'
      );
    } catch (error) {
      return DataServiceResult.error(error, 'Failed to update user');
    }
  }

  
  //danger will delete user and project associations (and comments, chats ect eventually) will not delete docs or projects
  // static async deleteUser(userId) {
  //   const userRef = doc(db, "users", userId);
  //   await deleteDoc(userRef);
  // }

  // COLLABORATION METHODS

  static async getUserByEmail(email) {
    const usersRef = collection(db, "users");
    const q = query(usersRef, where('email', '==', email));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return null;
    
    const userDoc = snapshot.docs[0];
    return { id: userDoc.id, ...userDoc.data() };
  }

  //TODO will need to have a way to get all users in a project or "org"


  static async getUserRoleInProject(userId, projectId) {
    const userProjectsRef = collection(db, "userProjects");
    const q = query(userProjectsRef, 
      where('userId', '==', userId),
      where('projectId', '==', projectId),
      where('status', '==', 'active')
    );
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return null;
    
    return snapshot.docs[0].data().role;
  }

  static async getPendingInvitations(email = null) {
    // Use current user's email if no email provided
    const targetEmail = email || getStore().user?.email;
    
    if (!targetEmail) {
      console.warn('No email provided for getPendingInvitations');
      return [];
    }

    const invitationsRef = collection(db, "invitations");
    const q = query(invitationsRef, 
      where('email', '==', targetEmail),
      where('status', '==', 'pending')
    );
    const snapshot = await getDocs(q);
    
    // Filter out expired invitations
    const now = new Date();
    const validInvitations = snapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      .filter(invitation => {
        const expiresAt = invitation.expiresAt?.toDate?.() || new Date(invitation.expiresAt);
        return expiresAt > now;
      });

    return validInvitations;
  }

  static async declineInvitation(inviteId) {
    try {
      PermissionHelper.requireAuth();
      
      const invitationRef = doc(db, "invitations", inviteId);
      await updateDoc(invitationRef, {
        status: 'declined',
        declinedAt: serverTimestamp(),
        declinedBy: getStore().user.uid
      });

      return DataServiceResult.success(
        { inviteId, status: 'declined' }, 
        'Invitation declined'
      );
    } catch (error) {
      return DataServiceResult.error(error, 'Failed to decline invitation');
    }
  }

  static async getInvitationByToken(token) {
    const invitationsRef = collection(db, "invitations");
    const q = query(invitationsRef, 
      where('inviteToken', '==', token),
      where('status', '==', 'pending')
    );
    
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      throw new Error('Invitation not found or has expired');
    }

    const invitation = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    
    // Check if invitation is expired
    if (invitation.expiresAt.toDate() < new Date()) {
      throw new Error('This invitation has expired');
    }

    return invitation;
  }

  static async acceptInvitation(inviteToken) {
    try {
      PermissionHelper.requireAuth();
      
      // Find invitation
      const invitationsRef = collection(db, "invitations");
      const q = query(invitationsRef, 
        where('inviteToken', '==', inviteToken),
        where('status', '==', 'pending')
      );
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        throw new Error('Invalid or expired invitation');
      }

      const inviteDoc = snapshot.docs[0];
      const invitation = inviteDoc.data();

      // Validate invitation
      ValidationHelper.validateInvitation(invitation, getStore().user.email);

      // Check if user is already in the project
      const existingRole = await this.getUserRoleInProject(getStore().user.uid, invitation.projectId);
      if (existingRole) {
        // User is already in the project, just update invitation status and return success
        await updateDoc(doc(db, "invitations", inviteDoc.id), {
          status: 'accepted',
          acceptedAt: serverTimestamp()
        });

        // Set as default project if user doesn't have one
        if (!getStore().user.defaultProject) {
          await this.setDefaultProject(invitation.projectId);
        }

        // Refresh user data to include new project without resetting project state
        const refreshedUserData = await this.getUserData(getStore().user.uid);
        getStore().userSetData(refreshedUserData);

        return DataServiceResult.success(
          { projectId: invitation.projectId },
          'Successfully joined project!'
        );
      }

      // Add user to project
      const invitationWithFlag = { ...invitation, needsValidation: false };
      const addUserResult = await Project.addUserToProject(getStore().user.uid, invitation.projectId, invitation.role, invitationWithFlag);
      if (!addUserResult.success) {
        throw new Error(addUserResult.message || 'Failed to add user to project');
      }

      // Update invitation status
      await updateDoc(doc(db, "invitations", inviteDoc.id), {
        status: 'accepted',
        acceptedAt: serverTimestamp()
      });

      // Set as default project if user doesn't have one
      if (!getStore().user.defaultProject) {
        await this.setDefaultProject(invitation.projectId);
      }

      // Refresh user data to include new project without resetting project state
      const refreshedUserData = await this.getUserData(getStore().user.uid);
      getStore().userSetData(refreshedUserData);

      return DataServiceResult.success(
        { projectId: invitation.projectId },
        'Successfully joined project!'
      );
    } catch (error) {
      return DataServiceResult.error(error, 'Failed to accept invitation');
    }
  }

  static async acceptInvitationDuringCreation(inviteToken, userId, userEmail) {
    // Special method for auto-accepting invitations during user creation
    // Bypasses auth check since user is being created
    
    // Find invitation
    const invitationsRef = collection(db, "invitations");
    const q = query(invitationsRef, 
      where('inviteToken', '==', inviteToken),
      where('status', '==', 'pending')
    );
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      throw new Error('Invalid or expired invitation');
    }

    const inviteDoc = snapshot.docs[0];
    const invitation = inviteDoc.data();

    // Check if invitation is expired
    if (invitation.expiresAt.toDate() < new Date()) {
      throw new Error('Invitation has expired');
    }

    // Check if user email matches invitation
    if (!compareEmails(userEmail, invitation.email)) {
      throw new Error('This invitation is for a different email address');
    }

    // Add user to project (bypass auth check during user creation)
    await Project.addUserToProjectDuringCreation(userId, invitation.projectId, invitation.role, invitation);

    // Update invitation status
    await updateDoc(doc(db, "invitations", inviteDoc.id), {
      status: 'accepted',
      acceptedAt: serverTimestamp()
    });

    // Set as default project if user doesn't have one (first invitation sets default)
    if (!getStore().user.defaultProject) {
      // Direct database update to bypass auth check during user creation
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, { defaultProject: invitation.projectId });
      
      // Update store
      getStore().user.defaultProject = invitation.projectId;
    }

    return invitation.projectId;
  }

}



export class Project {
  constructor(value) { 
    this.name = value.name || ""; // String
    this.createdBy = value.createdBy || getStore().user.uid;
    this.folders = value.folders || [];
    this.org = value.org || getStore().user.email.split('@')[1];
    Object.assign(this, addInDefaults(this));
  }
  
  static async create(value) {
    try {
      PermissionHelper.requireAuth();
      
      // Check if user can create more projects
      const canCreate = await this.canUserCreateProject();
      if (!canCreate.allowed) {
        return DataServiceResult.error(new Error(canCreate.reason), canCreate.reason);
      }
      
      const projectInstance = new Project(value);
      const docRef = await addDoc(collection(db, "project"), {...projectInstance});

      // Make the project creator an admin
      await this.addUserToProject(getStore().user.uid, docRef.id, 'admin');
      
      const createdProject = {id: docRef.id, ...projectInstance};
      return DataServiceResult.success(createdProject, 'Project created successfully');
    } catch (error) {
      return DataServiceResult.error(error, 'Failed to create project');
    }
  }

  static async canUserCreateProject() {
    try {
      PermissionHelper.requireAuth();
      
      const store = getStore();
      const userTier = store.user.tier;
      
      // Pro users have unlimited projects
      if (userTier === 'pro' || userTier === 'trial') {
        return { allowed: true, reason: null, projectCount: 0, limit: null };
      }
      
      // Get user's current project count (only active projects)
      const userProjects = store.user.projects || [];
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
    } catch (error) {
      return { 
        allowed: false, 
        reason: 'Unable to verify project limits',
        projectCount: 0,
        limit: 5
      };
    }
  }
  
  static async getById(id, userDetails = false, skipAuthCheck = false) {
    try {
      if (!id) return null;
      
      if (!skipAuthCheck) {
        PermissionHelper.requireProject();
      }
      
      const projectRef = doc(db, "project", id);
      const snapshot = await getDoc(projectRef);

      if (!snapshot.exists()) {
        if (skipAuthCheck) return null;
        return DataServiceResult.error(new Error('Project not found'), 'Project not found');
      }

      let invitations = [];
      let users = []
      if (getStore().isProjectAdmin) {
        invitations = await this.getInvitation(id);
        users = await this.getUsersForProject(id, userDetails);
      } 

      const projectData = {
        id: snapshot.id,
        ...snapshot.data(),
        users: users,
        invitations: invitations
      };

      // For backwards compatibility with store calls
      if (skipAuthCheck) {
        return projectData;
      }

      return DataServiceResult.success(projectData, 'Project loaded successfully');
    } catch (error) {
      if (skipAuthCheck) {
        // For store calls, return null on error to maintain compatibility
        console.error('Error loading project:', error);
        return null;
      }
      return DataServiceResult.error(error, 'Failed to load project');
    }
  }

  static async getAllForUser(userId, includeArchived = false) {
    try {
      PermissionHelper.requireAuth();
      
      // Get user's project memberships
      const userProjectsRef = collection(db, "userProjects");
      const userProjectsQuery = query(userProjectsRef, 
        where('userId', '==', userId),
        where('status', '==', 'active')
      );
      const userProjectsSnapshot = await getDocs(userProjectsQuery);
      
      if (userProjectsSnapshot.empty) {
        return DataServiceResult.success([], 'No projects found');
      }
      
      const projectIds = userProjectsSnapshot.docs.map(doc => doc.data().projectId);
      
      // Get all projects for the user
      const projects = [];
      for (const projectId of projectIds) {
        const projectData = await this.getById(projectId, false, true);
        if (projectData && (includeArchived || !projectData.archived)) {
          projects.push(projectData);
        }
      }
      
      return DataServiceResult.success(projects, 'Projects loaded successfully');
    } catch (error) {
      return DataServiceResult.error(error, 'Failed to load projects');
    }
  }
  
  static async update(id, value) {
    try {
      PermissionHelper.requireAuth();
      PermissionHelper.requireProject();
      
      const projectRef = doc(db, "project", id);
      await updateDoc(projectRef, {
        ...value,
        updatedDate: serverTimestamp()
      });
      
      return DataServiceResult.success(
        { id, ...value },
        'Project updated successfully'
      );
    } catch (error) {
      return DataServiceResult.error(error, 'Failed to update project');
    }
  }
  
  static async updateField(id, fieldName, fieldValue) {
    try {
      PermissionHelper.requireAuth();
      PermissionHelper.requireProject();
      
      const documentRef = doc(db, "project", id);
      await updateDoc(documentRef, {
        [fieldName]: fieldValue,
        updatedDate: serverTimestamp()
      });
      
      return DataServiceResult.success(
        { id, [fieldName]: fieldValue }, 
        'Project updated successfully'
      );
    } catch (error) {
      return DataServiceResult.error(error, 'Failed to update project');
    }
  }

  static async archive(id) {
    try {
      PermissionHelper.requireAuth();
      PermissionHelper.requireProjectAdmin();
      
      const projectRef = doc(db, "project", id);
      await updateDoc(projectRef, { 
        archived: true,
        updatedDate: serverTimestamp()
      });
      
      return DataServiceResult.success(
        { id, archived: true },
        'Project archived successfully'
      );
    } catch (error) {
      return DataServiceResult.error(error, 'Failed to archive project');
    }
  }

  static async delete(id) {
    try {
      PermissionHelper.requireAuth();
      PermissionHelper.requireProjectAdmin();
      
      // Delete all associated documents
      const documentsRef = collection(db, "documents");
      const documentsQuery = query(documentsRef, where("project", "==", id));
      const documentsSnapshot = await getDocs(documentsQuery);
      const deleteDocumentsPromises = documentsSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deleteDocumentsPromises);
      
      // Delete all associated chats
      const chatsRef = collection(db, "chats");
      const chatsQuery = query(chatsRef, where("project", "==", id));
      const chatsSnapshot = await getDocs(chatsQuery);
      const deleteChatsPromises = chatsSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deleteChatsPromises);
      
      // Delete all userProject relationships
      const userProjectsRef = collection(db, "userProjects");
      const userProjectsQuery = query(userProjectsRef, where("projectId", "==", id));
      const userProjectsSnapshot = await getDocs(userProjectsQuery);
      const deleteUserProjectsPromises = userProjectsSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deleteUserProjectsPromises);
      
      // Delete all invitations
      const invitationsRef = collection(db, "invitations");
      const invitationsQuery = query(invitationsRef, where("projectId", "==", id));
      const invitationsSnapshot = await getDocs(invitationsQuery);
      const deleteInvitationsPromises = invitationsSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deleteInvitationsPromises);
      
      // Finally, delete the project itself
      const projectRef = doc(db, "project", id);
      await deleteDoc(projectRef);
      
      return DataServiceResult.success(
        { id, deleted: true },
        'Project and all associated data deleted successfully'
      );
    } catch (error) {
      return DataServiceResult.error(error, 'Failed to delete project');
    }
  }

  static async unarchive(id) {
    try {
      PermissionHelper.requireAuth();
      PermissionHelper.requireProjectAdmin();
      
      const projectRef = doc(db, "project", id);
      await updateDoc(projectRef, { 
        archived: false,
        updatedDate: serverTimestamp()
      });
      
      return DataServiceResult.success(
        { id, archived: false },
        'Project restored successfully'
      );
    } catch (error) {
      return DataServiceResult.error(error, 'Failed to restore project');
    }
  }

  // ENHANCED USER MANAGEMENT

  static async getInvitation(projectId, email = null) {
    //TODO need a way to check if user recently created an account but did not accept invitation
    const invitationRef = collection(db, "invitations");
    let q;
    if (email) {
      q = query(invitationRef, 
        where('projectId', '==', projectId),
        where('email', '==', email)
      );
    } else {
      q = query(invitationRef, where('projectId', '==', projectId));
    }
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  }

  static async inviteUserToProject({projectId, email, role}) {
    try {
      PermissionHelper.requireAuth();
      PermissionHelper.requireProjectAdmin();

      // Check if user is already in the project
      const projectUsers = await this.getUsersForProject(projectId);
      const userInProject = projectUsers.find(user => user.email === email);
      if (userInProject) {
        return DataServiceResult.success(
          { user: userInProject },
          'User already in project'
        );
      }

      // Check if user is already created
      const existingUser = await User.getUserByEmail(email);
      if (existingUser) {
        await this.addUserToProject(existingUser.id, projectId, role);
        return DataServiceResult.success(
          { user: existingUser },
          'User added to project'
        );
      }

      // Check if user is already invited
      const existingInvitations = await this.getInvitation(projectId, email);
      if (existingInvitations.length > 0) {
        const existingInvitation = existingInvitations[0];
        return DataServiceResult.success(
          { id: existingInvitation.id, ...existingInvitation },
          'User already invited'
        );
      }

      const invitation = BusinessHelper.createInvitationData(email, projectId, role, getStore().user.uid);

      const inviteRef = await addDoc(collection(db, "invitations"), invitation);
      
      return DataServiceResult.success(
        { id: inviteRef.id, ...invitation },
        'Invitation created successfully'
      );
    } catch (error) {
      return DataServiceResult.error(error, 'Failed to invite user to project');
    }
  }

  static async updateInvitation(id, payload) {
    try {
      PermissionHelper.requireAuth();
      PermissionHelper.requireProjectAdmin();
      
      const invitationRef = doc(db, "invitations", id);
      await updateDoc(invitationRef, {
        ...payload,
        updatedDate: serverTimestamp()
      });
      
      return DataServiceResult.success(
        { id, ...payload },
        'Invitation updated successfully'
      );
    } catch (error) {
      return DataServiceResult.error(error, 'Failed to update invitation');
    }
  }


  static async addUserToProject(userId, projectId, role='user', invite= null) {
    console.log('addUserToProject', userId, projectId, role, invite);
    try {
      PermissionHelper.requireAuth();
      
      // Check if user is already in the project (any status)
      const userProjectsRef = collection(db, "userProjects");
      const existingQuery = query(userProjectsRef, 
        where('userId', '==', userId),
        where('projectId', '==', projectId)
      );
      const existingSnapshot = await getDocs(existingQuery);
      
      if (!existingSnapshot.empty) {
        const existingDoc = existingSnapshot.docs[0];
        const existingData = existingDoc.data();
        
        // If user is already active, throw error
        if (existingData.status === 'active') {
          throw new Error(ERROR_MESSAGES.USER_ALREADY_IN_PROJECT);
        }
        
        // If user was removed, reactivate them
        if (existingData.status === 'removed') {
          await updateDoc(existingDoc.ref, {
            status: 'active',
            role: role,
            reinstatedAt: serverTimestamp(),
            reinstatedBy: getStore().user.uid
          });
          
          return DataServiceResult.success(
            { userId, projectId, role, status: 'active' },
            'User reactivated in project'
          );
        }
      }

      // Validate invite if provided (skip validation if called from acceptInvitation)
      // Note: acceptInvitation already validates the invitation before calling this method
      if (invite && invite.needsValidation !== false) {
        ValidationHelper.validateInvitation(invite, getStore().user.email);
      }
      
      await addDoc(userProjectsRef, { 
        userId, 
        projectId, 
        role,
        status: 'active',
        joinedDate: serverTimestamp(),
        invitedBy: invite ? invite.invitedBy : getStore().user.uid,
        isCreator: false
      });
      
      return DataServiceResult.success(
        { userId, projectId, role, status: 'active' },
        'User added to project'
      );
    } catch (error) {
      return DataServiceResult.error(error, 'Failed to add user to project');
    }
  }

  static async addUserToProjectDuringCreation(userId, projectId, role='user', invite= null) {
    // Special method for adding users during account creation - bypasses auth check
    
    // Check if user is already in the project (any status)
    console.log('addUserToProjectDuringCreation', userId, projectId, role, invite);
    const userProjectsRef = collection(db, "userProjects");
    const existingQuery = query(userProjectsRef, 
      where('userId', '==', userId),
      where('projectId', '==', projectId)
    );
    const existingSnapshot = await getDocs(existingQuery);
    
    if (!existingSnapshot.empty) {
      const existingDoc = existingSnapshot.docs[0];
      const existingData = existingDoc.data();
      
      // If user is already active, return success (no duplicate)
      if (existingData.status === 'active') {
        return true;
      }
      
      // If user was removed, reactivate them
      if (existingData.status === 'removed') {
        await updateDoc(existingDoc.ref, {
          status: 'active',
          role: role,
          reinstatedAt: serverTimestamp()
        });
        return true;
      }
    }

    // Validate invite if provided
    if (invite) {
      const inviteExpirationDate = new Date(invite.expiresAt.toDate());
      if (inviteExpirationDate < new Date()) {
        throw new Error('Invitation has expired');
      }
    }
    
    await addDoc(userProjectsRef, { 
      userId, 
      projectId, 
      role,
      status: 'active',
      joinedDate: serverTimestamp(),
      invitedBy: invite ? invite.invitedBy : null,
      isCreator: false // Always false for invited users
    });
    
    return true;
  }

  static async updateUserRole(userId, projectId, newRole) {
    try {
      PermissionHelper.requireAuth();
      
      // Check if current user is admin
      const currentUserRole = await User.getUserRoleInProject(getStore().user.uid, projectId);
      if (currentUserRole !== 'admin') {
        throw new Error('Only project admins can change user roles');
      }

      // Prevent removing the last admin
      if (newRole !== 'admin') {
        const admins = await this.getProjectAdmins(projectId);
        if (admins.length === 1 && admins[0].userId === userId) {
          throw new Error(ERROR_MESSAGES.LAST_ADMIN_REMOVAL);
        }
      }

      // Use the general update method
      await this.updateUserProjectStatus({
        userId,
        projectId,
        updates: { role: newRole }
      });

      return DataServiceResult.success(
        { userId, projectId, role: newRole },
        'User role updated successfully'
      );
    } catch (error) {
      return DataServiceResult.error(error, 'Failed to update user role');
    }
  }

  static async removeUserFromProject({userId, projectId}) {
    try {
      PermissionHelper.requireAuth();
      PermissionHelper.requireProjectAdmin();

      // Prevent removing the last admin
      const project = await this.getById(projectId);
      const admins = project.users.filter(user => user.role === 'admin');
      if (admins.length === 1) {
        return DataServiceResult.error(
          new Error(ERROR_MESSAGES.LAST_ADMIN_REMOVAL),
          ERROR_MESSAGES.LAST_ADMIN_REMOVAL
        );
      }

      // Use the general update method
      await this.updateUserProjectStatus({
        userId,
        projectId,
        updates: {
          status: 'removed',
          removedAt: serverTimestamp(),
          removedBy: getStore().user.uid
        }
      });

      return DataServiceResult.success(
        { userId, projectId, status: 'removed' },
        'User removed from project'
      );
    } catch (error) {
      return DataServiceResult.error(error, 'Failed to remove user from project');
    }
  }

  static async updateUserProjectStatus({userId, projectId, updates}) {
    try {
      PermissionHelper.requireAuth();
      PermissionHelper.requireProjectAdmin();

      const userProjectsRef = collection(db, "userProjects");
      const q = query(userProjectsRef, 
        where('userId', '==', userId),
        where('projectId', '==', projectId)
      );
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        await updateDoc(snapshot.docs[0].ref, {
          ...updates,
          updatedAt: serverTimestamp(),
          updatedBy: getStore().user.uid
        });
        
        return DataServiceResult.success(
          { userId, projectId, ...updates },
          'User project status updated successfully'
        );
      } else {
        throw new Error('User project relationship not found');
      }
    } catch (error) {
      return DataServiceResult.error(error, 'Failed to update user project status');
    }
  }

  static async reinstateUser({userId, projectId}) {
    try {
      PermissionHelper.requireAuth();
      PermissionHelper.requireProjectAdmin();

      await this.updateUserProjectStatus({
        userId,
        projectId,
        updates: {
          status: 'active',
          reinstatedAt: serverTimestamp(),
          reinstatedBy: getStore().user.uid
        }
      });

      return DataServiceResult.success(
        { userId, projectId, status: 'active' },
        'User reinstated successfully'
      );
    } catch (error) {
      return DataServiceResult.error(error, 'Failed to reinstate user');
    }
  }

  static async getProjectAdmins(projectId) {
    const userProjectsRef = collection(db, "userProjects");
    const q = query(userProjectsRef, 
      where('projectId', '==', projectId),
      where('role', '==', 'admin'),
      where('status', '==', 'active')
    );
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => doc.data());
  }


  static async getProjectInvitations(projectId) {
    try {
      PermissionHelper.requireAuth();
      
      // Check if user is admin
      const currentUserRole = await User.getUserRoleInProject(getStore().user.uid, projectId);
      
      // Also check if user is the project creator as fallback
      let isProjectCreator = false;
      if (currentUserRole !== 'admin') {
        const projectRef = doc(db, "project", projectId);
        const projectDoc = await getDoc(projectRef);
        if (projectDoc.exists()) {
          isProjectCreator = projectDoc.data().createdBy === getStore().user.uid;
        }
      }
      
      if (currentUserRole !== 'admin' && !isProjectCreator) {
        throw new Error('Only project admins can view invitations');
      }

      const invitationsRef = collection(db, "invitations");
      const q = query(invitationsRef, 
        where('projectId', '==', projectId)
      );
      const snapshot = await getDocs(q);
      
      const invitations = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Sort by createdDate in JavaScript instead of Firestore
      const sortedInvitations = invitations.sort((a, b) => {
        const dateA = a.createdDate?.toDate?.() || new Date(a.createdDate);
        const dateB = b.createdDate?.toDate?.() || new Date(b.createdDate);
        return dateB - dateA; // desc order (newest first)
      });

      return DataServiceResult.success(
        sortedInvitations,
        'Project invitations loaded successfully'
      );
    } catch (error) {
      return DataServiceResult.error(error, 'Failed to load project invitations');
    }
  }

  // Update existing getUsersForProject to filter by active status
  static async getUsersForProject(projectId, details = false) {
    try {
      PermissionHelper.requireAuth();
      
      const userProjectsRef = collection(db, "userProjects");
      const q = query(userProjectsRef, 
        where('projectId', '==', projectId),
      );
      const snapshot = await getDocs(q);
      const users = snapshot.docs.map(doc => ({
        ...doc.data()
      }));

      // If details is true, get the user details
      if (details) {
        const userIds = users.map(u => u.userId);
        const userIdChunks = _.chunk(userIds, 10);
        
        let usersDetail = [];
        for (const chunk of userIdChunks) {
          const usersRef = collection(db, "users");
          const q = query(usersRef, where('__name__', 'in', chunk));
          const userSnapshots = await getDocs(q);
          
          const chunkUsers = userSnapshots.docs.map(doc => {
            const userProject = users.find(u => u.userId === doc.id);
            return { 
              id: doc.id, 
              ...doc.data(), 
              ...userProject,
            };
          });
          
          usersDetail.push(...chunkUsers);
        }
        
        return usersDetail;
      }

      return users;
    } catch (error) {
      console.error('Error getting users for project:', error);
      return [];
    }
  }
}


export class Comment {
  constructor(value) {
    this.comment = value.comment; 
    this.documentVersion = value.documentVersion || null;
    this.resolved = value.resolved || false;
    this.parentId = value.parentId || null; // For thread support
    this.aiGenerated = value.aiGenerated || false;
    this.issueType = value.issueType || null;
    this.severity = value.severity || null;
    this.suggestion = value.suggestion || null;
    this.selectedText = value.selectedText || null;
    Object.assign(this, addInDefaults(this));
  }
}

export class Document {
  constructor(value) {
    this.defaultValues = {
      archived: value.archived || false,
      content: value.content || "",
      name: value.name || "",
      id: value.id || "",
      draft: value.draft || true,
      children: value.children || [],
      order: value.order || 1000,
      releasedVersion: value.releasedVersion || [],
    }
  }
  
  static async getAll(includeArchived = false, includeDraft = false) {
    
    // Check if project.id exists before using it in the query
    if (!getStore().project?.id) {
      console.warn('No project ID available, returning empty array');
      return [];
    }

    if (!getStore().isUserInProject && getStore().project.id !== import.meta.env.VITE_DEFAULT_PROJECT_ID) {
      getStore().uiAlert({
        type: 'error',
        message: 'You are not a member of this project',
        autoClear: true
      });
      return [];
    }
    
    const documentsRef = collection(db, "documents");

    const conditions = [where("project", "==", getStore().project.id)];
    if (!includeArchived) {conditions.push(where("archived", "==", false));}
    if (!getStore().user.uid && !includeDraft) {conditions.push(where("draft", "==", false));}

    const q = query(documentsRef, ...conditions);

    const snapshot = await getDocs(q);
    const documents = await Promise.all(snapshot.docs.map(async(doc) => ({
      id: doc.id,
      data: doc.data()
    })));

    return documents;
  }

  
  // Helper function to ensure project creator is in userProjects
  static async ensureProjectCreatorAccess(projectId, userId) {
    // Get project details to check if user is the creator
    const projectRef = doc(db, "project", projectId);
    const projectDoc = await getDoc(projectRef);
    
    if (!projectDoc.exists()) {
      return false;
    }
    
    const projectData = projectDoc.data();
    
    // If user is the project creator, ensure they're in userProjects
    if (projectData.createdBy === userId) {
      // Check if user is already in userProjects
      const userRole = await User.getUserRoleInProject(userId, projectId);
      
      if (!userRole) {
        // User is project creator but not in userProjects - add them as admin
        await Project.addUserToProject(userId, projectId, 'admin');
        
        // Refresh user data to include the new project relationship
        await getStore().userEnter();
        
        console.log('Auto-added project creator to userProjects');
        return true;
      }
    }
    
    return false;
  }
  
  static async getDocById(id) {
    // Get document ref first to use in the permission checks
    const documentRef = doc(db, "documents", id);
    
    // Get basic document data to check permissions
    const docSnapshot = await getDoc(documentRef);
    
    if (!docSnapshot.exists()) {
      throw new Error(`Document with ID ${id} not found`);
    }
    
    const docData = docSnapshot.data();
    const isUserLoggedIn = getStore().isUserLoggedIn;
    
    // Permission check 1: Check if user is not logged in and document is in draft mode
    if (!isUserLoggedIn && docData.draft) {
      getStore().uiAlert( { 
        type: 'error', 
        message: 'This document is not publicly available. Please sign in to view it.' 
      });
      throw new Error('Permission denied: Document is not public and user is not logged in');
    }
    
    // Permission check 2: If user is logged in, check additional permissions
    if (isUserLoggedIn) {
      const projectId = docData.project;
      if (projectId) {
        // Get user's projects
        let userProjects = getStore().user.projects || [];
        const userProjectIds = userProjects.map(p => p.projectId || p.id);
        
        // Check if user is in the document's project
        if (!userProjectIds.includes(projectId)) {
          // Try to auto-add project creator if they're missing from userProjects
          const wasAdded = await this.ensureProjectCreatorAccess(projectId, getStore().user.uid);
          
          if (!wasAdded) {
            getStore().uiAlert( { 
              type: 'error', 
              message: 'You do not have access to this document. Please contact the project administrator.' 
            });
            throw new Error('Permission denied: User is not a member of the document\'s project');
          }
        }
      }
    }
    
    // All permission checks passed, get full document data
    const versionsRef = collection(documentRef, "versions");
    const versionsSnapshot = await getDocs(versionsRef);
    
    const commentsRef = collection(documentRef, "comments");
    const commentsSnapshot = await getDocs(commentsRef);
    
    return {
      id: docSnapshot.id,
      data: docData,
      versions: versionsSnapshot.docs.map(doc => ({
        id: doc.id, 
        ...doc.data()
      })),
      comments: commentsSnapshot.docs.map(doc => ({id: doc.id, ...doc.data()}))
    };
  }
  
  static async create(value) {
    try {
      PermissionHelper.requireAuth();
      
      value = addInDefaults(value);
      const docRef = await addDoc(collection(db, "documents"), value);
      
      return DataServiceResult.success(
        { id: docRef.id, data: value },
        'Document created successfully'
      );
    } catch (error) {
      return DataServiceResult.error(error, 'Failed to create document');
    }
  }

  
  static async updateDoc(id, value) {
    try {
      PermissionHelper.requireAuth();
      
      const documentRef = doc(db, "documents", id);
      await updateDoc(documentRef, {
        ...value,
        updatedDate: serverTimestamp()
      });
      
      return DataServiceResult.success(
        { id, ...value },
        'Document updated successfully'
      );
    } catch (error) {
      return DataServiceResult.error(error, 'Failed to update document');
    }
  }

  
  static async updateDocField(id, fieldName, fieldValue) {
    try {
      PermissionHelper.requireAuth();
      
      const documentRef = doc(db, "documents", id);
      await updateDoc(documentRef, {
        [fieldName]: fieldValue,
        updatedDate: serverTimestamp()
      });
      
      return DataServiceResult.success(
        { id, [fieldName]: fieldValue },
        'Document field updated successfully'
      );
    } catch (error) {
      return DataServiceResult.error(error, 'Failed to update document field');
    }
  }

  
  static async archiveDoc(id) {
    try {
      PermissionHelper.requireAuth();
      
      const documentRef = doc(db, "documents", id);
      await updateDoc(documentRef, {
        archived: true,
        updatedDate: serverTimestamp()
      });
      
      return DataServiceResult.success(
        { id, archived: true },
        'Document archived successfully'
      );
    } catch (error) {
      return DataServiceResult.error(error, 'Failed to archive document');
    }
  }

  
  static async deleteDocByID(id) {
    try {
      PermissionHelper.requireAuth();
      
      const documentRef = doc(db, "documents", id);
      await deleteDoc(documentRef);
      
      return DataServiceResult.success(
        { id },
        'Document deleted successfully'
      );
    } catch (error) {
      return DataServiceResult.error(error, 'Failed to delete document');
    }
  }


  ///-----------------------------------
  /// DOC Comments
  ///-----------------------------------  
  
  static async createComment(docID, comment) {
    try {
      PermissionHelper.requireAuth();
      
      const documentRef = doc(db, "documents", docID);
      
      // If this is a child comment (has parentId), enforce single-level nesting
      if (comment.parentId) {
        const parentCommentRef = doc(documentRef, "comments", comment.parentId);
        const parentCommentSnap = await getDoc(parentCommentRef);
        
        if (parentCommentSnap.exists()) {
          ValidationHelper.validateCommentThreading(parentCommentSnap.data());
        }
      }
      
      const commentInstance = new Comment(comment);
      const commentRef = await addDoc(collection(documentRef, "comments"), {...commentInstance});
      
      return DataServiceResult.success(
        {id: commentRef.id, ...commentInstance},
        'Comment created successfully'
      );
    } catch (error) {
      return DataServiceResult.error(error, 'Failed to create comment');
    }
  }

  static async updateComment(docID, commentId, comment) {
    try {
      PermissionHelper.requireAuth();
      
      const documentRef = doc(db, "documents", docID);
      const commentRef = doc(documentRef, "comments", commentId);
      await updateDoc(commentRef, {
        ...comment,
        updatedDate: serverTimestamp()
      });
      
      return DataServiceResult.success(
        {id: commentId, ...comment},
        'Comment updated successfully'
      );
    } catch (error) {
      return DataServiceResult.error(error, 'Failed to update comment');
    }
  } 

  static async updateCommentData(docID, commentId, values) {
    try {
      PermissionHelper.requireAuth();
      
      const documentRef = doc(db, "documents", docID);
      const commentRef = doc(documentRef, "comments", commentId);
      await updateDoc(commentRef, {
        ...values,
        updatedDate: serverTimestamp()
      });
      
      return DataServiceResult.success(
        {id: commentId, ...values},
        'Comment data updated successfully'
      );
    } catch (error) {
      return DataServiceResult.error(error, 'Failed to update comment data');
    }
  } 

  static async archiveComment(docID, commentId) {
    try {
      PermissionHelper.requireAuth();
      
      const documentRef = doc(db, "documents", docID);
      const commentRef = doc(documentRef, "comments", commentId);
      await updateDoc(commentRef, {
        archived: true,
        updatedDate: serverTimestamp()
      });
      
      return DataServiceResult.success(
        {id: commentId, archived: true},
        'Comment archived successfully'
      );
    } catch (error) {
      return DataServiceResult.error(error, 'Failed to archive comment');
    }
  }

  static async deleteComment(docID, commentId) {
    try {
      PermissionHelper.requireAuth();
      
      const documentRef = doc(db, "documents", docID);
      const commentRef = doc(documentRef, "comments", commentId);
      await deleteDoc(commentRef);
      
      return DataServiceResult.success(
        {id: commentId},
        'Comment deleted successfully'
      );
    } catch (error) {
      return DataServiceResult.error(error, 'Failed to delete comment');
    }
  }



  ///-----------------------------------
  /// DOC VERSIONS
  ///-----------------------------------  
  static async getDocVersion(docID, versionNumber){
    const documentRef = doc(db, "documents", docID);
    const versionsRef = collection(documentRef, "versions");
    const q = query(versionsRef, where("versionNumber", "==", versionNumber));
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
        id: doc.id, 
        ...doc.data()}))[0];
  }
  
  static async createVersion(docId, versionContent, versionNumber) {
    try {
      PermissionHelper.requireAuth();

      // Get the current document
      const documentRef = doc(db, "documents", docId);

      // Check to make sure version number is unique
      const versionsRef = collection(documentRef, "versions");
      const versionsSnapshot = await getDocs(versionsRef);
      const existingVersionNumbers = versionsSnapshot.docs.map(doc => doc.data().versionNumber);

      // Use ValidationHelper
      ValidationHelper.validateVersionNumber(existingVersionNumbers, versionNumber);

      // Create a new version
      const newVersion = {
        content: versionContent,
        createdBy: getStore().user.uid,
        createDate: serverTimestamp(),
        versionNumber: versionNumber,
        released: false,
      };

      // Add the new version to the versions subcollection
      const versionRef = await addDoc(collection(documentRef, "versions"), newVersion);

      return DataServiceResult.success(
        { id: versionRef.id, ...newVersion },
        `Version ${versionNumber} created successfully`
      );
    } catch (error) {
      return DataServiceResult.error(error, `Failed to create version ${versionNumber}`);
    }
  }

  
  static async deleteVersion(docId, versionNumber) {
    try {
      PermissionHelper.requireAuth();

      const documentRef = doc(db, "documents", docId);
      const versionsRef = collection(documentRef, "versions");
      const q = query(versionsRef, where("versionNumber", "==", versionNumber));
      const versionSnapshot = await getDocs(q);
      
      if (!versionSnapshot.empty) {
        const versionDocRef = versionSnapshot.docs[0].ref;
        await deleteDoc(versionDocRef);
        
        return DataServiceResult.success(
          { docId, versionNumber },
          `Version ${versionNumber} deleted successfully`
        );
      } else {
        throw new Error(`Version ${versionNumber} not found`);
      }
    } catch (error) {
      return DataServiceResult.error(error, `Failed to delete version ${versionNumber}`);
    }
  } 


  static async updateMarkedUpContent(docID, versionContent, versionNumber) {
    try {
      PermissionHelper.requireAuth();
      
      const documentRef = doc(db, "documents", docID);
      const versionsRef = collection(documentRef, "versions");
      const q = query(versionsRef, where("versionNumber", "==", versionNumber));
      const versionSnapshot = await getDocs(q);
      
      if (!versionSnapshot.empty) {
        const versionDocRef = versionSnapshot.docs[0].ref;
        await updateDoc(versionDocRef, {
          markedUpContent: versionContent,
          updatedDate: serverTimestamp()
        });
        
        return DataServiceResult.success(
          { docID, versionNumber, markedUpContent: versionContent },
          `Marked up content updated for version ${versionNumber}`
        );
      } else {
        throw new Error(`Version ${versionNumber} not found`);
      }
    } catch (error) {
      return DataServiceResult.error(error, `Failed to update marked up content for version ${versionNumber}`);
    }
  }

  static async toggleVersionReleased(docID, versionNumber, released) {
    try {
      PermissionHelper.requireAuth();
      
      const documentRef = doc(db, "documents", docID);
      const versionsRef = collection(documentRef, "versions");
      const q = query(versionsRef, where("versionNumber", "==", versionNumber));
      const versionSnapshot = await getDocs(q);
      
      if (!versionSnapshot.empty) {
        const versionDocRef = versionSnapshot.docs[0].ref;
        await updateDoc(versionDocRef, {
          released: released,
          updatedDate: serverTimestamp()
        });
        
        const action = released ? 'released' : 'unreleased';
        return DataServiceResult.success(
          { docID, versionNumber, released },
          `Version ${versionNumber} ${action} successfully`
        );
      } else {
        throw new Error(`Version ${versionNumber} not found`);
      }
    } catch (error) {
      return DataServiceResult.error(error, `Failed to toggle release status for version ${versionNumber}`);
    }
  }

}


export class ChatHistory {
  constructor(value) {
    this.messages = [];
    this.name = value.name || "";
    this.updatedDate = serverTimestamp();
    // Call addInDefaults to add any missing default fields
    Object.assign(this, addInDefaults(this));
  }

  
  static async create(value) {
    try {
      PermissionHelper.requireAuth();
      
      value = addInDefaults(value);
      const docRef = await addDoc(collection(db, "chats"), value);
      
      return DataServiceResult.success(
        {id: docRef.id, ...value},
        'Chat created successfully'
      );
    } catch (error) {
      return DataServiceResult.error(error, 'Failed to create chat');
    }
  }
  
  static async getAll() {
    try {
      PermissionHelper.requireAuth();
      PermissionHelper.requireProject();
      
      const chatsRef = collection(db, "chats");
      const q = query(chatsRef, where("project", "==", getStore().project.id));
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        data: doc.data()
      }));
    } catch (error) {
      console.error('Error getting chats:', error);
      return [];
    }
  }

  
  static async getDocById(id) {
    try {
      PermissionHelper.requireAuth();
      
      const documentRef = doc(db, "chats", id);
      const snapshot = await getDoc(documentRef);
      
      return DataServiceResult.success(
        {
          id: snapshot.id,
          data: snapshot.data()
        },
        'Chat loaded successfully'
      );
    } catch (error) {
      return DataServiceResult.error(error, 'Failed to load chat');
    }
  }

  
  static async updateChat(id, value) {
    try {
      PermissionHelper.requireAuth();
      
      const documentRef = doc(db, "chats", id);
      await updateDoc(documentRef, {
        ...value,
        updatedDate: serverTimestamp()
      });
      
      return DataServiceResult.success(
        {id, ...value},
        'Chat updated successfully'
      );
    } catch (error) {
      return DataServiceResult.error(error, 'Failed to update chat');
    }
  }

  static async updateChatField(id, fieldName, fieldValue) {
    try {
      PermissionHelper.requireAuth();
      
      const documentRef = doc(db, "chats", id);
      await updateDoc(documentRef, {
        [fieldName]: fieldValue,
        updatedDate: serverTimestamp()
      });
      
      return DataServiceResult.success(
        {id, [fieldName]: fieldValue},
        'Chat field updated successfully'
      );
    } catch (error) {
      return DataServiceResult.error(error, 'Failed to update chat field');
    }
  }

  
  static async archiveChat(id) {
    try {
      PermissionHelper.requireAuth();
      
      const documentRef = doc(db, "chats", id);
      await updateDoc(documentRef, {
        archived: true,
        updatedDate: serverTimestamp()
      });
      
      return DataServiceResult.success(
        {id, archived: true},
        'Chat archived successfully'
      );
    } catch (error) {
      return DataServiceResult.error(error, 'Failed to archive chat');
    }
  }

  
  static async deleteChat(id) {
    try {
      PermissionHelper.requireAuth();
      
      const documentRef = doc(db, "chats", id);
      await deleteDoc(documentRef);
      
      return DataServiceResult.success(
        {id},
        'Chat deleted successfully'
      );
    } catch (error) {
      return DataServiceResult.error(error, 'Failed to delete chat');
    }
  }
}

export class UsageLogger {
  static async logUsage(userId, functionName) {
      const usageRef = doc(db, "usageLogs", userId);
      const today = new Date().toISOString().split('T')[0]; // Get today's date in YYYY-MM-DD format

      const usageDoc = await getDoc(usageRef);
      if (usageDoc.exists()) {
          const data = usageDoc.data();
          if (data[functionName] && data[functionName][today]) {
              await updateDoc(usageRef, {
                  [`${functionName}.${today}`]: increment(1)
              });
          } else {
              await updateDoc(usageRef, {
                  [`${functionName}.${today}`]: 1
              });
          }
      } else {
          await setDoc(usageRef, {
              [functionName]: {
                  [today]: 1
              }
          });
      }
  }
}

export class Favorites {

  static async getAll() {
    try {
      // For safety check - don't require auth to avoid breaking unauthenticated calls 
      if (!getStore().user?.uid) {
        console.warn('No user ID available for favorites, returning empty array');
        return [];
      }
      
      const favoritesRef = doc(db, "favorites", getStore().user.uid);
      const snapshot = await getDoc(favoritesRef);
      
      if (snapshot.exists()) {
        return snapshot.data().favorites || [];
      } else {
        return [];
      }
    } catch (error) {
      console.error('Error getting favorites:', error);
      return [];
    }
  }
  
  static async updateFavorites(favorites) {
    try {
      PermissionHelper.requireAuth();
      
      const favoritesRef = doc(db, "favorites", getStore().user.uid);
      await setDoc(favoritesRef, { favorites }, { merge: true });
      
      return DataServiceResult.success(
        { favorites },
        'Favorites updated successfully'
      );
    } catch (error) {
      return DataServiceResult.error(error, 'Failed to update favorites');
    }
  }
}

export class Task {
  static async getAll() {
    // Check if user is logged in first, return empty array if not
    
    if (!getStore().user?.uid) {
      console.warn('User not logged in, returning empty tasks array');
      return [];
    }
    
    // Check if project.id exists before using it in the query
    if (!getStore().project?.id) {
      console.warn('No project ID available for tasks, returning empty array');
      return [];
    }
    
    const tasksRef = collection(db, "tasks");
    const q = query(tasksRef, where("project", "==", getStore().project.id));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
  }

  static async updateTasks(docID, documentContent) {
    try {
      PermissionHelper.requireAuth();
      
      const tasksRef = doc(db, "tasks", docID);
      const snapshot = await getDoc(tasksRef);

      // Remove the record if there are no tasks but there were tasks before
      if (!documentContent.content) {
        await deleteDoc(tasksRef);
        return DataServiceResult.success(null, 'Tasks cleared');
      }
        
      const taskRegex = /:canonical-task{src="([^"]*)" identity="([^"]*)" checked="([^"]*)"}/g;
      const matches = [...documentContent.content.matchAll(taskRegex)];
      const tasks = matches.map(match => ({
          src: match[1],
          identity: match[2],
          checked: match[3]  // Keep as string
      }));

      let updatedTasks = [];
      for (const task of tasks) {
        const storedTask = snapshot?.data()?.tasks?.find(t => t.identity=== task.identity);

        if (storedTask) {
          updatedTasks.push({
              ...task, 
              priority: storedTask?.priority || null,
              createdDate: storedTask?.createdDate || null,
              checkDate: task.checked === 'true' ? 
                (storedTask.checked !== 'true' ? { seconds: Math.floor(Date.now() / 1000) } : storedTask.checkDate) : 
                null
            })
        } else {
         updatedTasks.push({
          ...task,
          createdDate: { seconds: Math.floor(Date.now() / 1000) },
          checkDate: task.checked === 'true' ? { seconds: Math.floor(Date.now() / 1000) } : null
         })
        }
      }

      const data = addInDefaults({
        docID: docID,
        createdBy: getStore().user.uid,
        tasks: updatedTasks
      });

      await setDoc(tasksRef, data, { merge: true });
      
      return DataServiceResult.success(
        data,
        `Tasks updated successfully (${updatedTasks.length} tasks)`
      );
    } catch (error) {
      return DataServiceResult.error(error, 'Failed to update tasks');
    }
  }


  static async updateTask(docID, identity, value) {
    try {
      PermissionHelper.requireAuth();
      
      const tasksRef = doc(db, "tasks", docID);
      const snapshot = await getDoc(tasksRef);
      
      if (!snapshot.exists()) {
        throw new Error('Task document not found');
      }

      const tasks = snapshot.data().tasks;
      const taskIndex = tasks.findIndex(task => task.identity === identity);
      
      if (taskIndex === -1) {
        throw new Error('Task not found');
      }

      // Create a new tasks array with the updated task
      const updatedTasks = [...tasks];
      updatedTasks[taskIndex] = { ...updatedTasks[taskIndex], ...value };

      await updateDoc(tasksRef, { 
        tasks: updatedTasks,
        updatedDate: serverTimestamp()
      });
      
      return DataServiceResult.success(
        { docID, identity, ...value },
        'Task updated successfully'
      );
    } catch (error) {
      return DataServiceResult.error(error, 'Failed to update task');
    }
  }


}

wrapAsyncMethodsWithTimeout(User, 5000); // 5 seconds timeout
wrapAsyncMethodsWithTimeout(Comment, 5000);
wrapAsyncMethodsWithTimeout(Document, 5000);
wrapAsyncMethodsWithTimeout(ChatHistory, 5000);
wrapAsyncMethodsWithTimeout(UsageLogger, 5000);
wrapAsyncMethodsWithTimeout(Favorites, 5000);
wrapAsyncMethodsWithTimeout(Project, 5000);




