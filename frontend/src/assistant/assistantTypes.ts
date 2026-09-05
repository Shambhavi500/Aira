export interface AssistantContext {
  currentRoute: string;
  currentModule: string;
  currentScreen?: string;
  selectedCustomer?: string;
  selectedPayment?: string;
  selectedRecoveryCase?: string;
  visibleMetrics?: Record<string, any>;
  currentWorkflowStep?: string;
  activeEntity?: Record<string, any>;
}

export interface AssistantAction {
  type: 'NAVIGATE' | 'EXPLAIN' | 'TRIGGER_ACTION';
  label: string;
  route?: string;
  prompt?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  actions?: AssistantAction[];
  suggestedPrompts?: string[];
  moduleContext?: string;
  isFallback?: boolean;
}

export interface AssistantResponse {
  intent: string;
  response: string;
  actions?: AssistantAction[];
  suggested_prompts?: string[];
  module_context?: string;
}
