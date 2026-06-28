from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from langchain_anthropic import ChatAnthropic
from dotenv import load_dotenv
load_dotenv()



model = ChatAnthropic(model="claude-sonnet-4-6")

system_msg = SystemMessage("You are a helpful coding assistant.")

messages = [
    {"role": "system", "content": "How do I create a REST API?"},
    {"role": "user", "content": "How do I create a REST API?"}
]
response = model.invoke(messages)
print(response.content)