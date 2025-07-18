<template>
  <div class="commit-history-container">
    <!-- Header section with controls -->
    <div class="d-flex align-center gap-1 my-2 px-4">
      <div class="d-flex align-center mr-2">
        <v-icon size="16" class="mr-1">mdi-source-branch</v-icon>
        <span class="text-caption text-medium-emphasis">{{ currentBranch }}</span>
      </div>
      
      <v-btn-toggle class="gen-btn" density="compact">
        <v-tooltip 
          v-if="showCommitUI" 
          text="Create commit from current changes" 
          location="bottom"
        >
          <template v-slot:activator="{ props }">
            <v-btn
              :disabled="disabled"
              class="text-none text-sm"
              density="compact"
              v-bind="props"
              @click="showCommitDialog = true"
            >
              <v-icon size="16" class="mr-1">mdi-source-commit</v-icon>
              Commit
            </v-btn>
          </template>
        </v-tooltip>
        
        <v-tooltip text="Create new version" location="bottom">
          <template v-slot:activator="{ props }">
            <v-btn
              :disabled="disabled"
              class="text-none text-sm"
              density="compact"
              v-bind="props"
              @click="showVersionDialog = true"
            >
              <v-icon size="16" class="mr-1">mdi-tag</v-icon>
              Version
            </v-btn>
          </template>
        </v-tooltip>
      </v-btn-toggle>

      <!-- Uncommitted changes indicator -->
      <v-chip
        v-if="showCommitUI"
        size="small"
        color="warning"
        variant="tonal"
        class="ml-2"
      >
        <v-icon size="12" class="mr-1">mdi-alert</v-icon>
        Uncommitted
      </v-chip>
    </div>

    <!-- Commit Timeline -->
    <div class="commit-timeline flex-grow-1 overflow-y-auto px-4">
      <div v-if="commits.length === 0" class="empty-state text-center py-6">
        <v-icon size="32" class="mb-2 text-medium-emphasis">mdi-source-branch</v-icon>
        <p class="text-caption text-medium-emphasis">No commits yet</p>
        <p class="text-caption text-disabled">
          Make changes and create your first commit
        </p>
      </div>
      
      <div v-else class="timeline-container">
        <!-- Current working state -->
        <div v-if="showCommitUI" class="timeline-item working-changes">
          <div class="timeline-connector working"></div>
          <div class="timeline-content">
            <div class="commit-card working pa-2">
              <div class="d-flex align-center mb-1">
                <v-icon size="14" class="mr-1 text-warning">mdi-pencil</v-icon>
                <span class="text-caption text-warning font-weight-medium">Working changes</span>
              </div>
              <div class="text-caption text-disabled">
                Uncommitted • {{ $dayjs().fromNow() }}
              </div>
            </div>
          </div>
        </div>

        <!-- Commit history -->
        <div 
          v-for="(item, index) in timeline" 
          :key="item.id || `${item.type}-${index}`"
          class="timeline-item"
          :class="{ 'is-current': item.isCurrent }"
        >
          <div 
            class="timeline-connector"
            :class="{ 
              'current': item.isCurrent,
              'version': item.type === 'version'
            }"
          ></div>
          
          <div class="timeline-content">
            <!-- Version item -->
            <div v-if="item.type === 'version'" class="version-card pa-2">
              <div class="d-flex align-center justify-space-between mb-1">
                <v-chip
                  size="x-small"
                  :color="item.data.released ? 'success' : 'warning'"
                  variant="tonal"
                >
                  <v-icon size="10" class="mr-1">mdi-tag</v-icon>
                  {{ item.data.versionNumber }}
                </v-chip>
                <span class="text-caption text-medium-emphasis">
                  {{ item.data.released ? 'Released' : 'Staged' }}
                </span>
              </div>
              <div class="d-flex align-center justify-space-between">
                <span class="text-caption text-disabled">
                  {{ $dayjs(item.data.createDate?.seconds * 1000).fromNow() }}
                </span>
                <div class="d-flex">
                  <v-btn
                    size="x-small"
                    variant="text"
                    class="text-caption"
                    @click="switchToVersion(item.data.versionNumber)"
                  >
                    View
                  </v-btn>
                  <v-btn
                    v-if="!item.data.released"
                    size="x-small"
                    variant="text"
                    class="text-caption"
                    @click="toggleVersionRelease(item.data)"
                  >
                    Release
                  </v-btn>
                </div>
              </div>
            </div>

            <!-- Commit item -->
            <div v-else class="commit-card pa-2">
              <div class="d-flex align-center mb-1">
                <v-icon size="14" class="mr-1">mdi-source-commit</v-icon>
                <span class="text-caption font-weight-medium flex-grow-1">{{ item.data.message }}</span>
              </div>
              <div class="d-flex align-center justify-space-between mb-1">
                <v-chip size="x-small" variant="outlined" class="text-caption">
                  {{ item.data.commitId?.substring(0, 7) }}
                </v-chip>
                <span class="text-caption text-disabled">
                  {{ $dayjs(item.data.createDate?.seconds * 1000).fromNow() }}
                </span>
              </div>
              <div v-if="item.data.tags && item.data.tags.length > 0" class="mb-1">
                <v-chip
                  v-for="tag in item.data.tags"
                  :key="tag"
                  size="x-small"
                  variant="outlined"
                  class="mr-1"
                >
                  {{ tag }}
                </v-chip>
              </div>
              <div class="d-flex justify-end">
                <v-btn
                  size="x-small"
                  variant="text"
                  class="text-caption"
                  @click="viewCommit(item.data)"
                >
                  View
                </v-btn>
                <v-btn
                  v-if="!item.data.versionNumber"
                  size="x-small"
                  variant="text"
                  class="text-caption"
                  @click="tagCommitAsVersion(item.data)"
                >
                  Tag
                </v-btn>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Commit Dialog -->
    <v-dialog v-model="showCommitDialog" max-width="360">
      <v-card>
        <v-card-title class="text-body-1 pa-3">Create Commit</v-card-title>
        <v-card-text class="pa-3 pt-0">
          <v-textarea
            v-model="commitMessage"
            label="Commit message"
            placeholder="Describe your changes..."
            rows="2"
            variant="outlined"
            density="compact"
            hide-details="auto"
            class="mb-2"
          ></v-textarea>
          <div class="text-caption text-disabled">
            Save the current state of your document.
          </div>
        </v-card-text>
        <v-card-actions class="pa-3 pt-0">
          <v-spacer></v-spacer>
          <v-btn 
            variant="text" 
            density="compact"
            class="text-none"
            @click="showCommitDialog = false"
          >
            Cancel
          </v-btn>
          <v-btn
            :disabled="!commitMessage || commitMessage.trim() === ''"
            color="primary"
            density="compact"
            class="text-none"
            @click="createCommit"
          >
            Commit
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Version Dialog -->
    <v-dialog v-model="showVersionDialog" max-width="360">
      <v-card>
        <v-card-title class="text-body-1 pa-3">Create Version</v-card-title>
        <v-card-text class="pa-3 pt-0">
          <v-text-field
            v-model="versionNumber"
            label="Version number"
            placeholder="v1.0.0"
            variant="outlined"
            density="compact"
            hide-details="auto"
            class="mb-2"
          ></v-text-field>
          <div class="text-caption text-disabled">
            Create a new version from the current state.
          </div>
        </v-card-text>
        <v-card-actions class="pa-3 pt-0">
          <v-spacer></v-spacer>
          <v-btn 
            variant="text" 
            density="compact"
            class="text-none"
            @click="showVersionDialog = false"
          >
            Cancel
          </v-btn>
          <v-btn
            :disabled="!versionNumber || versionNumber.trim() === ''"
            color="primary"
            density="compact"
            class="text-none"
            @click="createVersion"
          >
            Create
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script>
export default {
  name: "CommitHistory",
  props: {
    disabled: {
      type: Boolean,
      default: false
    },
    document: {
      type: Object,
      required: true
    }
  },
  data() {
    return {
      showCommitDialog: false,
      showVersionDialog: false,
      commitMessage: '',
      versionNumber: '',
    };
  },
  computed: {
    commits() {
      return this.$store.selected?.commits || [];
    },
    versions() {
      return this.$store.selected?.versions || [];
    },
    currentBranch() {
      return this.$store.selected?.currentBranch || 'main';
    },
    showCommitUI() {
      return this.$store.isUserLoggedIn && 
             this.$store.selected.currentVersion === 'live' && 
             this.$store.uncommittedChanges;
    },
    timeline() {
      // Combine commits and versions into a single timeline
      const commits = this.commits.map(commit => ({
        id: commit.id,
        type: 'commit',
        data: commit,
        sortDate: commit.createDate?.seconds || 0,
        isCurrent: this.isCurrentCommit(commit)
      }));

      const versions = this.versions.map(version => ({
        id: version.id,
        type: 'version',
        data: version,
        sortDate: version.createDate?.seconds || 0,
        isCurrent: false
      }));

      // Combine and sort by date (newest first)
      return [...commits, ...versions]
        .sort((a, b) => b.sortDate - a.sortDate);
    }
  },
  methods: {
    isCurrentCommit(commit) {
      const currentCommit = this.$store.currentCommit;
      return currentCommit && currentCommit.id === commit.id;
    },

    async createCommit() {
      if (!this.commitMessage || this.commitMessage.trim() === '') {
        return;
      }

      try {
        await this.$store.createCommit(this.commitMessage);
        this.commitMessage = '';
        this.showCommitDialog = false;
      } catch (error) {
        console.error('Error creating commit:', error);
      }
    },

         async createVersion() {
       if (!this.versionNumber || this.versionNumber.trim() === '') {
         return;
       }

       if (this.versionNumber === 'live') {
         this.$store.uiAlert({
           type: 'error',
           message: 'Cannot name version "live"',
           autoClear: true
         });
         return;
       }

       try {
         const newVersionNumber = this.versionNumber;
         await this.$store.createVersion(newVersionNumber);
         this.versionNumber = '';
         this.showVersionDialog = false;
         
         // Optionally switch to the new version
         this.$router.push({ query: { v: newVersionNumber }});
       } catch (error) {
         console.error('Error creating version:', error);
       }
     },

    switchToVersion(versionNumber) {
      if (versionNumber === 'live') {
        this.$router.replace({'query': null});
      } else {
        this.$router.push({ query: { v: versionNumber }});
      }
    },

    async toggleVersionRelease(version) {
      try {
        await this.$store.toggleVersionReleased({
          versionNumber: version.versionNumber,
          released: !version.released
        });
      } catch (error) {
        console.error('Error toggling version release:', error);
      }
    },

    viewCommit(commit) {
      // For now, just show an alert with commit details
      // Could be expanded to show a diff view
      this.$store.uiAlert({
        type: 'info',
        message: `Commit: ${commit.message}\nID: ${commit.commitId}`,
        autoClear: true
      });
    },

    tagCommitAsVersion(commit) {
      // Pre-fill the version dialog when tagging a commit
      this.versionNumber = `v${this.versions.length + 1}.0.0`;
      this.showVersionDialog = true;
    }
  }
};
</script>

<style scoped>
.commit-history-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.commit-timeline {
  flex-grow: 1;
  min-height: 0;
}

.timeline-container {
  position: relative;
}

.timeline-item {
  position: relative;
  padding-left: 24px;
  margin-bottom: 12px;
}

.timeline-item.working-changes {
  margin-bottom: 16px;
}

.timeline-connector {
  position: absolute;
  left: 6px;
  top: 6px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: rgb(var(--v-theme-outline));
  border: 2px solid rgb(var(--v-theme-surface));
}

.timeline-connector.working {
  background-color: rgb(var(--v-theme-warning));
  animation: pulse 2s infinite;
}

.timeline-connector.current {
  background-color: rgb(var(--v-theme-primary));
  box-shadow: 0 0 0 2px rgba(var(--v-theme-primary), 0.3);
}

.timeline-connector.version {
  background-color: rgb(var(--v-theme-success));
  width: 10px;
  height: 10px;
  left: 5px;
}

.timeline-connector::before {
  content: '';
  position: absolute;
  left: 50%;
  top: 100%;
  width: 1px;
  height: 20px;
  background-color: rgba(var(--v-theme-outline), 0.3);
  transform: translateX(-50%);
}

.timeline-item:last-child .timeline-connector::before {
  display: none;
}

.timeline-content {
  margin-left: 6px;
}

.commit-card,
.version-card {
  background-color: rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-theme-outline), 0.12);
  border-radius: 6px;
  transition: all 0.2s ease;
}

.commit-card:hover,
.version-card:hover {
  border-color: rgba(var(--v-theme-outline), 0.3);
}

.commit-card.working {
  border-color: rgb(var(--v-theme-warning));
  background-color: rgba(var(--v-theme-warning), 0.05);
}

.empty-state {
  color: rgb(var(--v-theme-on-surface-variant));
}

.is-current .commit-card {
  border-color: rgb(var(--v-theme-primary));
  background-color: rgba(var(--v-theme-primary), 0.05);
}

/* Make buttons more compact */
.gen-btn .v-btn {
  min-width: auto !important;
  width: auto !important;
  padding: 0 8px !important;
}

.gen-btn .v-btn__content {
  justify-content: center;
}

/* Ensure icons are properly sized */
.gen-btn .v-icon {
  margin-right: 0 !important;
}

@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(var(--v-theme-warning), 0.4);
  }
  70% {
    box-shadow: 0 0 0 6px rgba(var(--v-theme-warning), 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(var(--v-theme-warning), 0);
  }
}
</style> 