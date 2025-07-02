// src/utils.js
export function formatServerTimeStamp(date) {
    const timestamp = date.seconds * 1000 + date.nanoseconds / 1000000; // Convert to milliseconds
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(timestamp).toLocaleDateString(undefined, options);
}

// Application Constants
export const PROJECT_LIMITS = {
  FREE_TIER_LIMIT: 5
};

// Constants for consistent usage across components
export const ALERT_TYPES = {
    SUCCESS: 'success',
    ERROR: 'error',
    INFO: 'info',
    WARNING: 'warning'
};

export const USER_ROLES = {
    ADMIN: 'admin',
    USER: 'user',
    MEMBER: 'member'
};

export const INVITATION_STATUS = {
    PENDING: 'pending',
    ACCEPTED: 'accepted',
    CANCELLED: 'cancelled',
    DECLINED: 'declined'
};

// Project statuses
export const PROJECT_STATUS = {
  ACTIVE: 'active',
  ARCHIVED: 'archived',
  REMOVED: 'removed'
};

// User tiers
export const USER_TIERS = {
  FREE: 'free',
  PRO: 'pro',
  TRIAL: 'trial'
};

// Router paths
export const ROUTES = {
  HOME: '/',
  NEW_USER: '/new-user'
};

// Auto-clear timeout for alerts (in milliseconds)
export const ALERT_AUTO_CLEAR_TIMEOUT = 5000;
export const ALERT_FADE_OUT_TIMEOUT = 1000;

// Shared utility functions
export const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString();
};

export const normalizeEmail = (email) => {
    return email?.toLowerCase().trim() || '';
};

export const isValidEmail = (email) => {
    if (!email) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

export const compareEmails = (email1, email2) => {
    return normalizeEmail(email1) === normalizeEmail(email2);
};

/**
 * Filters array items based on search criteria
 * @param {Array} list - List to filter
 * @param {string} filter - Filter string
 * @returns {Array} Filtered list
 */
export function filterHelper(list, filter) {
  if (!filter || !Array.isArray(list)) return list;
  
  return [...list].filter(function(item) {
    var justTheData = [];
    Object.keys(item.data || {}).forEach(k => {
      justTheData.push(item.data[k])
    });
    Object.keys(item).forEach(k => {
      if(k != "data") {justTheData.push(item[k])}
    });
    let regex = new RegExp('(' + filter + ')', 'i');
    return JSON.stringify({justTheData}).match(regex);
  });
}

/**
 * Updates an array immutably by finding and updating a specific item
 * @param {Array} array - Array to update
 * @param {Function} findFn - Function to find the item to update
 * @param {Object} updates - Object with updates to apply
 * @returns {Array} New array with the item updated
 */
export function updateArrayItem(array, findFn, updates) {
  if (!Array.isArray(array)) return [];
  
  return array.map(item => {
    if (findFn(item)) {
      return { ...item, ...updates };
    }
    return item;
  });
}

export const getRoleColor = (role) => {
    switch (role) {
        case USER_ROLES.ADMIN:
            return 'orange';
        case USER_ROLES.USER:
            return 'blue';
        default:
            return 'grey';
    }
};

export const getRoleDisplayName = (role) => {
    switch (role) {
        case USER_ROLES.ADMIN:
            return 'Admin';
        case USER_ROLES.USER:
            return 'User';
        default:
            return 'Unknown';
    }
};

// Button label constants for accessibility
export const BUTTON_LABELS = {
    ACCEPT_INVITATION: 'Accept project invitation',
    DECLINE_INVITATION: 'Decline project invitation',
    SIGN_IN: 'Sign in to your account',
    SIGN_UP: 'Create new account'
};

// User-facing messages
export const MESSAGES = {
  PROJECT_LIMIT_EXCEEDED: (limit) => `Free users are limited to ${limit} projects. Upgrade to Pro for unlimited projects.`,
  PROJECT_ARCHIVED_SUCCESS: 'Project archived successfully',
  PROJECT_RESTORED_SUCCESS: 'Project restored successfully', 
  PROJECT_DELETED_SUCCESS: 'Project deleted successfully',
  PROJECT_ARCHIVE_FAILED: 'Failed to archive project',
  PROJECT_RESTORE_FAILED: 'Failed to restore project',
  PROJECT_DELETE_FAILED: 'Failed to delete project',
  PROJECT_CREATE_FAILED: 'Failed to create project',
  PROJECT_ACCESS_DENIED: 'You are not a member of this project',
  PROJECT_DATA_LOAD_FAILED: 'Failed to load project data. Please try refreshing the page.',
  PROJECT_SWITCHED: (name) => `Switched to project: ${name}`,
  PROJECT_CREATE_PROMPT: 'No projects available. Let\'s create a new one!',
  DOCUMENT_CREATE_FAILED: 'Failed to create document',
  DOCUMENT_SAVE_FAILED: 'Failed to save document',
  DOCUMENT_DELETE_FAILED: 'Failed to delete document',
  DOCUMENT_ARCHIVE_FAILED: 'Failed to archive document',
  COMMENT_CREATE_FAILED: 'Failed to create comment',
  COMMENT_REPLY_FAILED: 'Failed to create reply',
  COMMENT_UPDATE_FAILED: 'Failed to update comment',
  COMMENT_DELETE_FAILED: 'Failed to delete comment',
  COMMENT_DATA_UPDATE_FAILED: 'Failed to update comment data',
  VERSION_CREATE_FAILED: 'Failed to create version',
  VERSION_DELETE_FAILED: 'Failed to delete version',
  VERSION_TOGGLE_FAILED: 'Failed to toggle version release status',
  CHAT_RENAME_FAILED: 'Failed to rename chat',
  CHAT_DELETE_FAILED: 'Failed to delete chat',
  CHAT_ARCHIVE_FAILED: 'Failed to archive chat',
  CHAT_LOAD_FAILED: 'Failed to load chat',
  CHATS_LOAD_FAILED: 'Failed to load chats. Please try again.',
  TASK_UPDATE_FAILED: 'Failed to update task',
  MARKED_CONTENT_UPDATE_FAILED: 'Failed to update marked up content',
  FAVORITES_UPDATE_FAILED: 'Failed to update favorites',
  FOLDER_UPDATE_SUCCESS: 'Folder updated',
  FOLDER_ADD_FAILED: 'Failed to add folder',
  FOLDER_REMOVE_FAILED: 'Failed to remove folder',
  FOLDER_EXISTS_ERROR: 'New Folder already exists rename it before adding more folders',
  FOLDER_NOT_FOUND: (name) => `Target folder "${name}" not found`,
  FOLDER_MOVE_SUCCESS: (target) => target ? `moved to "${target}" folder` : 'moved to root level',
  DEFAULT_PROJECT_SET_FAILED: 'Failed to set default project',
  LOGOUT_FAILED: 'Unexpected error during logout',
  AUTH_FAILED: 'Authentication failed',
  AUTH_NOT_AVAILABLE: 'User not available to interact',
  NO_DOCUMENT_SELECTED: 'No document selected',
  INVALID_DOCUMENT: 'Cannot save document: selected document is invalid'
};

// Error messages
export const ERROR_MESSAGES = {
    INVALID_TOKEN: 'No invitation token provided',
    FAILED_LOAD: 'Failed to load invitation details',
    WRONG_EMAIL: 'This invitation is for a different email address. Please sign in with the correct email.',
    SIGN_IN_REQUIRED: 'Please sign in to accept the invitation'
};

// Success messages  
export const SUCCESS_MESSAGES = {
    INVITATION_ACCEPTED: 'Successfully joined project!',
    INVITATION_DECLINED: 'Invitation declined',
    REDIRECTING: 'Successfully joined the project! Redirecting to home page...'
};
