<template>
  <v-card class="github-integration">
    <v-card-title class="text-h6 d-flex align-center">
      <v-icon class="mr-2">mdi-github</v-icon>
      GitHub Integration
    </v-card-title>
    
    <v-card-text>
      <!-- Connection Status -->
      <div v-if="connectionStatus.connected" class="mb-4">
        <v-alert type="success" variant="tonal" class="mb-3">
          <v-row align="center">
            <v-col cols="auto">
              <v-avatar size="32">
                <v-img :src="connectionStatus.avatarUrl" :alt="connectionStatus.username"></v-img>
              </v-avatar>
            </v-col>
            <v-col>
              <div class="text-subtitle-1">Connected as @{{ connectionStatus.username }}</div>
              <div class="text-caption text-medium-emphasis">
                Connected {{ formatDate(connectionStatus.connectedAt) }}
              </div>
            </v-col>
            <v-col cols="auto">
              <v-btn
                color="error"
                variant="outlined"
                size="small"
                @click="confirmDisconnect = true"
                :loading="loading.disconnect"
              >
                Disconnect
              </v-btn>
            </v-col>
          </v-row>
        </v-alert>

        <!-- Permissions -->
        <v-expansion-panels variant="accordion" class="mb-4">
          <v-expansion-panel title="Permissions & Scopes">
            <v-expansion-panel-text>
              <v-chip-group>
                <v-chip
                  v-for="scope in connectionStatus.scopes"
                  :key="scope"
                  size="small"
                  color="primary"
                  variant="outlined"
                >
                  {{ scope }}
                </v-chip>
              </v-chip-group>
              <div class="text-caption text-medium-emphasis mt-2">
                These permissions allow the app to read your private repositories and pull request data.
              </div>
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>

        <!-- Release Notes Generator -->
        <v-card variant="outlined" class="mb-4">
          <v-card-title class="text-subtitle-1">Generate Release Notes</v-card-title>
          <v-card-text>
            <v-form @submit.prevent="generateReleaseNotes">
              <v-row>
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model="releaseForm.owner"
                    label="Repository Owner"
                    placeholder="octocat"
                    required
                    :rules="[rules.required]"
                  ></v-text-field>
                </v-col>
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model="releaseForm.repo"
                    label="Repository Name"
                    placeholder="Hello-World"
                    required
                    :rules="[rules.required]"
                  ></v-text-field>
                </v-col>
              </v-row>
              
              <v-row>
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model="releaseForm.version"
                    label="Version"
                    placeholder="v1.2.3"
                    required
                    :rules="[rules.required]"
                  ></v-text-field>
                </v-col>
                <v-col cols="12" md="6">
                  <v-select
                    v-model="releaseForm.format"
                    label="Format"
                    :items="formatOptions"
                    required
                  ></v-select>
                </v-col>
              </v-row>

              <v-expansion-panels variant="accordion" class="mb-4">
                <v-expansion-panel title="Advanced Options">
                  <v-expansion-panel-text>
                    <v-row>
                      <v-col cols="12" md="6">
                        <v-text-field
                          v-model="releaseForm.baseBranch"
                          label="Base Branch"
                          placeholder="main"
                        ></v-text-field>
                      </v-col>
                      <v-col cols="12" md="6">
                        <v-text-field
                          v-model="releaseForm.sinceDate"
                          label="Since Date"
                          type="date"
                          hint="Only include PRs merged after this date"
                        ></v-text-field>
                      </v-col>
                    </v-row>
                    
                    <v-textarea
                      v-model="releaseForm.prNumbers"
                      label="Specific PR Numbers"
                      placeholder="123, 456, 789"
                      hint="Comma-separated list of PR numbers (optional)"
                      rows="2"
                    ></v-textarea>
                  </v-expansion-panel-text>
                </v-expansion-panel>
              </v-expansion-panels>

              <v-btn
                type="submit"
                color="primary"
                :loading="loading.generate"
                :disabled="!releaseForm.owner || !releaseForm.repo || !releaseForm.version"
              >
                <v-icon start>mdi-file-document-plus</v-icon>
                Generate Release Notes
              </v-btn>
            </v-form>
          </v-card-text>
        </v-card>

        <!-- Generated Release Notes -->
        <v-card v-if="generatedNotes" variant="outlined">
          <v-card-title class="text-subtitle-1 d-flex align-center justify-space-between">
            <span>Generated Release Notes</span>
            <v-btn
              size="small"
              variant="outlined"
              @click="copyToClipboard(generatedNotes.releaseNotes)"
            >
              <v-icon start>mdi-content-copy</v-icon>
              Copy
            </v-btn>
          </v-card-title>
          <v-card-text>
            <div class="text-caption text-medium-emphasis mb-2">
              {{ generatedNotes.stats.totalPRs }} PRs • 
              {{ generatedNotes.stats.features }} features • 
              {{ generatedNotes.stats.bugfixes }} bug fixes • 
              {{ generatedNotes.stats.improvements }} improvements
            </div>
            <v-textarea
              :model-value="generatedNotes.releaseNotes"
              readonly
              auto-grow
              variant="outlined"
              class="text-body-2"
            ></v-textarea>
          </v-card-text>
        </v-card>
      </div>

      <!-- Not Connected -->
      <div v-else>
        <v-alert type="info" variant="tonal" class="mb-4">
          <v-row align="center">
            <v-col>
              <div class="text-subtitle-1">Connect Your GitHub Account</div>
              <div class="text-body-2">
                Connect your GitHub account to fetch pull request data and generate release notes.
              </div>
            </v-col>
          </v-row>
        </v-alert>

        <v-list class="mb-4">
          <v-list-item
            v-for="feature in features"
            :key="feature.title"
            :prepend-icon="feature.icon"
          >
            <v-list-item-title>{{ feature.title }}</v-list-item-title>
            <v-list-item-subtitle>{{ feature.description }}</v-list-item-subtitle>
          </v-list-item>
        </v-list>

        <v-btn
          color="primary"
          size="large"
          @click="connectGitHub"
          :loading="loading.connect"
        >
          <v-icon start>mdi-github</v-icon>
          Connect GitHub Account
        </v-btn>

        <div class="text-caption text-medium-emphasis mt-2">
          This will redirect you to GitHub to authorize the connection.
        </div>
      </div>
    </v-card-text>

    <!-- Disconnect Confirmation Dialog -->
    <v-dialog v-model="confirmDisconnect" max-width="400">
      <v-card>
        <v-card-title>Disconnect GitHub Account?</v-card-title>
        <v-card-text>
          <p>Are you sure you want to disconnect your GitHub account?</p>
          <p class="text-caption text-medium-emphasis">
            You'll need to reconnect to generate release notes from private repositories.
          </p>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn @click="confirmDisconnect = false">Cancel</v-btn>
          <v-btn
            color="error"
            @click="disconnectGitHub"
            :loading="loading.disconnect"
          >
            Disconnect
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-card>
</template>

<script>
import { ref, onMounted, computed } from 'vue';
import { useMainStore } from '../../store/index.js';
import { GitHubService } from '../../services/githubService.js';
import dayjs from 'dayjs';

export default {
  name: 'GitHubIntegration',
  setup() {
    const store = useMainStore();
    
    // Reactive data
    const loading = ref({
      status: false,
      connect: false,
      disconnect: false,
      generate: false
    });
    
    const connectionStatus = ref({
      connected: false,
      username: null,
      avatarUrl: null,
      connectedAt: null,
      scopes: []
    });
    
    const confirmDisconnect = ref(false);
    
    const releaseForm = ref({
      owner: '',
      repo: '',
      version: '',
      format: 'markdown',
      baseBranch: 'main',
      sinceDate: '',
      prNumbers: ''
    });
    
    const generatedNotes = ref(null);
    
    // Static data
    const formatOptions = [
      { title: 'Markdown', value: 'markdown' },
      { title: 'HTML', value: 'html' },
      { title: 'Plain Text', value: 'text' }
    ];
    
    const features = [
      {
        icon: 'mdi-lock',
        title: 'Private Repository Access',
        description: 'Access pull requests from your private repositories'
      },
      {
        icon: 'mdi-file-document-plus',
        title: 'Automated Release Notes',
        description: 'Generate release notes from PR titles, descriptions, and commits'
      },
      {
        icon: 'mdi-tag-multiple',
        title: 'Smart Categorization',
        description: 'Automatically categorize changes by type (features, bugs, improvements)'
      },
      {
        icon: 'mdi-history',
        title: 'Commit History',
        description: 'Include detailed commit information in your release notes'
      }
    ];
    
    const rules = {
      required: value => !!value || 'This field is required'
    };
    
    // Computed
    const isUserLoggedIn = computed(() => store.isUserLoggedIn);
    
    // Methods
    const checkConnectionStatus = async () => {
      if (!isUserLoggedIn.value) return;
      
      loading.value.status = true;
      try {
        const result = await GitHubService.getConnectionStatus();
        if (result.success) {
          connectionStatus.value = result.data;
        }
      } catch (error) {
        store.uiAlert({
          type: 'error',
          message: 'Failed to check GitHub connection status',
          autoClear: true
        });
      } finally {
        loading.value.status = false;
      }
    };
    
    const connectGitHub = async () => {
      loading.value.connect = true;
      try {
        const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
        const redirectUri = `${window.location.origin}/settings/github/callback`;
        
        if (!clientId) {
          throw new Error('GitHub OAuth not configured. Please contact your administrator.');
        }
        
        const authUrl = GitHubService.initiateOAuthFlow(clientId, redirectUri);
        window.location.href = authUrl;
        
      } catch (error) {
        store.uiAlert({
          type: 'error',
          message: error.message || 'Failed to initiate GitHub connection',
          autoClear: true
        });
        loading.value.connect = false;
      }
    };
    
    const disconnectGitHub = async () => {
      loading.value.disconnect = true;
      try {
        const result = await GitHubService.disconnectAccount();
        if (result.success) {
          connectionStatus.value = {
            connected: false,
            username: null,
            avatarUrl: null,
            connectedAt: null,
            scopes: []
          };
          generatedNotes.value = null;
          confirmDisconnect.value = false;
          
          store.uiAlert({
            type: 'success',
            message: 'GitHub account disconnected successfully',
            autoClear: true
          });
        } else {
          throw new Error(result.message);
        }
      } catch (error) {
        store.uiAlert({
          type: 'error',
          message: error.message || 'Failed to disconnect GitHub account',
          autoClear: true
        });
      } finally {
        loading.value.disconnect = false;
      }
    };
    
    const generateReleaseNotes = async () => {
      loading.value.generate = true;
      try {
        // Parse PR numbers if provided
        let prNumbers = [];
        if (releaseForm.value.prNumbers.trim()) {
          prNumbers = releaseForm.value.prNumbers
            .split(',')
            .map(num => parseInt(num.trim()))
            .filter(num => !isNaN(num));
        }
        
        // Fetch PR data
        const fetchOptions = {
          base: releaseForm.value.baseBranch || 'main'
        };
        
        if (releaseForm.value.sinceDate) {
          fetchOptions.since = releaseForm.value.sinceDate;
        }
        
        if (prNumbers.length > 0) {
          fetchOptions.prNumbers = prNumbers;
        }
        
        const prResult = await GitHubService.fetchMultiplePRs(
          releaseForm.value.owner,
          releaseForm.value.repo,
          fetchOptions
        );
        
        if (!prResult.success) {
          throw new Error(prResult.message);
        }
        
        // Generate release notes
        const notesResult = GitHubService.generateReleaseNotes(prResult.data, {
          version: releaseForm.value.version,
          format: releaseForm.value.format
        });
        
        if (!notesResult.success) {
          throw new Error(notesResult.message);
        }
        
        generatedNotes.value = notesResult.data;
        
        store.uiAlert({
          type: 'success',
          message: `Generated release notes with ${prResult.data.length} PRs`,
          autoClear: true
        });
        
      } catch (error) {
        store.uiAlert({
          type: 'error',
          message: error.message || 'Failed to generate release notes',
          autoClear: true
        });
      } finally {
        loading.value.generate = false;
      }
    };
    
    const copyToClipboard = async (text) => {
      try {
        await navigator.clipboard.writeText(text);
        store.uiAlert({
          type: 'success',
          message: 'Release notes copied to clipboard',
          autoClear: true
        });
      } catch (error) {
        store.uiAlert({
          type: 'error',
          message: 'Failed to copy to clipboard',
          autoClear: true
        });
      }
    };
    
    const formatDate = (date) => {
      if (!date) return '';
      return dayjs(date.toDate()).fromNow();
    };
    
    // Lifecycle
    onMounted(() => {
      checkConnectionStatus();
      
      // Check for OAuth callback
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');
      
      if (code && state) {
        handleOAuthCallback(code, state);
      }
    });
    
    const handleOAuthCallback = async (code, state) => {
      loading.value.connect = true;
      try {
        const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
        const clientSecret = import.meta.env.VITE_GITHUB_CLIENT_SECRET;
        
        const result = await GitHubService.completeOAuthFlow(code, state, clientId, clientSecret);
        
        if (result.success) {
          // Clean up URL
          window.history.replaceState({}, document.title, window.location.pathname);
          
          // Refresh connection status
          await checkConnectionStatus();
          
          store.uiAlert({
            type: 'success',
            message: result.message,
            autoClear: true
          });
        } else {
          throw new Error(result.message);
        }
      } catch (error) {
        store.uiAlert({
          type: 'error',
          message: error.message || 'Failed to complete GitHub connection',
          autoClear: true
        });
      } finally {
        loading.value.connect = false;
      }
    };
    
    return {
      // Data
      loading,
      connectionStatus,
      confirmDisconnect,
      releaseForm,
      generatedNotes,
      formatOptions,
      features,
      rules,
      
      // Methods
      connectGitHub,
      disconnectGitHub,
      generateReleaseNotes,
      copyToClipboard,
      formatDate
    };
  }
};
</script>

<style scoped>
.github-integration {
  max-width: 800px;
}
</style> 