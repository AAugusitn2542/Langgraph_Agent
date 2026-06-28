from dotenv import load_dotenv
load_dotenv()
from langchain_anthropic import ChatAnthropic
from langchain.tools import tool
#The tool decorator is used to define a function as a tool that can be called by the model. 
# The tool decorator takes a function and adds metadata to it, such as the name of the tool and 
# its description. This allows the model to recognize the function as a tool and call it when needed.
model = ChatAnthropic(model="claude-sonnet-4-6")

@tool
def get_weather(location: str) -> str:
    """Get the weather at a location."""
    return f"It's sunny in {location}."

model_with_tools = model.bind_tools([get_weather])

response = model_with_tools.invoke("What's the weather like in Boston?")
for tool_call in response.tool_calls:
    print(f"Tool: {tool_call['name']}")
    print(f"Args: {tool_call['args']}")
