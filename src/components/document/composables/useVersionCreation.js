/**
 * Composable for version creation logic
 * Handles both scenarios: creating version from uncommitted changes vs tagging existing commit
 */
import { computed } from 'vue'
import { useMainStore } from '../../../store'
import { useRouter } from 'vue-router'

export function useVersionCreation() {
  const store = useMainStore()
  const router = useRouter()
  
  const uncommittedChanges = computed(() => store.uncommittedChanges)
  const currentCommit = computed(() => store.currentCommit)
  const selectedCommits = computed(() => store.selected?.commits || [])
  
  /**
   * Create a version - either from uncommitted changes or by tagging current commit
   * @param {Object} params
   * @param {string} params.versionNumber - The version number (e.g., "v1.0.0")
   * @param {boolean} params.released - Whether to mark as released
   * @param {string} [params.commitMessage] - Commit message if creating new commit
   * @param {Object} [params.fromCommit] - Specific commit to tag (optional)
   * @param {boolean} [params.stayOnCommit] - Whether to stay on commit after creation
   */
  async function createVersion({ 
    versionNumber, 
    released = false, 
    commitMessage = '', 
    fromCommit = null, 
    stayOnCommit = false 
  }) {
    if (!versionNumber || versionNumber.trim() === '') {
      throw new Error('Version number is required')
    }

    if (versionNumber === 'live') {
      throw new Error('Cannot name version "live"')
    }

    try {
      let targetCommit = fromCommit

      // If we're tagging a specific commit (e.g., from commit history)
      if (fromCommit) {
        await store.createVersion(versionNumber, { 
          content: fromCommit.documentContent || fromCommit.content,
          released: released,
          fromCommitId: fromCommit.id
        })

        store.uiAlert({
          type: 'success',
          message: `Version ${versionNumber} created from commit`,
          autoClear: true
        })

        // Stay on commit unless explicitly told to navigate
        if (!stayOnCommit) {
          router.push({ query: { c: fromCommit.id } })
        }
        
        return { success: true, commit: fromCommit, versionNumber }
      }

      // Check if there are uncommitted changes
      if (uncommittedChanges.value) {
        // Create a new commit with version tagging
        if (!commitMessage || commitMessage.trim() === '') {
          throw new Error('Commit message is required for uncommitted changes')
        }

        const newCommit = await store.createCommit(commitMessage, {
          versionNumber: versionNumber,
          released: released
        })

        store.uiAlert({
          type: 'success',
          message: `Version ${versionNumber} created with new commit`,
          autoClear: true
        })

        // Navigate to the new version
        router.push({ query: { v: versionNumber } })
        
        return { success: true, commit: newCommit, versionNumber }
      } else {
        // No uncommitted changes - tag the current/latest commit as a version
        const latestCommit = currentCommit.value || selectedCommits.value[0]
        
        if (!latestCommit) {
          throw new Error('No commits available to tag as version')
        }

        // Check if this commit already has a version number
        if (latestCommit.versionNumber) {
          throw new Error(`Commit already tagged as version ${latestCommit.versionNumber}`)
        }

        await store.createVersion(versionNumber, { 
          content: latestCommit.documentContent || latestCommit.content,
          released: released,
          fromCommitId: latestCommit.id
        })

        store.uiAlert({
          type: 'success',
          message: `Version ${versionNumber} created from current commit`,
          autoClear: true
        })

        // Navigate to the version
        router.push({ query: { v: versionNumber } })
        
        return { success: true, commit: latestCommit, versionNumber }
      }
    } catch (error) {
      store.uiAlert({
        type: 'error',
        message: error.message || 'Failed to create version',
        autoClear: true
      })
      throw error
    }
  }

  /**
   * Get suggested version number based on existing versions
   */
  function getSuggestedVersionNumber() {
    const existingVersions = selectedCommits.value
      .filter(c => c.versionNumber)
      .length
    return `v${existingVersions + 1}.0.0`
  }

  /**
   * Check if current commit can be tagged as version
   */
  function canTagCurrentCommit() {
    const latest = currentCommit.value || selectedCommits.value[0]
    return latest && !latest.versionNumber && !uncommittedChanges.value
  }

  return {
    createVersion,
    getSuggestedVersionNumber,
    canTagCurrentCommit,
    uncommittedChanges,
    currentCommit,
    selectedCommits
  }
} 