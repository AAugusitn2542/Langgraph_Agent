import os
os.environ["ANTHROPIC_API_KEY"] =""


from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage

model = ChatAnthropic(model="claude-sonnet-4-6")

response = model.invoke([HumanMessage("What is 3 + 4?")])
print(response.content)
