# 📚 Complete How-To Guide for Canonical

Welcome to Canonical! This comprehensive guide will walk you through all the features and capabilities of the platform.

## 📋 Table of Contents

1. [Getting Started](#getting-started)
2. [Project Management](#project-management)
3. [Document Management](#document-management)
4. [User Management & Collaboration](#user-management--collaboration)
5. [Comments & Feedback](#comments--feedback)
6. [Version Control](#version-control)
7. [Editor Features](#editor-features)
8. [Task Management](#task-management)
9. [Folder Organization](#folder-organization)
10. [Chat & AI Features](#chat--ai-features)

---

## 🚀 Getting Started

### Creating Your Account
1. Visit the application URL
2. Click **"Register"** or **"Sign Up"**
3. Enter your email address and password
4. Complete the registration process

### First-Time Setup
After registration, you'll be guided through:
1. **Project Creation**: Set up your first project
2. **Project Configuration**: Choose folders and basic settings
3. **First Document**: Create your welcome document

---

## 🏗️ Project Management

### Creating a Project

**For New Users:**
1. After registration, you'll automatically be guided to create your first project
2. Enter a project name (e.g., "My Product Documentation")
3. Select default folders from the list or customize your own
4. Click **"Initialize"** to create the project

**For Existing Users:**
1. Go to **Settings** → **Project Config**
2. Click **"New Project"** button (if you haven't reached your project limit)
3. Enter project details and configure folders
4. Click **"Initialize"**

### Project Limits
- **Free Users**: Up to 5 active projects
- **Pro/Trial Users**: Unlimited projects

### Updating Project Settings
1. Navigate to **Settings** → **Project Config**
2. Modify project name, description, or folder structure
3. Click **"Update"** to save changes

### Archiving a Project
1. Go to **Settings** → **Project Config**
2. Click the **"⋮"** (three dots) menu
3. Select **"Archive Project"**
4. Confirm the action

**Note**: Archived projects are read-only but can be restored by admins.

### Permanently Deleting a Project
1. Go to **Settings** → **Project Config**
2. Click the **"⋮"** (three dots) menu
3. Select **"Permanently Delete"**
4. Type the confirmation text
5. Click **"Delete"**

**⚠️ Warning**: This action cannot be undone!

---

## 📄 Document Management

### Creating Documents

**Method 1: From Home Page**
1. Click **"Create Doc"** button on the main page
2. Start typing your content
3. The document will auto-save as you type

**Method 2: From Document Tree**
1. In the left sidebar, click **"Create Doc"**
2. Begin writing your content
3. Change the document title by editing the name field

**Method 3: Using AI Templates**
1. When creating a new document, click the template icon
2. Enter a prompt describing what you want to create
3. Click **"Generate"** to create an AI-powered template
4. Customize the generated content as needed

### Document Versions and History

Documents in Canonical automatically track changes through a commit-based version control system similar to git.

#### Accessing Document History
1. Open any document
2. Click the document icon in the top-right to open the sidepanel
3. Navigate to the **History** tab to view:
   - **Commit timeline**: Visual timeline of all document changes
   - **Version tags**: Released versions of the document
   - **Uncommitted changes**: Current working state

#### Creating Commits
Commits save the current state of your document for version tracking:

1. Make changes to your document
2. In the History tab, you'll see an "Uncommitted changes" indicator
3. Click **Commit** or the "Commit" button in the header
4. Enter a descriptive commit message
5. Click **Create** to save the current state

**Best Practices for Commit Messages:**
- Use present tense: "Add new section", "Fix formatting"
- Be descriptive but concise
- Reference what changed: "Update pricing table", "Add conclusion paragraph"

#### Creating Versions
Versions are tagged snapshots that can be released to make documents officially available:

1. Go to the History tab
2. Click **Version** in the header
3. Enter a version number (e.g., "v1.0.0", "draft-2")
4. Click **Create**

You can also tag existing commits as versions by clicking **Tag** next to any commit.

#### Version States
- **Staged**: Version created but not yet released (shows warning chip)
- **Released**: Version officially published (shows success chip)

#### Switching Between Versions
- Click **View** next to any version to switch to that version
- Use the version selector in the document header
- Return to "live" to see the latest working version

#### Visual Timeline
The History tab shows a visual timeline with:
- **Working changes** (yellow): Current uncommitted edits
- **Commits** (blue): Saved document states with commit messages
- **Versions** (green): Tagged releases with version numbers
- **Current commit** (highlighted): The most recent commit

#### Version Management Actions
- **Release**: Make a staged version officially available
- **View**: Switch to view a specific version
- **Tag**: Convert an existing commit into a version

This system ensures you never lose work and can always return to previous states of your document.

### Document States
- **Draft**: Document is not published (shows pencil icon)
- **Published**: Document has released versions and is visible to all project members

### Reading Documents
1. Click on any document in the document tree (left sidebar)
2. Use the search filter to find specific documents
3. Documents are organized by folders and show their status (draft/published)

### Editing Documents
1. Click on a document to open it
2. Start typing - changes are auto-saved every 5 seconds
3. The document title can be edited inline
4. Use the formatting toolbar for rich text editing

### Document Versions
Documents automatically track changes and you can create specific versions (see [Version Control](#version-control)).

### Archiving Documents
1. Open the document
2. Click the **"⋮"** menu in the top-right of the document panel
3. Select **"Archive doc"**
4. Confirm the action

### Permanently Deleting Documents
1. Open the document
2. Click the **"⋮"** menu in the top-right of the document panel
3. Select **"Permanently delete doc"**
4. Confirm the action

**⚠️ Warning**: This action cannot be undone!

---

## 👥 User Management & Collaboration

### Inviting Users (Admin Only)

**Step 1: Create Invitation**
1. Go to **Settings** → **Project Config**
2. Scroll to the **"Manage Users"** section
3. Click **"Invite User"**
4. Enter the user's email address
5. Select their role:
   - **User**: Can read and edit documents
   - **Admin**: Can manage users and project settings
6. Click **"Create Invitation"**

**Step 2: Share Invitation Link**
1. Copy the generated invitation link
2. Share via:
   - Email (click "Share via Email" to open your email client)
   - Slack, Teams, or any messaging platform
   - Direct communication

**Important**: Recipients must sign up using the exact email address from the invitation.

### Managing User Roles (Admin Only)
1. Go to **Settings** → **Project Config**
2. In the **"Manage Users"** section, find the user
3. Click the role dropdown next to their name
4. Select new role (Admin ↔ User)

### Removing Users (Admin Only)
1. Go to **Settings** → **Project Config**
2. Find the user in the **"Manage Users"** section
3. Click **"Remove"** next to their name
4. Confirm the action

**Note**: You cannot remove the last admin from a project.

### Viewing Project Members
All project members are listed in **Settings** → **Project Config** under **"Manage Users"**.

### Accepting Invitations
1. Click the invitation link you received
2. Sign up using the exact email address from the invitation
3. You'll automatically be added to the project
4. Start collaborating immediately!

---

## 💬 Comments & Feedback

### Adding Comments

**Method 1: Using the Toolbar**
1. Select text in the document
2. Click the **comment** icon in the toolbar
3. Type your comment
4. Click **"Submit"**

**Method 2: Using the Comments Panel**
1. Open the document
2. In the right panel, go to the **"Review"** tab
3. Scroll to the comments section
4. Type your comment in the text box
5. Click the **send** icon

### Replying to Comments
1. Find the comment you want to reply to
2. Click **"Reply"** on the comment
3. Type your response
4. Click **"Submit"**

### Resolving Comments
1. Click on a comment that has a suggestion
2. If the comment includes a suggestion, click **"Accept Suggestion"**
3. The suggested text will replace the original text
4. The comment will be marked as resolved

### Viewing Comments
- **All Comments**: Shows every comment on the document
- **Active Only**: Shows only unresolved comments
- **By Date**: Comments sorted chronologically
- **By Position**: Comments sorted by their position in the document

### AI-Generated Comments
1. Open the document review panel
2. Click **"Generate Feedback"** for overall document feedback
3. Click **"Review Document"** to generate inline comments on specific text
4. AI comments will include:
   - Issue type and severity
   - Specific suggestions for improvement
   - Highlighted problematic text

### Filtering Comments
- Use the toggle buttons in the comments panel to switch between "All Comments" and "Active Only"
- Use "By Date" or "By Position" to change the sorting order

---

## 🔄 Version Control

### Creating Versions
1. Open a document
2. Click the version dropdown (shows "live" by default)
3. Click **"New"**
4. Enter a version number (e.g., "v1.0", "1.1", "beta-1")
5. Click **"Create"**

**Note**: Version numbers must be unique and cannot be "live".

### Viewing Different Versions
1. Open a document
2. Click the version dropdown
3. Select any version from the list
4. The document will switch to that version's content

**When viewing a version:**
- The document becomes read-only
- You can see comments specific to that version
- The version indicator shows "Staged" or "Released"

### Releasing Versions
1. Switch to the version you want to release
2. Click the **"Staged"** button next to the version
3. It will change to **"Released"**
4. Released versions are publicly visible

### Managing Versions
1. Open the version dropdown
2. Available actions:
   - **Create**: Make a new version
   - **Delete**: Remove a version (for the currently selected version)
   - **Fork**: Create a new version based on the current one

### Version States
- **Staged**: Version exists but is not public
- **Released**: Version is published and visible to all users
- **Live**: The current working version (always editable)

### Auto-Redirect for Demo Users
Non-logged-in users viewing documents with versions will automatically be redirected to the most recent released version.

---

## ✨ Editor Features

### AI Content Generation (`/gen`)

**Basic Usage:**
1. Type `/gen` in the document
2. A prompt box will appear
3. Enter your request (e.g., "create a list of product features")
4. Click **"Generate"** or press Enter
5. Review the AI-generated content
6. Click **"Accept"** to insert it, **"Regenerate"** to try again, or **"Close"** to cancel

**Example Prompts:**
- "Create a product requirements document"
- "List 5 key features for a mobile app"
- "Write an executive summary"
- "Generate user interview questions"

### Document References (`@ref`)

**Creating References:**
1. Type `@` followed by the document name
2. A dropdown will appear with matching documents
3. Select the document you want to reference
4. A clickable reference chip will be inserted

**Reference Behavior:**
- **Existing Documents**: Shows as a blue chip with the document name
- **New Documents**: Shows as a green chip with "Create" option
- **Draft Documents**: Shows a pencil icon indicator

**Creating New Documents from References:**
1. Type `@NewDocumentName` where no document exists
2. Click the green reference chip
3. AI will generate a template based on the document name
4. The new document will be created and linked

### Task Management (`//todo:`)

**Creating Tasks:**
1. Type `//todo:` in the document
2. A task chip will appear
3. Click on the task text to edit it
4. Press Enter to save the task

**Managing Tasks:**
- **Check/Uncheck**: Click the checkbox next to the task
- **Edit Task**: Click on the task text to modify it
- **Task Status**: Tasks sync across the entire project

**Viewing All Tasks:**
1. Go to the **Tasks** page (main navigation)
2. See all tasks across all documents in the project
3. Filter and sort by:
   - Status (completed/pending)
   - Priority (P1, P2, P3)
   - Creation date
   - Document

**Task Features:**
- Tasks are automatically tracked across all documents
- Completion dates are recorded
- Tasks can be assigned priorities
- Search and filter capabilities

### Rich Text Formatting

**Toolbar Options:**
- **Bold**: Select text and click **B** or use Ctrl+B
- **Italic**: Select text and click **I** or use Ctrl+I
- **Strikethrough**: Select text and click the strikethrough icon
- **Links**: Select text, click link icon, enter URL
- **Lists**: Use bullet or numbered list buttons
- **Blockquotes**: Highlight text and click quote icon
- **Code Blocks**: Select text and click code icon

**Markdown Support:**
The editor supports standard Markdown syntax:
- `**bold**` for **bold text**
- `*italic*` for *italic text*
- `~~strikethrough~~` for ~~strikethrough~~
- `> quote` for blockquotes
- `- item` for bullet lists
- `1. item` for numbered lists

### Diagrams (Mermaid)
The editor supports Mermaid diagrams for flowcharts, sequence diagrams, and more. Use standard Mermaid syntax.

---

## ✅ Task Management

### Overview Page
1. Navigate to **Tasks** in the main menu
2. View all tasks across all documents in your project
3. See task statistics and completion status

### Task Properties
Each task includes:
- **Status**: Checked/unchecked
- **Priority**: P1 (high), P2 (medium), P3 (low), or None
- **Creation Date**: When the task was created
- **Completion Date**: When the task was checked off
- **Document**: Which document contains the task
- **Content**: The actual task description

### Managing Tasks

**From the Tasks Page:**
1. **Check/Uncheck**: Click the checkbox to toggle completion
2. **Set Priority**: Click the priority dropdown to assign P1, P2, or P3
3. **View Document**: Click the document name to jump to the task location

**From Within Documents:**
1. Find tasks marked with `//todo:` syntax
2. Click the checkbox to complete/uncomplete
3. Click the task text to edit the description
4. Changes sync automatically across the project

### Task Filtering and Sorting
- **Search**: Use the search box to find specific tasks
- **Sort by Status**: Group completed and pending tasks
- **Sort by Priority**: Order by importance (P1 → P2 → P3 → None)
- **Sort by Date**: Order by creation or completion date
- **Sort by Document**: Group tasks by their containing document

### Task Workflow
1. Create tasks in documents using `//todo:` syntax
2. Tasks automatically appear in the central Tasks page
3. Assign priorities as needed
4. Check off tasks as you complete them
5. Use the Tasks page for project-wide task management

---

## 📁 Folder Organization

### Creating Folders
1. In the document tree (left sidebar), click **"Add Folder"**
2. Enter the folder name
3. Press Enter to create the folder

### Organizing Documents

**Drag and Drop:**
1. Drag any document from the document list
2. Drop it onto a folder to move it
3. Drop it outside folders to move to root level
4. Folders will auto-expand when you hover during drag

**Manual Organization:**
Documents can be organized by dragging them between:
- Root level (no folder)
- Specific folders
- Between different folders

### Managing Folders

**Renaming Folders:**
1. Click the **"⋮"** menu next to the folder name
2. Select **"Rename"**
3. Enter the new name
4. Press Enter or click outside to save

**Deleting Folders:**
1. Click the **"⋮"** menu next to the folder name
2. Select **"Delete"**
3. Confirm the action

**Note**: Deleting a folder moves all its documents to the root level.

### Folder Features
- **Expand/Collapse**: Click the arrow next to folder names
- **Auto-expand**: Folders automatically open when dragging documents over them
- **Document Count**: See how many documents are in each folder
- **Nested Organization**: Documents can be organized in a clear hierarchy

### Default Folders
New projects come with suggested folders:
- Product
- Features  
- Personas
- Notes
- Decisions
- User Interviews

You can customize, rename, or delete these as needed.

---

## �� Chat & AI Features

### Document Chat
1. Open any document
2. Click the **"Chat"** tab in the right panel
3. Ask questions about the document
4. The AI will respond based on the document content

**Chat Features:**
- **Context-Aware**: AI knows the content of the current document
- **Document Discussion**: Ask questions, get suggestions, brainstorm ideas
- **Chat History**: Previous conversations are saved per document
- **Quick Switching**: Toggle between Review and Chat panels

### AI Content Generation
- **`/gen` Command**: Generate content based on prompts (see Editor Features)
- **Document Templates**: AI-generated starting points for new documents
- **Feedback Generation**: AI analysis of document quality and suggestions

### AI Review Features
1. Open the **Review** panel on any document
2. Click **"Generate Feedback"** for overall document analysis
3. Click **"Review Document"** for inline comments and suggestions
4. AI will provide:
   - Overall document feedback
   - Specific inline comments on problematic text
   - Improvement suggestions
   - Issue severity ratings

### AI Requirements
- AI features require a **Pro** or **Trial** account
- Free users have limited access to AI functionality

---

## 🔧 Additional Features

### Search and Filtering
- **Document Search**: Use the filter box in the document tree to find documents quickly
- **Global Search**: Search across all documents in your project
- **Task Search**: Filter tasks on the Tasks page

### Favorites
- **Add to Favorites**: Click the star icon on any document
- **View Favorites**: Favorited documents are highlighted in the document tree

### Keyboard Shortcuts
- **Ctrl+B**: Bold text
- **Ctrl+I**: Italic text
- **Ctrl+S**: Save document (auto-save is also enabled)
- **Esc**: Cancel current action (like comment input or AI generation)

### Project Switching
- **Multiple Projects**: If you have multiple projects, switch between them in Settings → Project Config
- **Default Project**: Set your preferred default project for quick access

### Account Settings
- Navigate to **Settings** → **User Settings** to:
  - Update your profile information
  - Change account settings
  - View your account tier (Free/Pro/Trial)

---

## 🆘 Troubleshooting

### Common Issues

**"Permission Denied" Errors:**
- Ensure you're logged in and a member of the project
- Check that you have the required role (admin vs. user)
- Contact your project admin if you need access

**Documents Not Saving:**
- Check your internet connection
- Ensure you're not viewing a version (versions are read-only)
- Try refreshing the page

**AI Features Not Working:**
- Verify you have a Pro or Trial account
- Check that you're logged in
- Contact support if issues persist

**Invitation Links Not Working:**
- Ensure the recipient signs up with the exact email address from the invitation
- Check that the invitation hasn't expired (7-day limit)
- Generate a new invitation if needed

### Getting Help
- Check this guide for detailed instructions
- Contact your project admin for project-specific issues
- Reach out to support for technical problems

---

## 🎉 Best Practices

### Document Organization
1. **Use Folders**: Organize documents into logical folders
2. **Descriptive Names**: Use clear, descriptive document names
3. **Version Control**: Create versions for important milestones
4. **Comments**: Use comments for feedback and discussions

### Collaboration
1. **Clear Roles**: Assign appropriate admin and user roles
2. **Regular Reviews**: Use AI and peer review features
3. **Task Management**: Break work into manageable tasks
4. **Communication**: Use comments and chat for discussions

### Project Management
1. **Regular Updates**: Keep documents current and relevant
2. **Archive Old Content**: Archive outdated documents
3. **User Management**: Regularly review and update user access
4. **Backup Important Work**: Create versions of critical documents

---

Congratulations! You now have a complete understanding of all Canonical features. Start exploring and creating amazing collaborative documents! 🚀 