// A collaborator is a real app user (identified by their auth user_id) that the
// owner has added to their roster so tasks can be shared / assigned to them.
export interface Collaborator {
  id: string;
  // The collaborator's auth user id — who they are across devices.
  user_id: string;
  // Cached display info (the owner can label them; email is best-effort).
  display_name: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface CollaboratorDraft {
  user_id: string;
  display_name?: string;
  email?: string;
}
