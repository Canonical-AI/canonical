<template>
  <v-sheet>
      <section v-if="isLoggedIn">
        <v-btn @click="logout">Logout</v-btn>
      </section>
      <section v-else id="firebaseui-auth-container"></section>
  </v-sheet>
</template>

<script>
import {firebaseApp} from "../firebase";
import { getAuth, GoogleAuthProvider, EmailAuthProvider, GithubAuthProvider, setPersistence, browserLocalPersistence } from 'firebase/auth';
import * as firebaseui from 'firebaseui'

const auth = getAuth(firebaseApp);

export default {
  props: {
    registering: {
      type: Boolean,
      default: false
    }
  },
  computed: {
    isLoggedIn() {
      return this.$store.getters.isLoggedIn;
    },
  },
  async mounted() {
    await setPersistence(auth, browserLocalPersistence);
    let ui = firebaseui.auth.AuthUI.getInstance();
    if (!ui) {ui = new firebaseui.auth.AuthUI(auth);}
    var uiConfig = {
      signInFlow: 'popup',
      signInOptions: [
        {
          provider: GoogleAuthProvider.PROVIDER_ID,
          customParameters: { prompt: 'select_account'}
        },
        GithubAuthProvider.PROVIDER_ID,
        EmailAuthProvider.PROVIDER_ID,
      ],
      callbacks: {
        signInSuccessWithAuthResult: ()=>{
          this.$store.dispatch('enter')
          this.$emit('login-success')
          return
        }
      }
    };
   ui.start("#firebaseui-auth-container", uiConfig);
  }
};
</script>

<style scoped>
</style>
