import { create } from 'zustand';
import type {
  TeamPersona,
  Lead,
  WorkflowSOP,
  SOPStep,
  WorkLink,
  ProblemItem,
  VisualDiagram,
  LeadStatus,
  ProblemSeverity,
  TeamNote,
  TeamTask,
  DiagramNode,
  ChatRef,
  TeamChatMessage,
  TeamPersona as Persona,
  TeamMissionItem,
} from './team-types';

/**
 * Off switch for the whole team workspace. While false nothing can enter a team
 * room, so no realtime channel is ever opened. Flip to true to bring it back.
 */
export const TEAM_WORKSPACE_ENABLED = false;

let chatSeq = 0;
const chatId = () => `chat-${Date.now().toString(36)}-${(chatSeq += 1).toString(36)}`;

/**
 * Modules post their own activity into the project chat, so the conversation
 * and the work stay in one timeline. Built as a plain value so a mutator can
 * append it inside the same `set` call that changes the item — one atomic
 * update, one sync write.
 */
const systemMessage = (missionId: string, body: string, ref?: ChatRef): TeamChatMessage => ({
  id: chatId(),
  missionId,
  kind: 'system',
  authorName: 'Workspace',
  body,
  refs: ref ? [ref] : [],
  reactions: [],
  mentions: [],
  createdAt: new Date().toISOString(),
});

/** @Name matches against the room's personas; unknown handles stay plain text. */
const extractMentions = (body: string, personas: Persona[]): string[] => {
  const lower = body.toLowerCase();
  return personas.filter((p) => lower.includes(`@${p.name.toLowerCase()}`)).map((p) => p.name);
};

const TASK_STATUS_COPY: Record<TeamTask['status'], string> = {
  backlog: 'moved to Backlog',
  in_progress: 'started',
  review: 'moved to Review',
  done: 'completed',
};

interface TeamState {
  workspaceMode: 'personal' | 'team';
  teamUnlocked: boolean;
  activePersona: TeamPersona;
  teamMissions: TeamMissionItem[];
  selectedTeamMissionId: string | null;
  leads: Lead[];
  workflows: WorkflowSOP[];
  workLinks: WorkLink[];
  problems: ProblemItem[];
  diagrams: VisualDiagram[];
  teamNotes: TeamNote[];
  teamTasks: TeamTask[];
  personas: TeamPersona[];
  chatMessages: TeamChatMessage[];
  /** Item handed to the chat composer by a module's "Discuss" action. */
  chatDraftRef: ChatRef | null;
  /** missionId -> ISO timestamp the current user last read that channel. */
  channelReads: Record<string, string>;
  /** Channel currently on screen; notifications skip it. */
  activeChatChannel: string | null;
  backendSyncStatus: 'offline' | 'loading' | 'syncing' | 'synced' | 'error';
  backendSyncError: string | null;

  // Auth & Workspace Switching
  setWorkspaceMode: (mode: 'personal' | 'team') => void;
  grantApprovedTeamAccess: () => void;
  lockTeam: () => void;
  setAuthenticatedPersona: (persona: TeamPersona) => void;
  selectTeamMission: (missionId: string | null) => void;

  // Team Missions Actions
  addTeamMission: (mission: Omit<TeamMissionItem, 'id'>) => TeamMissionItem;
  updateTeamMission: (id: string, updates: Partial<TeamMissionItem>) => void;
  deleteTeamMission: (id: string) => void;

  // Leads CRM Actions
  addLead: (lead: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>) => Lead;
  updateLead: (id: string, updates: Partial<Lead>) => void;
  deleteLead: (id: string) => void;
  updateLeadStatus: (id: string, status: LeadStatus) => void;

  // Workflows & SOP Actions
  toggleSOPStep: (sopId: string, stepId: string) => void;
  addWorkflow: (workflow: Omit<WorkflowSOP, 'id'>) => WorkflowSOP;
  addSOPStep: (sopId: string, step: Pick<SOPStep, 'title' | 'description'>) => void;

  // Work Links Actions
  addWorkLink: (link: Omit<WorkLink, 'id' | 'createdAt'>) => void;
  updateWorkLink: (id: string, updates: Partial<Omit<WorkLink, 'id' | 'missionId' | 'createdAt'>>) => void;
  deleteWorkLink: (id: string) => void;

  // MDM Problem Bank Actions
  addProblem: (problem: Omit<ProblemItem, 'id' | 'createdAt'>) => ProblemItem;
  updateProblem: (id: string, updates: Partial<ProblemItem>) => void;
  updateProblemStatus: (id: string, status: 'open' | 'investigating' | 'solved') => void;
  deleteProblem: (id: string) => void;

  // Visual Diagrams Actions
  addDiagram: (diagram: Omit<VisualDiagram, 'id' | 'updatedAt'>) => VisualDiagram;
  updateDiagram: (id: string, updates: Partial<Omit<VisualDiagram, 'id' | 'missionId'>>) => void;
  deleteDiagram: (id: string) => void;
  updateDiagramNodes: (diagramId: string, nodes: DiagramNode[]) => void;
  /** Shuffles a diagram one slot earlier or later among its project siblings. */
  moveDiagram: (id: string, direction: 'back' | 'forward') => void;

  // Team Notes Actions
  addTeamNote: (note: Omit<TeamNote, 'id' | 'createdAt' | 'updatedAt'>) => TeamNote;
  updateTeamNote: (id: string, updates: Partial<TeamNote>) => void;
  deleteTeamNote: (id: string) => void;

  // Team Tasks Actions
  addTeamTask: (task: Omit<TeamTask, 'id' | 'createdAt'>) => TeamTask;
  updateTeamTask: (id: string, updates: Partial<TeamTask>) => void;
  toggleTeamTaskDone: (id: string) => void;
  deleteTeamTask: (id: string) => void;

  // Project Chat Actions
  sendChatMessage: (input: {
    missionId: string;
    body: string;
    refs?: ChatRef[];
    /** Set to reply inside a thread rather than the channel. */
    parentId?: string;
  }) => TeamChatMessage;
  editChatMessage: (id: string, body: string) => void;
  toggleChatReaction: (id: string, emoji: string) => void;
  deleteChatMessage: (id: string) => void;
  markChannelRead: (missionId: string) => void;
  setActiveChatChannel: (missionId: string | null) => void;
  startChatDraft: (ref: ChatRef) => void;
  clearChatDraft: () => void;
  /** Turn a message into a task / issue / note, keeping the link both ways. */
  promoteChatMessage: (messageId: string, target: 'task' | 'problem' | 'note') => void;

  // Fast Pocket Drops
  pocketDropLead: (data: {
    missionId: string;
    businessName: string;
    ownerName: string;
    phone: string;
    notes: string;
    category?: Lead['category'];
  }) => Lead;

  pocketDropProblem: (data: {
    missionId: string;
    title: string;
    description: string;
    source: string;
    severity: ProblemSeverity;
    audienceCategory?: string;
  }) => ProblemItem;
}

const UNKNOWN_PERSONA: TeamPersona = {
  id: 'unknown',
  name: 'You',
  role: 'General Member',
  initials: '··',
  color: 'gray',
};

export const useTeamStore = create<TeamState>()(
    (set, get) => ({
      workspaceMode: 'personal',
      teamUnlocked: false,
      activePersona: UNKNOWN_PERSONA,
      teamMissions: [],
      selectedTeamMissionId: null,
      leads: [],
      workflows: [],
      workLinks: [],
      problems: [],
      diagrams: [],
      teamNotes: [],
      teamTasks: [],
      personas: [],
      chatMessages: [],
      chatDraftRef: null,
      channelReads: {},
      activeChatChannel: null,
      backendSyncStatus: 'offline',
      backendSyncError: null,

      setWorkspaceMode: (mode) => set({ workspaceMode: TEAM_WORKSPACE_ENABLED ? mode : 'personal' }),

      lockTeam: () => set({ teamUnlocked: false, workspaceMode: 'personal' }),

      grantApprovedTeamAccess: () => set({ teamUnlocked: true, workspaceMode: 'team' }),

      setAuthenticatedPersona: (persona) => set({ activePersona: persona }),

      selectTeamMission: (missionId) => set({ selectedTeamMissionId: missionId }),

      // Team Missions
      addTeamMission: (missionData) => {
        const newMission: TeamMissionItem = {
          ...missionData,
          id: `m-${Date.now()}`,
        };
        set((state) => ({ teamMissions: [newMission, ...state.teamMissions] }));
        return newMission;
      },

      updateTeamMission: (id, updates) => {
        set((state) => ({
          teamMissions: state.teamMissions.map((m) => (m.id === id ? { ...m, ...updates } : m)),
        }));
      },

      deleteTeamMission: (id) => {
        set((state) => ({
          teamMissions: state.teamMissions.filter((m) => m.id !== id),
          selectedTeamMissionId:
            state.selectedTeamMissionId === id ? null : state.selectedTeamMissionId,
        }));
      },

      // Leads
      addLead: (leadData) => {
        const newLead: Lead = {
          ...leadData,
          id: `lead-${Date.now()}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set((state) => ({
          leads: [newLead, ...state.leads],
          chatMessages: [
            ...state.chatMessages,
            systemMessage(newLead.missionId, 'logged a lead', {
              kind: 'lead', id: newLead.id, label: newLead.businessName, detail: newLead.status,
            }),
          ],
        }));
        return newLead;
      },

      updateLead: (id, updates) => {
        set((state) => ({
          leads: state.leads.map((l) =>
            l.id === id ? { ...l, ...updates, updatedAt: new Date().toISOString() } : l
          ),
        }));
      },

      deleteLead: (id) => {
        set((state) => ({
          leads: state.leads.filter((l) => l.id !== id),
        }));
      },

      updateLeadStatus: (id, status) => {
        set((state) => {
          const lead = state.leads.find((l) => l.id === id);
          if (!lead || lead.status === status) return {};
          return {
            leads: state.leads.map((l) =>
              l.id === id ? { ...l, status, updatedAt: new Date().toISOString() } : l
            ),
            chatMessages: [
              ...state.chatMessages,
              systemMessage(lead.missionId, `moved a lead to ${status.replace(/_/g, ' ')}`, {
                kind: 'lead', id: lead.id, label: lead.businessName, detail: status,
              }),
            ],
          };
        });
      },

      // Workflows & SOPs
      toggleSOPStep: (sopId, stepId) => {
        const currentPersona = get().activePersona;
        set((state) => ({
          workflows: state.workflows.map((wf) => {
            if (wf.id !== sopId) return wf;
            const updatedSteps = wf.steps.map((step) => {
              if (step.id !== stepId) return step;
              const willBeCompleted = !step.completed;
              return {
                ...step,
                completed: willBeCompleted,
                completedAt: willBeCompleted ? new Date().toISOString().split('T')[0] : undefined,
                completedBy: willBeCompleted ? currentPersona.name : undefined,
              };
            });
            const allDone = updatedSteps.every((s) => s.completed);
            return {
              ...wf,
              steps: updatedSteps,
              status: allDone ? 'completed' : 'in_progress',
            };
          }),
        }));
      },

      addWorkflow: (wfData) => {
        const newWf: WorkflowSOP = {
          ...wfData,
          id: `sop-${Date.now()}`,
        };
        set((state) => ({
          workflows: [...state.workflows, newWf],
          chatMessages: [
            ...state.chatMessages,
            systemMessage(newWf.missionId, 'added a process', {
              kind: 'workflow', id: newWf.id, label: newWf.title, detail: newWf.status,
            }),
          ],
        }));
        return newWf;
      },

      addSOPStep: (sopId, step) => {
        set((state) => ({
          workflows: state.workflows.map((wf) => {
            if (wf.id !== sopId) return wf;
            const newStep: SOPStep = {
              id: `step-${Date.now()}`,
              stepNumber: wf.steps.length + 1,
              title: step.title,
              description: step.description,
              completed: false,
            };
            return {
              ...wf,
              steps: [...wf.steps, newStep],
              // A fresh open step means the protocol is no longer finished.
              status: wf.status === 'completed' ? 'in_progress' : wf.status,
            };
          }),
        }));
      },

      // Work Links
      addWorkLink: (linkData) => {
        const newLink: WorkLink = {
          ...linkData,
          id: `wl-${Date.now()}`,
          createdAt: new Date().toISOString(),
        };
        set((state) => ({
          workLinks: [newLink, ...state.workLinks],
          chatMessages: [
            ...state.chatMessages,
            systemMessage(newLink.missionId, 'added a link', {
              kind: 'link', id: newLink.id, label: newLink.title, detail: newLink.category,
            }),
          ],
        }));
      },

      updateWorkLink: (id, updates) => {
        set((state) => ({
          workLinks: state.workLinks.map((w) => (w.id === id ? { ...w, ...updates } : w)),
        }));
      },

      deleteWorkLink: (id) => {
        set((state) => ({
          workLinks: state.workLinks.filter((w) => w.id !== id),
        }));
      },

      // Problems / Friction
      addProblem: (probData) => {
        const newProb: ProblemItem = {
          ...probData,
          id: `prob-${Date.now()}`,
          createdAt: new Date().toISOString(),
        };
        set((state) => ({
          problems: [newProb, ...state.problems],
          chatMessages: [
            ...state.chatMessages,
            systemMessage(newProb.missionId, 'logged an issue', {
              kind: 'problem', id: newProb.id, label: newProb.title, detail: newProb.severity,
            }),
          ],
        }));
        return newProb;
      },

      updateProblem: (id, updates) => {
        set((state) => ({ problems: state.problems.map((problem) => problem.id === id ? { ...problem, ...updates } : problem) }));
      },

      updateProblemStatus: (id, status) => {
        set((state) => {
          const problem = state.problems.find((p) => p.id === id);
          if (!problem || problem.status === status) return {};
          return {
            problems: state.problems.map((p) => (p.id === id ? { ...p, status } : p)),
            chatMessages: [
              ...state.chatMessages,
              systemMessage(problem.missionId, status === 'solved' ? 'solved an issue' : `moved an issue to ${status}`, {
                kind: 'problem', id: problem.id, label: problem.title, detail: status,
              }),
            ],
          };
        });
      },

      deleteProblem: (id) => {
        set((state) => ({
          problems: state.problems.filter((p) => p.id !== id),
        }));
      },

      // Visual Diagrams
      addDiagram: (diagramData) => {
        const diagram: VisualDiagram = {
          ...diagramData,
          id: `diagram-${Date.now()}`,
          updatedAt: new Date().toISOString(),
        };
        set((state) => ({ diagrams: [diagram, ...state.diagrams] }));
        return diagram;
      },

      updateDiagram: (id, updates) => {
        set((state) => ({
          diagrams: state.diagrams.map((diagram) =>
            diagram.id === id ? { ...diagram, ...updates, updatedAt: new Date().toISOString() } : diagram
          ),
        }));
      },

      deleteDiagram: (id) => {
        set((state) => ({ diagrams: state.diagrams.filter((diagram) => diagram.id !== id) }));
      },

      updateDiagramNodes: (diagramId, nodes) => {
        set((state) => ({
          diagrams: state.diagrams.map((d) =>
            d.id === diagramId ? { ...d, nodes, updatedAt: new Date().toISOString() } : d
          ),
        }));
      },

      moveDiagram: (id, direction) => {
        set((state) => {
          const target = state.diagrams.find((diagram) => diagram.id === id);
          if (!target) return {};

          // Reorder within the project only — the array holds every mission's.
          const siblingIndexes = state.diagrams
            .map((diagram, index) => (diagram.missionId === target.missionId ? index : -1))
            .filter((index) => index >= 0);

          const position = siblingIndexes.indexOf(state.diagrams.indexOf(target));
          const swapPosition = direction === 'back' ? position - 1 : position + 1;
          if (swapPosition < 0 || swapPosition >= siblingIndexes.length) return {};

          const diagrams = [...state.diagrams];
          const from = siblingIndexes[position];
          const to = siblingIndexes[swapPosition];
          [diagrams[from], diagrams[to]] = [diagrams[to], diagrams[from]];
          return { diagrams };
        });
      },

      // Team Notes
      addTeamNote: (noteData) => {
        const newNote: TeamNote = {
          ...noteData,
          id: `tn-${Date.now()}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set((state) => ({
          teamNotes: [newNote, ...state.teamNotes],
          chatMessages: [
            ...state.chatMessages,
            systemMessage(newNote.missionId, 'added a note', {
              kind: 'note', id: newNote.id, label: newNote.title, detail: newNote.category,
            }),
          ],
        }));
        return newNote;
      },

      updateTeamNote: (id, updates) => {
        set((state) => ({
          teamNotes: state.teamNotes.map((n) =>
            n.id === id ? { ...n, ...updates, updatedAt: new Date().toISOString() } : n
          ),
        }));
      },

      deleteTeamNote: (id) => {
        set((state) => ({
          teamNotes: state.teamNotes.filter((n) => n.id !== id),
        }));
      },

      // Team Tasks
      addTeamTask: (taskData) => {
        const newTask: TeamTask = {
          ...taskData,
          id: `tt-${Date.now()}`,
          createdAt: new Date().toISOString(),
        };
        set((state) => ({
          teamTasks: [newTask, ...state.teamTasks],
          chatMessages: [
            ...state.chatMessages,
            systemMessage(newTask.missionId, 'added a task', {
              kind: 'task', id: newTask.id, label: newTask.title, detail: newTask.priority,
            }),
          ],
        }));
        return newTask;
      },

      updateTeamTask: (id, updates) => {
        set((state) => {
          const task = state.teamTasks.find((t) => t.id === id);
          const teamTasks = state.teamTasks.map((t) => (t.id === id ? { ...t, ...updates } : t));
          // Only a status move is worth announcing; edits to a title are not.
          if (!task || !updates.status || updates.status === task.status) return { teamTasks };
          return {
            teamTasks,
            chatMessages: [
              ...state.chatMessages,
              systemMessage(task.missionId, TASK_STATUS_COPY[updates.status], {
                kind: 'task', id: task.id, label: task.title, detail: updates.status,
              }),
            ],
          };
        });
      },

      toggleTeamTaskDone: (id) => {
        set((state) => {
          const task = state.teamTasks.find((t) => t.id === id);
          if (!task) return {};
          const nextStatus: TeamTask['status'] = task.status === 'done' ? 'in_progress' : 'done';
          return {
            teamTasks: state.teamTasks.map((t) =>
              t.id === id
                ? { ...t, status: nextStatus, completedAt: nextStatus === 'done' ? new Date().toISOString() : undefined }
                : t
            ),
            chatMessages: [
              ...state.chatMessages,
              systemMessage(task.missionId, TASK_STATUS_COPY[nextStatus], {
                kind: 'task', id: task.id, label: task.title, detail: nextStatus,
              }),
            ],
          };
        });
      },

      deleteTeamTask: (id) => {
        set((state) => ({
          teamTasks: state.teamTasks.filter((t) => t.id !== id),
        }));
      },

      // Project Chat
      sendChatMessage: ({ missionId, body, refs = [], parentId }) => {
        const message: TeamChatMessage = {
          id: chatId(),
          missionId,
          kind: 'message',
          authorName: get().activePersona.name,
          body,
          refs,
          reactions: [],
          mentions: extractMentions(body, get().personas),
          parentId,
          createdAt: new Date().toISOString(),
        };
        set((state) => ({ chatMessages: [...state.chatMessages, message], chatDraftRef: null }));
        return message;
      },

      editChatMessage: (id, body) => {
        set((state) => ({
          chatMessages: state.chatMessages.map((m) =>
            m.id === id
              ? { ...m, body, mentions: extractMentions(body, state.personas), editedAt: new Date().toISOString() }
              : m
          ),
        }));
      },

      toggleChatReaction: (id, emoji) => {
        const me = get().activePersona.name;
        set((state) => ({
          chatMessages: state.chatMessages.map((m) => {
            if (m.id !== id) return m;
            const existing = m.reactions.find((r) => r.emoji === emoji);
            if (!existing) return { ...m, reactions: [...m.reactions, { emoji, by: [me] }] };
            const by = existing.by.includes(me) ? existing.by.filter((n) => n !== me) : [...existing.by, me];
            return {
              ...m,
              reactions: by.length
                ? m.reactions.map((r) => (r.emoji === emoji ? { ...r, by } : r))
                : m.reactions.filter((r) => r.emoji !== emoji),
            };
          }),
        }));
      },

      deleteChatMessage: (id) => {
        set((state) => ({
          chatMessages: state.chatMessages.filter((m) => m.id !== id && m.parentId !== id),
        }));
      },

      markChannelRead: (missionId) => {
        set((state) => ({
          channelReads: { ...state.channelReads, [missionId]: new Date().toISOString() },
        }));
      },

      setActiveChatChannel: (missionId) => set({ activeChatChannel: missionId }),

      startChatDraft: (ref) => set({ chatDraftRef: ref }),

      clearChatDraft: () => set({ chatDraftRef: null }),

      promoteChatMessage: (messageId, target) => {
        const message = get().chatMessages.find((m) => m.id === messageId);
        if (!message || message.spawned) return;

        // First line becomes the title, the rest the body.
        const [firstLine, ...rest] = message.body.split('\n');
        const title = firstLine.trim().slice(0, 120) || 'Untitled';
        const detail = rest.join('\n').trim();
        const persona = get().activePersona;
        let spawned: ChatRef;

        if (target === 'task') {
          const task = get().addTeamTask({
            missionId: message.missionId,
            title,
            outcome: detail || undefined,
            status: 'backlog',
            priority: 'normal',
            assigneeRole: persona.role,
          });
          spawned = { kind: 'task', id: task.id, label: task.title, detail: 'backlog' };
        } else if (target === 'problem') {
          const problem = get().addProblem({
            missionId: message.missionId,
            audienceCategory: 'Team',
            title,
            description: detail || title,
            source: `Chat · ${message.authorName}`,
            severity: 'friction',
            status: 'open',
            tags: ['From-Chat'],
            loggedBy: persona.name,
          });
          spawned = { kind: 'problem', id: problem.id, label: problem.title, detail: 'open' };
        } else {
          const note = get().addTeamNote({
            missionId: message.missionId,
            title,
            content: detail || title,
            category: 'General',
            author: persona.name,
          });
          spawned = { kind: 'note', id: note.id, label: note.title, detail: note.category };
        }

        // The add* call above already posted its own system message; this just
        // links the source message to what came out of it.
        set((state) => ({
          chatMessages: state.chatMessages.map((m) => (m.id === messageId ? { ...m, spawned } : m)),
        }));
      },

      // Fast Drops
      pocketDropLead: ({ missionId, businessName, ownerName, phone, notes, category = 'Turf' }) => {
        const persona = get().activePersona;
        const newLead: Lead = {
          id: `lead-${Date.now()}`,
          missionId,
          businessName,
          category,
          ownerName: ownerName || 'Owner/Manager',
          phone,
          location: 'Field Visit',
          status: 'contacted',
          notes,
          nextFollowUp: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          createdBy: persona.name,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set((state) => ({
          leads: [newLead, ...state.leads],
          chatMessages: [
            ...state.chatMessages,
            systemMessage(missionId, 'dropped a lead from the field', {
              kind: 'lead', id: newLead.id, label: newLead.businessName, detail: newLead.status,
            }),
          ],
        }));
        return newLead;
      },

      pocketDropProblem: ({
        missionId,
        title,
        description,
        source,
        severity,
        audienceCategory = 'Venue Owner',
      }) => {
        const persona = get().activePersona;
        const newProb: ProblemItem = {
          id: `prob-${Date.now()}`,
          missionId,
          audienceCategory,
          title,
          description: description || title,
          source: source || persona.name,
          severity,
          status: 'open',
          tags: [severity, 'Field-Drop'],
          loggedBy: persona.name,
          createdAt: new Date().toISOString(),
        };
        set((state) => ({
          problems: [newProb, ...state.problems],
          chatMessages: [
            ...state.chatMessages,
            systemMessage(missionId, 'dropped an issue from the field', {
              kind: 'problem', id: newProb.id, label: newProb.title, detail: newProb.severity,
            }),
          ],
        }));
        return newProb;
      },
    }),
);
