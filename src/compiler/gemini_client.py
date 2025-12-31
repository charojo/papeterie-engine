import os
from google import genai
from google.genai import types
from dotenv import load_dotenv
from .token_logger import log_token_usage

load_dotenv()

class GeminiCompilerClient:
    def __init__(self, model_name="gemini-2.5-flash"): 
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY not found in .env file")
        
        # Initialize client with explicit v1beta version if needed
        self.client = genai.Client(
            api_key=api_key,
            http_options=types.HttpOptions(api_version="v1beta")
        )
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

        # Log usage to ledger
        if hasattr(response, 'usage_metadata') and response.usage_metadata:
            usage = response.usage_metadata
            log_token_usage(
                model_name=self.model_name,
                prompt_tokens=usage.prompt_token_count,
                candidate_tokens=usage.candidates_token_count,
                total_tokens=usage.total_token_count,
                task_name="compiler_metadata_generation"
            )
            
        return response.text


    def edit_image(self, input_image_path: str, prompt: str, system_instruction: str = None) -> bytes:
        """
        Refines a sprite using Gemini 3 Pro Image (Preview).
        """
        try:
            from PIL import Image
            img = Image.open(input_image_path)
            
            # Using Gemini 3 Pro Image Preview as requested
            model_name = "gemini-3-pro-image-preview"
            
            final_prompt = prompt
            if system_instruction:
                 final_prompt = f"{system_instruction}\n\nTask: {prompt}"
            
            # Contents: [Text, Image]
            contents = [final_prompt, img]
            
            print(f"DEBUG: calling generate_content with model={model_name} and response_modalities=['TEXT', 'IMAGE']")
            
            response = self.client.models.generate_content(
                model=model_name,
                contents=contents,
                config=types.GenerateContentConfig(
                    response_modalities=['TEXT', 'IMAGE'],
                    image_config=types.ImageConfig(aspect_ratio="1:1")
                )
            )
            
            # Log usage
            if hasattr(response, 'usage_metadata') and response.usage_metadata:
                usage = response.usage_metadata
                log_token_usage(
                    model_name=model_name,
                    prompt_tokens=usage.prompt_token_count,
                    candidate_tokens=usage.candidates_token_count,
                    total_tokens=usage.total_token_count,
                    task_name="edit_image"
                )
            
            # Extract Image from response
            if not response.candidates:
                 raise ValueError(f"No candidates returned. Text: {response.text}")
                 
            candidate = response.candidates[0]
            
            # Defensive checks for structure
            if not candidate.content or not candidate.content.parts:
                raise ValueError(f"Gemini returned candidate but no content/parts. Finish reason: {candidate.finish_reason}")

            # Check for inline_data (image)
            image_data = None
            text_explanation = []

            for part in candidate.content.parts:
                if hasattr(part, 'inline_data') and part.inline_data:
                    print("DEBUG: Found generated inline_data (image)")
                    image_data = part.inline_data.data
                elif hasattr(part, 'text') and part.text:
                    text_explanation.append(part.text)
            
            if image_data:
                return image_data
            
            # If no image found, return the text explanation as the error
            full_explanation = "\n".join(text_explanation)
            print(f"DEBUG: Model returned text explanation: {full_explanation[:200]}...")
            raise ValueError(f"Model returned text instead of image (Refusal?). Explanation: {full_explanation}")
            
        except Exception as e:
            print(f"Image generation failed: {e}")
            import traceback
            traceback.print_exc()
            raise e