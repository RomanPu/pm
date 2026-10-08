from google import genai

MODEL = "gemini-3.8-flash"


def ask(prompt: str) -> str:
    # genai.Client reads GEMINI_API_KEY from the environment
    client = genai.Client()
    response = client.models.generate_content(model=MODEL, contents=prompt)
    return response.text
