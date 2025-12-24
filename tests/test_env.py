import os
from dotenv import load_dotenv

def test_env_loading():
    """Verify that the API key is accessible and not empty."""
    # We explicitly load to see if it's found
    load_dotenv() 
    api_key = os.getenv("GEMINI_API_KEY")
    
    assert api_key is not None, "GEMINI_API_KEY is missing from environment"
    assert api_key.startswith("AIza"), "GEMINI_API_KEY does not look like a valid Google API key"
    
    # Optional: Verify PYTHONPATH is set for the engine
    #python_path = os.getenv("PYTHONPATH")
    #assert "src" in str(python_path), "PYTHONPATH should include 'src' for package discovery"
