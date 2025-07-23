<template>
  <v-container>
    <v-row>
      <v-col cols="12">
        <h1>GitHub Integration Example</h1>
        <p class="text-subtitle-1 text-medium-emphasis">
          This example demonstrates how to use the GitHub integration to fetch PR data and generate release notes.
        </p>
      </v-col>
    </v-row>

    <!-- Connection Status -->
    <v-row>
      <v-col cols="12">
        <v-card>
          <v-card-title>GitHub Connection</v-card-title>
          <v-card-text>
            <v-btn 
              @click="checkConnection" 
              :loading="loading.connection"
              color="primary"
              class="mr-2"
            >
              Check Connection
            </v-btn>
            
            <v-chip 
              v-if="connectionChecked"
              :color="githubConnected ? 'success' : 'error'"
              variant="flat"
            >
              {{ githubConnected ? 'Connected' : 'Not Connected' }}
            </v-chip>
            
            <div v-if="githubConnected && username" class="mt-2">
              <strong>Connected as:</strong> @{{ username }}
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Single PR Example -->
    <v-row class="mt-4">
      <v-col cols="12">
        <v-card>
          <v-card-title>Fetch Single PR</v-card-title>
          <v-card-text>
            <v-form @submit.prevent="fetchSinglePR">
              <v-row>
                <v-col cols="4">
                  <v-text-field
                    v-model="singlePR.owner"
                    label="Repository Owner"
                    placeholder="octocat"
                    required
                  />
                </v-col>
                <v-col cols="4">
                  <v-text-field
                    v-model="singlePR.repo"
                    label="Repository Name"
                    placeholder="Hello-World"
                    required
                  />
                </v-col>
                <v-col cols="4">
                  <v-text-field
                    v-model.number="singlePR.number"
                    label="PR Number"
                    type="number"
                    placeholder="123"
                    required
                  />
                </v-col>
              </v-row>
              <v-btn 
                type="submit" 
                :loading="loading.singlePR"
                :disabled="!githubConnected"
                color="primary"
              >
                Fetch PR Data
              </v-btn>
            </v-form>

            <!-- Single PR Results -->
            <v-expansion-panels v-if="singlePRData" class="mt-4">
              <v-expansion-panel title="PR Data">
                <v-expansion-panel-text>
                  <pre>{{ JSON.stringify(singlePRData, null, 2) }}</pre>
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Release Notes Generation Example -->
    <v-row class="mt-4">
      <v-col cols="12">
        <v-card>
          <v-card-title>Generate Release Notes</v-card-title>
          <v-card-text>
            <v-form @submit.prevent="generateReleaseNotes">
              <v-row>
                <v-col cols="6">
                  <v-text-field
                    v-model="releaseNotes.owner"
                    label="Repository Owner"
                    placeholder="octocat"
                    required
                  />
                </v-col>
                <v-col cols="6">
                  <v-text-field
                    v-model="releaseNotes.repo"
                    label="Repository Name"
                    placeholder="Hello-World"
                    required
                  />
                </v-col>
              </v-row>
              
              <v-row>
                <v-col cols="6">
                  <v-text-field
                    v-model="releaseNotes.version"
                    label="Version"
                    placeholder="v1.2.3"
                    required
                  />
                </v-col>
                <v-col cols="6">
                  <v-text-field
                    v-model="releaseNotes.baseBranch"
                    label="Base Branch"
                    placeholder="main"
                  />
                </v-col>
              </v-row>

              <v-row>
                <v-col cols="6">
                  <v-text-field
                    v-model="releaseNotes.sinceDate"
                    label="Since Date"
                    type="date"
                    hint="Only PRs merged after this date"
                  />
                </v-col>
                <v-col cols="6">
                  <v-textarea
                    v-model="releaseNotes.prNumbers"
                    label="Specific PR Numbers (optional)"
                    placeholder="123, 456, 789"
                    rows="2"
                    hint="Comma-separated list"
                  />
                </v-col>
              </v-row>

              <v-btn 
                type="submit" 
                :loading="loading.releaseNotes"
                :disabled="!githubConnected"
                color="success"
                class="mr-2"
              >
                Generate Release Notes
              </v-btn>
              
              <v-btn 
                v-if="generatedNotes"
                @click="copyToClipboard"
                variant="outlined"
              >
                Copy to Clipboard
              </v-btn>
            </v-form>

            <!-- Generated Release Notes -->
            <v-card v-if="generatedNotes" variant="outlined" class="mt-4">
              <v-card-title class="text-subtitle-1">
                Generated Release Notes
                <v-spacer />
                <v-chip size="small" color="primary">
                  {{ generatedNotes.stats.totalPRs }} PRs
                </v-chip>
              </v-card-title>
              <v-card-text>
                <div class="text-caption mb-2">
                  {{ generatedNotes.stats.features }} features • 
                  {{ generatedNotes.stats.bugfixes }} bug fixes • 
                  {{ generatedNotes.stats.improvements }} improvements • 
                  {{ generatedNotes.stats.other }} other
                </div>
                <v-textarea
                  :model-value="generatedNotes.releaseNotes"
                  readonly
                  auto-grow
                  variant="outlined"
                />
              </v-card-text>
            </v-card>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Code Examples -->
    <v-row class="mt-4">
      <v-col cols="12">
        <v-card>
          <v-card-title>Code Examples</v-card-title>
          <v-card-text>
            <v-tabs v-model="codeTab">
              <v-tab value="service">Direct Service Usage</v-tab>
              <v-tab value="store">Store Actions</v-tab>
              <v-tab value="component">Component Integration</v-tab>
            </v-tabs>

            <v-window v-model="codeTab">
              <v-window-item value="service">
                <pre class="code-block">{{ serviceExample }}</pre>
              </v-window-item>
              
              <v-window-item value="store">
                <pre class="code-block">{{ storeExample }}</pre>
              </v-window-item>
              
              <v-window-item value="component">
                <pre class="code-block">{{ componentExample }}</pre>
              </v-window-item>
            </v-window>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
import { ref } from 'vue';
import { useMainStore } from '../src/store/index.js';
import { GitHubService } from '../src/services/githubService.js';

export default {
  name: 'GitHubIntegrationExample',
  setup() {
    const store = useMainStore();
    
    // Reactive data
    const loading = ref({
      connection: false,
      singlePR: false,
      releaseNotes: false
    });
    
    const connectionChecked = ref(false);
    const githubConnected = ref(false);
    const username = ref(null);
    
    const singlePR = ref({
      owner: 'octocat',
      repo: 'Hello-World',
      number: 1
    });
    
    const singlePRData = ref(null);
    
    const releaseNotes = ref({
      owner: 'octocat',
      repo: 'Hello-World',
      version: 'v1.2.3',
      baseBranch: 'main',
      sinceDate: '',
      prNumbers: ''
    });
    
    const generatedNotes = ref(null);
    const codeTab = ref('service');
    
    // Code examples
    const serviceExample = `// Direct service usage
import { GitHubService } from '@/services/githubService';

// Check connection status
const status = await GitHubService.getConnectionStatus();
if (status.success && status.data.connected) {
  console.log('Connected as:', status.data.username);
}

// Fetch single PR
const prResult = await GitHubService.fetchPullRequestData('owner', 'repo', 123);
if (prResult.success) {
  console.log('PR data:', prResult.data);
}

// Fetch multiple PRs and generate release notes
const prsResult = await GitHubService.fetchMultiplePRs('owner', 'repo', {
  base: 'main',
  since: '2024-01-01'
});

if (prsResult.success) {
  const notesResult = GitHubService.generateReleaseNotes(prsResult.data, {
    version: 'v1.2.3',
    format: 'markdown'
  });
  
  if (notesResult.success) {
    console.log('Release notes:', notesResult.data.releaseNotes);
  }
}`;

    const storeExample = `// Using store actions
export default {
  methods: {
    async checkConnection() {
      const result = await this.$store.githubGetConnectionStatus();
      return result.success && result.data.connected;
    },
    
    async fetchPRData() {
      const result = await this.$store.githubFetchPRData('owner', 'repo', 123);
      if (result.success) {
        return result.data;
      }
    },
    
    async generateRelease() {
      // Fetch multiple PRs
      const prResult = await this.$store.githubFetchMultiplePRs('owner', 'repo', {
        prNumbers: [123, 124, 125]
      });
      
      if (prResult.success) {
        // Generate release notes
        const notesResult = await this.$store.githubGenerateReleaseNotes(prResult.data, {
          version: 'v1.2.3',
          format: 'markdown'
        });
        
        return notesResult.data;
      }
    }
  }
};`;

         const componentExample = `<template>
   <div>
     <v-btn @click="generateReleaseNotes" :loading="loading">
       Generate Release Notes
     </v-btn>
     
     <v-textarea 
       v-if="releaseNotes" 
       :value="releaseNotes" 
       readonly 
     />
   </div>
 </template>
 
 <scr`+`ipt>
 export default {
   data() {
     return {
       loading: false,
       releaseNotes: null
     };
   },
   methods: {
     async generateReleaseNotes() {
       this.loading = true;
       try {
         // Fetch PRs from the last 30 days
         const sinceDate = new Date();
         sinceDate.setDate(sinceDate.getDate() - 30);
         
         const prResult = await this.$store.githubFetchMultiplePRs('owner', 'repo', {
           base: 'main',
           since: sinceDate.toISOString()
         });
         
         if (prResult.success) {
           const notesResult = await this.$store.githubGenerateReleaseNotes(prResult.data, {
             version: 'v1.2.3',
             format: 'markdown'
           });
           
           if (notesResult.success) {
             this.releaseNotes = notesResult.data.releaseNotes;
           }
         }
       } finally {
         this.loading = false;
       }
     }
   }
 };
 </scr`+`ipt>`;
     
     // Methods
     const checkConnection = async () => {
      loading.value.connection = true;
      try {
        const result = await store.githubGetConnectionStatus();
        connectionChecked.value = true;
        if (result.success) {
          githubConnected.value = result.data.connected;
          username.value = result.data.username;
        } else {
          githubConnected.value = false;
          username.value = null;
        }
      } finally {
        loading.value.connection = false;
      }
    };
    
    const fetchSinglePR = async () => {
      loading.value.singlePR = true;
      try {
        const result = await store.githubFetchPRData(
          singlePR.value.owner,
          singlePR.value.repo,
          singlePR.value.number
        );
        
        if (result.success) {
          singlePRData.value = result.data;
        }
      } finally {
        loading.value.singlePR = false;
      }
    };
    
    const generateReleaseNotes = async () => {
      loading.value.releaseNotes = true;
      try {
        // Parse PR numbers if provided
        let prNumbers = [];
        if (releaseNotes.value.prNumbers.trim()) {
          prNumbers = releaseNotes.value.prNumbers
            .split(',')
            .map(num => parseInt(num.trim()))
            .filter(num => !isNaN(num));
        }
        
        // Fetch multiple PRs
        const fetchOptions = {
          base: releaseNotes.value.baseBranch || 'main'
        };
        
        if (releaseNotes.value.sinceDate) {
          fetchOptions.since = releaseNotes.value.sinceDate;
        }
        
        if (prNumbers.length > 0) {
          fetchOptions.prNumbers = prNumbers;
        }
        
        const prResult = await store.githubFetchMultiplePRs(
          releaseNotes.value.owner,
          releaseNotes.value.repo,
          fetchOptions
        );
        
        if (prResult.success) {
          const notesResult = await store.githubGenerateReleaseNotes(prResult.data, {
            version: releaseNotes.value.version,
            format: 'markdown'
          });
          
          if (notesResult.success) {
            generatedNotes.value = notesResult.data;
          }
        }
      } finally {
        loading.value.releaseNotes = false;
      }
    };
    
    const copyToClipboard = async () => {
      try {
        await navigator.clipboard.writeText(generatedNotes.value.releaseNotes);
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
    
    return {
      // Data
      loading,
      connectionChecked,
      githubConnected,
      username,
      singlePR,
      singlePRData,
      releaseNotes,
      generatedNotes,
      codeTab,
      serviceExample,
      storeExample,
      componentExample,
      
      // Methods
      checkConnection,
      fetchSinglePR,
      generateReleaseNotes,
      copyToClipboard
    };
  }
};
</script>

<style scoped>
.code-block {
  background-color: #f5f5f5;
  padding: 16px;
  border-radius: 4px;
  overflow-x: auto;
  font-size: 0.875rem;
  line-height: 1.4;
}
</style> 