/**
 * Data Migration System
 * 
 * Handles migration of data structures between application versions.
 * This runs after user data loads and checks for migration needs.
 * 
 * Current migrations:
 * - Versions to Commits: Convert old version system to new commit-based system
 * - Commits to Versions: Backwards compatibility for UI components still using versions
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
      const versionsNeedMigration = !migrationStatus.versionsToCommitsCompleted && this.checkVersionsMigrationNeeded();

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
   * @returns {boolean} True if migration is needed
   */
  checkVersionsMigrationNeeded() {
    const documentsWithVersions = this.store.documents.filter(doc => 
      doc.data && doc.data.releasedVersion && doc.data.releasedVersion.length > 0
    );
    
    return documentsWithVersions.length > 0;
  }



  /**
   * Convert old versions to commits for documents that still have the old structure
   */
  async migrateVersionsToCommits() {
    const documentsWithVersions = this.store.documents.filter(doc => 
      doc.data && doc.data.releasedVersion && doc.data.releasedVersion.length > 0
    );

    if (documentsWithVersions.length === 0) {
      console.log('No documents with versions to migrate');
      return;
    }

    console.log(`Migrating versions to commits for ${documentsWithVersions.length} documents`);

    for (const doc of documentsWithVersions) {
      try {
        // Get full document data including versions
        const fullDoc = await Document.getDocById(doc.id);
        
        if (!fullDoc.versions || fullDoc.versions.length === 0) {
          continue;
        }

        // Convert each version to a commit with version number
        for (const version of fullDoc.versions) {
          try {
            const result = await Commit.create(
              doc.id,
              { name: doc.data.name, content: version.content || '', type: doc.data.type },
              `Migrated from version ${version.versionNumber}`,
              null, // Versions don't have parent tracking
              {
                versionNumber: version.versionNumber,
                released: version.released || false,
                branch: 'main'
              }
            );

            if (result.success) {
              console.log(`Successfully migrated version ${version.versionNumber} to commit for document ${doc.id}`);
            } else {
              console.error(`Failed to migrate version ${version.versionNumber}:`, result.error);
            }

          } catch (versionError) {
            console.error(`Error migrating version ${version.versionNumber}:`, versionError);
          }
        }

        // After successful migration, clear the releasedVersion field
        await Document.updateDocField(doc.id, 'releasedVersion', []);
        console.log(`Cleared releasedVersion field for document ${doc.id}`);

      } catch (docError) {
        console.error(`Error migrating document ${doc.id}:`, docError);
      }
    }
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