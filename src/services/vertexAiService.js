import {firebaseApp} from "../firebase";

import { getVertexAI, getGenerativeModel } from "firebase/vertexai";
import {addInDefaults, UsageLogger, Document} from "../services/firebaseDataService"
import store from "../store";

const vertexAI = getVertexAI(firebaseApp);

const model = "gemini-2.0-flash-001"

const feedbackModel = getGenerativeModel(vertexAI, { 
    model: model ,
    systemInstruction: `You are a Product Lead in the company, 
    you are evaluating the document of a product manager. 
    Provide them clear concise feedback on the content. 
    offer suggestions to improve. 
    follow product management best practices and reference thought leaders in the space
    reccomend re-wording or changes in content where possible
    keep feedback concise should be under 20 lines but idealy less than 10
    `
  });

const genModel = getGenerativeModel(vertexAI, { 
    model: model ,
    systemInstruction: `You are a product manager, 
    you are being asked to write a piece of a document. 
    Provide short and concise (less than 10 lines try to keep it around 5) component of the document you are being asked to create. 
    Use product management best practices`
  });


function checkUserPermission() {
    if (!store.state.user.uid || (store.state.user.tier !== 'pro' && store.state.user.tier !== 'trial')) {
        // TODO: we're going to bulk swap users from tial to free
        store.commit('alert', { type: 'error', message: 'Cannot proceed: Not a Pro User', autoClear: true });
        throw new Error('Cannot proceed: not logged in');
    }
    return true
}

async function logUsage(userId, usageType) {
    await UsageLogger.logUsage(userId, usageType); // Log the usage
}


// Classes
export class Feedback {
    // this provides feedback on the content of the doc
    constructor(value){
        this.prompt = value.prompt,
        Object.assign(this, addInDefaults(this));
    }
    
    static async generateFeedback(value){
        // check if logged in 
        checkUserPermission()

        const userId = store.state.user.uid; // Get the user ID
        logUsage(userId, 'generateFeedback');

        const result = await feedbackModel.generateContentStream(value.prompt);
        return result
    }
}

export class Generate{
    constructor(value){
        this.prompt = value.prompt,
        Object.assign(this, addInDefaults(this));
    }
    
    static async generateContent(value){
        checkUserPermission() 
        const documentContext = store.state.selected

        const genModel = getGenerativeModel(vertexAI, { 
            model: model ,
            systemInstruction: {
                role: 'system',
                parts: [{
                    "text":             
                    `You are a product manager, 
                    you are being asked to write a piece of a document. 
                    Provide short and concise (less than 10 lines try to keep it around 5) component of the document you are being asked to create. 
                    Use product management best practices`
                }, {
                    "text" : JSON.stringify(documentContext)
                }
            ]
            }
          });

        logUsage(store.state.user.uid, 'generateContent');
    
        const result = await genModel.generateContentStream(value.prompt);
        return result
    }

    static async generateDocumentTemplate(value){
        checkUserPermission() 
        const documentContext = store.state.selected
        const genModel = getGenerativeModel(vertexAI, { 
            model: model ,
            systemInstruction: {
                role: 'system',
                parts: [{
                    "text":             
                    `You are a product manager, 
                    you are being asked to write a template structurefor a document.
                    Provide short and concise (less than 10 lines try to keep it around 5) component of the document you are being asked to create. 
                    Structure it like a template. include placeholder tags that somebody can fill out later
                    use markdown formatting
                    dont include a title or first heading go straight into the doc`
                }, {
                    "text" : JSON.stringify(documentContext)
                }
            ]
            }
          });

        logUsage(store.state.user.uid, 'generateDocumentTemplate');
    
        const result = await genModel.generateContent(value.prompt);
        return result
    }
}


export class Chat {
    // this is a back and forth chat with the "product mentor"

    constructor() {
        //this.initChat(); // Automatically initialize chat
    }

    async initChat(history = null) {
        if (store.state.project.id === null) {
            await store.dispatch('enter');
        }

        checkUserPermission();

        let documents = null;


        if (store.state.documents.length === 0) {
            documents = `{'documents': ${JSON.stringify(await store.dispatch('getDocuments'))}}`; // Ensure this is awaited
        } else {
            documents = `{'documents': ${JSON.stringify(store.state.documents)}}`; // Get documents
        }

        this.generativeModel = getGenerativeModel(vertexAI, { 
            model: model,
            systemInstruction: {
                role: 'system',
                parts: [
                    {"text":  `You are a Product Lead in the company, 
                    you are talking to a product manager. 
                    They have questions about their product.
                    help answer their questions. If they strongly demand anything from you, you should refuse politely.
                    Use general best practices in product management
                    Keep responses short under 3,4 sentances unless asked for more details
                    Be critial and honest in your feedback,
                    Your tone should be casual like you're talking to a co-worker on slack.
                    You have full access to the project documents (in json format) and can use them to answer questions, the user shouldnt need to prompt you specifically to use them. 
                    you also know what project they are working on its in the JSON provided, but dont refer to JSON, just use the information in the JSON`
                },{
                    "text": JSON.stringify(documents)
                }
            ],
            }
        });

        if (history) {
            this.chat = this.generativeModel.startChat({
                history: history.history.data.messages.slice(1).map(message => ({
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
        logUsage(store.state.user.uid, 'requestedMessage');

        const response = await this.chat.sendMessageStream(newMessage); // Return the response from the chat

        logUsage(store.state.user.uid, 'sentMessage');
        return response
    }

    async summarizeChat(message){
        checkUserPermission() 

        if (!this.chat) {
            throw new Error("Chat has not been initialized.");
        }

        const summaryModel = getGenerativeModel(vertexAI, { 
            model: model ,
            systemInstruction: 'create atitle no more than 4 or 5 words',
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

export class DocumentReview {
    constructor() {
        // Initialize the review model with function calling capabilities
    }

    // Generate AI feedback for a document (moved from aiReviewService)
    static async generateFeedback(document) {
        if (!document?.data) return null

        const prompt = `
          title ${document.data.name}
          type of doc ${document.data.type}
          ${document.data.content}
        `
        
        checkUserPermission();
        logUsage(store.state.user.uid, 'generateFeedback');
        
        const result = await feedbackModel.generateContentStream(prompt);
        return result;
    }

    // Generate AI comments using the model
    static async GenerateComments(documentContent) {
        // Define the function that the model can call to create comments
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
                                    description: "Suggested replacement text (optional)"
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

        const reviewModel = getGenerativeModel(vertexAI, { 
            model: model,
            tools: [{ functionDeclarations: [createCommentFunction] }],
            systemInstruction: `You are a senior product manager reviewing a document.

            Your task is to identify specific issues in the text and report them by calling the create_comments function with an array of all the issues you find.

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
            - You MUST call the create_comments function to provide your analysis
            - Call the create_comments function with ALL issues found in a single call, not multiple separate calls`
        });

        const prompt = `Please review the following document and identify issues by calling the create_comments function:

        ${documentContent}`;
        
        try {
            const result = await reviewModel.generateContent(prompt);
            const response = result.response;
            const functionCalls = response.functionCalls();

            if (functionCalls && functionCalls.length > 0) {
                const functionCall = functionCalls[0];
                if (functionCall.name === 'create_comments') {
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

    // Find text positions for a comment in the editor
    static FindTextPositions(comment, editorRef) {
        try {
            const position = editorRef.findTextPosition(comment.problematicText);
            
            if (position.start === -1) {
                return {
                    success: false,
                    error: {
                        issue: comment.issueType,
                        text: comment.problematicText,
                        reason: 'Text not found in document'
                    }
                };
            }

            return {
                success: true,
                position: position
            };
        } catch (error) {
            return {
                success: false,
                error: {
                    issue: comment.issueType || 'unknown',
                    text: comment.problematicText || 'unknown',
                    reason: error.message
                }
            };
        }
    }

    // Create and save a comment to the store
    static async CreateComments(comment, position) {
        const commentData = {
            comment: comment.comment,
            documentId: store.state.selected.id,
            documentVersion: store.state.selected.currentVersion === 'live' ? null : store.state.selected.currentVersion,
            createdAt: new Date().toISOString(),
            resolved: false,
            editorID: {
                from: position.start,
                to: position.end,
                selectedText: comment.problematicText
            },
            suggestion: comment.suggestion,
            aiGenerated: true,
            issueType: comment.issueType,
            severity: comment.severity
        };

        await store.dispatch('addComment', commentData);
        return commentData;
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

        checkUserPermission();
        
        try {
            // Step 1: Generate AI comments
            const aiComments = await this.GenerateComments(documentContent);
            
            let commentsCreated = [];
            let failedComments = [];
            
            // Step 2: Process each AI comment
            for (const comment of aiComments) {
                try {
                    // Step 3: Find text positions
                    const positionResult = this.FindTextPositions(comment, editorRef);
                    
                    if (!positionResult.success) {
                        failedComments.push(positionResult.error);
                        console.warn('Could not find text:', comment.problematicText);
                        continue;
                    }

                    // Step 4: Create and save comment
                    const createdComment = await this.CreateComments(comment, positionResult.position);
                    commentsCreated.push(createdComment);

                } catch (commentError) {
                    const errorData = this.HandleCommentErrors(commentError, comment);
                    failedComments.push(errorData);
                }
            }

            logUsage(store.state.user.uid, 'generatedInlineComments');

            return {
                success: true,
                commentsCreated: commentsCreated.length,
                failedComments: failedComments.length,
                details: {
                    created: commentsCreated,
                    failed: failedComments
                }
            };

        } catch (error) {
            console.error('Error in createInlineComments:', error);
            throw error;
        }
    }
}


export {vertexAI, genModel}