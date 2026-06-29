import os
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send"
]

def get_gmail_service():
    creds = None

    if os.path.exists("token.json"):
        creds = Credentials.from_authorized_user_file("token.json", SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file("../credentials.json", SCOPES)
            creds = flow.run_local_server(port=0)

        with open("token.json", "w") as token:
            token.write(creds.to_json())

    return build("gmail", "v1", credentials=creds)


def read_email(max_result=5):
    service = get_gmail_service()
    results = service.users().messages().list(userId="me", 
                                    labelIds=["INBOX"], 
                                    q="is:unread",
                                    maxResults=max_result
                                    ).execute()
    messages = results.get("messages", [])
    email_contents = []

    for message in messages:
        msg = service.users().messages().get(userId="me", 
                                             id=message["id"],
                                             format="full"
                                             ).execute()
        
        headers = message["payload"]["headers"]
        subject = next((h["value"] for h in headers if h["name"] == "Subject"), "No Subject")
        sender = next((h["value"] for h in headers if h["name"] == "From"), "Unknown")
        
        body = ""
        if "parts" in message["payload"]:
            for part in message["payload"]["parts"]:
                if part["mimeType"] == "text/plain":
                    import base64
                    body = base64.urlsafe_b64decode(part["body"]["data"]).decode("utf-8")
                    break
        
        email_contents.append({
            "id": msg["id"],
            "subject": subject,
            "sender": sender,
            "body": body[:500]
        })
    
    return email_contents

        
if __name__ == "__main__":
    service = get_gmail_service()
    print("Connected to Gmail successfully!")
    read_email()







"""

def read_email(state: EmailAgentState) -> dict:
    Extract and parse email content
    # In production, this would connect to your email service
    return {
        "messages": [HumanMessage(content=f"Processing email: {state['email_content']}")]
    }
def send_email(state: EmailAgentState) -> dict:
    Send the draft response to the customer
    # In production, this would connect to your email service
    return {
        "messages": [HumanMessage(content=f"Sending email: {state['draft_response']}")]
    }
"""
