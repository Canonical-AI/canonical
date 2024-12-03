<template>
    <v-list>
        <v-list-item @click="$router.push('/settings/user')" >
            User
        </v-list-item>
        <v-list-item @click="$router.push('/settings/project')">
            Project
        </v-list-item>
    </v-list>
</template>