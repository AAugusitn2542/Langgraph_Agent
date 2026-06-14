import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai" // For creating vector embeddings from text using Gemini
import { ChatGoogleGenerativeAI } from "@langchain/google-genai" // Google's Gemini AI model
import { AIMessage, BaseMessage, HumanMessage } from "@langchain/core/messages" // Message types for conversations
import {
  ChatPromptTemplate,      // For creating structured prompts with placeholders
  MessagesPlaceholder,     // Placeholder for dynamic message history
} from "@langchain/core/prompts"
import { StateGraph } from "@langchain/langgraph"              // State-based workflow orchestration
import { Annotation } from "@langchain/langgraph"              // Type annotations for state management
import { tool } from "@langchain/core/tools"                   // For creating custom tools/functions
import { ToolNode } from "@langchain/langgraph/prebuilt"       // Pre-built node for executing tools
import { MongoDBSaver } from "@langchain/langgraph-checkpoint-mongodb" // For saving conversation state
import { MongoDBAtlasVectorSearch } from "@langchain/mongodb"   // Vector search integration with MongoDB
import { MongoClient } from "mongodb"                          // MongoDB database client
import { z } from "zod"                                        // Schema validation library
import "dotenv/config"                                         // Load environment variables from .env file


async function retryWithBackoff<T> (
    fn :() => Promise<T>,
    maxRetries = 3,

): Promise<T> {

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error: any) {
            if (error.status === 429 && attempt < maxRetries) {
                const delay = Math.min(1000 * Math.pow(2, attempt), 3000)
                console.error(`Rate limit hit. Retrying in ${delay/1000} seconds...`)
                await new Promise(resolve => setTimeout(resolve, delay))
                continue
            }
                throw error;
        }
    }
    throw new Error("Max retries exceeded");
}

export async function callAgent(client: MongoClient, query: string, thread_id: string) {
  try {
    // Database configuration
    const dbName = "inventory_database"        // Name of the MongoDB database
    const db = client.db(dbName)              // Get database instance
    const collection = db.collection("items") // Get the 'items' collection

    // Define the state structure for the agent workflow
    const GraphState = Annotation.Root({
      messages: Annotation<BaseMessage[]>({
        // Reducer function: how to combine old and new messages
        reducer: (x, y) => x.concat(y), // Simply concatenate old messages (x) with new messages (y)
      }),
    })

    // Create a custom tool for searching furniture inventory
    const itemLookupTool = tool(
      // The actual function that will be executed when tool is called
      async ({ query, n = 10 }) => {
        try {
          console.log("Item lookup tool called with query:", query)

          // Check if database has any data at all
          const totalCount = await collection.countDocuments()
          console.log(`Total documents in collection: ${totalCount}`)

          // Early return if database is empty
          if (totalCount === 0) {
            console.log("Collection is empty")
            return JSON.stringify({ 
              error: "No items found in inventory", 
              message: "The inventory database appears to be empty",
              count: 0 
            })
          }

          // Get sample documents for debugging purposes
          const sampleDocs = await collection.find({}).limit(3).toArray()
          console.log("Sample documents:", sampleDocs)

          // Configuration for MongoDB Atlas Vector Search
          const dbConfig = {
            collection: collection,           // MongoDB collection to search
            indexName: "vector_index",       // Name of the vector search index
            textKey: "embedding_text",       // Field containing the text used for embeddings
            embeddingKey: "embeddings",       // Field containing the vector embeddings
          }


            const vectorStore = new MongoDBAtlasVectorSearch(
                new GoogleGenerativeAIEmbeddings({
                    apiKey: process.env.GOOGLE_API_KEY,
                    modelName: "text-embedding-004",
                }),
                dbConfig
            )
            console.log("Vector search initialized with configuration:")
            const results = await vectorStore.similaritySearch(query, n);
            console.log(`Vector search returned ${results.length} results.`)

            if (results.length === 0) {
                console.log("Vector search returned no results, trying text search...")

                const textResults = await collection.find({
                $or:[
                  { item_name: {$regex: query, $options: "i"} },
                  { item_description: {$regex: query, $options: 'i' } },
                  { embedding_text: {$regex: query, $options: 'i'} },
                  { categories: {$regex: query, $options: 'i'} },
        ]
    }).limit(n).toArray();
        
        console.error(`Text search returned results: ${textResults.length} textResults`);
        // I stopped at 55:27
         return JSON.stringify({
              results: textResults,
              searchType: "text",    // Indicate this was a text search
              query: query,
              count: textResults.length
            })
          }

          return JSON.stringify({
              results: results, // change this to results
              searchType: "vector",
              query: query,
              count: results.length,
        })
            } catch (error: any) {
                console.error("Error during item lookup:", error)
                console.error("Error details:", {
                    message: error.message,
                    stack: error.stack,
                    name: error.name
                })
                return JSON.stringify({
                    error: "Failed to search inventory",
                    details: error.message,
                    query: query,
                })
            }
        },
        
        {
            name:"item_lookup",
            description: "Gathers furinture item information from the inventory database. Input should be a search query for the item. Output is a JSON array of items matching the query.",
            schema: z.object({
                query: z.string().describe("Search query for the item"),
                n: z.number().optional().default(10)
                .describe("Number of results to return")
        }),
      }
    )
    const tools = [itemLookupTool]
    
    const toolNode = new ToolNode<typeof GraphState.State>(tools)

    const model = new ChatGoogleGenerativeAI({
        model: "gemini-1.5-flash",
        temperature: 0,
        maxRetries: 0,
        apiKey: process.env.GOOGLE_API_KEY,
    }).bindTools(tools)

     function shouldContinue(state: typeof GraphState.State) {
      const messages = state.messages                               // Get all messages
      const lastMessage = messages[messages.length - 1] as AIMessage // Get the most recent message

      // If the AI wants to use tools, go to tools node; otherwise end
      if (lastMessage.tool_calls?.length) {
        return "tools"  // Route to tool execution
      }
      return "__end__"  // End the workflow
    }

    // Function that calls the AI model with retry logic
    async function callModel(state: typeof GraphState.State) {
      return retryWithBackoff(async () => { // Wrap in retry logic
        // Create a structured prompt template
        const prompt = ChatPromptTemplate.fromMessages([
          [
            "system", // System message defines the AI's role and behavior
            `You are a helpful E-commerce Chatbot Agent for a furniture store. 

IMPORTANT: You have access to an item_lookup tool that searches the furniture inventory database. ALWAYS use this tool when customers ask about furniture items, even if the tool returns errors or empty results.

When using the item_lookup tool:
- If it returns results, provide helpful details about the furniture items
- If it returns an error or no results, acknowledge this and offer to help in other ways
- If the database appears to be empty, let the customer know that inventory might be being updated

Current time: {time}`,
          ],
          new MessagesPlaceholder("messages"), // Placeholder for conversation history
        ])

        // Fill in the prompt template with actual values
        const formattedPrompt = await prompt.formatMessages({
          time: new Date().toISOString(), // Current timestamp
          messages: state.messages,       // All previous messages
        })

        // Call the AI model with the formatted prompt
        const result = await model.invoke(formattedPrompt)
        // Return new state with the AI's response added
        return { messages: [result] }
      })
    }

    // Build the workflow graph
    const workflow = new StateGraph(GraphState)
      .addNode("agent", callModel)                    // Add AI model node
      .addNode("tools", toolNode)                     // Add tool execution node
      .addEdge("__start__", "agent")                  // Start workflow at agent
      .addConditionalEdges("agent", shouldContinue)   // Agent decides: tools or end
      .addEdge("tools", "agent")                      // After tools, go back to agent

    // Initialize conversation state persistence
    const checkpointer = new MongoDBSaver({ client, dbName })
    // Compile the workflow with state saving
    const app = workflow.compile({ checkpointer })

    // Execute the workflow
    const finalState = await app.invoke(
      {
        messages: [new HumanMessage(query)], // Start with user's question
      },
      { 
        recursionLimit: 15,                   // Prevent infinite loops
        configurable: { thread_id: thread_id } // Conversation thread identifier
      }
    )

    // Extract the final response from the conversation
    const response = finalState.messages[finalState.messages.length - 1].content
    console.log("Agent response:", response)

    return response // Return the AI's final response

  } catch (error: any) {
    // Handle different types of errors with user-friendly messages
    console.error("Error in callAgent:", error.message)
    
    if (error.status === 429) { // Rate limit error
      throw new Error("Service temporarily unavailable due to rate limits. Please try again in a minute.")
    } else if (error.status === 401) { // Authentication error
      throw new Error("Authentication failed. Please check your API configuration.")
    } else { // Generic error
      throw new Error(`Agent failed: ${error.message}`)
    }
  }
}