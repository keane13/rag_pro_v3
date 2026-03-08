export interface Message {
    role: 'user' | 'assistant';
    content: string;
    imagePreview?: string;
    isThinking?: boolean;
    isComplete?: boolean;
    metrics?: {
        latency: number;
        faithfulness?: number;
        answer_relevancy?: number;
    };
    sources?: { filename: string; content: string }[];
}

export interface Session {
    id: string;
    title: string;
    timestamp: string;
}

export interface FileItem {
    filename: string;
    checked?: boolean;
}

export interface RetrievalContext {
    page_content: string;
    metadata: Record<string, any>;
}
