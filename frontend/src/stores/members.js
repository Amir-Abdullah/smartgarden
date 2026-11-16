import { defineStore } from 'pinia';
import api from '../services/api.js';
import { useAuthStore } from './auth.js';

export const useMembersStore = defineStore('members', {
  state: () => ({
    members: [],
    invitations: [],
    activeGardenId: null,
    currentUserRole: null, // 'OWNER' | 'FAMILY' | 'GUEST' | null
    loading: false,
    actionLoading: false,
    error: null,
    successMessage: null
  }),

  getters: {
    isOwner(state) {
      const auth = useAuthStore();
      return state.currentUserRole === 'OWNER' || Boolean(auth.isAdmin);
    },

    canInvite() {
      return this.isOwner;
    },

    canManageMembers() {
      return this.isOwner;
    },

    isGuest(state) {
      const auth = useAuthStore();
      return state.currentUserRole === 'GUEST' && !auth.isAdmin;
    },

    soleOwner(state) {
      const owners = state.members.filter(m => m.role === 'OWNER');
      return owners.length === 1 ? owners[0] : null;
    },

    isSoleOwner(state) {
      const auth = useAuthStore();
      const sole = this.soleOwner;
      return Boolean(sole && auth.user && sole.user_id === auth.user.id);
    },

    pendingInvitations(state) {
      return state.invitations.filter(inv => inv.status === 'PENDING');
    }
  },

  actions: {
    clearMessages() {
      this.error = null;
      this.successMessage = null;
    },

    extractError(err, fallback = 'Operation failed') {
      return (
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        err.message ||
        fallback
      );
    },

    // 1. Fetch active members for a garden
    async fetchMembers(gardenId) {
      this.loading = true;
      this.error = null;
      this.activeGardenId = Number(gardenId);
      try {
        const response = await api.get(`/gardens/${gardenId}/members`);
        const membersList = response.data?.data?.members || [];
        this.members = membersList;

        // Resolve current user's role in this garden
        const auth = useAuthStore();
        if (auth.user) {
          const myMembership = membersList.find(m => m.user_id === auth.user.id);
          this.currentUserRole = myMembership ? myMembership.role : (auth.isAdmin ? 'OWNER' : null);
        }
        return membersList;
      } catch (err) {
        this.error = this.extractError(err, 'Failed to load garden members.');
        throw err;
      } finally {
        this.loading = false;
      }
    },

    // 2. Update member role (OWNER only)
    async updateMemberRole(gardenId, userId, newRole) {
      this.actionLoading = true;
      this.error = null;
      this.successMessage = null;
      try {
        const response = await api.put(`/gardens/${gardenId}/members/${userId}`, { role: newRole });
        const updated = response.data?.data?.member;

        // Update local state
        const idx = this.members.findIndex(m => m.user_id === Number(userId));
        if (idx !== -1 && updated) {
          this.members[idx].role = updated.role;
        }
        this.successMessage = `Member role updated to ${newRole}.`;
        return updated;
      } catch (err) {
        this.error = this.extractError(err, 'Failed to update member role.');
        throw err;
      } finally {
        this.actionLoading = false;
      }
    },

    // 3. Remove member or leave garden
    async removeMember(gardenId, userId) {
      this.actionLoading = true;
      this.error = null;
      this.successMessage = null;
      try {
        const response = await api.delete(`/gardens/${gardenId}/members/${userId}`);
        this.members = this.members.filter(m => m.user_id !== Number(userId));
        this.successMessage = response.data?.data?.message || 'Member removed successfully.';
        return response.data;
      } catch (err) {
        this.error = this.extractError(err, 'Failed to remove member.');
        throw err;
      } finally {
        this.actionLoading = false;
      }
    },

    // 4. Fetch invitations (OWNER only)
    async fetchInvitations(gardenId) {
      this.error = null;
      try {
        const response = await api.get(`/gardens/${gardenId}/invitations`);
        this.invitations = response.data?.data?.invitations || [];
        return this.invitations;
      } catch (err) {
        // If not OWNER, backend returns 403; silently clear invitations
        if (err.response?.status === 403) {
          this.invitations = [];
          return [];
        }
        this.error = this.extractError(err, 'Failed to load invitations.');
        throw err;
      }
    },

    // 5. Create new invitation (OWNER only)
    async createInvitation(gardenId, { email, role, expiresInDays }) {
      this.actionLoading = true;
      this.error = null;
      this.successMessage = null;
      try {
        const payload = {
          email,
          role: role || 'GUEST',
          expiresInDays: expiresInDays ? Number(expiresInDays) : 7
        };
        const response = await api.post(`/gardens/${gardenId}/invitations`, payload);
        const invitation = response.data?.data;

        // Add to local state if returned
        if (invitation) {
          this.invitations.unshift({
            id: invitation.id,
            garden_id: gardenId,
            invitee_email: invitation.email || email,
            role: invitation.role || role,
            token: invitation.token,
            status: invitation.status || 'PENDING',
            expires_at: invitation.expires_at,
            created_at: new Date().toISOString()
          });
        }
        this.successMessage = `Invitation created for ${email}.`;
        return invitation;
      } catch (err) {
        this.error = this.extractError(err, 'Failed to create invitation.');
        throw err;
      } finally {
        this.actionLoading = false;
      }
    },

    // 6. Revoke / cancel invitation (OWNER only)
    async revokeInvitation(gardenId, inviteId) {
      this.actionLoading = true;
      this.error = null;
      this.successMessage = null;
      try {
        const response = await api.delete(`/gardens/${gardenId}/invitations/${inviteId}`);
        this.invitations = this.invitations.filter(i => i.id !== Number(inviteId));
        this.successMessage = response.data?.data?.message || 'Invitation revoked successfully.';
        return response.data;
      } catch (err) {
        this.error = this.extractError(err, 'Failed to revoke invitation.');
        throw err;
      } finally {
        this.actionLoading = false;
      }
    },

    // 7. Accept invitation by token (Authenticated user)
    async acceptInvitation(token) {
      this.actionLoading = true;
      this.error = null;
      this.successMessage = null;
      try {
        const response = await api.post(`/invitations/${token}/accept`);
        const data = response.data?.data;
        this.successMessage = data?.message || 'Invitation accepted successfully!';
        return data;
      } catch (err) {
        this.error = this.extractError(err, 'Failed to accept invitation.');
        throw err;
      } finally {
        this.actionLoading = false;
      }
    },

    // 8. Reject invitation by token (Authenticated user)
    async rejectInvitation(token) {
      this.actionLoading = true;
      this.error = null;
      this.successMessage = null;
      try {
        const response = await api.post(`/invitations/${token}/reject`);
        const data = response.data?.data;
        this.successMessage = data?.message || 'Invitation declined.';
        return data;
      } catch (err) {
        this.error = this.extractError(err, 'Failed to decline invitation.');
        throw err;
      } finally {
        this.actionLoading = false;
      }
    }
  }
});
