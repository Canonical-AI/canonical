<template>
    <v-container fluid>
      <v-row id="chatList" class="mb-10" >
        <v-col cols="12">
          <v-fade-transition>
            <v-list v-if="!isLoading" class="chat-list mx-auto" style="max-width: 800px;">
              <v-fade-transition group tag="v-list">
                <v-list-item v-for="(message, index) in chatHist.data.messages.slice()" :key="message.index">
                  <div class="rounded-2xl pa-2 text-break message-right float-right"v-if="message.sent" >
                      <v-hover v-slot:default="{ isHovering , props }">
                        <v-slide-y-reverse-transition>
                        <div v-if="isHovering && message.sent" class="timestamp">
                          {{ $dayjs(message.timestamp).fromNow() }}
                        </div>
                      </v-slide-y-reverse-transition>
                      <p 
                        class="chat-message text-body" 
                        v-html="renderMarkdown(message.text)"
                        v-bind="props"
                        >
                      </p>
                      </v-hover>
                  </div>
                  <div class="rounded-2xl pa-2 text-break message-left float-left w-100" v-else>
                      <p 
                        class="chat-message text-body"
                        :class="{ 'typing': message.isTyping }"
                        v-html="renderMarkdown(message.text)"
                      >
                      </p>
                    
                  </div>  
                </v-list-item>
              </v-fade-transition>
            </v-list>
          </v-fade-transition>
        </v-col>
        <div ref="bottomElement"></div>
      </v-row>
      <div class="fixed-bottom" style="position: sticky; bottom: 32px; left: 0; right: 0;">
        <div class="mx-auto rounded-lg border" style="max-width: 800px;">
          <v-textarea
            v-model="newMessage"
            @keyup.enter="sendMessage"
            label="Type a message"
            variant="outlined"
            rows="2"
            clearable
            auto-grow
            bg-color="rgba(var(--v-theme-surface),1)"
            hide-details
          >
            <template v-slot:append-inner>
                <v-btn 
                v-if="newMessage !== ''"
                transition="fade-transition"
                class="text-none transition-opacity duration-500 ease-in opacity-0"
                :class="{'opacity-100': newMessage !== ''}"
                color="success"
                @click="sendMessage">Send</v-btn>
            </template>
        
        </v-textarea>

       </div>
      </div>
    </v-container>
  </template>
  
 
 <script>

import {Chat} from "../../services/vertexAiService"
import { ChatHistory } from "../../services/firebaseDataService"; // Import Document class
import {marked} from 'marked'

  export default {
    data() {
      return {
        newMessage: '',
        selectedMessage: null, // Add this line to track the selected message
        chatInstance: null,
        isLoading: false,
        mentorGreetings:[
          "How are you doing today? how can I help?",
          "How is your product doing?",
          "Having trouble with anything?", 
          "Everything on track?",
          "How is your roadmap looking?",
          "Any critical blockers lately?",
          "What are your stakeholders saying?",
          "How is your team doing?"
       ],
        chatHist:{
          id: null,
          data : {
            name: null,
            messages: [{
              index:1,
              text: '',
              sent: false,
              timestamp: Date.now()
            }],
          }
        },
      };
    },
    emits: ['scrollToBottom'],
    watch:{

      $route: {
        async handler(){

          if (this.$route.params.id) {    
            this.isLoading = true
              const storedChatHist = await ChatHistory.getDocById(this.$route.params.id)
              this.chatHist = storedChatHist
              this.chatInstance = new Chat(); 
              await this.chatInstance.initChat({history:storedChatHist})
              this.isLoading = false
              this.scrollToBottom();
          } else {
            this.chatHist = {
                id: null,
                data : {
                  name: null,
                  messages: [{
                    index:1,
                    text: this.getRandomGreeting() ,
                    sent: false,
                    timestamp: Date.now()
                  }],
                }
              }
            }
          }, 
        immediate: true
      },

      '$store.getters.isUserLoggedIn':{
        async handler(isUserLoggedIn){
          if(this.$store.getters.isUserLoggedIn){
            this.chatInstance = new Chat(); 
            await this.chatInstance.initChat()
          } else {
            this.$router.push({ path: '/' });
          }
        },
        immediate: true
      }
    },
    methods: {

      getRandomGreeting() {
        const randomIndex = Math.floor(Math.random() * this.mentorGreetings.length);
        return this.mentorGreetings[randomIndex];
      },

      renderMarkdown(text) {
        return marked.parse(text); // Convert Markdown to HTML
      },

      async HandleChatDoc(){
        if (!this.chatHist.id) {
          const firstMessageText = this.chatHist.data.messages[1].text;
          const summary = await this.chatInstance.summarizeChat(firstMessageText)
          console.log(summary.response.text())
          this.chatHist.data.name = summary.response.text()

          const newChatHist = await ChatHistory.create(this.chatHist.data)
          this.chatHist.id = newChatHist.id
          this.$router.push({ path: `/chat/${newChatHist.id}` });
          this.$store.commit('getChats')
          return this.chatHist
        
        } else {
          await ChatHistory.updateChat(this.chatHist.id, this.chatHist.data);
        }
      },

      async sendMessage() {
        if (this.newMessage.trim()) {
          this.chatHist.data.messages.push({ 
              index: this.chatHist.data.messages.length+1,
              text: this.newMessage, 
              sent: true ,  
              timestamp: Date.now() });
          const userMessage = this.newMessage.slice();
          this.newMessage = '';
          
          // Add typing indicator message
          const botMessage = { 
            index: this.chatHist.data.messages.length + 1,
            text: '...', // Changed to use dots for typing animation
            sent: false, 
            timestamp: Date.now(),
            isTyping: true // Add new property to control animation
          };
          this.chatHist.data.messages.push(botMessage);
          this.scrollToBottom();

          const chatOut = await this.chatInstance.sendMessage(userMessage);

          const lastMessageIndex = this.chatHist.data.messages.length - 1;
          let fullResponse = '';

          for await (const chunk of chatOut.stream) {
            const chunkText = chunk.text();
            await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * (900 - 400 + 1)) + 400)); // Random delay between 400 and 900 ms
          
            fullResponse += chunkText;
            this.chatHist.data.messages[lastMessageIndex].text = fullResponse;
            this.scrollToBottom();
          }

          // Remove typing indicator after message is complete
          this.chatHist.data.messages[lastMessageIndex].isTyping = false;
          this.scrollToBottom();

          await this.HandleChatDoc();
        }
      },
      
      scrollToBottom() {
        this.$emit('scrollToBottom')
      }
    }
  };
  </script>
  
<style>

.fixed-bottom {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 1000; /* Ensure it appears above other content */
}


.typing-indicator {
  display: inline-block;
  width: 1em;
  height: 1em;
  border-radius: 50%;
  background-color: rgba(var(--v-theme-surface), 1);
  animation: typing 2s infinite steps(3);
}

.typing-indicator::after {
  animation: typing-dot 1.4s infinite both;
}

@keyframes blink {
  0% {
    opacity: 0.2;
  }
  20% {
    opacity: 1;
  }
  100% {
    opacity: 0.2;
  }
}

.chat-message{
  ul,ol {
    padding-left: 1em;
  }

  p{
    margin-top: .5em;
    margin-bottom: .5em;
  }

}

.chat-list{
    max-height: none;
    background-color: inherit !important;
    overflow: visible;
}

.chat-list::after {
    content: '';
    position: fixed;
    bottom: 75px; /* Position at the bottom */
    left: 0;
    right: 0;
    height: 20%; /* Adjust height for the fade area */
   pointer-events: none; /* Allow clicks to pass through */
}

  .sender {
    font-weight: normal; /* Demphasized sender */
    font-size: 0.9em; /* Smaller font size */
  }
  
  .timestamp {
    font-weight: normal; /* Demphasized timestamp */
    font-size: 0.8em; /* Smaller font size */
    margin-left: 8px; /* Space between sender and timestamp */
    position: absolute;
    top: -20px; /* Adjust as needed */
    right: 0;
    text-align: center;
    font-size: 0.8em;
    color: gray;
  }
  

.message-right {
    background-color: rgba(var(--v-theme-surface-light),1) ;
    max-width: 75%;
    justify-content: left;
}

.typing {
  position: relative;
  display: inline-block; /* Ensure it wraps around the text */
}

.typing > * {
  display: inline-block; /* Ensure children are inline-block for animation */
  animation: typing 0.5s forwards; /* Animation duration can be adjusted */
}


@keyframes typing {
  from { width: 0 }
  to { width: 100% }
}

/* .hal-avatar{
  background: radial-gradient(circle, 
    rgb(222, 247, 0) 0%, 
    rgba(139, 0, 0, 1) 20%, 
    rgba(0, 0, 0, 1) 70%) !important;
    border: 2px solid rgba(var(--v-theme-surface-variant),1) !important;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
} */

  </style>