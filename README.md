# LangGraph Agent

A LangGraph agent that uses tool calling to perform arithmetic operations (add, multiply, divide) using Claude via the Anthropic API.

## Demo

![LangGraph Studio](agentic_workflow.png)

The agent receives a natural language request, decides which tool to call, executes it, and returns the result.

## How it works

1. **Model node** — Claude receives the user message and decides whether to call a tool
2. **Tool node** — executes the selected tool (add, multiply, or divide)
3. The model loops until no more tool calls are needed, then returns the final answer

## Tools

| Tool | Description |
|------|-------------|
| `add` | Adds two numbers |
| `multiply` | Multiplies two numbers |
| `divide` | Divides two numbers |

## Setup

1. Clone the repo
2. Install dependencies:
   ```
   pip install langchain langgraph langchain-anthropic langchain-core python-dotenv
   ```
3. Create a `.env` file:
   ```
   ANTHROPIC_API_KEY=your-key-here
   LANGSMITH_API_KEY=your-key-here
   ```
4. Run the agent:
   ```
   python main.py
   ```
5. Or run the LangGraph dev server:
   ```
   langgraph dev
   ```

## Stack

- [LangGraph](https://langchain-ai.github.io/langgraph/) — agent orchestration
- [LangChain](https://python.langchain.com/) — LLM tooling
- [Anthropic Claude](https://www.anthropic.com/) — language model
- [LangSmith](https://smith.langchain.com/) — tracing and observability
