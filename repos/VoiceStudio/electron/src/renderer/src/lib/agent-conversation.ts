import { Store } from '@tanstack/store';
import type {
  RepairAgentEvent,
  RepairAgentState,
  RepairAgentStatus,
} from '../../../preload/index.d';
import type { AgentChatMessage } from '@shared/agent-workspace';

export interface ConversationMessage extends AgentChatMessage {
  id: string;
  sessionId?: string;
  status?: RepairAgentStatus;
}
export const agentConversation = new Store({
  messages: [] as ConversationMessage[],
  draft: '',
  activeId: '',
});

export function conversationHistory(): AgentChatMessage[] {
  return agentConversation.state.messages
    .filter((message) => message.content && message.status !== 'running')
    .slice(-12)
    .map(({ role, content }) => ({ role, content: content.slice(-4000) }));
}
export function beginAgentTurn(content: string): string {
  const id = crypto.randomUUID();
  agentConversation.setState((state) => ({
    ...state,
    draft: '',
    activeId: id,
    messages: [
      ...state.messages.slice(-38),
      { id: crypto.randomUUID(), role: 'user', content },
      { id, role: 'assistant', content: '', status: 'running' },
    ],
  }));
  return id;
}
export function updateAgentTurn(id: string, patch: Partial<ConversationMessage>) {
  agentConversation.setState((state) => ({
    ...state,
    messages: state.messages.map((message) =>
      message.id === id ? { ...message, ...patch } : message,
    ),
  }));
}
export function receiveAgentEvent(event: RepairAgentEvent) {
  const state = agentConversation.state;
  const current = state.messages.find((message) => message.id === state.activeId);
  if (!current || (current.sessionId && current.sessionId !== event.sessionId)) return;
  if (!current.sessionId && (event.type !== 'state' || event.status !== 'running')) return;
  updateAgentTurn(
    current.id,
    event.type === 'output'
      ? { sessionId: event.sessionId, content: (current.content + event.text).slice(-250_000) }
      : { sessionId: event.sessionId, status: event.status },
  );
}
export function restoreAgentTurn(state: RepairAgentState) {
  if (!state.sessionId) return;
  const existing = agentConversation.state.messages.find(
    (message) => message.sessionId === state.sessionId,
  );
  if (existing) {
    updateAgentTurn(existing.id, { content: state.output, status: state.status });
    return;
  }
  if (agentConversation.state.activeId || (!state.output && state.status !== 'running')) return;
  const id = crypto.randomUUID();
  agentConversation.setState((current) => ({
    ...current,
    activeId: id,
    messages: [
      ...current.messages,
      {
        id,
        role: 'assistant',
        content: state.output,
        status: state.status,
        sessionId: state.sessionId,
      },
    ],
  }));
}
