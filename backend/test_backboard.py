import argparse
import json
import sys
import requests


def main():
    parser = argparse.ArgumentParser(description="Test Backboard chat endpoint")
    parser.add_argument("--message", default="Hello!", help="Message to send")
    parser.add_argument("--provider", default="openai", help="LLM provider (openai/anthropic/mistral)")
    parser.add_argument("--model", default="gpt-5", help="Model name for provider")
    parser.add_argument("--url", default="http://localhost:5001/api/backboard/chat", help="Endpoint URL")
    args = parser.parse_args()

    payload = {
        "message": args.message,
        "provider": args.provider,
        "model": args.model,
    }

    try:
        resp = requests.post(args.url, json=payload, timeout=60)
    except Exception as e:
        print(f"Request failed: {e}")
        sys.exit(1)

    print(f"Status: {resp.status_code}")
    try:
        data = resp.json()
        print(json.dumps(data, indent=2))
    except requests.exceptions.JSONDecodeError:
        print("Non-JSON response body:")
        print(resp.text)


if __name__ == "__main__":
    main()