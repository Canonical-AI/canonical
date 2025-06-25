<template>
  <div class="chat-sidepanel h-100 d-flex flex-column pb-24">
    <!-- Recent Chats Section -->
    <div v-if="recentChats.length > 0" class="recent-chats flex-shrink-0">
      <!-- Show list when no chat selected -->
      <div v-if="!chatHist.id">
        <div class="recent-chats-header pa-2">
          <span class="text-caption text-medium-emphasis">Recent Chats</span>
        </div>
        <v-list density="compact" class="pa-0">
          <v-list-item
            v-for="chat in recentChats"
            density="compact"
            :key="chat.id"
            :title="chat.data.name || 'Untitled Chat'"
            :subtitle="$dayjs(chat.data.updatedDate?.seconds * 1000).fromNow()"
            class="recent-chat-item px-2 py-1"
            @click="loadChat(chat)"
          >
            <template v-slot:prepend>
              <v-icon size="x-small" color="primary">mdi-chat-outline</v-icon>
            </template>
          </v-list-item>
        </v-list>
      </div>
      
      <!-- Show compact toolbar when chat selected -->
      <div v-else class="chat-toolbar d-flex align-center justify-space-between px-2 py-0">
        <span class="text-caption text-medium-emphasis">{{ chatHist.data.name || 'Chat' }}</span>
        <v-btn 
          size="x-small" 
          variant="text" 
          icon="mdi-history"
          @click="showChatHistory"
          title="View recent chats"
        ></v-btn>
      </div>
      
    </div>

    <!-- Chat Header -->


    <!-- Chat Messages -->
    <div class="chat-messages flex-grow-1 overflow-y-auto pa-3">
      <v-fade-transition>
        <div v-if="!isLoading" class="messages-container">
          <v-fade-transition group tag="div">
            <div 
              v-for="(message, index) in (chatHist.data.messages || []).slice()" 
              :key="message.index"
              class="message-wrapper mb-3"
            >
              <!-- User Message -->
              <div v-if="message.sent" class="message user-message">
                <div 
                  class="message-bubble user-bubble pa-2 rounded-lg"
                  :class="{ 'system-message': message.isSystemMessage }"
                >
                  <p 
                    class="message-text text-body-2 mb-0" 
                    v-html="renderMarkdown(message.text)"
                  ></p>
                </div>
                <div v-if="!message.isSystemMessage" class="message-timestamp text-caption text-medium-emphasis mt-1 text-right">
                  {{ $dayjs(message.timestamp).fromNow() }}
                </div>
              </div>
              
              <!-- Bot Message -->
              <div v-else class="message bot-message">
                <div class="message-bubble bot-bubble pa-2 rounded-lg">
                  <p 
                    class="message-text text-body-2 mb-0"
                    :class="{ 'typing': message.isTyping }"
                    v-html="renderMarkdown(message.text)"
                  ></p>
                </div>
              </div>
            </div>
          </v-fade-transition>
        </div>
      </v-fade-transition>
      
      <!-- Loading State -->
      <div v-if="isLoading" class="d-flex justify-center align-center" style="height: 200px;">
        <v-progress-circular indeterminate color="primary"></v-progress-circular>
      </div>
    </div>

    <!-- Chat Input -->
    <div class="chat-input flex-shrink-0 pa-3">
      <v-textarea
        v-model="newMessage"
        @keyup.enter="sendMessage"
        rows="2"
        auto-grow
        density="compact"
        hide-details
        clearable
        placeholder="Ask about your document..."
        max-rows="4"
      >
        <template v-slot:append-inner>
          <v-fade-transition>
            <div v-if="newMessage !== ''" class="d-flex align-center">
              <v-btn 
                color="success"
                size="small"
                icon="mdi-send"
                @click="sendMessage"
                :loading="isSending"
              >

              </v-btn>
            </div>
          </v-fade-transition>
        </template>
      </v-textarea>
    </div>
  </div>
</template>

<script>
import { Chat } from "../../services/vertexAiService";
import { ChatHistory } from "../../services/firebaseDataService";
import { marked } from 'marked';
import { useEventWatcher } from "../../composables/useEventWatcher";
import { eventStore } from "../../store/eventStore";

export default {
  name: 'ChatSidepanel',
  props: {
    documentId: {
      type: String,
      default: null
    },
    documentContent: {
      type: String,
      default: ''
    }
  },
  emits: ['close'],
  data() {
    return {
      newMessage: '',
      chatInstance: null,
      isLoading: false,
      isSending: false,
      mentorGreetings: [
        "How can I help with your document today?",
        "What would you like me to review or improve?",
        "Need feedback on your content?",
        "How can I make your document better?",
        "What questions do you have about your document?",
        "Would you like me to suggest improvements?",
        "How can I help you refine this document?",
        "What aspect would you like me to focus on?"
      ],
      chatHist: {
        id: null,
        data: {
          name: null,
          messages: [{
            index: 1,
            text: '',
            sent: false,
            timestamp: Date.now()
          }],
        }
      },
    };
  },
  computed: {
    recentChats() {
      // Get the last 3 most recent chats, sorted by updated date
      return this.$store.chats
        .filter(chat => !chat.data.archived)
        .sort((a, b) => (b.data.updatedDate?.seconds || 0) - (a.data.updatedDate?.seconds || 0))
        .slice(0, 3);
    }
  },
  async created() {
    // Load chats if not already loaded
    if (this.$store.chats.length === 0 && this.$store.isUserLoggedIn) {
      await this.$store.getChats();
    }
    await this.initializeChat();
    
    // Watch for document save events instead of content changes
    useEventWatcher(eventStore, 'documentSaved', (payload) => {
      // Only update if this is the document we're chatting about
      if (payload.documentId === this.documentId && this.chatInstance) {
        this.updateDocumentContext(payload.documentData.content);
      }
    });
  },
  watch: {
    // Removed documentContent watcher - now using event-based approach
    // to only update when document is actually saved successfully
  },
  methods: {
    getRandomGreeting() {
      const randomIndex = Math.floor(Math.random() * this.mentorGreetings.length);
      return this.mentorGreetings[randomIndex];
    },

    renderMarkdown(text) {
      return marked.parse(text);
    },

    showChatHistory() {
      // Reset to new chat state to show recent chats list
      this.chatHist = {
        id: null,
        data: {
          name: null,
          messages: [{
            index: 1,
            text: this.getRandomGreeting(),
            sent: false,
            timestamp: Date.now()
          }],
        }
      };
      
      // Reset chat instance
      this.chatInstance = null;
      this.initializeChat();
    },

    async loadChat(chat) {
      this.isLoading = true;
      
      try {
        // Get the full chat history
        const result = await ChatHistory.getDocById(chat.id);
        
        if (result.success) {
          this.chatHist = result.data;
          
          // Ensure messages array exists
          if (!this.chatHist.data.messages) {
            this.chatHist.data.messages = [];
          }
          
          // Initialize chat instance with history
          this.chatInstance = new Chat();
          await this.chatInstance.initChat({ history: this.chatHist });
          
          // If we have document content, update the context for this loaded chat
          if (this.documentContent) {
            await this.updateDocumentContext(this.documentContent);
          }
        } else {
          throw new Error(result.message || 'Failed to load chat');
        }
        
      } catch (error) {
        console.error('Error loading chat:', error);
        this.$store.uiAlert({ 
          type: 'error', 
          message: 'Failed to load chat', 
          autoClear: true 
        });
      } finally {
        this.isLoading = false;
      }
    },

    async initializeChat() {
      // Only initialize if we haven't already
      if (this.chatInstance) {
        return;
      }

      this.isLoading = true;
      
      // Initialize with a greeting
      this.chatHist = {
        id: null,
        data: {
          name: `Document Chat - ${this.documentId || 'New Document'}`,
          messages: [{
            index: 1,
            text: this.getRandomGreeting(),
            sent: false,
            timestamp: Date.now()
          }],
        }
      };

      // Initialize chat instance
      if (this.$store.isUserLoggedIn) {
        this.chatInstance = new Chat();
        await this.chatInstance.initChat();
      }
      
      this.isLoading = false;
    },

    async provideDocumentContext() {
      if (this.documentContent) {
        const contextMessage = `I'm working on a document with the following content:\n\n${this.documentContent}\n\nPlease help me improve it and answer any questions I have about it.`;
        
        // Send context to AI but don't add to chat history to avoid role conflicts
        const chatOut = await this.chatInstance.sendMessage(contextMessage);
        
        // Consume the response but don't add it to chat history
        for await (const chunk of chatOut.stream) {
          // Just consume the chunks to complete the request
        }

        // Only add a visual indicator that document was shared (won't be sent to AI)
        this.chatHist.data.messages.push({
          index: this.chatHist.data.messages.length + 1,
          text: `📄 Shared "${this.documentId || 'document'}"`,
          sent: true,
          timestamp: Date.now(),
          isSystemMessage: true // This gets filtered out when sending to AI
        });
      }
    },

    async updateDocumentContext(newContent) {
      if (newContent && this.chatInstance) {
        const contextMessage = `The document content has been updated. Here's the new content:\n\n${newContent}\n\nPlease help me improve it and answer any questions I have about it.`;
        
        // Send the updated context to the chat but don't add to chat history
        const chatOut = await this.chatInstance.sendMessage(contextMessage);
        
        // Consume the response but don't add it to chat history
        for await (const chunk of chatOut.stream) {
          // Just consume the chunks to complete the request
        }

        // Only add a visual indicator that document was updated (won't be sent to AI)
        this.chatHist.data.messages.push({
          index: this.chatHist.data.messages.length + 1,
          text: `📄 Updated "${this.documentId || 'document'}"`,
          sent: true,
          timestamp: Date.now(),
          isSystemMessage: true // This gets filtered out when sending to AI
        });
      }
    },

    async HandleChatDoc() {
      if (!this.chatHist.id) {
        const firstMessageText = this.chatHist.data.messages[1].text;
        const summary = await this.chatInstance.summarizeChat(firstMessageText);
        this.chatHist.data.name = summary.response.text();

        const newChatHist = await ChatHistory.create(this.chatHist.data);
        this.chatHist.id = newChatHist.id;
        this.$store.getChats();
        return this.chatHist;
      } else {
        await ChatHistory.updateChat(this.chatHist.id, this.chatHist.data);
      }
    },

    async sendMessage() {
      if (this.newMessage.trim() && !this.isSending) {
        this.isSending = true;
        
        // Check if this is the first user message and provide document context
        const isFirstUserMessage = this.chatHist.data.messages.filter(m => m.sent).length === 0;
        
        // Add user message
        this.chatHist.data.messages.push({
          index: this.chatHist.data.messages.length + 1,
          text: this.newMessage,
          sent: true,
          timestamp: Date.now()
        });
        
        const userMessage = this.newMessage.slice();
        this.newMessage = '';

        // If this is the first user message, provide document context first
        if (isFirstUserMessage && this.documentContent) {
          await this.provideDocumentContext();
        }

        // Add typing indicator
        const botMessage = {
          index: this.chatHist.data.messages.length + 1,
          text: '...',
          sent: false,
          timestamp: Date.now(),
          isTyping: true
        };
        this.chatHist.data.messages.push(botMessage);

        try {
          const chatOut = await this.chatInstance.sendMessage(userMessage);
          const lastMessageIndex = this.chatHist.data.messages.length - 1;
          let fullResponse = '';

          for await (const chunk of chatOut.stream) {
            this.chatHist.data.messages[lastMessageIndex].isTyping = false;
            const chunkText = chunk.text();
            for (let char of chunkText) {
              fullResponse += char;
              this.chatHist.data.messages[lastMessageIndex].text = fullResponse;
              await new Promise(resolve => setTimeout(resolve, 10));
            }
          }

          await this.HandleChatDoc();
        } catch (error) {
          console.error('Error sending message:', error);
          // Remove the typing indicator and show error
          this.chatHist.data.messages.pop();
        } finally {
          this.isSending = false;
        }
      }
    }
  }
};
</script>

<style scoped>
.chat-sidepanel {
  height: 100%;
  background-color: rgb(var(--v-theme-surface));
  display: flex;
  flex-direction: column;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  min-height: 0; /* Allow flexbox to shrink */
}

.messages-container {
  min-height: 100%;
}

.message-wrapper {
  display: flex;
  flex-direction: column;
}

.message {
  display: flex;
  flex-direction: column;
  max-width: 100%;
}

.user-message {
  align-items: flex-end;
}

.bot-message {
  align-items: flex-start;
}

.message-bubble {
  max-width: 85%;
  word-wrap: break-word;
}

.user-bubble {
  background-color: rgba(var(--v-theme-primary), 0.1);
  color: rgb(var(--v-theme-on-surface));
}

.bot-bubble {
  background-color: rgba(var(--v-theme-surface-variant), 0.5);
  color: rgb(var(--v-theme-on-surface));
}

/* System message styling */
.system-message {
  background-color: rgba(var(--v-theme-outline), 0.1) !important;
  color: rgba(var(--v-theme-on-surface), 0.7) !important;
  font-style: italic;
  font-size: 0.875rem;
}

.message-text {
  line-height: 1.4;
}

.message-text :deep(ul),
.message-text :deep(ol) {
  padding-left: 1em;
  margin: 0.5em 0;
}

.message-text :deep(p) {
  margin: 0.5em 0;
}

.message-timestamp {
  font-size: 0.75rem;
}

.chat-input {
  background-color: rgb(var(--v-theme-surface));
  flex-shrink: 0; /* Prevent shrinking */
  min-height: 0; /* Allow content to determine height */
  position: fixed;
  bottom: 48px;
  width: 100%;
  z-index: 100;
}

.typing {
  animation: blink 1.4s infinite both;
}

@keyframes blink {
  0% { opacity: 0.2; }
  20% { opacity: 1; }
  100% { opacity: 0.2; }
}

/* Scrollbar styling */
.chat-messages::-webkit-scrollbar {
  width: 6px;
}

.chat-messages::-webkit-scrollbar-track {
  background: transparent;
}

.chat-messages::-webkit-scrollbar-thumb {
  background-color: rgba(var(--v-theme-outline), 0.3);
  border-radius: 3px;
}

.chat-messages::-webkit-scrollbar-thumb:hover {
  background-color: rgba(var(--v-theme-outline), 0.5);
}

/* Recent chats section */
.recent-chats {
  border-bottom: 1px solid rgba(var(--v-theme-outline), 0.1);
  background-color: rgba(var(--v-theme-surface-variant), 0.2);
}

.recent-chats-header {
  min-height: 32px;
  background-color: rgba(var(--v-theme-surface-variant), 0.1);
}

.chat-toolbar {
  min-height: 32px;
  background-color: rgba(var(--v-theme-primary), 0.08);
}

.recent-chat-item {
  cursor: pointer;
  transition: background-color 0.2s ease;
  min-height: 40px !important;
}

.recent-chat-item:hover {
  background-color: rgba(var(--v-theme-primary), 0.08);
}

.recent-chat-item .v-list-item__content {
  padding: 2px 0;
}

.recent-chat-item .v-list-item-title {
  font-size: 0.75rem !important;
  font-weight: 500;
  line-height: 1.2;
}

.recent-chat-item .v-list-item-subtitle {
  font-size: 0.65rem !important;
  opacity: 0.6;
  line-height: 1.1;
}

.recent-chat-item .v-list-item__prepend {
  padding-inline-end: 8px;
}

/* Ensure textarea doesn't overflow */
.chat-input :deep(.v-field__input) {
  max-height: 120px; /* Limit max height */
  overflow-y: auto;
}
</style> 