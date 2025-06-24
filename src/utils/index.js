// src/utils.js
export function formatServerTimeStamp(date) {
    const timestamp = date.seconds * 1000 + date.nanoseconds / 1000000; // Convert to milliseconds
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(timestamp).toLocaleDateString(undefined, options);
}

// Constants for consistent usage across components
export const ALERT_TYPES = {
    SUCCESS: 'success',
    ERROR: 'error',
    INFO: 'info',
    WARNING: 'warning'
};

export const USER_ROLES = {
    ADMIN: 'admin',
    USER: 'user'
};

export const INVITATION_STATUS = {
    PENDING: 'pending',
    ACCEPTED: 'accepted',
    CANCELLED: 'cancelled',
    DECLINED: 'declined'
};

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
