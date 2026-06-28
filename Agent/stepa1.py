from dataclasses import dataclass
from langchain.agents import create_agent
from langchain_core.utils.uuid import uuid7
from langgraph.checkpoint.memory import InMemorySaver
from dotenv import load_dotenv
load_dotenv()

@dataclass
class Context:
    user_id: str


agent = create_agent(
    model="anthropic:claude-sonnet-4-6",
    tools=[],
    name="WeatherAgent",
    context_schema=Context,
    checkpointer=InMemorySaver(),
)

result = agent.invoke(
    {"messages": [{"role": "user", "content": "What's the weather in San Francisco?"}]},
    config={"configurable": {"thread_id": str(uuid7())}},
    context=Context(user_id="user-123"),
)
print(result["messages"][-1].content)
