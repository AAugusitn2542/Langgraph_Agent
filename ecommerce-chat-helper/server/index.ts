import 'dotenv/config'

import express, { Express, Request, Response } from "express"

import { MongoClient } from "mongodb"

import { callAgent } from './agent'

const app: Express = express();

import cors from 'cors'

app.use(cors());

app.use(express.json()); //so this allows us to parse JSON request bodies

const client = new MongoClient(process.env.MONGODB_ATLAS_URI as string)

async function connectToDatabase() {
  try {
    await client.connect() // Connect to MongoDB Atlas
    
    await client.db("admin").command({ ping: 1 }) // Ping the database to check connection
    
    console.log("Connected to MongoDB Atlas")
    
    app.get('/', (req: Request, res: Response) => {
      
        res.send("LangGraph API is running");
    })

    app.post('/chat', async (req: Request, res: Response) => {
        const initialMessage = req.body.message
        
        const threadId = Date.now().toString(); // Generate a unique thread ID based on the current timestamp
        
        console.log(initialMessage)
        try {
            const response = await callAgent(client, initialMessage, threadId)
            
            res.json({threadId, response})
        } catch (error) {
            console.error('Error staring conversation:', error);
            
            res.status(500).json({ error: 'Internal Server Error' }); 
            }
        }); //so what does this do? It calls the agent with the initial message and thread ID, then returns the response in JSON format.
        

        app.post('/chat/:threadId', async (req: Request, res: Response) => {
            const {threadId} = req.params
            
            const {message} = req.body // Extract the message from the request body
             
            try {
                const response = await callAgent(client, message, threadId)
                
                res.json({response})
            } catch (error) {
                console.error('Error in chat', error);
                
                res.status(500).json({ error: 'Internal server error' }) 
            } //so what does this do? It calls the agent with the message and thread ID, then returns the response in JSON format. 
        })
        
        const PORT = process.env.PORT || 8000
        
        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`)  
        })
    } catch (error) { 
        console.error('Error connecting to MongoDB Atlas:', error)
        process.exit(1) // Exit the process if connection fails
    }
}
connectToDatabase() // Call the function to connect to the database

        