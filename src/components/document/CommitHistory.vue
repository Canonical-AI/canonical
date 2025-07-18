<template>
  <div class="commit-history-container">
    <!-- Header section with controls -->
    <div class="d-flex align-center gap-1 my-2 px-4">
      <div class="d-flex align-center mr-2">
        <v-icon size="16" class="mr-1">mdi-source-branch</v-icon>
        <span class="text-caption text-medium-emphasis">{{ currentBranch }}</span>
      </div>
      
      <div class="d-flex">
        <v-tooltip 
          v-if="showCommitUI" 
          text="Create commit from current changes" 
          location="bottom"
        >
          <template v-slot:activator="{ props }">
            <v-btn
              :disabled="disabled"
              color="success"
              variant="flat"
              density="compact"
              class="text-none hover-scale rounded-none"
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
              color="success"
              variant="tonal"
              density="compact"
              class="text-none hover-scale rounded-none"
              v-bind="props"
              @click="showVersionDialog = true"
            >
              <v-icon size="16" class="mr-1">mdi-tag</v-icon>
              Version
            </v-btn>
          </template>
        </v-tooltip>
      </div>
    </div>

    <v-text-field 
    v-model="commitMessage" 
    placeholder="Commit message..."
    density="compact" 
    class="p-4"
    hide-details="auto"></v-text-field>

    <!-- Enhanced Git-style Commit Timeline -->
    <div class="commit-timeline flex-grow-1 overflow-y-auto px-4">
      <div v-if="commits.length === 0" class="empty-state text-center py-6">
        <v-icon size="32" class="mb-2 text-medium-emphasis">mdi-source-branch</v-icon>
        <p class="text-caption text-medium-emphasis">No commits yet</p>
        <p class="text-caption text-disabled">
          Make changes and create your first commit
        </p>
      </div>
      
      <div v-else class="git-graph-container">
        <!-- Current working state -->
        <div v-if="showCommitUI" class="git-item working-changes">
          <div class="git-graph-column">
            <div class="git-node working">
              <v-icon size="10" class="working-icon">mdi-pencil</v-icon>
            </div>
            <div class="git-line working-line"></div>
          </div>
          <div class="git-content">
            <v-tooltip location="right" :text="`Modified ${$dayjs().fromNow()}`">
              <template v-slot:activator="{ props }">
                <div class="commit-card working pa-2" v-bind="props">
                  <div class="d-flex align-center">
                    <v-icon size="12" class="mr-1 text-warning">mdi-pencil</v-icon>
                    <span class="text-caption text-warning font-weight-medium">Working changes</span>
                    <v-spacer></v-spacer>
                    <v-chip size="x-small" variant="outlined" color="warning">
                      UNCOMMITTED
                    </v-chip>
                  </div>
                </div>
              </template>
            </v-tooltip>
          </div>
        </div>

        <!-- Git Graph Timeline -->
        <div 
          v-for="(item, index) in timeline" 
          :key="item.id || `${item.type}-${index}`"
          class="git-item"
          :class="{ 
            'is-current': item.isCurrent,
            'is-version': item.type === 'version',
            'is-last': index === timeline.length - 1
          }"
        >
          <div class="git-graph-column">
            <!-- Git Node -->
            <div 
              class="git-node"
              :class="{ 
                'current': item.isCurrent,
                'version': item.type === 'version',
                'commit': item.type === 'commit'
              }"
            >
              <v-icon 
                v-if="item.type === 'version'" 
                size="10" 
                class="node-icon"
              >
                mdi-tag
              </v-icon>
              <v-icon 
                v-else 
                size="8" 
                class="node-icon"
              >
                mdi-circle
              </v-icon>
            </div>
            
            <!-- Git Lines -->
            <div 
              v-if="index < timeline.length - 1 || (showCommitUI && index === 0)"
              class="git-line"
              :class="{ 
                'current-line': item.isCurrent,
                'version-line': item.type === 'version',
                'to-working': showCommitUI && index === 0
              }"
            ></div>
            
            <!-- Merge indicator for special commits -->
            <div 
              v-if="item.data.parentCommitId && index < timeline.length - 1" 
              class="merge-indicator"
            ></div>
          </div>
          
          <div class="git-content">
            <!-- Version Card -->
            <v-tooltip 
              v-if="item.type === 'version'" 
              location="right" 
              :text="`Created ${$dayjs(item.data.createDate?.seconds * 1000).fromNow()}`"
            >
              <template v-slot:activator="{ props }">
                <div class="version-card pa-2" v-bind="props">
                  <div class="d-flex align-center justify-space-between">
                    <div class="d-flex align-center">
                      <v-chip
                        size="x-small"
                        :color="item.data.released ? 'success' : 'orange'"
                        variant="tonal"
                        class="mr-1"
                      >
                        <v-icon size="8" class="mr-1">mdi-tag</v-icon>
                        {{ item.data.versionNumber }}
                      </v-chip>
                      <span class="text-caption font-weight-medium">
                        {{ item.data.versionNumber }}
                      </span>
                    </div>
                    <div class="d-flex align-center gap-1">
                      <v-chip
                        size="x-small"
                        :color="item.data.released ? 'success' : 'orange'"
                        variant="outlined"
                      >
                        {{ item.data.released ? 'RELEASED' : 'STAGED' }}
                      </v-chip>
                      <v-btn
                        size="x-small"
                        variant="text"
                        class="text-caption px-1"
                        @click="switchToVersion(item.data.versionNumber)"
                      >
                        <v-icon size="10">mdi-eye</v-icon>
                      </v-btn>
                      <v-btn
                        v-if="!item.data.released"
                        size="x-small"
                        variant="text"
                        color="success"
                        class="text-caption px-1"
                        @click="toggleVersionRelease(item.data)"
                      >
                        <v-icon size="10">mdi-rocket-launch</v-icon>
                      </v-btn>
                    </div>
                  </div>
                  
                  <!-- Version description if available -->
                  <div v-if="item.data.description" class="text-caption text-medium-emphasis mt-1">
                    {{ item.data.description }}
                  </div>
                </div>
              </template>
            </v-tooltip>

            <!-- Commit Card -->
            <v-tooltip 
              v-else 
              location="right" 
              :text="`Committed ${$dayjs(item.data.createDate?.seconds * 1000).fromNow()}`"
            >
              <template v-slot:activator="{ props }">
                <div class="commit-card pa-2" v-bind="props">
                  <div class="d-flex align-center">
                    <v-icon size="12" class="mr-1 text-primary">mdi-source-commit</v-icon>
                    <span class="text-caption font-weight-medium flex-grow-1">{{ item.data.message }}</span>
                    <v-chip 
                      v-if="item.isCurrent" 
                      size="x-small" 
                      color="primary" 
                      variant="outlined"
                    >
                      HEAD
                    </v-chip>
                    <v-btn
                        size="small"
                        variant="text"
                        class="text-caption px-1"
                        @click="viewCommit(item.data)"
                      >
                        <v-icon size="10">mdi-eye</v-icon>
                      </v-btn>
                      <v-btn
                        v-if="!item.data.versionNumber"
                        size="small"
                        variant="text"
                        class="text-caption px-1"
                        @click="tagCommitAsVersion(item.data)"
                      >
                        <v-icon size="10">mdi-tag-plus</v-icon>
                      </v-btn>
                  </div>
  
                  
                  <!-- Commit tags if available -->
                  <div v-if="item.data.tags && item.data.tags.length > 0" class="mt-1">
                    <v-chip
                      v-for="tag in item.data.tags"
                      :key="tag"
                      size="x-small"
                      variant="outlined"
                      color="secondary"
                      class="mr-1"
                    >
                      {{ tag }}
                    </v-chip>
                  </div>
                  
                  <!-- Commit author and changes info -->
                  <div v-if="item.data.author || item.data.changes" class="text-caption text-disabled mt-1">
                    <span v-if="item.data.author">by {{ item.data.author }}</span>
                    <span v-if="item.data.author && item.data.changes"> • </span>
                    <span v-if="item.data.changes">{{ item.data.changes }} changes</span>
                  </div>
                </div>
              </template>
            </v-tooltip>
          </div>
        </div>
      </div>
    </div>

    <!-- Commit Dialog -->
    <v-dialog v-model="showCommitDialog" max-width="400">
      <v-card>
        <v-card-title class="text-h6 pa-4">
          <v-icon class="mr-2">mdi-source-commit</v-icon>
          Create Commit
        </v-card-title>
        <v-card-text class="pa-4 pt-0">
          <v-textarea
            v-model="commitMessage"
            label="Commit message"
            placeholder="Describe your changes..."
            rows="3"
            variant="outlined"
            density="compact"
            hide-details="auto"
            class="mb-3"
          ></v-textarea>
          <div class="text-caption text-disabled d-flex align-center">
            <v-icon size="14" class="mr-1">mdi-information-outline</v-icon>
            This will create a new commit with your current changes
          </div>
        </v-card-text>
        <v-card-actions class="pa-4 pt-0">
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
            <v-icon size="16" class="mr-1">mdi-source-commit</v-icon>
            Commit
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Version Dialog -->
    <v-dialog v-model="showVersionDialog" max-width="500">
      <v-card title="Create a Version" class="p-4">
        <v-text-field
          v-model="versionNumber"
          label="Version Number"
          placeholder="v0.0.1"
          density="compact"
        ></v-text-field>
        
        <v-text-field 
          v-if="uncommittedChanges"
          v-model="commitMessageForVersion"
          label="Commit Message"
          placeholder="Commit message..."
          density="compact"
          hide-details="auto"
        ></v-text-field>
        
        <v-switch 
          color="success"
          v-model="versionRelease"
          density="compact"
        >
          <template v-slot:label>
            {{ versionRelease ? 'Version will release to project readers' : 'Staged, visible only to collaborators' }}
          </template>
        </v-switch>

        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn
            text="Close"
            class="text-none"
            variant="tonal"
            @click="closeVersionDialog"
          ></v-btn>
          <v-btn
            text="Create"
            color="success"
            class="text-none"
            variant="elevated"
            :disabled="!versionNumber || versionNumber.trim() === ''"
            @click="createVersion"
          ></v-btn>
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
      versionRelease: false,
      commitMessageForVersion: '',
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
    uncommittedChanges() {
      return this.$store.uncommittedChanges;
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
        // If there are uncommitted changes and a commit message, create a commit first
        if (this.uncommittedChanges && this.commitMessageForVersion && this.commitMessageForVersion.trim() !== '') {
          await this.$store.createCommit(this.commitMessageForVersion);
        }

        const newVersionNumber = this.versionNumber;
        await this.$store.createVersion(newVersionNumber, { released: this.versionRelease });
        this.closeVersionDialog();
        
        // Optionally switch to the new version
        this.$router.push({ query: { v: newVersionNumber }});
      } catch (error) {
        console.error('Error creating version:', error);
      }
    },

    closeVersionDialog() {
      this.showVersionDialog = false;
      this.versionNumber = '';
      this.versionRelease = false;
      this.commitMessageForVersion = '';
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

.git-graph-container {
  position: relative;
}

/* Hover scale animation for buttons */
.hover-scale {
  transition: transform 0.2s ease;
}

.hover-scale:hover {
  transform: scale(1.02);
}

/* Enhanced empty state */
.empty-state {
  color: rgb(var(--v-theme-on-surface-variant));
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

/* Git Node Icons */
.node-icon {
  color: rgb(var(--v-theme-on-surface));
}

.git-node.version .node-icon {
  color: rgb(var(--v-theme-success));
}

.git-node.commit .node-icon {
  color: rgb(var(--v-theme-info));
}

.git-node.current .node-icon {
  color: rgb(var(--v-theme-primary));
}

.working-icon {
  color: rgb(var(--v-theme-warning));
}

/* Enhanced Card Styling */
.commit-card,
.version-card {
  background-color: rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-theme-outline), 0.12);
  border-radius: 8px;
  transition: all 0.3s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.commit-card:hover,
.version-card:hover {
  border-color: rgba(var(--v-theme-outline), 0.3);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transform: translateY(-1px);
}

.commit-card.working {
  border-color: rgb(var(--v-theme-warning));
  background-color: rgba(var(--v-theme-warning), 0.08);
  border-left: 4px solid rgb(var(--v-theme-warning));
}

.version-card {
  border-left: 4px solid rgb(var(--v-theme-success));
  background-color: rgba(var(--v-theme-success), 0.05);
}

.is-current .commit-card {
  border-color: rgb(var(--v-theme-primary));
  background-color: rgba(var(--v-theme-primary), 0.08);
  border-left: 4px solid rgb(var(--v-theme-primary));
}

/* Advanced Git Graph Styling */
.git-item {
  position: relative;
  margin-bottom: 6px;
  display: flex;
  min-height: 32px;
}

.git-graph-column {
  position: relative;
  width: 18px;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-right: 12px;
  flex-shrink: 0;
}

.git-node {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background-color: rgb(var(--v-theme-outline));
  border: 1.5px solid rgb(var(--v-theme-surface));
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 3;
  position: relative;
  transition: all 0.3s ease;
  box-shadow: 0 0 0 0 transparent;
}

.git-node.working {
  background-color: rgb(var(--v-theme-warning));
  border-color: rgb(var(--v-theme-warning));
  animation: pulse 2s infinite;
}

.git-node.current {
  background-color: rgb(var(--v-theme-primary));
  border-color: rgb(var(--v-theme-primary));
  box-shadow: 0 0 0 2px rgba(var(--v-theme-primary), 0.2);
}

.git-node.version {
  background-color: rgb(var(--v-theme-success));
  border-color: rgb(var(--v-theme-success));
  width: 12px;
  height: 12px;
}

.git-node.commit {
  background-color: rgb(var(--v-theme-info));
  border-color: rgb(var(--v-theme-info));
}

/* Git Lines */
.git-line {
  position: absolute;
  left: 50%;
  top: 10px;
  bottom: -6px;
  width: 1.5px;
  background: linear-gradient(
    to bottom,
    rgba(var(--v-theme-outline), 0.4) 0%,
    rgba(var(--v-theme-outline), 0.3) 50%,
    rgba(var(--v-theme-outline), 0.2) 100%
  );
  transform: translateX(-50%);
  z-index: 1;
  transition: all 0.3s ease;
}

.git-line.current-line {
  background: linear-gradient(
    to bottom,
    rgba(var(--v-theme-primary), 0.8) 0%,
    rgba(var(--v-theme-primary), 0.6) 50%,
    rgba(var(--v-theme-primary), 0.4) 100%
  );
  width: 2px;
  box-shadow: 0 0 3px rgba(var(--v-theme-primary), 0.3);
}

.git-line.version-line {
  background: linear-gradient(
    to bottom,
    rgba(var(--v-theme-success), 0.8) 0%,
    rgba(var(--v-theme-success), 0.6) 50%,
    rgba(var(--v-theme-success), 0.4) 100%
  );
  width: 2px;
}

.git-line.working-line {
  background: linear-gradient(
    to bottom,
    rgba(var(--v-theme-warning), 0.8) 0%,
    rgba(var(--v-theme-warning), 0.6) 50%,
    rgba(var(--v-theme-warning), 0.4) 100%
  );
  width: 2px;
  animation: flow 3s ease-in-out infinite;
}

.git-item:last-child .git-line {
  display: none;
}

/* Merge Indicators */
.merge-indicator {
  position: absolute;
  top: 6px;
  right: -6px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: rgb(var(--v-theme-secondary));
  border: 1px solid rgb(var(--v-theme-surface));
  z-index: 2;
}

/* Content Area */
.git-content {
  flex-grow: 1;
  min-width: 0;
}

/* Typography Improvements */
.text-body-2 {
  line-height: 1.4;
}

.font-mono {
  font-family: 'SF Mono', Monaco, 'Roboto Mono', monospace;
  letter-spacing: 0.5px;
}

/* Button Improvements */
.git-item .v-btn {
  transition: all 0.2s ease;
}

.git-item .v-btn:hover {
  transform: scale(1.05);
}

/* Chip Improvements */
.git-item .v-chip {
  transition: all 0.2s ease;
}

.git-item .v-chip:hover {
  transform: scale(1.02);
}

/* Empty State Styling */
.empty-state {
  background: rgba(var(--v-theme-surface-variant), 0.3);
  border-radius: 12px;
  border: 1px dashed rgba(var(--v-theme-outline), 0.3);
}

/* Dialog Improvements */
.v-dialog .v-card {
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
}

/* Responsive Design */
@media (max-width: 768px) {
  .git-graph-container {
    padding-left: 12px;
  }
  
  .git-graph-column {
    width: 16px;
    margin-right: 8px;
  }
  
  .git-node {
    width: 8px;
    height: 8px;
  }
  
  .git-node.version {
    width: 10px;
    height: 10px;
  }
  
  .git-item {
    margin-bottom: 4px;
    min-height: 28px;
  }
  
  .commit-card,
  .version-card {
    padding: 8px !important;
  }
}

/* Advanced Animations */
@keyframes flow {
  0%, 100% {
    background: linear-gradient(
      to bottom,
      rgba(var(--v-theme-warning), 0.8) 0%,
      rgba(var(--v-theme-warning), 0.6) 50%,
      rgba(var(--v-theme-warning), 0.4) 100%
    );
  }
  50% {
    background: linear-gradient(
      to bottom,
      rgba(var(--v-theme-warning), 1) 0%,
      rgba(var(--v-theme-warning), 0.8) 50%,
      rgba(var(--v-theme-warning), 0.6) 100%
    );
  }
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

/* Hover Effects for Interactive Elements */
.git-item:hover .git-node {
  transform: scale(1.1);
}

.git-item:hover .git-line {
  opacity: 0.8;
}

.working-changes:hover .git-node.working {
  animation: pulse 1s infinite;
}

/* Focus States for Accessibility */
.v-btn:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}

/* Dark Mode Adjustments */
@media (prefers-color-scheme: dark) {
  .commit-card,
  .version-card {
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  }
  
  .commit-card:hover,
  .version-card:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  }
}
</style> 