/**
 * Data Migration System
 * 
 * Handles migration of data structures between application versions.
 * Uses a two-tier approach for efficiency:
 * 
 * 1. PROJECT-LEVEL MIGRATION (runMigrations):
 *    - Runs after user data loads
 *    - Migrates documents with releasedVersion data (bulk migration)
 *    - Only processes released versions for efficiency
 * 
 * 2. DOCUMENT-LEVEL MIGRATION (checkDocumentMigrationOnOpen):
 *    - Runs when individual documents are opened
 *    - Handles unreleased versions and edge cases
 *    - Uses document.migrations.versions field to avoid redundant reads
 * 
 * Current migrations:
 * - Versions to Commits: Convert old version system to new commit-based system
 * - Document Migration Tracking: Per-document migration status to reduce reads
 */

import { Document, Commit } from '../services/firebaseDataService'

export class MigrationSystem {
  constructor(store) {
    this.store = store;
  }

  /**
   * Main migration function that orchestrates all migration processes
   */
  async runMigrations() {
    if (!this.store.user.uid || !this.store.project.id) {
      console.log('Skipping migration - no user or project');
      return;
    }

    try {
      // Check project migration status first
      const migrationStatus = this.store.project.migrationStatus || {};
      
      // Check if migrations are needed before running them
      const versionsNeedMigration = !migrationStatus.versionsToCommitsCompleted && await this.checkReleasedVersionsMigrationNeeded();

      if (!versionsNeedMigration) {
        console.log('No migrations needed - all data is up to date');
        return;
      }

      let migrationRan = false;

      // Only run migrations that are actually needed
      if (versionsNeedMigration) {
        await this.migrateVersionsToCommits();
        // Update document version fields after migration
        await this.updateDocumentVersionFields();
        // Mark this migration as completed
        await this.markMigrationCompleted('versionsToCommitsCompleted');
        migrationRan = true;
      } else {
        console.log('Skipping versions->commits migration - already completed');
      }
      
      if (migrationRan) {
        console.log('Migration completed successfully');
      }
    } catch (error) {
      console.error('Migration failed:', error);
      this.store.uiAlert({ 
        type: 'warning', 
        message: 'Some data migration steps failed. Please contact support if you experience issues.',
        autoClear: true 
      });
    }
  }

  /**
   * Mark a specific migration as completed in the project data
   * @param {string} migrationKey - The key identifying the completed migration
   */
  async markMigrationCompleted(migrationKey) {
    try {
      const currentStatus = this.store.project.migrationStatus || {};
      const updatedStatus = {
        ...currentStatus,
        [migrationKey]: true,
        [`${migrationKey}Timestamp`]: new Date().toISOString()
      };

      // Update project migration status
      const { Project } = await import('../services/firebaseDataService');
      await Project.updateField(this.store.project.id, 'migrationStatus', updatedStatus);
      
      // Update local state
      this.store.project.migrationStatus = updatedStatus;
      
      console.log(`Migration '${migrationKey}' marked as completed`);
    } catch (error) {
      console.error(`Failed to mark migration '${migrationKey}' as completed:`, error);
      // Don't throw - this is just tracking, not critical
    }
  }

  /**
   * Check if any documents still need versions->commits migration
   * Only checks documents that haven't been marked as migrated
   * @returns {boolean} True if migration is needed
   */
  async checkReleasedVersionsMigrationNeeded() {
    // First check if any documents have releasedVersion data and aren't already migrated
    const documentsWithVersions = this.store.documents.filter(doc => 
      doc.data && 
      doc.data.releasedVersion && 
      doc.data.releasedVersion.length > 0 &&
      (!doc.data.migrations || doc.data.migrations.versions !== 'complete')
    );

    if (documentsWithVersions.length === 0) {
      return false;
    }

    // For efficiency, just return true if we found documents that need checking
    // The actual migration will handle the detailed checks
    return true;
  }


  async checkSelectedDocumentMigration() {
    // Safety checks
    if (!this.store.selected || !this.store.selected.id) {
      console.log('No selected document to check for migration');
      return false;
    }

    // Check if the selected document has versions
    const selectedDocVersions = this.store.selected.versions || [];

    if (selectedDocVersions.length === 0) {
      console.log('No versions to migrate for selected document');
      return false;
    }   

    // Check if the versions have been migrated to commits
    const selectedDocCommits = this.store.selected.commits || [];

    let unmigratedVersions = [];
    for (const version of selectedDocVersions) {
      const versionNumber = version.versionNumber;
      
      if (!versionNumber || versionNumber.trim() === '') {
        continue; // Skip versions without version numbers
      }

      const versionCommit = selectedDocCommits.find(commit => commit.versionNumber === versionNumber);

      if (!versionCommit) {
        unmigratedVersions.push(version);
      }
    }

    if (unmigratedVersions.length === 0) {
      console.log('No unmigrated versions found');
      return false;
    }

    // If there are unmigrated versions, migrate them
    console.log(`Migrating ${unmigratedVersions.length} unmigrated versions for document ${this.store.selected.id}`);
    try {
      await this.migrateDocumentVersions(this.store.selected.id, false);
      return true;
    } catch (error) {
      console.error('Error migrating selected document versions:', error);
      return false;
    }
  }



  /**
   * Convert old versions to commits for documents that still have the old structure
   */
  async migrateVersionsToCommits() {
    const documentsWithVersions = this.store.documents.filter(doc => 
      doc.data && 
      doc.data.releasedVersion && 
      doc.data.releasedVersion.length > 0 &&
      (!doc.data.migrations || doc.data.migrations.versions !== 'complete')
    );

    if (documentsWithVersions.length === 0) {
      console.log('No documents with versions to migrate');
      return;
    }

    console.log(`Migrating released versions to commits for ${documentsWithVersions.length} documents`);

    for (const doc of documentsWithVersions) {
      try {
        await this.migrateDocumentVersions(doc.id, true); // true = only released versions
      } catch (docError) {
        console.error(`Error migrating document ${doc.id}:`, docError);
      }
    }
  }

  /**
   * Migrate versions to commits for a specific document
   * @param {string} docId - Document ID
   * @param {boolean} onlyReleased - If true, only migrate released versions
   * @returns {boolean} True if migration was performed
   */
  async migrateDocumentVersions(docId, onlyReleased = false) {
    try {
      // Get full document data including versions and commits
      const fullDoc = await Document.getDocById(docId);
      
      if (!fullDoc.versions || fullDoc.versions.length === 0) {
        // No versions to migrate, but mark as complete to avoid future checks
        await this.markDocumentMigrationComplete(docId);
        return false;
      }

      // Get existing commits for this document
      const existingCommits = fullDoc.commits || [];
      const existingVersionNumbers = existingCommits
        .filter(commit => commit.versionNumber && commit.versionNumber.trim() !== '')
        .map(commit => commit.versionNumber);

      // Filter versions based on migration type and existing commits
      const versionsToMigrate = fullDoc.versions.filter(version => {
        const hasVersionNumber = version.versionNumber && version.versionNumber.trim() !== '';
        const notAlreadyMigrated = !existingVersionNumbers.includes(version.versionNumber);
        const shouldMigrate = onlyReleased ? version.released === true : true;
        
        return hasVersionNumber && notAlreadyMigrated && shouldMigrate;
      });

      if (versionsToMigrate.length === 0) {
        // No versions need migration, mark as complete
        await this.markDocumentMigrationComplete(docId);
        return false;
      }

      console.log(`Migrating ${versionsToMigrate.length} versions for document ${docId}`);

      // Migrate each version to a commit
      let migratedCount = 0;
      for (const version of versionsToMigrate) {
        try {
          const result = await Commit.create(
            docId,
            { name: fullDoc.data.name, content: version.content || '', type: fullDoc.data.type },
            `Migrated from version ${version.versionNumber}`,
            null, // Versions don't have parent tracking
            {
              versionNumber: version.versionNumber,
              released: version.released || false,
              branch: 'main'
            }
          );

          if (result.success) {
            console.log(`Successfully migrated version ${version.versionNumber} to commit for document ${docId}`);
            migratedCount++;
          } else {
            console.error(`Failed to migrate version ${version.versionNumber}:`, result.error);
          }

        } catch (versionError) {
          console.error(`Error migrating version ${version.versionNumber}:`, versionError);
        }
      }

      // Mark document migration as complete
      await this.markDocumentMigrationComplete(docId);
      
      // Clear releasedVersion field if we migrated released versions
      if (onlyReleased && migratedCount > 0) {
        await Document.updateDocField(docId, 'releasedVersion', []);
        console.log(`Cleared releasedVersion field for document ${docId}`);
      }

      return migratedCount > 0;

    } catch (error) {
      console.error(`Error in migrateDocumentVersions for ${docId}:`, error);
      return false;
    }
  }

  /**
   * Mark a document's version migration as complete
   * @param {string} docId - Document ID
   */
  async markDocumentMigrationComplete(docId) {
    try {
      const migrations = { versions: 'complete' };
      await Document.updateDocField(docId, 'migrations', migrations);
      
      // Update local store if this document is loaded
      const storeDoc = this.store.documents.find(doc => doc.id === docId);
      if (storeDoc && storeDoc.data) {
        storeDoc.data.migrations = migrations;
      }
      
      console.log(`Marked document ${docId} version migration as complete`);
    } catch (error) {
      console.error(`Failed to mark document ${docId} migration as complete:`, error);
      // Don't throw - this is just tracking, not critical
    }
  }

  /**
   * Check and migrate versions for a specific document when it's opened
   * This handles cases where documents have unreleased versions or weren't caught by bulk migration
   * @param {Object} fullDocumentData - Full document data with versions and commits loaded
   * @returns {boolean} True if migration was performed
   */
  async checkDocumentMigrationOnOpen(fullDocumentData) {
    if (!fullDocumentData || !fullDocumentData.id) {
      return false;
    }

    // Skip if already migrated
    if (fullDocumentData.data && 
        fullDocumentData.data.migrations && 
        fullDocumentData.data.migrations.versions === 'complete') {
      return false;
    }

    // Skip if no versions exist
    if (!fullDocumentData.versions || fullDocumentData.versions.length === 0) {
      // Mark as complete to avoid future checks
      await this.markDocumentMigrationComplete(fullDocumentData.id);
      return false;
    }

    // Check if any versions need migration (both released and unreleased)
    const existingCommits = fullDocumentData.commits || [];
    const existingVersionNumbers = existingCommits
      .filter(commit => commit.versionNumber && commit.versionNumber.trim() !== '')
      .map(commit => commit.versionNumber);

    const unmigrated = fullDocumentData.versions.some(version => 
      version.versionNumber && 
      version.versionNumber.trim() !== '' && 
      !existingVersionNumbers.includes(version.versionNumber)
    );

    if (!unmigrated) {
      // All versions already migrated, just mark as complete
      await this.markDocumentMigrationComplete(fullDocumentData.id);
      return false;
    }

    console.log(`Document ${fullDocumentData.id} has unmigrated versions, migrating on document open`);
    
    // Migrate all versions (including unreleased) when document is opened
    return await this.migrateDocumentVersions(fullDocumentData.id, false); // false = migrate all versions
  }

 
  /**
   * Update document fields based on commits with version numbers
   */
  async updateDocumentVersionFields() {
    const documentsWithCommits = this.store.documents.filter(doc => doc.id);

    if (documentsWithCommits.length === 0) {
      console.log('No documents to update version fields for');
      return;
    }

    for (const doc of documentsWithCommits) {
      try {
        // Get full document data including commits
        const fullDoc = await Document.getDocById(doc.id);
        
        if (!fullDoc.commits || fullDoc.commits.length === 0) {
          continue;
        }

        // Find commits that have version numbers and are released
        const releasedVersionCommits = fullDoc.commits.filter(commit => 
          commit.versionNumber && commit.versionNumber.trim() !== '' && commit.released
        );

        // Update releasedVersion field based on released commits
        const releasedVersionNumbers = releasedVersionCommits.map(commit => commit.versionNumber);
        
        // Use the store's helper method to ensure consistency
        await this.store.updateDocumentReleasedVersions(doc.id, releasedVersionNumbers);

      } catch (docError) {
        console.error(`Error updating document ${doc.id} version fields:`, docError);
      }
    }
    
    console.log('Document version fields updated');
  }
} 