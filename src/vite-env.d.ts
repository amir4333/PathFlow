/// <reference types="vite/client" />

interface Window {
    pathflowPdf: {
        save: (fileName: string) => Promise<{
            success: boolean;
            canceled?: boolean;
            filePath?: string;
            error?: string;
        }>;
    };
}