import argparse
import json
import sys
import urllib.request
import urllib.error


def main():
    parser = argparse.ArgumentParser(description="Test Backboard chat endpoint")
    parser.add_argument("--user-id", default="dev-user", help="Required user_id for chat")
    parser.add_argument("--message", default="Hello!", help="Message to send")
    parser.add_argument("--route-mode", default="auto", choices=["auto", "manual"], help="Routing mode")
    parser.add_argument("--provider", default="openai", help="LLM provider (manual mode)")
    parser.add_argument("--model", default="gpt-5-chat-latest", help="Model name for provider (manual mode)")
    parser.add_argument("--url", default="http://localhost:5001/api/backboard/chat", help="Endpoint URL")
    args = parser.parse_args()

    payload = {
        "user_id": args.user_id,
        "message": args.message,
        "route_mode": args.route_mode,
    }

    if args.route_mode == "manual":
        payload["provider"] = args.provider
        payload["model"] = args.model

    try:
        req = urllib.request.Request(
            args.url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=60) as resp:
            status = resp.status
            body = resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        status = getattr(e, "code", 0) or 0
        body = e.read().decode("utf-8", errors="replace") if hasattr(e, "read") else str(e)
    except Exception as e:
        print(f"Request failed: {e}")
        sys.exit(1)

    print(f"Status: {status}")
    try:
        data = json.loads(body)
        print(json.dumps(data, indent=2))
    except json.JSONDecodeError:
        print("Non-JSON response body:")
        print(body)


if __name__ == "__main__":
    main()