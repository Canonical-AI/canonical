// Define the data schema for Firebase Firestore

// User schema
interface User {
    id: string; // User ID
    displayName: string; // User's display name
    email: string; // User's email
    project: string; // Associated project ID
    createdBy?: string; // Creator's user ID
    createdDate?: Date; // Date of creation
    updatedDate?: Date; // Date of last update
}

interface Project {
    id: string; // Project ID
    name: string; // Project name
    createdBy: string; // User ID of the creator
    folders: Folder[];
    createdDate: Date; // Date of creation
    updatedDate: Date; // Date of last update

}

interface ProjectUser

// Document schema
interface Document {
    id: string; // Document ID
    archived: boolean; // Archive status
    content: string; // Document content
    createdBy: string; // User ID of the creator
    createdDate: Date; // Date of creation
    name: string; // Document name
    project: string; // Associated project ID
    relationships: Relationship[]; // Relationships with other documents
    type: string; // Document type
    updatedDate: Date; // Date of last update
}

// Relationship schema
interface Relationship {
    id: string; // Related document ID
    type: string; // Type of relationship
}

// Comment schema
interface Comment {
    id: string; // Comment ID
    docID: string; // Associated document ID
    docType: string; // Type of document
    comment: string; // Comment text
    createdBy: string; // User ID of the creator
    createdDate: Date; // Date of creation
    updatedDate?: Date; // Date of last update
    archived: boolean; // Archive status
}

// Template Scheme
interface Template {
    name: string; // String
    content: string; // HTML
}

interface Folder {
    id: string; // Folder ID
    name: string; // Folder name
    createdBy: string; // User ID of the creator
    createdDate: Date; // Date of creation
    updatedDate: Date; // Date of last update
    archived: boolean; // Archive status
    children: string[]; // IDs of documents in the folder
}
