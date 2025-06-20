<template>
  <v-responsive>
    <v-app>
      <v-main class=" h-100 overflow-y-auto">
        <v-container v-if="loading">
          <span class="d-flex justify-space-between align-center w-100 mb-5" > <!-- Added justify-space-between and w-100 -->

            <v-skeleton-loader type="heading" class="mr-3 bg-inherit" width="200"></v-skeleton-loader>
            <v-skeleton-loader type="button" class="bg-inherit" width="200" ></v-skeleton-loader>
          </span>
          <v-row>
            <v-col v-for="n in 6" :key="n" cols="12" sm="6" md="4">
              <v-skeleton-loader
                class="mx-auto bg-inherit"
                type="card"
                height="300"
              ></v-skeleton-loader>
            </v-col>
          </v-row>
        </v-container>
        <v-container v-else-if="favoriteDocuments.length > 0">
          <span class="d-flex justify-space-between align-center w-100 mb-5" > <!-- Added justify-space-between and w-100 -->
            <h1 class="mr-3">{{title}}</h1> <!-- Added Vuetify margin class -->
            <v-btn @click="createDocument" color="primary">Create Document</v-btn>
          </span>
          <v-row>
            <v-col v-for="doc in favoriteDocuments" :key="doc.id" cols="12" sm="6" md="4">
              <v-card class="d-flex flex-column p-1 rounded-lg border border-surface-light" height="300" @click="goToDocument(doc.id)" :style="getRandomGradient()"> <!-- Added click event -->
                <v-card-title v-if="doc.data?.name" ><v-icon left>mdi-file-document</v-icon>   {{ doc.data.name }}</v-card-title>
                <v-card-subtitle v-if="doc.data?.updatedDate" >{{ $dayjs(doc.data.updatedDate?.seconds*1000).fromNow() }}</v-card-subtitle> <!-- Added subtitle --> 
                <v-card-text 
                  v-if="doc.data?.content"
                  :style="{ backgroundColor: 'rgb(var(--v-theme-surface))!important'}"  
                  class="flex-grow-1 p-3 m-1 rounded-lg border border-surface-light elevation-1 overflow-hidden h-100 doc-card whitespace-normal text-clip" 
                  v-html="renderMarkdown(doc.data.content)"></v-card-text>
              </v-card>
            </v-col>
          </v-row>
        </v-container>
        <v-container v-else>
          <span class="d-flex justify-space-between align-center w-100 mb-5" > <!-- Added justify-space-between and w-100 -->
            <h1 v-if="$store.user.uid" class="mr-3">Favorites</h1> <!-- Added Vuetify margin class -->
            <v-btn @click="createDocument" :disabled="!$store.user.uid" color="primary">Create Document</v-btn>
          </span>
          <h1 v-if="$store.user.uid">It's quiet here... add some documents to your favorites</h1>
          <h1 v-else>you're not logged in :/</h1>
        </v-container>
      </v-main>
    </v-app>
  </v-responsive>
</template>

<script>
import { marked } from 'marked';
import ReferenceLink from './editor/reference-link/ReferenceLink.vue';

export default {
  name: 'Home',
  components: {
    ReferenceLink,
  },
  data() {
    return {
      title: 'Favorites',
      loading: true, // Add loading state
    };
  },
  computed: {
    favoriteDocuments() {
      const favorites = this.$store.documents
        .filter(doc => this.$store.isFavorite(doc.id))
        .sort((a, b) => b.data?.updatedDate?.seconds - a.data?.updatedDate?.seconds);

      if (favorites.length > 0) {
        return favorites;
      }
      
      this.title = 'Recent Documents'

      // If no favorites, return the 5 most recent documents only if they have content
      return this.$store.documents
        .filter(doc => doc.data?.content)
        .sort((a, b) => b.data?.updatedDate?.seconds - a.data?.updatedDate?.seconds)
        .slice(0, 5);
    }, 
  },
  watch: {
    favoriteDocuments: {
      handler(docs){
        if (this.$store.user.uid) {
          this.loading = docs.length === 0;
        } else {
          this.loading = false;
        }
      },
      immediate: true,
    }
  },
  methods: {
    createDocument() {
      this.$router.push({ path: '/document/create-document' });
    },
    goToDocument(id) {
      this.$router.push({ path: `/document/${id}` }); // Navigate to the document detail page
    },
    renderMarkdown(content) {
      const renderer = new marked.Renderer();
      // Override the text renderer to detect the pattern inline
      renderer.text = (text) => {
        // Ensure text is a string

        if (text.type !== 'text') {
          return text.raw;
        }

        const refPattern = /:canonical-ref{src="([^"]+)"}/g;
        return text.raw.replace(refPattern, (match, src) => {
          // Return a placeholder for the Vue component
          return `<button class="v-chip v-chip--label v-chip--link v-theme--hal2001 text-primary v-chip--density-default v-chip--size-default v-chip--variant-tonal"> @ref</button>`;
        });
      };

      // Parse the markdown with the custom renderer
      const parseMarkdown = marked.parse(content, { breaks: true, gfm: true, renderer });

      return parseMarkdown;
    },
    getRandomGradient() {
      const baseColors = [
        'rgb(var(--v-theme-surface-light))',
        'rgb(var(--v-theme-surface-variant))',
        'rgb(var(--v-theme-surface-bright))',
        'rgb(var(--v-theme-surface))',
      ];
      const accentColors = [
        'rgba(var(--v-theme-primary-darken-1), 0.25)',
        'rgba(var(--v-theme-secondary-darken-1), 0.25)',
        'rgba(var(--v-theme-info), 0.25)',
        'rgba(var(--v-theme-error), 0.25)',
        'rgba(var(--v-theme-warning), 0.25)',
        'rgba(var(--v-theme-success), 0.25)',
      ];
      const color1 = baseColors[Math.floor(Math.random() * baseColors.length)];
      const color2 = accentColors[Math.floor(Math.random() * accentColors.length)];
      const color3 = baseColors[Math.floor(Math.random() * baseColors.length)];
      return {
        background: `linear-gradient(${Math.floor(Math.random() * 360)}deg, ${color1} 45%, ${color2} 76%, ${color3} 100%)`
      };
    },
  }
}
</script>

<style scoped>
/* Add any styles you need here */

.doc-card :deep(ul),
.doc-card :deep(ol) {
  padding-left: 1em;
}

.doc-card :deep(p) {
  margin-top: .5em;
  margin-bottom: .5em;
}

</style>
