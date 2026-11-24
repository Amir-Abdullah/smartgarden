<template>
  <UDashboardPanel id="community-view">
    <template #header>
      <UDashboardNavbar title="Community Hub & Social Feed">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <AlertBellButton />
          <UColorModeButton />
          <UButton
            color="primary"
            size="sm"
            icon="i-lucide-plus"
            @click="composerOpen = !composerOpen"
          >
            New Post
          </UButton>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="space-y-6">
        <!-- New Post Composer -->
        <UCard v-if="composerOpen" data-testid="community-composer-card">
          <template #header>
            <h3 class="text-sm font-semibold text-zinc-900 dark:text-white">
              Share With Fellow Growers
            </h3>
          </template>
          <form class="space-y-3" @submit.prevent="handleCreatePost">
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <UFormField label="Post Title" required class="sm:col-span-2">
                <UInput v-model="postForm.title" placeholder="e.g. Drip emitter spacing for raised beds" class="w-full" required />
              </UFormField>
              <UFormField label="Category" required>
                <USelect v-model="postForm.category" :items="categorySelectOptions" value-key="value" class="w-full" />
              </UFormField>
            </div>
            <UFormField label="Post Content" required>
              <UTextarea v-model="postForm.content" :rows="3" placeholder="Share harvest tips, experiments, or questions..." class="w-full" required />
            </UFormField>
            <div class="flex flex-wrap items-center justify-end gap-2">
              <UButton color="neutral" variant="outline" @click="composerOpen = false">Cancel</UButton>
              <UButton type="submit" color="primary" icon="i-lucide-send" :loading="creatingPost">
                Publish Post
              </UButton>
            </div>
          </form>
        </UCard>

        <!-- Feed Filters -->
        <UCard>
          <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div class="flex flex-wrap gap-1.5">
              <UButton
                v-for="tab in filterTabs"
                :key="tab.value"
                size="xs"
                :color="activeCategory === tab.value ? 'primary' : 'neutral'"
                :variant="activeCategory === tab.value ? 'solid' : 'outline'"
                @click="activeCategory = tab.value"
              >
                {{ tab.label }}
              </UButton>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <UInput v-model="searchQuery" placeholder="Search posts..." size="sm" class="w-56" />
              <UButton
                size="sm"
                :color="followingOnly ? 'primary' : 'neutral'"
                :variant="followingOnly ? 'solid' : 'outline'"
                icon="i-lucide-users"
                @click="followingOnly = !followingOnly"
              >
                Following Only
              </UButton>
            </div>
          </div>
        </UCard>

        <!-- Feed Posts -->
        <div v-if="sprint4Store.communityLoading" class="py-8 text-center text-xs text-zinc-500">
          Loading community discussions...
        </div>
        <UEmpty
          v-else-if="sprint4Store.posts.length === 0"
          icon="i-lucide-globe"
          title="No community posts match your filters"
          description="Be the first to share a seasonal showcase, cultivation tip, or gardening question."
        />
        <div v-else class="space-y-4">
          <UCard
            v-for="post in sprint4Store.posts"
            :key="post.id"
            :data-testid="`community-post-${post.id}`"
          >
            <template #header>
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div class="space-y-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <UBadge v-if="post.is_pinned" color="warning" variant="subtle" size="xs" icon="i-lucide-pin">
                      Pinned
                    </UBadge>
                    <UBadge v-if="post.is_flagged" color="error" variant="subtle" size="xs">
                      Flagged
                    </UBadge>
                    <UBadge color="primary" variant="soft" size="xs">
                      {{ post.category }}
                    </UBadge>
                    <span class="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                      {{ post.author_name }}
                    </span>
                    <span v-if="post.author_region" class="text-xs text-zinc-400">
                      &bull; {{ post.author_region }}
                    </span>
                  </div>
                  <h3 class="text-base font-bold text-zinc-900 dark:text-white">
                    {{ post.title }}
                  </h3>
                </div>

                <div class="flex flex-wrap items-center gap-2">
                  <UButton
                    v-if="authStore.user && Number(authStore.user.id) !== Number(post.author_id)"
                    size="xs"
                    :color="post.author_followed_by_me ? 'neutral' : 'primary'"
                    :variant="post.author_followed_by_me ? 'outline' : 'soft'"
                    :icon="post.author_followed_by_me ? 'i-lucide-user-check' : 'i-lucide-user-plus'"
                    @click="handleFollow(post)"
                  >
                    {{ post.author_followed_by_me ? 'Following' : 'Follow' }}
                  </UButton>

                  <template v-if="authStore.isAdmin">
                    <UButton
                      size="xs"
                      color="neutral"
                      variant="ghost"
                      :icon="post.is_pinned ? 'i-lucide-pin-off' : 'i-lucide-pin'"
                      @click="sprint4Store.moderatePost(post.id, { is_pinned: !post.is_pinned })"
                    >
                      {{ post.is_pinned ? 'Unpin' : 'Pin' }}
                    </UButton>
                    <UButton
                      size="xs"
                      color="warning"
                      variant="ghost"
                      icon="i-lucide-flag"
                      @click="sprint4Store.moderatePost(post.id, { is_flagged: !post.is_flagged })"
                    >
                      {{ post.is_flagged ? 'Unflag' : 'Flag' }}
                    </UButton>
                  </template>

                  <UButton
                    v-if="authStore.isAdmin || (authStore.user && Number(authStore.user.id) === Number(post.author_id))"
                    size="xs"
                    color="error"
                    variant="ghost"
                    icon="i-lucide-trash-2"
                    aria-label="Delete post"
                    @click="sprint4Store.deletePost(post.id)"
                  />
                </div>
              </div>
            </template>

            <div class="space-y-3">
              <img
                v-if="post.photo_url"
                :src="post.photo_url"
                alt="Community photo"
                class="max-h-72 w-full rounded-lg object-cover border border-zinc-200 dark:border-zinc-800"
              />
              <p class="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                {{ post.content }}
              </p>

              <div class="flex flex-wrap items-center gap-3 pt-1">
                <UButton
                  size="xs"
                  :color="post.liked_by_me ? 'error' : 'neutral'"
                  :variant="post.liked_by_me ? 'soft' : 'outline'"
                  icon="i-lucide-heart"
                  @click="sprint4Store.toggleLike(post.id)"
                >
                  Like ({{ post.likes_count }})
                </UButton>

                <UButton
                  size="xs"
                  color="neutral"
                  variant="outline"
                  icon="i-lucide-message-square"
                  @click="toggleComments(post.id)"
                >
                  Comments ({{ post.comments_count }})
                </UButton>
              </div>

              <!-- Threaded Comments Drawer -->
              <div
                v-if="expandedComments[post.id]"
                class="mt-3 space-y-2.5 rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/50"
              >
                <div
                  v-for="comment in (sprint4Store.commentsByPost[post.id] || [])"
                  :key="comment.id"
                  :class="[
                    'rounded-lg bg-white p-2.5 text-xs shadow-2xs dark:bg-zinc-900',
                    comment.parent_comment_id ? 'ml-6 border-l-2 border-emerald-500' : ''
                  ]"
                >
                  <div class="flex items-center justify-between gap-2 text-zinc-500">
                    <span class="font-semibold text-zinc-800 dark:text-zinc-200">{{ comment.author_name }}</span>
                  </div>
                  <p class="mt-1 text-zinc-700 dark:text-zinc-300">{{ comment.content }}</p>
                </div>

                <form class="flex gap-2 pt-1" @submit.prevent="handleAddComment(post.id)">
                  <UInput
                    v-model="commentDrafts[post.id]"
                    placeholder="Write a comment..."
                    size="xs"
                    class="flex-1"
                  />
                  <UButton type="submit" size="xs" color="primary">
                    Post Comment
                  </UButton>
                </form>
              </div>
            </div>
          </UCard>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>

<script setup>
import { ref, reactive, onMounted, watch } from 'vue';
import { useToast } from '@nuxt/ui/composables';
import { useAuthStore } from '../../stores/auth.js';
import { useSprint4Store } from '../../stores/sprint4.js';
import AlertBellButton from '../../components/AlertBellButton.vue';

const toast = useToast();
const authStore = useAuthStore();
const sprint4Store = useSprint4Store();

const composerOpen = ref(false);
const creatingPost = ref(false);
const activeCategory = ref('ALL');
const searchQuery = ref('');
const followingOnly = ref(false);
const expandedComments = reactive({});
const commentDrafts = reactive({});

const postForm = reactive({
  title: '',
  category: 'TIP',
  content: ''
});

const filterTabs = [
  { label: 'All', value: 'ALL' },
  { label: 'Showcase', value: 'SHOWCASE' },
  { label: 'Tips', value: 'TIP' },
  { label: 'Questions', value: 'QUESTION' },
  { label: 'General', value: 'GENERAL' }
];

const categorySelectOptions = [
  { label: 'TIP', value: 'TIP' },
  { label: 'SHOWCASE', value: 'SHOWCASE' },
  { label: 'QUESTION', value: 'QUESTION' },
  { label: 'GENERAL', value: 'GENERAL' }
];

async function reloadFeed() {
  await sprint4Store.fetchPosts({
    category: activeCategory.value,
    search: searchQuery.value,
    followingOnly: followingOnly.value
  }).catch(() => {});
}

async function handleCreatePost() {
  if (!postForm.title.trim() || !postForm.content.trim()) return;
  creatingPost.value = true;
  try {
    await sprint4Store.createPost({
      title: postForm.title.trim(),
      category: postForm.category,
      content: postForm.content.trim()
    });
    postForm.title = '';
    postForm.content = '';
    composerOpen.value = false;
    toast.add({ title: 'Post Published', color: 'success' });
  } catch (err) {
    toast.add({
      title: 'Publish Failed',
      description: err?.response?.data?.error?.message || 'Unable to create post.',
      color: 'error'
    });
  } finally {
    creatingPost.value = false;
  }
}

async function toggleComments(postId) {
  expandedComments[postId] = !expandedComments[postId];
  if (expandedComments[postId]) {
    await sprint4Store.fetchComments(postId).catch(() => {});
  }
}

async function handleAddComment(postId) {
  const text = String(commentDrafts[postId] || '').trim();
  if (!text) return;
  commentDrafts[postId] = '';
  await sprint4Store.addComment(postId, { content: text });
}

async function handleFollow(post) {
  const followed = await sprint4Store.toggleFollow(post.author_id, post.author_followed_by_me);
  toast.add({
    title: followed ? `Following ${post.author_name}` : `Unfollowed ${post.author_name}`,
    color: 'neutral'
  });
}

watch([activeCategory, followingOnly], reloadFeed);
watch(searchQuery, reloadFeed);

onMounted(reloadFeed);
</script>
