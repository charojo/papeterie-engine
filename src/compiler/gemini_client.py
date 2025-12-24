import os
from google import genai
from dotenv import load_dotenv

load_dotenv()

class GeminiCompilerClient:
    def __init__(self, model_name="gemini-2.5-flash"): #"gemini-1.5-flash"):
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY not found in .env file")
        
        # Initialize with the API key
        self.client = genai.Client(api_key=api_key)
        # Note: If 'gemini-1.5-flash' fails, try 'gemini-1.5-flash-latest'
        self.model_name = model_name

    def generate_metadata(self, system_instruction: str, user_prompt: str) -> str:
        # Use the config parameter correctly for system instructions
        response = self.client.models.generate_content(
            model=self.model_name,
            contents=user_prompt,
            config={
                "system_instruction": system_instruction,
                "response_mime_type": "application/json"
            }
        )
        
        if not response.text:
            raise ValueError("Gemini returned an empty response. Check API usage limits.")
            
        return response.text