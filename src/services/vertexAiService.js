import {firebaseApp} from "../firebase";

import { getVertexAI, getGenerativeModel } from "firebase/vertexai-preview";
import {addInDefaults, UsageLogger, Document} from "../services/firebaseDataService"
import store from "../store";

const vertexAI = getVertexAI(firebaseApp);

const feedbackModel = getGenerativeModel(vertexAI, { 
    model: "gemini-1.5-flash" ,
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
    model: "gemini-1.5-flash" ,
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
            model: "gemini-1.5-flash" ,
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
            model: "gemini-1.5-flash" ,
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
            console.log("loading documents");
            documents = `{'documents': ${JSON.stringify(await store.dispatch('getDocuments'))}}`; // Ensure this is awaited
        } else {
            documents = `{'documents': ${JSON.stringify(store.state.documents)}}`; // Get documents
        }

        

        this.generativeModel = getGenerativeModel(vertexAI, { 
            model: "gemini-1.5-flash",
            systemInstruction: {
                role: 'system',
                parts: [
                    {"text":  `You are a Product Lead in the company, 
                    you are talking to a product manager. 
                    They have questions about their product.
                    help answer their questions. 
                    Use general best practices in product management
                    Keep responses short under 3,4 sentances unless asked for more details
                    Be critial and honest
                    You have full access to the project documents (in json format) and can use them to answer questions, the user shouldnt need to prompt you specifically to use them`
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

        return response
    }

    async summarizeChat(message){
        checkUserPermission() 

        if (!this.chat) {
            throw new Error("Chat has not been initialized.");
        }

        const summaryModel = getGenerativeModel(vertexAI, { 
            model: "gemini-1.5-flash" ,
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



export {vertexAI, genModel}