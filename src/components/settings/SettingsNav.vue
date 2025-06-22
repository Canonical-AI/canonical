<template>
    <v-list>
        <v-list-item @click="$router.push('/settings/user')" >
            User
        </v-list-item>
        <v-list-item @click="navigateToProject()">
            Project
        </v-list-item>
    </v-list>
</template>

<script>
export default {
    name: 'SettingsNav',
    methods: {
        navigateToProject() {
            // Navigate to current project if available, otherwise just go to project settings
            const projectId = this.$store.project?.id;
            if (projectId) {
                this.$router.push(`/settings/project/${projectId}`);
            } else {
                // If no current project, go to project settings without ID (will show project selection)
                this.$router.push('/settings/project/new');
            }
        }
    }
}
</script>