import {firebaseApp} from "../firebase";

import { getVertexAI, getGenerativeModel } from "firebase/vertexai";
import {addInDefaults, UsageLogger, Document} from "../services/firebaseDataService"
import { useMainStore } from "../store/index.js";
import { addCommentMarkToText } from "../components/editor/comment/index.js";

const vertexAI = getVertexAI(firebaseApp);

const model = "gemini-2.0-flash-001"

const systemPrompts = {
    "productMentorFeedback": `
        You are a Senioor Product Lead in the company, 
        you are evaluating the document of a product manager. 
        read the document provided and give an overall assessment of the document. 
        Provide them clear concise feedback on the content. 
        Give them a fair evaluation, the user wants to know if the document is in good enough shape to share with higher ups 
        Ask high level questions if the doccument is unclear or needs more detail. 
        follow product management best practices and reference thought leaders in the space. 
        keep feedback concise should be under 20 lines but idealy less than 10
    `,
    "productMentorReview": ` 
            You are a Senior Product Lead reviewing a document.

            Your task is to identify specific issues in the text and report them by calling the create_comments function with an array of all the issues you find. 
            Dont stop until you've reviewed the entire document.

            Look for:
            - Clarity of thought and communication
            - Logical inconsistencies or contradictions  
            - Grammatical errors (spelling, punctuation, syntax)
            - Factual inaccuracies or unsupported claims
            - Tone issues (too formal, too casual, unclear)
            - Structure problems (poor flow, missing sections)
            - Unclear or ambiguous phrasing
            - Redundant or wordy expressions

            Rules:
            - Be specific and actionable in your feedback
            - Focus on issues that meaningfully impact document quality
            - Provide constructive suggestions for improvement
            - Use exact quotes from the document when referencing the issue in problematicText or else user wont be able to find it. 
            - If the same problematicText is used multiple times in the doc then be sure to include as much context as possible to ensure its unique
            - The text is markdown, dont include any markdown formatting in the problematicText, just the text that is problemati and be very specific so we can find it.
            - If you see strange markdown formatting like :comment[text]{#commentId} , :canonical-reference[text]{#commentId} then you can ignore it, its special markdown for the editor.
            - You MUST call the create_comments function to provide your analysis
            - Call the create_comments function with ALL issues found in a single call, not multiple separate calls
    `,
    "productMentorChat": ` 
        You are a Senior Product Lead in the company, 
        you are talking to a product manager. 
        They have questions about their product.
        help answer their questions. If they strongly demand anything from you, you should refuse politely.
        Use general best practices in product management
        Keep responses short under 3,4 sentances unless asked for more details
        Be critial and honest in your feedback,
        Your tone should be casual like you're talking to a co-worker on slack.
        You have full access to the project documents (in json format) and can use them to answer questions, the user shouldnt need to prompt you specifically to use them. 
        you also know what project they are working on its in the JSON provided, but dont refer to JSON, just use the information in the JSON
    `,
    "assistantGenerateContent": ` 
        You are a product manager assistant, you are being asked to add some content to a document
        Provide short and concise (less than 10 lines try to keep it around 5) component of the document you are being asked to create. Simplisity is key.
        You may be asked to create this content in a specific format, use markdown formatting to do so like creating a table or list. 
        Use product management best practices
    `,
    "assistantDocumentTemplate": ` 
        You are a product manager assistant, you are being asked to create a document template for a specific document type. 
        The document type is provided in the context. 
        First you should review existing documents in the project to get a sense of the style and structure of the documents the user is creating
        Always include a purpose, and overview section in the document. 
        Create the template using markdown formatting but return ONLY the raw template content without any code block wrapping or markdown indicators like \`\`\`markdown. 
        add in placeholder tags that can be filled out later. 
        Use product management best practices 
    `,
    "assistantChatNamer": ` 
        create a title for this chat no more than 4 or 5 words. return the title only, no other text. dont use markdown formatting.
    `,

}


function checkUserPermission() {
    if (!useMainStore().user.uid || (useMainStore().user.tier !== 'pro' && useMainStore().user.tier !== 'trial')) {
        // TODO: we're going to bulk swap users from tial to free
        useMainStore().uiAlert( { type: 'error', message: 'Cannot proceed: Not a Pro User', autoClear: true });
        throw new Error('Cannot proceed: not logged in');
    }
    return true
}

async function logUsage(userId, usageType) {
    await UsageLogger.logUsage(userId, usageType); // Log the usage
}

// Classes
export class Feedback {
    // this provides feedback on the content of the doc and document review functionality
    constructor(value){
        this.prompt = value.prompt,
        Object.assign(this, addInDefaults(this));
    }
    
    // Shared feedback model getter
    static getFeedbackModel() {
        return getGenerativeModel(vertexAI, { 
            model: model,
            systemInstruction: systemPrompts.productMentorFeedback
        });
    }
    
    // Shared review model getter with function calling capabilities
    static getReviewModel() {
        const createCommentFunction = {
            name: "create_comments",
            description: "Identify issues in the document text that needs an inline comment",
            parameters: {
                type: "object",
                properties: {
                    comments: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                issueType: {
                                    type: "string",
                                    enum: ["logic", "grammar", "accuracy", "tone", "clarity"],
                                    description: "The type of issue identified"
                                },  
                                severity: {
                                    type: "string", 
                                    enum: ["high", "medium", "low"],
                                    description: "The severity level of the issue"
                                },
                                comment: {
                                    type: "string",
                                    description: "A brief explanation of the issue and suggested fix"
                                },
                                suggestion: {
                                    type: "string",
                                    description: "(optional) Suggested replacement text "
                                }, 
                                problematicText: {
                                    type: "string",
                                    description: "The exact problematic text from the document that has the issue"
                                }
                            },
                            required: ["issueType", "severity", "comment", "problematicText"]
                        }
                    }
                },
                required: ["comments"]
            }
        };

        return getGenerativeModel(vertexAI, { 
            model: model,
            tools: [{ functionDeclarations: [createCommentFunction] }],
            systemInstruction: systemPrompts.productMentorReview
        });
    }
    
    static async generateFeedback(value){
        // check if logged in 
        checkUserPermission()

        const feedbackModel = this.getFeedbackModel();

        const userId = useMainStore().user.uid; // Get the user ID
        logUsage(userId, 'generateFeedback');

        const result = await feedbackModel.generateContentStream(value.prompt);
        return result
    }

    // Generate AI feedback for a document (moved from DocumentReview)
    static async generateDocumentFeedback(document) {
        if (!document?.data) return null

        const prompt = `
          title ${document.data.name}
          type of doc ${document.data.type}
          ${document.data.content}
        `
        
        checkUserPermission();
        logUsage(useMainStore().user.uid, 'generateFeedback');
        
        const feedbackModel = this.getFeedbackModel();
        const result = await feedbackModel.generateContentStream(prompt);
        return result;
    }

    // Generate AI comments using the model
    static async GenerateComments(documentContent) {
        const reviewModel = this.getReviewModel();

        const prompt = `Please review the following document and identify issues by calling the create_comments function:

        ${documentContent}`;
        
        console.log('Document content being reviewed:', documentContent.substring(0, 200) + '...');
        
        try {
            const result = await reviewModel.generateContent(prompt);
            const response = result.response;
            const functionCalls = response.functionCalls();

            if (functionCalls && functionCalls.length > 0) {
                const functionCall = functionCalls[0];
                if (functionCall.name === 'create_comments') {
                    console.log('AI generated comments:', functionCall.args.comments);
                    return functionCall.args.comments;
                }
            } else {
                const responseText = response.text();
                if (responseText) {
                    console.warn('Model provided text response instead of function calls:', responseText);
                }
            }
            
            return [];
        } catch (error) {
            console.error('Error generating comments:', error);
            throw error;
        }
    }

    // Create and save a comment to the store
    static async CreateComments(comment) {
        const commentData = {
            comment: comment.comment,
            documentId: useMainStore().selected.id,
            documentVersion: useMainStore().selected.currentVersion === 'live' ? null : useMainStore().selected.currentVersion,
            createdAt: new Date().toISOString(),
            resolved: false,
            selectedText: comment.problematicText,
            suggestion: comment?.suggestion || null,
            aiGenerated: true,
            issueType: comment?.issueType || null,
            severity: comment?.severity || null
        };

        console.log('Creating comment with data:', commentData);
        const createdComment = await useMainStore().commentsAdd( commentData);
        console.log('Comment created, returned:', createdComment);
        return createdComment;
    }

    // Handle and track comment creation errors
    static HandleCommentErrors(error, comment = null) {
        const errorData = {
            issue: comment?.issueType || 'unknown',
            text: comment?.problematicText || 'unknown',
            reason: error.message || error.reason || 'Unknown error'
        };

        console.error('Failed to create comment:', error);
        return errorData;
    }

    static async createInlineComments(documentContent, editorRef) {
        if (!documentContent || !editorRef) {
            throw new Error('Document content and editor reference are required');
        }

        // Validate that editorRef is a ProseMirror editor view
        if (!editorRef.state || !editorRef.dispatch || !editorRef.dom) {
            throw new Error('Invalid editor reference. Expected ProseMirror editor view.');
        }

        checkUserPermission();
        
        try {
            // Step 1: Generate AI comments
            const aiComments = await this.GenerateComments(documentContent);
            
            if (!aiComments || aiComments.length === 0) {
                return {
                    success: true,
                    commentsCreated: 0,
                    marksAdded: 0,
                    marksFailed: 0,
                    details: {
                        created: [],
                    }
                };
            }
            
            let commentsCreated = [];
            let marksAdded = 0;
            let marksFailed = 0;
            
            // Step 2: Process each AI comment
            for (const comment of aiComments) {
                try {
                    // Create the comment in the store
                    const createdComment = await this.CreateComments(comment);
                    
                    // Validate that the comment was created successfully
                    if (!createdComment || !createdComment.id) {
                        console.error('Comment creation failed - no ID returned:', createdComment);
                        continue;
                    }
                    
                    commentsCreated.push(createdComment);
                    
                    // Add visual mark to the editor
                    if (createdComment.selectedText) {
                        console.log(`Adding mark for comment "${createdComment.id}" with text "${createdComment.selectedText}"`);
                        const markSuccess = await addCommentMarkToText(
                            editorRef, 
                            createdComment.selectedText, 
                            createdComment.id, 
                            null, // startPos - will be found automatically
                            false // resolved
                        );
                        
                        if (markSuccess) {
                            marksAdded++;
                            console.log(`Successfully added mark for comment "${createdComment.id}"`);
                        } else {
                            marksFailed++;
                            console.warn(`Failed to add visual mark for comment "${createdComment.id}" with text "${createdComment.selectedText}"`);
                        }
                    } else {
                        console.warn(`Comment "${createdComment.id}" has no selectedText, skipping mark creation`);
                    }
                } catch (commentError) {
                    console.error('Error processing individual comment:', commentError);
                    // Continue with other comments even if one fails
                }
            }

            logUsage(useMainStore().user.uid, 'generatedInlineComments');

            return {
                success: true,
                commentsCreated: commentsCreated.length,
                marksAdded: marksAdded,
                marksFailed: marksFailed,
                details: {
                    created: commentsCreated,
                }
            };

        } catch (error) {
            console.error('Error in createInlineComments:', error);
            throw error;
        }
    }
}

export class Generate{
    constructor(value){
        this.prompt = value.prompt,
        Object.assign(this, addInDefaults(this));
    }
    
    static async generateContent(value){
        checkUserPermission() 
        const documentContext = useMainStore().selected

        const genModel = getGenerativeModel(vertexAI, { 
            model: model ,
            systemInstruction: {
                role: 'system',
                parts: [{
                    "text": systemPrompts.assistantGenerateContent        
                    
                }, {
                    "text" : JSON.stringify(documentContext)
                }
            ]
            }
          });

        logUsage(useMainStore().user.uid, 'generateContent');
    
        const result = await genModel.generateContentStream(value.prompt);
        return result
    }

    static async generateDocumentTemplate(value){
        checkUserPermission() 
        const genModel = getGenerativeModel(vertexAI, { 
            model: model ,
            systemInstruction: {
                role: 'system',
                parts: [{
                    "text":  systemPrompts.assistantDocumentTemplate
                }, {
                    "text" : `{'documents': ${JSON.stringify(useMainStore().documents)}}`
                }
            ]
            }
          });

        logUsage(useMainStore().user.uid, 'generateDocumentTemplate');
    
        const result = await genModel.generateContent(value.prompt);
        
        // Clean up the response to remove any markdown code block wrapping
        const originalText = result.response.text();
        const cleanedText = this._cleanMarkdownCodeBlocks(originalText);
        
        // Return a modified result object with the cleaned text
        return {
            ...result,
            response: {
                ...result.response,
                text: () => cleanedText
            }
        };
    }

    // Helper method to clean markdown code blocks from template responses
    static _cleanMarkdownCodeBlocks(text) {
        if (!text) return text;
        
        // Remove markdown code blocks with various language identifiers
        let cleaned = text
            // Remove opening code blocks: ```markdown, ```md, ```text, or just ```
            .replace(/^```(?:markdown|md|text)?\s*\n?/gim, '')
            // Remove closing code blocks
            .replace(/\n?```\s*$/gim, '')
            // Also handle cases where there might be multiple code block patterns
            .replace(/```(?:markdown|md|text)?\s*\n?([\s\S]*?)\n?```/gim, '$1');
        
        // Trim any extra whitespace
        cleaned = cleaned.trim();
        
        // Remove first line if it starts with markdown heading (# or ##)
        const lines = cleaned.split('\n');
        if (lines.length > 0 && lines[0].trim().match(/^#{1,6}\s/)) {
            lines.shift(); // Remove the first line
            cleaned = lines.join('\n').trim();
        }
        
        return cleaned;
    }
}


export class Chat {
    // this is a back and forth chat with the "product mentor"

    constructor() {
        //this.initChat(); // Automatically initialize chat
    }

    async initChat(history = null) {
        if (useMainStore().project.id === null) {
            await useMainStore().userEnter();
        }

        checkUserPermission();

        let documents = null;


        if (useMainStore().documents.length === 0) {
            documents = `{'documents': ${JSON.stringify(await useMainStore().documentsGetAll())}}`; // Ensure this is awaited
        } else {
            documents = `{'documents': ${JSON.stringify(useMainStore().documents)}}`; // Get documents
        }

        this.generativeModel = getGenerativeModel(vertexAI, { 
            model: model,
            systemInstruction: {
                role: 'system',
                parts: [
                    {"text":  systemPrompts.productMentorChat
                },{
                    "text": JSON.stringify(documents)
                }
            ],
            }
        });

        if (history) {
            this.chat = this.generativeModel.startChat({
                history: history.history.data.messages.slice(1)
                    .filter(message => !message.isSystemMessage) // Filter out system messages
                    .map(message => ({
                        role: message.sent ? 'user' : 'model',
                        parts: [{ text: message.text }]
                    }))
            }); // Start the chat
        } else {
            this.chat = this.generativeModel.startChat()
        }

        return this.chat
    }

    async sendMessage(newMessage) {
        checkUserPermission() 
        if (!this.chat) {throw new Error("Chat has not been initialized.")}
        logUsage(useMainStore().user.uid, 'requestedMessage');

        const response = await this.chat.sendMessageStream(newMessage); // Return the response from the chat

        logUsage(useMainStore().user.uid, 'sentMessage');
        return response
    }

    async summarizeChat(message){
        checkUserPermission() 

        if (!this.chat) {
            throw new Error("Chat has not been initialized.");
        }

        const summaryModel = getGenerativeModel(vertexAI, { 
            model: model ,
            systemInstruction: systemPrompts.assistantChatNamer,
            maxOutputTokens: 25
          });

        return summaryModel.generateContent(message)
    }

}

export class Message {
    constructor(value){
        this.parts = value.parts
        this.role = value.role
        this.time = new Date().toISOString()
    }
}




export {vertexAI }