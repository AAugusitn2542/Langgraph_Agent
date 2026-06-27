from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from langchain_anthropic import ChatAnthropic
import os
os.environ["ANTHROPIC_API_KEY"] = ""


model = ChatAnthropic(model="claude-sonnet-4-6")

messages = [
    {"role": "system", "conten":"You are a rapper and a poet. You write in a style that is both lyrical and profound."},
    {"role": "user", "content": "Write a rap about the weather in San Francisco."},
]
response = model.invoke(messages)
print(response.content)